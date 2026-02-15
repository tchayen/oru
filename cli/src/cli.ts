import { fileURLToPath } from "url";
import path from "path";
import { spawn } from "child_process";
import { Command, Option } from "commander";
import type Database from "better-sqlite3";
import { TaskService } from "./main.js";
import { createKysely } from "./db/kysely.js";
import { openDb } from "./db/connection.js";
import { initSchema } from "./db/schema.js";
import { formatTaskText, formatTasksText } from "./format/text.js";
import { formatTaskJson, formatTasksJson } from "./format/json.js";
import { SyncEngine } from "./sync/engine.js";
import { FsRemote } from "./sync/fs-remote.js";
import { getDeviceId } from "./device.js";
import { loadConfig, type Config } from "./config/config.js";
import { parseDate } from "./dates/parse.js";
import type { Status, Priority } from "./tasks/types.js";

declare const __GIT_COMMIT__: string;

const MAX_TITLE_LENGTH = 1000;
const MAX_NOTE_LENGTH = 10000;
const MAX_LABEL_LENGTH = 200;

function parseMetadata(pairs: string[]): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }
    const key = pair.slice(0, eqIdx);
    const value = pair.slice(eqIdx + 1);
    if (key) {
      meta[key] = value;
    }
  }
  return meta;
}

export function createProgram(
  db: Database.Database,
  write: (text: string) => void = (t) => process.stdout.write(t + "\n"),
  config?: Config,
): Command {
  const resolvedConfig = config ?? loadConfig();
  const ky = createKysely(db);
  const deviceId = getDeviceId(db);
  const service = new TaskService(ky, deviceId);
  const program = new Command("ao")
    .description(
      "agentodo — agent-friendly todo CLI with offline sync\n\nUse --json on any command for machine-readable output (or set AO_FORMAT=json).",
    )
    .version(`0.1.0 (${__GIT_COMMIT__})`);

  program.configureOutput({
    writeOut: write,
    writeErr: write,
  });

  // Override exit to not actually exit during tests
  program.exitOverride();

  const statusChoices = ["todo", "in_progress", "done"] as const;
  const priorityChoices = ["low", "medium", "high", "urgent"] as const;

  function useJson(opts: { json?: boolean; plaintext?: boolean }): boolean {
    if (opts.plaintext) {
      return false;
    }
    return !!(
      opts.json ||
      process.env.AO_FORMAT === "json" ||
      resolvedConfig.output_format === "json"
    );
  }

  // add
  program
    .command("add <title>")
    .description("Add a new task")
    .option("--id <id>", "Task ID (for idempotent creates)")
    .addOption(
      new Option("-s, --status <status>", "Initial status").choices(statusChoices).default("todo"),
    )
    .addOption(
      new Option("-p, --priority <priority>", "Priority level")
        .choices(priorityChoices)
        .default("medium"),
    )
    .option("-d, --due <date>", "Due date (e.g. 'tomorrow', 'tod 10a', '2026-03-20')")
    .option("-l, --label <labels...>", "Add labels")
    .option("-n, --note <note>", "Add an initial note")
    .option("--meta <key=value...>", "Add metadata key=value pairs")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .action(
      async (
        title: string,
        opts: {
          id?: string;
          status?: Status;
          priority?: Priority;
          due?: string;
          label?: string[];
          note?: string;
          meta?: string[];
          json?: boolean;
          plaintext?: boolean;
        },
      ) => {
        if (title.trim().length === 0) {
          if (useJson(opts)) {
            write(JSON.stringify({ error: "validation", message: "Title cannot be empty" }));
          } else {
            write("Title cannot be empty.");
          }
          process.exitCode = 1;
          return;
        }
        if (title.length > MAX_TITLE_LENGTH) {
          if (useJson(opts)) {
            write(
              JSON.stringify({
                error: "validation",
                message: `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters`,
              }),
            );
          } else {
            write(`Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters.`);
          }
          process.exitCode = 1;
          return;
        }
        if (opts.note && opts.note.length > MAX_NOTE_LENGTH) {
          if (useJson(opts)) {
            write(
              JSON.stringify({
                error: "validation",
                message: `Note exceeds maximum length of ${MAX_NOTE_LENGTH} characters`,
              }),
            );
          } else {
            write(`Note exceeds maximum length of ${MAX_NOTE_LENGTH} characters.`);
          }
          process.exitCode = 1;
          return;
        }
        if (opts.label) {
          for (const l of opts.label) {
            if (l.length > MAX_LABEL_LENGTH) {
              if (useJson(opts)) {
                write(
                  JSON.stringify({
                    error: "validation",
                    message: `Label exceeds maximum length of ${MAX_LABEL_LENGTH} characters`,
                  }),
                );
              } else {
                write(`Label exceeds maximum length of ${MAX_LABEL_LENGTH} characters.`);
              }
              process.exitCode = 1;
              return;
            }
          }
        }

        // Idempotent create: if --id is given and task exists, return it
        if (opts.id) {
          const existing = await service.get(opts.id);
          if (existing) {
            if (useJson(opts)) {
              write(formatTaskJson(existing));
            } else {
              write(formatTaskText(existing));
            }
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
            if (useJson(opts)) {
              write(
                JSON.stringify({
                  error: "validation",
                  message: `Could not parse due date: ${opts.due}`,
                }),
              );
            } else {
              write(`Could not parse due date: ${opts.due}`);
            }
            process.exitCode = 1;
            return;
          }
          dueAt = parsed;
        }

        const metadata = opts.meta ? parseMetadata(opts.meta) : undefined;

        const task = await service.add({
          title,
          id: opts.id,
          status: opts.status,
          priority: opts.priority,
          due_at: dueAt,
          labels: opts.label ?? undefined,
          notes: opts.note ? [opts.note] : undefined,
          metadata,
        });
        if (useJson(opts)) {
          write(formatTaskJson(task));
        } else {
          write(formatTaskText(task));
        }
      },
    );

  // list
  program
    .command("list")
    .description("List tasks (hides done tasks by default)")
    .addOption(new Option("-s, --status <status>", "Filter by status").choices(statusChoices))
    .addOption(
      new Option("-p, --priority <priority>", "Filter by priority").choices(priorityChoices),
    )
    .option("-l, --label <label>", "Filter by label")
    .option("--search <query>", "Search tasks by title")
    .option("-a, --all", "Include done tasks")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .action(
      async (opts: {
        status?: Status;
        priority?: Priority;
        label?: string;
        search?: string;
        all?: boolean;
        json?: boolean;
        plaintext?: boolean;
      }) => {
        let tasks = await service.list({
          status: opts.status,
          priority: opts.priority,
          label: opts.label,
          search: opts.search,
        });
        // Hide done tasks unless --all or --status is specified
        if (!opts.all && !opts.status) {
          tasks = tasks.filter((t) => t.status !== "done");
        }
        if (useJson(opts)) {
          write(formatTasksJson(tasks));
        } else {
          write(formatTasksText(tasks));
        }
      },
    );

  // get
  program
    .command("get <id>")
    .description("Get a task by ID")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .action(async (id: string, opts: { json?: boolean; plaintext?: boolean }) => {
      const task = await service.get(id);
      if (!task) {
        if (useJson(opts)) {
          write(JSON.stringify({ error: "not_found", id }));
        } else {
          write(`Task ${id} not found.`);
        }
        process.exitCode = 1;
        return;
      }
      if (useJson(opts)) {
        write(formatTaskJson(task));
      } else {
        write(formatTaskText(task));
      }
    });

  // update
  program
    .command("update <id>")
    .description("Update a task")
    .option("-t, --title <title>", "New title")
    .addOption(new Option("-s, --status <status>", "New status").choices(statusChoices))
    .addOption(new Option("-p, --priority <priority>", "New priority").choices(priorityChoices))
    .option(
      "-d, --due <date>",
      "Due date (e.g. 'tomorrow', 'tod 10a', '2026-03-20', 'none' to clear)",
    )
    .option("-l, --label <labels...>", "Add labels")
    .option("-n, --note <note>", "Append a note")
    .option("--meta <key=value...>", "Set metadata key=value pairs")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .action(
      async (
        id: string,
        opts: {
          title?: string;
          status?: Status;
          priority?: Priority;
          due?: string;
          label?: string[];
          note?: string;
          meta?: string[];
          json?: boolean;
          plaintext?: boolean;
        },
      ) => {
        if (opts.title !== undefined && opts.title.trim().length === 0) {
          if (useJson(opts)) {
            write(JSON.stringify({ error: "validation", message: "Title cannot be empty" }));
          } else {
            write("Title cannot be empty.");
          }
          process.exitCode = 1;
          return;
        }

        if (opts.title && opts.title.length > MAX_TITLE_LENGTH) {
          if (useJson(opts)) {
            write(
              JSON.stringify({
                error: "validation",
                message: `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters`,
              }),
            );
          } else {
            write(`Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters.`);
          }
          process.exitCode = 1;
          return;
        }
        if (opts.note && opts.note.length > MAX_NOTE_LENGTH) {
          if (useJson(opts)) {
            write(
              JSON.stringify({
                error: "validation",
                message: `Note exceeds maximum length of ${MAX_NOTE_LENGTH} characters`,
              }),
            );
          } else {
            write(`Note exceeds maximum length of ${MAX_NOTE_LENGTH} characters.`);
          }
          process.exitCode = 1;
          return;
        }
        if (opts.label) {
          for (const l of opts.label) {
            if (l.length > MAX_LABEL_LENGTH) {
              if (useJson(opts)) {
                write(
                  JSON.stringify({
                    error: "validation",
                    message: `Label exceeds maximum length of ${MAX_LABEL_LENGTH} characters`,
                  }),
                );
              } else {
                write(`Label exceeds maximum length of ${MAX_LABEL_LENGTH} characters.`);
              }
              process.exitCode = 1;
              return;
            }
          }
        }

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
              if (useJson(opts)) {
                write(
                  JSON.stringify({
                    error: "validation",
                    message: `Could not parse due date: ${opts.due}`,
                  }),
                );
              } else {
                write(`Could not parse due date: ${opts.due}`);
              }
              process.exitCode = 1;
              return;
            }
            updateFields.due_at = parsed;
          }
        }

        if (opts.label) {
          const existing = await service.get(id);
          if (!existing) {
            if (useJson(opts)) {
              write(JSON.stringify({ error: "not_found", id }));
            } else {
              write(`Task ${id} not found.`);
            }
            process.exitCode = 1;
            return;
          }
          const labels = [...existing.labels];
          for (const l of opts.label) {
            if (!labels.includes(l)) {
              labels.push(l);
            }
          }
          updateFields.labels = labels;
        }

        if (opts.meta) {
          const existing = await service.get(id);
          if (!existing) {
            if (useJson(opts)) {
              write(JSON.stringify({ error: "not_found", id }));
            } else {
              write(`Task ${id} not found.`);
            }
            process.exitCode = 1;
            return;
          }
          const merged = { ...existing.metadata, ...parseMetadata(opts.meta) };
          updateFields.metadata = merged;
        }

        const hasFields = Object.keys(updateFields).length > 0;
        let task;

        if (opts.note && hasFields) {
          task = await service.updateWithNote(
            id,
            updateFields as {
              title?: string;
              status?: Status;
              priority?: Priority;
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
              labels?: string[];
              metadata?: Record<string, unknown>;
            },
          );
        } else {
          task = await service.get(id);
        }

        if (!task) {
          if (useJson(opts)) {
            write(JSON.stringify({ error: "not_found", id }));
          } else {
            write(`Task ${id} not found.`);
          }
          process.exitCode = 1;
          return;
        }

        if (useJson(opts)) {
          write(formatTaskJson(task));
        } else {
          write(formatTaskText(task));
        }
      },
    );

  // delete
  program
    .command("delete <id>")
    .description("Delete a task")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .action(async (id: string, opts: { json?: boolean; plaintext?: boolean }) => {
      const result = await service.delete(id);
      if (useJson(opts)) {
        if (!result) {
          write(JSON.stringify({ error: "not_found", id }));
          process.exitCode = 1;
        } else {
          write(JSON.stringify({ id, deleted: true }));
        }
      } else if (result) {
        write(`Deleted ${id}`);
      } else {
        write(`Task ${id} not found.`);
        process.exitCode = 1;
      }
    });

  // sync
  program
    .command("sync <remote-path>")
    .description("Sync with a filesystem remote")
    .option("--json", "Output as JSON")
    .option("--plaintext", "Output as plain text (overrides config)")
    .action(async (remotePath: string, opts: { json?: boolean; plaintext?: boolean }) => {
      const remote = new FsRemote(remotePath);
      try {
        const engine = new SyncEngine(db, remote, deviceId);
        const result = await engine.sync();

        if (useJson(opts)) {
          write(JSON.stringify(result, null, 2));
        } else {
          write(`Pushed ${result.pushed} ops, pulled ${result.pulled} ops.`);
        }
      } finally {
        remote.close();
      }
    });

  // server
  const server = program.command("server").description("Manage the HTTP server for mobile clients");

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
          AO_PORT: opts.port,
          ...(opts.tunnel ? { AO_TUNNEL: "1" } : {}),
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

  return program;
}

// Entry point when run directly
async function main() {
  const db = openDb();
  initSchema(db);
  const config = loadConfig();
  const program = createProgram(db, undefined, config);

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
}

const currentFile = fileURLToPath(import.meta.url);
const isEntryPoint = process.argv[1] && currentFile === process.argv[1];

if (isEntryPoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
