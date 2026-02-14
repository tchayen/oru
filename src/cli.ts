import { Command, Option } from "commander";
import type Database from "better-sqlite3";
import { TaskService } from "./main.js";
import { openDb } from "./db/connection.js";
import { initSchema } from "./db/schema.js";
import { formatTaskText, formatTasksText } from "./format/text.js";
import { formatTaskJson, formatTasksJson } from "./format/json.js";
import { SyncEngine } from "./sync/engine.js";
import { FsRemote } from "./sync/fs-remote.js";
import { getDeviceId } from "./device.js";
import type { Status, Priority } from "./tasks/types.js";

export function createProgram(
  db: Database.Database,
  write: (text: string) => void = (t) => process.stdout.write(t + "\n"),
): Command {
  const service = new TaskService(db);
  const program = new Command("ao")
    .description("agentodo — agent-friendly todo CLI with offline sync")
    .version("0.1.0");

  program.configureOutput({
    writeOut: write,
    writeErr: write,
  });

  // Override exit to not actually exit during tests
  program.exitOverride();

  const statusChoices = ["todo", "in_progress", "done"] as const;
  const priorityChoices = ["low", "medium", "high", "urgent"] as const;

  function useJson(opts: { json?: boolean }): boolean {
    return !!(opts.json || process.env.AO_FORMAT === "json");
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
    .option("-l, --label <label>", "Add a label")
    .option("-n, --note <note>", "Add an initial note")
    .action(
      (
        title: string,
        opts: {
          id?: string;
          status?: Status;
          priority?: Priority;
          label?: string;
          note?: string;
        },
      ) => {
        // Idempotent create: if --id is given and task exists, return it
        if (opts.id) {
          const existing = service.get(opts.id);
          if (existing) {
            write(formatTaskJson(existing));
            return;
          }
        }

        const task = service.add({
          title,
          id: opts.id,
          status: opts.status,
          priority: opts.priority,
          labels: opts.label ? [opts.label] : undefined,
          notes: opts.note ? [opts.note] : undefined,
        });
        // Always output JSON for add (agent-friendly)
        write(formatTaskJson(task));
      },
    );

  // list
  program
    .command("list")
    .description("List tasks")
    .addOption(new Option("-s, --status <status>", "Filter by status").choices(statusChoices))
    .addOption(
      new Option("-p, --priority <priority>", "Filter by priority").choices(priorityChoices),
    )
    .option("-l, --label <label>", "Filter by label")
    .option("--json", "Output as JSON")
    .action((opts: { status?: Status; priority?: Priority; label?: string; json?: boolean }) => {
      const tasks = service.list({
        status: opts.status,
        priority: opts.priority,
        label: opts.label,
      });
      if (useJson(opts)) {
        write(formatTasksJson(tasks));
      } else {
        write(formatTasksText(tasks));
      }
    });

  // get
  program
    .command("get <id>")
    .description("Get a task by ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: { json?: boolean }) => {
      const task = service.get(id);
      if (!task) {
        write(`Task ${id} not found.`);
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
    .option("-l, --label <label>", "Add a label")
    .option("-n, --note <note>", "Append a note")
    .option("--json", "Output as JSON")
    .action(
      (
        id: string,
        opts: {
          title?: string;
          status?: Status;
          priority?: Priority;
          label?: string;
          note?: string;
          json?: boolean;
        },
      ) => {
        const updateFields: Record<string, unknown> = {};
        if (opts.title) updateFields.title = opts.title;
        if (opts.status) updateFields.status = opts.status;
        if (opts.priority) updateFields.priority = opts.priority;

        // --label appends a label (deduped) to existing labels
        if (opts.label) {
          const existing = service.get(id);
          if (!existing) {
            write(`Task ${id} not found.`);
            return;
          }
          const labels = [...existing.labels];
          if (!labels.includes(opts.label)) labels.push(opts.label);
          updateFields.labels = labels;
        }

        const hasFields = Object.keys(updateFields).length > 0;
        let task;

        if (opts.note && hasFields) {
          task = service.updateWithNote(
            id,
            updateFields as {
              title?: string;
              status?: Status;
              priority?: Priority;
              labels?: string[];
            },
            opts.note,
          );
        } else if (opts.note) {
          task = service.addNote(id, opts.note);
        } else if (hasFields) {
          task = service.update(
            id,
            updateFields as {
              title?: string;
              status?: Status;
              priority?: Priority;
              labels?: string[];
            },
          );
        } else {
          task = service.get(id);
        }

        if (!task) {
          write(`Task ${id} not found.`);
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
    .action((id: string, opts: { json?: boolean }) => {
      const result = service.delete(id);
      if (useJson(opts)) {
        write(JSON.stringify({ id, deleted: result }));
      } else if (result) {
        write(`Deleted ${id}`);
      } else {
        write(`Task ${id} not found.`);
      }
    });

  // sync
  program
    .command("sync <remote-path>")
    .description("Sync with a filesystem remote")
    .option("--json", "Output as JSON")
    .action(async (remotePath: string, opts: { json?: boolean }) => {
      const remote = new FsRemote(remotePath);
      const deviceId = getDeviceId(db);
      const engine = new SyncEngine(db, remote, deviceId);
      const result = await engine.sync();
      remote.close();

      if (useJson(opts)) {
        write(JSON.stringify(result, null, 2));
      } else {
        write(`Pushed ${result.pushed} ops, pulled ${result.pulled} ops.`);
      }
    });

  return program;
}

// Entry point when run directly
async function main() {
  const db = openDb();
  initSchema(db);
  const program = createProgram(db);

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

// Only run main when this is the entry point
const isEntryPoint =
  process.argv[1] && (process.argv[1].endsWith("/cli.js") || process.argv[1].endsWith("/cli.ts"));

if (isEntryPoint) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
