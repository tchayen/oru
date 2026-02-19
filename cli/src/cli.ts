import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { Command, Option, Help } from "commander";
import type Database from "better-sqlite3";
import { TaskService } from "./main";
import { createKysely } from "./db/kysely";
import { openDb } from "./db/connection";
import { initSchema } from "./db/schema";
import {
  formatTaskText,
  formatTasksText,
  formatLabelsText,
  formatLogText,
  filterByDue,
  formatContextText,
  type DueFilter,
} from "./format/text";
import {
  formatTaskJson,
  formatTasksJson,
  formatLabelsJson,
  formatLogJson,
  formatContextJson,
} from "./format/json";
import { SyncEngine } from "./sync/engine";
import { FsRemote } from "./sync/fs-remote";
import { getDeviceId } from "./device";
import {
  loadConfig,
  getConfigPath,
  setConfigValue,
  DEFAULT_CONFIG_TOML,
  type Config,
} from "./config/config";
import { parseDate } from "./dates/parse";
import { serializeTask, parseDocument, openInEditor, cleanupTmpFile } from "./edit";
import { STATUSES, PRIORITIES, type Status, type Priority } from "./tasks/types";
import { parseRecurrence, formatRecurrence } from "./recurrence/index";
import { SHOW_SERVER } from "./flags";
import { AmbiguousPrefixError, SORT_FIELDS, type SortField } from "./tasks/repository";
import {
  resolveDynamic,
  generateBashCompletions,
  generateZshCompletions,
  generateFishCompletions,
  detectShell,
  installCompletions,
  confirm,
  formatSuccessMessage,
} from "./completions/index";
import { bold, dim, white } from "./format/colors";
import { loadFilters, saveFilters, applyFilter, type FilterDefinition } from "./filters/filters";
import { isTelemetryEnabled, getTelemetryDisabledReason } from "./telemetry/telemetry";
import { performBackup } from "./backup";
import { isValidId } from "./id";
import {
  sanitizeTitle,
  validateTitle as checkTitle,
  validateNote as checkNote,
  validateLabels as checkLabels,
  MAX_LABELS,
  MAX_BLOCKED_BY,
  MAX_METADATA_KEYS,
  MAX_METADATA_KEY_LENGTH,
  MAX_METADATA_VALUE_LENGTH,
} from "./validation";

import { VERSION, GIT_COMMIT } from "./version";
function parseMetadata(pairs: string[]): Record<string, string | null> {
  const meta: Record<string, string | null> = {};
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) {
      if (pair.trim()) {
        meta[pair.trim()] = null;
      }
      continue;
    }
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1);
    if (key) {
      meta[key] = value;
    }
  }
  return meta;
}

function highlightInlineCommands(text: string): string {
  // Highlight command examples like "update -s done" in descriptions
  return text.replace(/\b(update -s \w+)\b/g, (_, cmd) => white(cmd));
}

function colorizeHelp(text: string): string {
  let section = "";
  return text
    .split("\n")
    .map((line) => {
      // Section headers: "Options:", "Commands:", "Arguments:"
      if (/^(Options|Commands|Arguments):$/.test(line)) {
        section = line.slice(0, -1).toLowerCase();
        return bold(line);
      }
      // Usage line: "Usage: oru [options] [command]"
      if (line.startsWith("Usage: ")) {
        section = "";
        return bold("Usage:") + " " + line.slice(7);
      }
      // Non-indented non-empty lines reset section (e.g. description text)
      if (line.trim() !== "" && !line.startsWith(" ")) {
        section = "";
        return line;
      }
      // Indented entries with descriptions (commands or options)
      const entryMatch = line.match(/^(\s{2})(\S.*?)(\s{2,})(.*)/);
      if (entryMatch) {
        const [, indent, term, pad, desc] = entryMatch;
        if (term.startsWith("-")) {
          return indent + bold(term) + pad + desc;
        }
        return indent + white(term) + pad + dim(highlightInlineCommands(desc));
      }
      // Continuation lines (deeply indented) in the commands section
      if (section === "commands" && line.match(/^\s{4,}\S/)) {
        return dim(highlightInlineCommands(line));
      }
      return line;
    })
    .join("\n");
}

const helpConfig = {
  formatHelp(cmd: Command, helper: Help) {
    const text = Help.prototype.formatHelp.call(helper, cmd, helper);
    return colorizeHelp(text);
  },
};

function applyHelpColors(cmd: Command): void {
  cmd.configureHelp(helpConfig);
  for (const sub of cmd.commands) {
    applyHelpColors(sub);
  }
}

export function createProgram(
  db: Database.Database,
  write: (text: string) => void = (t) => process.stdout.write(t + "\n"),
  config?: Config,
  writeErr: (text: string) => void = (t) => process.stderr.write(t),
): Command {
  const resolvedConfig = config ?? loadConfig();
  const ky = createKysely(db);
  const deviceId = getDeviceId(db);
  const service = new TaskService(ky, deviceId);
  const program = new Command("oru")
    .description(
      `${bold("oru")} - personal task manager that your agents can operate for you\n\nUse --json on any command for machine-readable output (or set ORU_FORMAT=json, or output_format in config). Run 'oru config init' to create a config file. Set ORU_DEBUG=1 for verbose error output.`,
    )
    .version(`${VERSION} (${GIT_COMMIT})`);

  program.configureOutput({
    writeOut: write,
    writeErr: write,
  });

  // Override exit to not actually exit during tests
  program.exitOverride();

  function useJson(opts: { json?: boolean; plaintext?: boolean }): boolean {
    if (opts.plaintext) {
      return false;
    }
    return !!(
      opts.json ||
      process.env.ORU_FORMAT === "json" ||
      resolvedConfig.output_format === "json"
    );
  }

  function handleAmbiguousPrefix(err: AmbiguousPrefixError, json: boolean): void {
    if (json) {
      write(
        JSON.stringify({
          error: "ambiguous_prefix",
          id: err.prefix,
          matches: err.matches,
        }),
      );
    } else {
      write(`Prefix '${err.prefix}' is ambiguous, matches: ${err.matches.join(", ")}.`);
    }
    process.exitCode = 1;
  }

  function validationError(json: boolean, message: string): void {
    if (json) {
      write(JSON.stringify({ error: "validation", message }));
    } else {
      write(message);
    }
    process.exitCode = 1;
  }

  function notFoundError(json: boolean, id: string): void {
    if (json) {
      write(JSON.stringify({ error: "not_found", id }));
    } else {
      write(`Task ${id} not found.`);
    }
    process.exitCode = 1;
  }

  function validateTitle(title: string, json: boolean): boolean {
    const result = checkTitle(title);
    if (!result.valid) {
      validationError(json, result.message);
      return false;
    }
    return true;
  }

  function validateNote(note: string, json: boolean): boolean {
    const result = checkNote(note);
    if (!result.valid) {
      validationError(json, result.message);
      return false;
    }
    return true;
  }

  function validateLabels(labels: string[], json: boolean): boolean {
    if (labels.length > MAX_LABELS) {
      validationError(json, `labels exceeds maximum of ${MAX_LABELS} items.`);
      return false;
    }
    const result = checkLabels(labels);
    if (!result.valid) {
      validationError(json, result.message);
      return false;
    }
    return true;
  }

  async function withTaskLookup<T>(
    id: string,
    json: boolean,
    operation: () => Promise<T | null>,
    onSuccess: (result: T) => void,
  ): Promise<void> {
    try {
      const result = await operation();
      if (!result) {
        notFoundError(json, id);
        return;
      }
      onSuccess(result);
    } catch (err) {
      if (err instanceof AmbiguousPrefixError) {
        handleAmbiguousPrefix(err, json);
        return;
      }
      throw err;
    }
  }

  function validateBlockedBy(blockedBy: string[], json: boolean): boolean {
    if (blockedBy.length > MAX_BLOCKED_BY) {
      validationError(json, `blocked_by exceeds maximum of ${MAX_BLOCKED_BY} items.`);
      return false;
    }
    return true;
  }

  function validateMetadata(metadata: Record<string, unknown>, json: boolean): boolean {
    if (Object.keys(metadata).length > MAX_METADATA_KEYS) {
      validationError(json, `Metadata exceeds maximum of ${MAX_METADATA_KEYS} keys.`);
      return false;
    }
    for (const key of Object.keys(metadata)) {
      if (key.length > MAX_METADATA_KEY_LENGTH) {
        validationError(
          json,
          `Metadata key exceeds maximum length of ${MAX_METADATA_KEY_LENGTH} characters.`,
        );
        return false;
      }
    }
    for (const value of Object.values(metadata)) {
      if (typeof value === "string" && value.length > MAX_METADATA_VALUE_LENGTH) {
        validationError(
          json,
          `Metadata value exceeds maximum length of ${MAX_METADATA_VALUE_LENGTH} characters.`,
        );
        return false;
      }
    }
    return true;
  }

  // add
  program
    .command("add <title>")
    .description("Add a new task")
    .option("--id <id>", "Task ID (for idempotent creates)")
    .addOption(
      new Option("-s, --status <status>", "Initial status").choices(STATUSES).default("todo"),
    )
    .addOption(
      new Option("-p, --priority <priority>", "Priority level")
        .choices(PRIORITIES)
        .default("medium"),
    )
    .option("-d, --due <date>", "Due date (e.g. 'tomorrow', 'tod 10a', '2026-03-20')")
    .option("--assign <owner>", "Assign to owner")
    .option("-l, --label <labels...>", "Add labels")
    .option("-b, --blocked-by <ids...>", "IDs of tasks that block this task")
    .option("-n, --note <note>", "Add an initial note")
    .option(
      "-r, --repeat <rule>",
      "Recurrence rule (e.g. daily, weekly, 'every monday', FREQ=DAILY)",
    )
    .option("--meta <key=value...>", "Metadata key=value pairs (key alone removes it)")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .addHelpText(
      "after",
      '\nExamples:\n  $ oru add "Fix login bug"\n  $ oru add "Fix login bug" -p high -d friday\n  $ oru add "Write docs" -l docs -n "Include API section"\n  $ oru add "Deploy v2" -s todo -d 2026-03-01 --assign alice\n  $ oru add "Water plants" -r "every 3 days" -d today',
    )
    .action(
      async (
        title: string,
        opts: {
          id?: string;
          status?: Status;
          priority?: Priority;
          due?: string;
          assign?: string;
          label?: string[];
          blockedBy?: string[];
          note?: string;
          repeat?: string;
          meta?: string[];
          json?: boolean;
          plaintext?: boolean;
        },
      ) => {
        title = sanitizeTitle(title);
        const json = useJson(opts);
        if (!validateTitle(title, json)) {
          return;
        }
        if (opts.note && !validateNote(opts.note, json)) {
          return;
        }
        if (opts.label && !validateLabels(opts.label, json)) {
          return;
        }
        if (opts.blockedBy && !validateBlockedBy(opts.blockedBy, json)) {
          return;
        }
        if (opts.blockedBy) {
          const result = await service.validateBlockedBy(null, opts.blockedBy);
          if (!result.valid) {
            validationError(json, result.error);
            return;
          }
        }

        if (opts.id && !isValidId(opts.id)) {
          validationError(
            json,
            `Invalid ID format: "${opts.id}". IDs must be 11-character base62 strings.`,
          );
          return;
        }

        // Idempotent create: if --id is given and task exists, return it
        if (opts.id) {
          const existing = await service.get(opts.id);
          if (existing) {
            write(json ? formatTaskJson(existing) : formatTaskText(existing));
            return;
          }
        }

        let dueAt: string | undefined;
        if (opts.due) {
          const parsed = parseDate(
            opts.due,
            resolvedConfig.date_format,
            resolvedConfig.first_day_of_week,
            resolvedConfig.next_month,
          );
          if (!parsed) {
            validationError(
              json,
              `Could not parse due date: ${opts.due}. Try: today, tomorrow, next friday, 2026-03-01, or march 15.`,
            );
            return;
          }
          dueAt = parsed;
        }

        let recurrence: string | undefined;
        if (opts.repeat) {
          try {
            recurrence = parseRecurrence(opts.repeat);
          } catch (err) {
            validationError(json, err instanceof Error ? err.message : String(err));
            return;
          }
        }

        const metadata = opts.meta ? parseMetadata(opts.meta) : undefined;
        if (metadata && !validateMetadata(metadata, json)) {
          return;
        }

        // Normalize empty/whitespace owner to null
        const owner = opts.assign !== undefined && opts.assign.trim() === "" ? null : opts.assign;

        const task = await service.add({
          title,
          id: opts.id,
          status: opts.status,
          priority: opts.priority,
          owner,
          due_at: dueAt,
          recurrence,
          blocked_by: opts.blockedBy,
          labels: opts.label ?? undefined,
          notes: opts.note ? [opts.note] : undefined,
          metadata,
        });
        write(json ? formatTaskJson(task) : formatTaskText(task));
      },
    );

  // list
  program
    .command("list")
    .description("List tasks (hides done tasks by default)")
    .option("-s, --status <status>", "Filter by status (comma-separated for multiple)", (value) => {
      const parts = value.split(",");
      for (const p of parts) {
        if (!STATUSES.includes(p as Status)) {
          throw new Error(`Invalid status: ${p}. Allowed: ${STATUSES.join(", ")}`);
        }
      }
      return parts.length === 1 ? (parts[0] as Status) : (parts as Status[]);
    })
    .option(
      "-p, --priority <priority>",
      "Filter by priority (comma-separated for multiple)",
      (value) => {
        const parts = value.split(",");
        for (const p of parts) {
          if (!PRIORITIES.includes(p as Priority)) {
            throw new Error(`Invalid priority: ${p}. Allowed: ${PRIORITIES.join(", ")}`);
          }
        }
        return parts.length === 1 ? (parts[0] as Priority) : (parts as Priority[]);
      },
    )
    .option("-l, --label <label>", "Filter by label")
    .option("--owner <owner>", "Filter by owner")
    .addOption(new Option("--due <range>", "Filter by due date").choices(["today", "this-week"]))
    .option("--overdue", "Show only overdue tasks")
    .addOption(new Option("--sort <field>", "Sort order").choices(SORT_FIELDS as readonly string[]))
    .option("--search <query>", "Search tasks by title")
    .option("-a, --all", "Include done tasks")
    .option("--actionable", "Show only tasks with no incomplete blockers")
    .option("--limit <n>", "Maximum number of tasks to return", Number)
    .option("--offset <n>", "Number of tasks to skip", Number)
    .option("--filter <name>", "Apply a saved filter (see 'oru filter list')")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .addHelpText(
      "after",
      '\nExamples:\n  $ oru list\n  $ oru list -s in_progress -p high\n  $ oru list -l backend --sort due --actionable\n  $ oru list --search "login" --all\n  $ oru list --filter mine',
    )
    .action(
      async (rawOpts: {
        status?: Status | Status[];
        priority?: Priority | Priority[];
        label?: string;
        owner?: string;
        sort?: SortField;
        due?: "today" | "this-week";
        overdue?: boolean;
        search?: string;
        all?: boolean;
        actionable?: boolean;
        limit?: number;
        offset?: number;
        filter?: string;
        json?: boolean;
        plaintext?: boolean;
      }) => {
        const json = useJson(rawOpts);
        let opts = rawOpts;
        let sqlFilter: string | undefined;

        if (rawOpts.filter) {
          const allFilters = loadFilters();
          const savedFilter = allFilters[rawOpts.filter];
          if (!savedFilter) {
            validationError(
              json,
              `Filter '${rawOpts.filter}' not found. Run 'oru filter list' to see available filters.`,
            );
            return;
          }
          opts = { ...rawOpts, ...applyFilter(rawOpts, savedFilter) };
          sqlFilter = savedFilter.sql;
        }

        let tasks = await service.list({
          status: opts.status,
          priority: opts.priority,
          owner: opts.owner,
          label: opts.label,
          search: opts.search,
          sort: opts.sort,
          actionable: opts.actionable,
          limit: opts.limit,
          offset: opts.offset,
          sql: sqlFilter,
        });
        // Hide done tasks unless --all or --status is specified
        if (!opts.all && !opts.status) {
          tasks = tasks.filter((t) => t.status !== "done");
        }
        if (opts.due) {
          tasks = filterByDue(
            tasks,
            opts.due as DueFilter,
            undefined,
            resolvedConfig.first_day_of_week,
          );
        }
        if (opts.overdue) {
          tasks = filterByDue(tasks, "overdue");
        }
        write(json ? formatTasksJson(tasks) : formatTasksText(tasks));
      },
    );

  // labels
  program
    .command("labels")
    .description("List all labels in use")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .action(async (opts: { json?: boolean; plaintext?: boolean }) => {
      const labels = await service.listLabels();
      const json = useJson(opts);
      write(json ? formatLabelsJson(labels) : formatLabelsText(labels));
    });

  // get
  program
    .command("get <id>")
    .description("Get a task by ID")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .addHelpText("after", "\nExamples:\n  $ oru get 019414a3\n  $ oru get 019414a3 --json")
    .action(async (id: string, opts: { json?: boolean; plaintext?: boolean }) => {
      const json = useJson(opts);
      await withTaskLookup(
        id,
        json,
        () => service.get(id),
        (task) => {
          write(json ? formatTaskJson(task) : formatTaskText(task));
        },
      );
    });

  // update
  program
    .command("update <id>")
    .description("Update a task")
    .option("-t, --title <title>", "New title")
    .addOption(new Option("-s, --status <status>", "New status").choices(STATUSES))
    .addOption(new Option("-p, --priority <priority>", "New priority").choices(PRIORITIES))
    .option(
      "-d, --due <date>",
      "Due date (e.g. 'tomorrow', 'tod 10a', '2026-03-20', 'none' to clear)",
    )
    .option("--assign <owner>", "Assign to owner ('none' to clear)")
    .option("-l, --label <labels...>", "Add labels")
    .option("--unlabel <labels...>", "Remove labels")
    .option("-b, --blocked-by <ids...>", "Set blocker task IDs (replaces full list)")
    .option("-n, --note <note>", "Append a note")
    .option("--clear-notes", "Remove all notes")
    .option("-r, --repeat <rule>", "Recurrence rule ('none' to clear)")
    .option("--meta <key=value...>", "Metadata key=value pairs (key alone removes it)")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .addHelpText(
      "after",
      '\nExamples:\n  $ oru update 019414a3 -s in_progress\n  $ oru update 019414a3 -l urgent -d tomorrow\n  $ oru update 019414a3 -n "Blocked on API review"\n  $ oru update 019414a3 -t "New title" -p high\n  $ oru update 019414a3 -r "every monday"',
    )
    .action(
      async (
        id: string,
        opts: {
          title?: string;
          status?: Status;
          priority?: Priority;
          due?: string;
          assign?: string;
          label?: string[];
          unlabel?: string[];
          blockedBy?: string[];
          note?: string;
          clearNotes?: boolean;
          repeat?: string;
          meta?: string[];
          json?: boolean;
          plaintext?: boolean;
        },
      ) => {
        const json = useJson(opts);
        if (opts.title !== undefined) {
          opts.title = sanitizeTitle(opts.title);
        }
        if (opts.title !== undefined && !validateTitle(opts.title, json)) {
          return;
        }
        if (opts.note && !validateNote(opts.note, json)) {
          return;
        }
        if (opts.label && !validateLabels(opts.label, json)) {
          return;
        }
        if (opts.blockedBy && !validateBlockedBy(opts.blockedBy, json)) {
          return;
        }
        if (opts.blockedBy) {
          const result = await service.validateBlockedBy(id, opts.blockedBy);
          if (!result.valid) {
            validationError(json, result.error);
            return;
          }
        }

        try {
          const updateFields: Record<string, unknown> = {};
          if (opts.title) {
            updateFields.title = opts.title;
          }
          if (opts.status) {
            updateFields.status = opts.status;
          }
          if (opts.priority) {
            updateFields.priority = opts.priority;
          }
          if (opts.due !== undefined) {
            if (opts.due.toLowerCase() === "none") {
              updateFields.due_at = null;
            } else {
              const parsed = parseDate(
                opts.due,
                resolvedConfig.date_format,
                resolvedConfig.first_day_of_week,
              );
              if (!parsed) {
                validationError(
                  json,
                  `Could not parse due date: ${opts.due}. Try: today, tomorrow, next friday, 2026-03-01, or march 15.`,
                );
                return;
              }
              updateFields.due_at = parsed;
            }
          }

          if (opts.assign !== undefined) {
            if (opts.assign.toLowerCase() === "none" || opts.assign.trim() === "") {
              updateFields.owner = null;
            } else {
              updateFields.owner = opts.assign;
            }
          }

          if (opts.label || opts.unlabel) {
            const existing = await service.get(id);
            if (!existing) {
              notFoundError(json, id);
              return;
            }
            let labels = [...existing.labels];
            if (opts.label) {
              for (const l of opts.label) {
                if (!labels.includes(l)) {
                  labels.push(l);
                }
              }
            }
            if (opts.unlabel) {
              labels = labels.filter((l) => !opts.unlabel!.includes(l));
            }
            if (!validateLabels(labels, json)) {
              return;
            }
            updateFields.labels = labels;
          }

          if (opts.blockedBy) {
            updateFields.blocked_by = opts.blockedBy;
          }

          if (opts.repeat !== undefined) {
            if (opts.repeat.toLowerCase() === "none") {
              updateFields.recurrence = null;
            } else {
              try {
                updateFields.recurrence = parseRecurrence(opts.repeat);
              } catch (err) {
                validationError(json, err instanceof Error ? err.message : String(err));
                return;
              }
            }
          }

          if (opts.meta) {
            const existing = await service.get(id);
            if (!existing) {
              notFoundError(json, id);
              return;
            }
            const parsed = parseMetadata(opts.meta);
            const merged = { ...existing.metadata };
            for (const [key, value] of Object.entries(parsed)) {
              if (value === null) {
                delete merged[key];
              } else {
                merged[key] = value;
              }
            }
            if (!validateMetadata(merged, json)) {
              return;
            }
            updateFields.metadata = merged;
          }

          const hasFields = Object.keys(updateFields).length > 0;
          let task;

          if (opts.clearNotes) {
            task = await service.clearNotes(id);
            if (!task) {
              notFoundError(json, id);
              return;
            }
            if (opts.note) {
              task = await service.addNote(id, opts.note);
            }
            if (hasFields) {
              task = await service.update(
                id,
                updateFields as {
                  title?: string;
                  status?: Status;
                  priority?: Priority;
                  blocked_by?: string[];
                  labels?: string[];
                  metadata?: Record<string, unknown>;
                },
              );
            }
          } else if (opts.note && hasFields) {
            task = await service.updateWithNote(
              id,
              updateFields as {
                title?: string;
                status?: Status;
                priority?: Priority;
                blocked_by?: string[];
                labels?: string[];
                metadata?: Record<string, unknown>;
              },
              opts.note,
            );
          } else if (opts.note) {
            task = await service.addNote(id, opts.note);
          } else if (hasFields) {
            task = await service.update(
              id,
              updateFields as {
                title?: string;
                status?: Status;
                priority?: Priority;
                blocked_by?: string[];
                labels?: string[];
                metadata?: Record<string, unknown>;
              },
            );
          } else {
            task = await service.get(id);
          }

          if (!task) {
            notFoundError(json, id);
            return;
          }
          write(json ? formatTaskJson(task) : formatTaskText(task));
          // Check for spawned recurring task
          if (task.status === "done" && task.recurrence) {
            const spawned = await service.getSpawnedTask(task.id);
            if (spawned) {
              if (json) {
                write(JSON.stringify({ spawned: spawned }, null, 2));
              } else {
                write(`\n${dim("Next occurrence:")} ${formatRecurrence(task.recurrence)}`);
                write(formatTaskText(spawned));
              }
            }
          }
        } catch (err) {
          if (err instanceof AmbiguousPrefixError) {
            handleAmbiguousPrefix(err, json);
            return;
          }
          throw err;
        }
      },
    );

  // edit
  program
    .command("edit <id>")
    .description("Open task in $EDITOR for complex edits")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .addHelpText("after", "\nExamples:\n  $ oru edit 019414a3\n  $ EDITOR=nano oru edit 019414a3")
    .action(async (id: string, opts: { json?: boolean; plaintext?: boolean }) => {
      const json = useJson(opts);
      try {
        const task = await service.get(id);
        if (!task) {
          notFoundError(json, id);
          return;
        }

        const document = serializeTask(task);
        const { edited, tmpFile } = await openInEditor(document);

        let fields: ReturnType<typeof parseDocument>["fields"];
        let newNotes: ReturnType<typeof parseDocument>["newNotes"];
        let removedNotes: ReturnType<typeof parseDocument>["removedNotes"];
        try {
          ({ fields, newNotes, removedNotes } = parseDocument(edited, task));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          validationError(json, message);
          writeErr(`Your edits are saved at: ${tmpFile}\n`);
          return;
        }
        cleanupTmpFile(tmpFile);

        const hasFields = Object.keys(fields).length > 0;
        const hasNotes = newNotes.length > 0;

        if (!hasFields && !hasNotes && !removedNotes) {
          if (json) {
            write(formatTaskJson(task));
          } else {
            write("No changes.");
          }
          return;
        }

        if (fields.title !== undefined) {
          fields.title = sanitizeTitle(fields.title);
        }
        if (fields.title !== undefined && !validateTitle(fields.title, json)) {
          return;
        }
        for (const note of newNotes) {
          if (!validateNote(note, json)) {
            return;
          }
        }
        if (fields.labels && !validateLabels(fields.labels, json)) {
          return;
        }
        if (fields.blocked_by && !validateBlockedBy(fields.blocked_by, json)) {
          return;
        }
        if (fields.blocked_by) {
          const result = await service.validateBlockedBy(task.id, fields.blocked_by);
          if (!result.valid) {
            validationError(json, result.error);
            return;
          }
        }
        if (fields.metadata && !validateMetadata(fields.metadata, json)) {
          return;
        }

        let result;
        if (removedNotes) {
          const afterFrontmatter = edited.slice(edited.indexOf("+++", 3) + 3);
          const keptNotes = afterFrontmatter
            .split("\n")
            .filter((line) => line.startsWith("- "))
            .map((line) => line.slice(2));
          const allNotes = [...keptNotes, ...newNotes];
          if (allNotes.length === 0) {
            result = await service.clearNotes(id);
          } else {
            result = await service.replaceNotes(id, allNotes);
          }
          if (hasFields) {
            result = await service.update(id, fields);
          }
        } else if (hasNotes && newNotes.length === 1 && hasFields) {
          result = await service.updateWithNote(id, fields, newNotes[0]);
        } else if (hasNotes && newNotes.length === 1 && !hasFields) {
          result = await service.addNote(id, newNotes[0]);
        } else {
          // Apply field updates first, then notes one by one
          if (hasFields) {
            result = await service.update(id, fields);
          }
          for (const note of newNotes) {
            result = await service.addNote(id, note);
          }
        }

        if (!result) {
          result = await service.get(id);
        }

        write(json ? formatTaskJson(result!) : formatTaskText(result!));
      } catch (err) {
        if (err instanceof AmbiguousPrefixError) {
          handleAmbiguousPrefix(err, json);
          return;
        }
        throw err;
      }
    });

  function addStatusShortcut(
    name: string,
    status: Status,
    description: string,
    examples: string,
  ): void {
    program
      .command(`${name} <id...>`)
      .description(description)
      .option("--json", "Output as JSON")
      .option("--plaintext", "Output as plain text (overrides config)")
      .addHelpText("after", examples)
      .action(async (ids: string[], opts: { json?: boolean; plaintext?: boolean }) => {
        const json = useJson(opts);
        for (const id of ids) {
          await withTaskLookup(
            id,
            json,
            () => service.update(id, { status }),
            (task) => {
              write(json ? formatTaskJson(task) : formatTaskText(task));
            },
          );
        }
      });
  }

  // done - separate from addStatusShortcut to handle recurring task spawn
  program
    .command("done <id...>")
    .description("Mark one or more tasks as done (shortcut for update -s done)")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .addHelpText("after", "\nExamples:\n  $ oru done 019414a3\n  $ oru done 019414a3 019414b7")
    .action(async (ids: string[], opts: { json?: boolean; plaintext?: boolean }) => {
      const json = useJson(opts);
      for (const id of ids) {
        await withTaskLookup(
          id,
          json,
          () => service.update(id, { status: "done" }),
          async (task) => {
            write(json ? formatTaskJson(task) : formatTaskText(task));
            // Check for spawned recurring task
            if (task.recurrence) {
              const spawned = await service.getSpawnedTask(task.id);
              if (spawned) {
                if (json) {
                  write(JSON.stringify({ spawned: spawned }, null, 2));
                } else {
                  write(`\n${dim("Next occurrence:")} ${formatRecurrence(task.recurrence)}`);
                  write(formatTaskText(spawned));
                }
              }
            }
          },
        );
      }
    });
  addStatusShortcut(
    "start",
    "in_progress",
    "Start one or more tasks (shortcut for update -s in_progress)",
    "\nExamples:\n  $ oru start 019414a3\n  $ oru start 019414a3 019414b7",
  );
  addStatusShortcut(
    "review",
    "in_review",
    "Mark one or more tasks as in_review (shortcut for update -s in_review)",
    "\nExamples:\n  $ oru review 019414a3\n  $ oru review 019414a3 019414b7",
  );

  // context
  program
    .command("context")
    .description(
      "Show a summary of what needs your attention (overdue, due soon, in progress, actionable, blocked, recently completed)",
    )
    .option("--owner <owner>", "Scope to a specific owner")
    .option("-l, --label <label>", "Filter by label")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .addHelpText(
      "after",
      "\nExamples:\n  $ oru context\n  $ oru context --owner alice\n  $ oru context -l backend",
    )
    .action(
      async (opts: { owner?: string; label?: string; json?: boolean; plaintext?: boolean }) => {
        const { sections } = await service.getContext({
          owner: opts.owner,
          label: opts.label,
        });

        const json = useJson(opts);
        write(json ? formatContextJson(sections) : formatContextText(sections, new Date()));
      },
    );

  // delete
  program
    .command("delete <id...>")
    .description("Delete one or more tasks permanently")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .addHelpText("after", "\nExamples:\n  $ oru delete 019414a3\n  $ oru delete 019414a3 019414b7")
    .action(async (ids: string[], opts: { json?: boolean; plaintext?: boolean }) => {
      const json = useJson(opts);
      for (const id of ids) {
        await withTaskLookup(
          id,
          json,
          () => service.delete(id),
          () => {
            write(json ? JSON.stringify({ id, deleted: true }) : `Deleted ${id}`);
          },
        );
      }
    });

  // log
  program
    .command("log <id>")
    .description("Show change history of a task")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .addHelpText("after", "\nExamples:\n  $ oru log 019414a3\n  $ oru log 019414a3 --json")
    .action(async (id: string, opts: { json?: boolean; plaintext?: boolean }) => {
      const json = useJson(opts);
      await withTaskLookup(
        id,
        json,
        () => service.log(id),
        (entries) => {
          write(json ? formatLogJson(entries) : formatLogText(entries));
        },
      );
    });

  // sync
  program
    .command("sync <remote-path>")
    .description("Sync with a filesystem remote")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .addHelpText(
      "after",
      "\nExamples:\n  $ oru sync /mnt/shared/oru\n  $ oru sync ~/Dropbox/oru-sync",
    )
    .action(async (remotePath: string, opts: { json?: boolean; plaintext?: boolean }) => {
      const remote = new FsRemote(remotePath);
      try {
        const engine = new SyncEngine(db, remote, deviceId);
        const result = await engine.sync();

        const json = useJson(opts);
        write(
          json
            ? JSON.stringify(result, null, 2)
            : `Pushed ${result.pushed} ops, pulled ${result.pulled} ops.`,
        );
      } finally {
        remote.close();
      }
    });

  // config
  const configCmd = program.command("config").description("Manage configuration");

  configCmd
    .command("init")
    .description("Create a default config file with documented options")
    .action(() => {
      const configPath = getConfigPath();
      if (fs.existsSync(configPath)) {
        write(`Config file already exists at ${configPath}`);
        return;
      }
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, DEFAULT_CONFIG_TOML);
      write(`Created ${configPath}`);
    });

  configCmd
    .command("path")
    .description("Print the config file path")
    .action(() => {
      write(getConfigPath());
    });

  // filter
  const filterCmd = program.command("filter").description("Manage saved list filters");

  filterCmd
    .command("list")
    .description("List all saved filters")
    .action(() => {
      const filters = loadFilters();
      const names = Object.keys(filters);
      if (names.length === 0) {
        write("No saved filters. Use 'oru filter add <name> [flags]' to create one.");
        return;
      }
      for (const name of names) {
        write(name);
      }
    });

  filterCmd
    .command("show <name>")
    .description("Show a filter's definition")
    .action((name: string) => {
      const filters = loadFilters();
      const filter = filters[name];
      if (!filter) {
        write(`Filter '${name}' not found.`);
        process.exitCode = 1;
        return;
      }
      const lines: string[] = [`[${name}]`];
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            lines.push(`${key} = ${value.join(", ")}`);
          } else {
            lines.push(`${key} = ${value}`);
          }
        }
      }
      write(lines.join("\n"));
    });

  filterCmd
    .command("remove <name>")
    .description("Delete a saved filter")
    .action((name: string) => {
      const filters = loadFilters();
      if (!(name in filters)) {
        write(`Filter '${name}' not found.`);
        process.exitCode = 1;
        return;
      }
      delete filters[name];
      saveFilters(filters);
      write(`Removed filter '${name}'.`);
    });

  filterCmd
    .command("add <name>")
    .description("Save a new named filter (accepts the same flags as 'oru list' plus --sql)")
    .option("-s, --status <status>", "Filter by status (comma-separated for multiple)", (value) => {
      const parts = value.split(",");
      for (const p of parts) {
        if (!STATUSES.includes(p as Status)) {
          throw new Error(`Invalid status: ${p}. Allowed: ${STATUSES.join(", ")}`);
        }
      }
      return parts.length === 1 ? (parts[0] as Status) : (parts as Status[]);
    })
    .option(
      "-p, --priority <priority>",
      "Filter by priority (comma-separated for multiple)",
      (value) => {
        const parts = value.split(",");
        for (const p of parts) {
          if (!PRIORITIES.includes(p as Priority)) {
            throw new Error(`Invalid priority: ${p}. Allowed: ${PRIORITIES.join(", ")}`);
          }
        }
        return parts.length === 1 ? (parts[0] as Priority) : (parts as Priority[]);
      },
    )
    .option("-l, --label <label>", "Filter by label")
    .option("--owner <owner>", "Filter by owner")
    .addOption(new Option("--due <range>", "Filter by due date").choices(["today", "this-week"]))
    .option("--overdue", "Show only overdue tasks")
    .addOption(new Option("--sort <field>", "Sort order").choices(SORT_FIELDS as readonly string[]))
    .option("--search <query>", "Search tasks by title")
    .option("-a, --all", "Include done tasks")
    .option("--actionable", "Show only tasks with no incomplete blockers")
    .option("--limit <n>", "Maximum number of tasks to return", Number)
    .option("--offset <n>", "Number of tasks to skip", Number)
    .option("--sql <condition>", "Raw SQL WHERE condition (e.g. \"priority = 'urgent'\")")
    .addHelpText(
      "after",
      "\nExamples:\n  $ oru filter add mine --owner tchayen --status todo\n  $ oru filter add upcoming --due this-week --sort due\n  $ oru filter add edge --sql \"priority = 'urgent'\"",
    )
    .action(
      (
        name: string,
        opts: {
          status?: Status | Status[];
          priority?: Priority | Priority[];
          label?: string;
          owner?: string;
          due?: "today" | "this-week";
          overdue?: boolean;
          sort?: SortField;
          search?: string;
          all?: boolean;
          actionable?: boolean;
          limit?: number;
          offset?: number;
          sql?: string;
        },
      ) => {
        const def: FilterDefinition = {};
        if (opts.status !== undefined) {
          def.status = opts.status;
        }
        if (opts.priority !== undefined) {
          def.priority = opts.priority;
        }
        if (opts.owner !== undefined) {
          def.owner = opts.owner;
        }
        if (opts.label !== undefined) {
          def.label = opts.label;
        }
        if (opts.search !== undefined) {
          def.search = opts.search;
        }
        if (opts.sort !== undefined) {
          def.sort = opts.sort;
        }
        if (opts.actionable !== undefined) {
          def.actionable = opts.actionable;
        }
        if (opts.due !== undefined) {
          def.due = opts.due;
        }
        if (opts.overdue !== undefined) {
          def.overdue = opts.overdue;
        }
        if (opts.all !== undefined) {
          def.all = opts.all;
        }
        if (opts.limit !== undefined) {
          def.limit = opts.limit;
        }
        if (opts.offset !== undefined) {
          def.offset = opts.offset;
        }
        if (opts.sql !== undefined) {
          def.sql = opts.sql;
        }

        if (Object.keys(def).length === 0) {
          write("No filter fields specified. Pass at least one flag.");
          process.exitCode = 1;
          return;
        }

        const filters = loadFilters();
        filters[name] = def;
        saveFilters(filters);
        write(`Saved filter '${name}'.`);
      },
    );

  // server (hidden behind feature flag until mobile app ships)
  if (SHOW_SERVER) {
    const server = program
      .command("server")
      .description("Manage the HTTP server for accessing tasks from your phone");

    server
      .command("start")
      .description("Start the server (runs in foreground, Ctrl+C to stop)")
      .option("--port <port>", "Port to listen on", "2358")
      .option("--tunnel", "Create a public tunnel via Cloudflare")
      .action((opts: { port: string; tunnel?: boolean }) => {
        const serverScript = path.join(
          path.dirname(fileURLToPath(import.meta.url)),
          "server",
          "index.js",
        );

        const child = spawn("node", [serverScript], {
          stdio: "inherit",
          env: {
            ...process.env,
            ORU_PORT: opts.port,
            ...(opts.tunnel ? { ORU_TUNNEL: "1" } : {}),
          },
        });

        const forward = (signal: NodeJS.Signals) => {
          child.kill(signal);
        };
        process.on("SIGINT", () => forward("SIGINT"));
        process.on("SIGTERM", () => forward("SIGTERM"));

        child.on("exit", (code) => {
          process.exit(code ?? 0);
        });
      });
  }

  // completions
  const completionsCmd = program
    .command("completions")
    .description("Generate shell completion scripts")
    .action(async () => {
      const shell = detectShell();
      if (!shell) {
        write("Could not detect shell from $SHELL.\nUse: oru completions bash|zsh|fish");
        process.exitCode = 1;
        return;
      }
      if (!process.stdin.isTTY) {
        write(`Detected shell: ${shell}\nRun interactively: oru completions ${shell}`);
        process.exitCode = 1;
        return;
      }
      write(`Detected shell: ${shell}`);
      const yes = await confirm(`Install completions for ${shell}? [Y/n] `);
      if (!yes) {
        write("Aborted.");
        return;
      }
      const result = installCompletions(shell, write);
      write(formatSuccessMessage(result));
    });

  for (const shell of ["bash", "zsh", "fish"] as const) {
    completionsCmd
      .command(shell)
      .description(`Install ${shell} completions`)
      .option("--print", "Print the completion script to stdout instead of installing")
      .action((opts: { print?: boolean }) => {
        if (opts.print || !process.stdout.isTTY) {
          write(
            shell === "bash"
              ? generateBashCompletions()
              : shell === "zsh"
                ? generateZshCompletions()
                : generateFishCompletions(),
          );
          return;
        }
        const result = installCompletions(shell, write);
        write(formatSuccessMessage(result));
      });
  }

  // self-update
  program
    .command("self-update")
    .description("Update oru to the latest version")
    .option("--check", "Only check if an update is available")
    .action(async (opts: { check?: boolean }) => {
      const { performUpdate } = await import("./update/perform.js");
      await performUpdate(!!opts.check);
    });

  // telemetry
  const telemetryCmd = program.command("telemetry").description("Manage anonymous usage telemetry");

  telemetryCmd
    .command("status")
    .description("Show whether telemetry is enabled or disabled")
    .action(() => {
      const reason = getTelemetryDisabledReason(resolvedConfig);
      if (reason) {
        write(`Telemetry: ${reason}`);
      } else {
        write("Telemetry: enabled");
      }
    });

  telemetryCmd
    .command("enable")
    .description("Enable anonymous usage telemetry")
    .action(() => {
      setConfigValue("telemetry", "true");
      write("Telemetry enabled.");
    });

  telemetryCmd
    .command("disable")
    .description("Disable anonymous usage telemetry")
    .action(() => {
      setConfigValue("telemetry", "false");
      write("Telemetry disabled.");
    });

  // backup
  program
    .command("backup [path]")
    .description("Create a database backup snapshot")
    .action((targetPath?: string) => {
      const backupDir = targetPath ?? resolvedConfig.backup_path;
      if (!backupDir) {
        write("No backup path specified. Pass a path argument or set backup_path in config.");
        process.exitCode = 1;
        return;
      }
      const dest = performBackup(db, backupDir);
      write(`Backed up to ${dest}`);
    });

  // hidden _complete command for dynamic completions
  program
    .command("_complete <type> [prefix]", { hidden: true })
    .action(async (type: string, prefix?: string) => {
      const results = await resolveDynamic(service, type, prefix ?? "");
      if (results.length > 0) {
        write(results.join("\n"));
      }
    });

  applyHelpColors(program);

  return program;
}

// Entry point when run directly
async function main() {
  const startTime = Date.now();
  const db = openDb();
  initSchema(db);
  const config = loadConfig();
  const program = createProgram(db, undefined, config);

  // Auto-backup if configured
  if (config.backup_path) {
    const { autoBackup } = await import("./backup.js");
    autoBackup(db, config.backup_path, config.backup_interval);
  }

  // Show first-run telemetry notice
  try {
    const { showFirstRunNotice } = await import("./telemetry/telemetry.js");
    showFirstRunNotice(config);
  } catch (err) {
    if (process.env.ORU_DEBUG === "1") {
      console.error("Telemetry notice failed:", err);
    }
  }

  // Start non-blocking update check
  let updateCheckPromise: Promise<string | null> | undefined;
  try {
    const { checkForUpdate } = await import("./update/check.js");
    updateCheckPromise = checkForUpdate(config);
  } catch (err) {
    if (process.env.ORU_DEBUG === "1") {
      console.error("Update check failed:", err);
    }
  }

  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    // Commander throws on --help, --version, etc.
    if (err instanceof Error && "exitCode" in err) {
      process.exit((err as { exitCode: number }).exitCode);
    }
    throw err;
  } finally {
    db.close();
  }

  // Send telemetry event (fire-and-forget)
  try {
    const { extractCommandAndFlags, buildEvent, sendEvent } =
      await import("./telemetry/telemetry.js");
    const { command, flags } = extractCommandAndFlags(process.argv);
    // Don't send telemetry for the telemetry command itself
    if (isTelemetryEnabled(config) && !command.startsWith("telemetry")) {
      const durationMs = Date.now() - startTime;
      const event = buildEvent(command, flags, durationMs, Number(process.exitCode ?? 0));
      sendEvent(event);
    }
  } catch (err) {
    if (process.env.ORU_DEBUG === "1") {
      console.error("Telemetry send failed:", err);
    }
  }

  // Print update notice after command completes
  if (updateCheckPromise) {
    try {
      const latestVersion = await updateCheckPromise;
      if (latestVersion) {
        const { printUpdateNotice } = await import("./update/check.js");
        printUpdateNotice(latestVersion);
      }
    } catch (err) {
      if (process.env.ORU_DEBUG === "1") {
        console.error("Update check failed:", err);
      }
    }
  }
}

const currentFile = fileURLToPath(import.meta.url);
const isEntryPoint = process.argv[1] && currentFile === process.argv[1];

if (isEntryPoint) {
  main().catch((err) => {
    if (process.env.ORU_DEBUG === "1") {
      console.error(err);
    } else {
      console.error(err instanceof Error ? err.message : String(err));
    }
    process.exit(1);
  });
}
