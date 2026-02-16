import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import type Database from "better-sqlite3";
import { createTestDb } from "../helpers/test-db.js";
import { createProgram } from "../../src/cli.js";

describe("CLI parse", () => {
  let db: Database.Database;
  let output: string;

  function capture(): (text: string) => void {
    output = "";
    return (text: string) => {
      output += text + "\n";
    };
  }

  beforeEach(() => {
    db = createTestDb();
    output = "";
  });

  afterEach(() => {
    db.close();
  });

  it("add command creates a task", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "oru", "add", "Buy milk"]);
    expect(output).toContain("Buy milk");
  });

  it("add outputs plain text by default", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "oru", "add", "Buy milk"]);
    // Should NOT be valid JSON
    expect(() => JSON.parse(output.trim())).toThrow();
    expect(output).toContain("Buy milk");
    expect(output).toContain("Status:");
  });

  it("add --json outputs valid JSON", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "oru", "add", "Buy milk", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.title).toBe("Buy milk");
    expect(parsed.id).toBeTruthy();
  });

  it("add with --priority flag", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "oru", "add", "Urgent task", "--priority", "high"]);
    expect(output).toContain("high");
  });

  it("add with --label flag", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "oru", "add", "Work task", "--label", "work"]);
    expect(output).toContain("work");
  });

  it("list command shows tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task A"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "list"]);
    expect(output).toContain("Task A");
  });

  it("list with --status filter", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Todo task"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Done task", "--status", "done"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--status", "done"]);
    expect(output).toContain("Done task");
    expect(output).not.toContain("Todo task");
  });

  it("list hides done tasks by default", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Open task"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Finished task", "--status", "done"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list"]);
    expect(output).toContain("Open task");
    expect(output).not.toContain("Finished task");
  });

  it("list --all shows done tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Open task"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Finished task", "--status", "done"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--all"]);
    expect(output).toContain("Open task");
    expect(output).toContain("Finished task");
  });

  it("list --json outputs valid JSON", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "JSON task"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "list", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].title).toBe("JSON task");
  });

  it("get command shows a task", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Find me", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "get", id]);
    expect(output).toContain("Find me");
  });

  it("get --json outputs valid JSON", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "JSON get", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "get", id, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.title).toBe("JSON get");
  });

  it("get nonexistent task shows error", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "get", "nonexistent"]);
    expect(output).toContain("not found");
  });

  it("update command updates a task", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Old title", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--title", "New title"]);
    expect(output).toContain("New title");
  });

  it("update --status changes status", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "In progress", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--status", "done"]);
    expect(output).toContain("done");
  });

  it("update --note appends a note", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task with notes", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--note", "A note"]);
    expect(output).toContain("A note");
  });

  it("delete command removes a task", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Delete me", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "delete", id]);
    expect(output).toContain("Deleted");

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "get", id]);
    expect(output).toContain("not found");
  });

  it("list with no tasks shows empty message", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "list"]);
    expect(output).toContain("No tasks");
  });

  it("list --json with no tasks returns empty array", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "list", "--json"]);
    expect(JSON.parse(output.trim())).toEqual([]);
  });

  // GAP-1: Combined --note + --status in a single atomic update
  it("update --note + --status applies both atomically", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Atomic task", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "update",
      id,
      "--note",
      "finished it",
      "--status",
      "done",
      "--json",
    ]);
    const result = JSON.parse(output.trim());
    expect(result.status).toBe("done");
    expect(result.notes).toContain("finished it");
  });

  it("update --clear-notes removes all notes", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Noted task", "--note", "Keep this", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--clear-notes", "--json"]);
    const result = JSON.parse(output.trim());
    expect(result.notes).toEqual([]);
  });

  it("update --clear-notes + --note clears then adds new note", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Noted task", "--note", "Old note", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "update",
      id,
      "--clear-notes",
      "--note",
      "Fresh note",
      "--json",
    ]);
    const result = JSON.parse(output.trim());
    expect(result.notes).toEqual(["Fresh note"]);
  });

  // AGENT-3: Idempotent create with --id
  it("add --id creates task with given ID", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", "ID task", "--id", "custom-id-123", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.id).toBe("custom-id-123");
  });

  it("add --id is idempotent — returns existing task on re-run", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "First run", "--id", "idem-id", "--json"]);
    const first = JSON.parse(output.trim());

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Second run", "--id", "idem-id", "--json"]);
    const second = JSON.parse(output.trim());

    expect(second.id).toBe(first.id);
    expect(second.title).toBe("First run"); // Original title preserved
  });

  // AGENT-8a: --note on add
  it("add --note creates task with initial note", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", "Noted task", "--note", "initial context", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.notes).toContain("initial context");
  });

  // AGENT-8b: --label on update
  it("update --label appends a label", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Label task", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--label", "urgent", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toContain("urgent");
  });

  it("update --label deduplicates", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Dedup task", "--label", "work", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--label", "work", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["work"]);
  });

  // AGENT-7: --json on delete
  it("delete --json returns structured response", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Delete json", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "delete", id, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toEqual({ id, deleted: true });
  });

  it("delete --json for non-existent task returns error", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "delete", "no-such-id", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toEqual({ error: "not_found", id: "no-such-id" });
  });

  // GAP-8: --label filtering via CLI
  it("list --label filters by label", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Work task", "--label", "work"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Home task", "--label", "home"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--label", "work"]);
    expect(output).toContain("Work task");
    expect(output).not.toContain("Home task");
  });

  // AGENT-4: ORU_FORMAT=json env var
  it("ORU_FORMAT=json makes list output JSON", async () => {
    process.env.ORU_FORMAT = "json";
    try {
      const p1 = createProgram(db, capture());
      await p1.parseAsync(["node", "oru", "add", "Env task"]);

      const p2 = createProgram(db, capture());
      await p2.parseAsync(["node", "oru", "list"]);
      const parsed = JSON.parse(output.trim());
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].title).toBe("Env task");
    } finally {
      delete process.env.ORU_FORMAT;
    }
  });

  // GAP-5: CLI sync command
  it("sync command pushes and pulls", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-cli-sync-test-"));
    const remotePath = path.join(tmpDir, "remote.db");

    try {
      // Create a task first
      const p1 = createProgram(db, capture());
      await p1.parseAsync(["node", "oru", "add", "Sync task"]);

      // Run sync
      const p2 = createProgram(db, capture());
      await p2.parseAsync(["node", "oru", "sync", remotePath]);
      expect(output).toContain("Pushed");
      expect(output).toContain("ops");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("get --json returns error object for non-existent task", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "get", "nonexistent-id", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("not_found");
    expect(parsed.id).toBe("nonexistent-id");
  });

  it("update --json returns error object for non-existent task", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "update", "nonexistent-id", "--status", "done", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("not_found");
    expect(parsed.id).toBe("nonexistent-id");
  });

  it("list --search filters tasks by title", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Buy milk"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Walk the dog"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--search", "milk"]);
    expect(output).toContain("Buy milk");
    expect(output).not.toContain("Walk the dog");
  });

  it("list --search --json returns filtered JSON", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Buy milk"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Walk the dog"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--search", "milk", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Buy milk");
  });

  it("add --meta sets metadata key=value pairs", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync([
      "node",
      "oru",
      "add",
      "Meta task",
      "--meta",
      "sprint=5",
      "team=backend",
      "--json",
    ]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.metadata).toEqual({ sprint: "5", team: "backend" });
  });

  it("update --meta merges metadata", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Meta update", "--meta", "key1=val1", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--meta", "key2=val2", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.metadata).toEqual({ key1: "val1", key2: "val2" });
  });

  it("update --meta key without = removes the key", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "oru",
      "add",
      "Meta delete",
      "--meta",
      "keep=yes",
      "remove=me",
      "--json",
    ]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--meta", "remove", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.metadata).toEqual({ keep: "yes" });
  });

  it("add --label accepts multiple labels", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync([
      "node",
      "oru",
      "add",
      "Multi label",
      "--label",
      "work",
      "urgent",
      "--json",
    ]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["work", "urgent"]);
  });

  it("update --label appends multiple labels", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Label update", "--label", "work", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--label", "urgent", "bug", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["work", "urgent", "bug"]);
  });

  it("update rejects empty title", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Some task", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--title", "   "]);
    expect(output).toContain("cannot be empty");
  });

  it("add strips newlines from title", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "oru", "add", "Title with\nnewline", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.title).toBe("Title with newline");
  });

  it("add strips \\r\\n from title", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "oru", "add", "Title with\r\nnewline", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.title).toBe("Title with newline");
  });

  it("add rejects title that is only newlines", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "oru", "add", "\n\n\n"]);
    expect(output).toContain("cannot be empty");
  });

  it("update strips newlines from title", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Old title", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--title", "New\ntitle", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.title).toBe("New title");
  });

  it("add rejects title exceeding max length", async () => {
    const longTitle = "a".repeat(1001);
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", longTitle]);
    expect(output).toContain("Title exceeds maximum length");
  });

  it("add rejects note exceeding max length", async () => {
    const longNote = "n".repeat(10001);
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", "Task", "--note", longNote]);
    expect(output).toContain("Note exceeds maximum length");
  });

  it("add rejects label exceeding max length", async () => {
    const longLabel = "l".repeat(201);
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", "Task", "--label", longLabel]);
    expect(output).toContain("Label exceeds maximum length");
  });

  it("add validation errors output JSON with --json", async () => {
    const longTitle = "a".repeat(1001);
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", longTitle, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("validation");
    expect(parsed.message).toContain("Title");
  });

  // Config-based output format
  it("outputs JSON when config sets output_format = json", async () => {
    const config = {
      date_format: "mdy" as const,
      first_day_of_week: "monday" as const,
      output_format: "json" as const,
      next_month: "same_day" as const,
    };
    const p = createProgram(db, capture(), config);
    await p.parseAsync(["node", "oru", "add", "Config json task"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.title).toBe("Config json task");
  });

  it("--plaintext overrides config output_format = json", async () => {
    const config = {
      date_format: "mdy" as const,
      first_day_of_week: "monday" as const,
      output_format: "json" as const,
      next_month: "same_day" as const,
    };
    const p = createProgram(db, capture(), config);
    await p.parseAsync(["node", "oru", "add", "Plaintext task", "--plaintext"]);
    expect(() => JSON.parse(output.trim())).toThrow();
    expect(output).toContain("Plaintext task");
    expect(output).toContain("Status:");
  });

  it("--plaintext overrides config for list command", async () => {
    const config = {
      date_format: "mdy" as const,
      first_day_of_week: "monday" as const,
      output_format: "json" as const,
      next_month: "same_day" as const,
    };
    const p1 = createProgram(db, capture(), config);
    await p1.parseAsync(["node", "oru", "add", "Task for list"]);

    const p2 = createProgram(db, capture(), config);
    await p2.parseAsync(["node", "oru", "list", "--plaintext"]);
    expect(() => JSON.parse(output.trim())).toThrow();
    expect(output).toContain("Task for list");
  });

  // Due date tests
  it("add --due sets due date", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", "Task with due", "--due", "2026-03-20", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.due_at).toBe("2026-03-20T00:00:00");
  });

  it("add --due with relative date", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", "Due tomorrow", "--due", "tomorrow", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.due_at).toBeTruthy();
    // Should be a valid date string
    expect(parsed.due_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("add --due with time", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync([
      "node",
      "oru",
      "add",
      "Due with time",
      "--due",
      "2026-03-20 10am",
      "--json",
    ]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.due_at).toBe("2026-03-20T10:00:00");
  });

  it("add --due rejects invalid date", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", "Bad date", "--due", "not-a-date"]);
    expect(output).toContain("Could not parse due date");
  });

  it("add --due invalid date outputs JSON with --json", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", "Bad date", "--due", "not-a-date", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("validation");
    expect(parsed.message).toContain("Could not parse due date");
  });

  it("update --due sets due date", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Update due", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--due", "2026-04-01", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.due_at).toBe("2026-04-01T00:00:00");
  });

  it("update --due none clears due date", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Clear due", "--due", "2026-03-20", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--due", "none", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.due_at).toBeNull();
  });

  it("add --due respects config date_format = dmy", async () => {
    const config = {
      date_format: "dmy" as const,
      first_day_of_week: "monday" as const,
      output_format: "text" as const,
      next_month: "same_day" as const,
    };
    const p = createProgram(db, capture(), config);
    await p.parseAsync(["node", "oru", "add", "DMY date", "--due", "20/03/2026", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.due_at).toBe("2026-03-20T00:00:00");
  });

  it("due date shows in text output", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", "Due task", "--due", "2026-03-20"]);
    expect(output).toContain("Due: 2026-03-20");
  });

  it("due date with time shows in text output", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "add", "Due time", "--due", "2026-03-20 14:30"]);
    expect(output).toContain("Due: 2026-03-20 14:30");
  });

  it("due date shows in list output", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "List due", "--due", "2026-03-20"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "list"]);
    expect(output).toContain("2026-03-20");
  });

  // Quick status shortcuts: done, start
  it("done command marks task as done", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Finish me", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "done", id, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.status).toBe("done");
  });

  it("done --json returns error for non-existent task", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "done", "no-such-id", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("not_found");
  });

  it("done command shows text output by default", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Text done", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "done", id]);
    expect(output).toContain("done");
    expect(output).toContain("Text done");
  });

  it("start command marks task as in_progress", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Begin me", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "start", id, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.status).toBe("in_progress");
  });

  it("start --json returns error for non-existent task", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "start", "no-such-id", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("not_found");
  });

  it("start command shows text output by default", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Text start", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "start", id]);
    expect(output).toContain("in_progress");
    expect(output).toContain("Text start");
  });

  // Review command
  it("review command marks task as in_review", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Review me", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "review", id, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.status).toBe("in_review");
  });

  it("review --json returns error for non-existent task", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "review", "no-such-id", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("not_found");
  });

  it("review accepts multiple IDs", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task R1", "--json"]);
    const id1 = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Task R2", "--json"]);
    const id2 = JSON.parse(output.trim()).id;

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "review", id1, id2, "--json"]);
    const objects = output.trim().split(/\n(?=\{)/);
    expect(objects).toHaveLength(2);
    expect(JSON.parse(objects[0]).status).toBe("in_review");
    expect(JSON.parse(objects[1]).status).toBe("in_review");
  });

  it("review command shows text output by default", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Text review", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "review", id]);
    expect(output).toContain("in_review");
    expect(output).toContain("Text review");
  });

  it("in_review tasks show in list by default", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Review task", "--status", "in_review"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "list"]);
    expect(output).toContain("Review task");
  });

  // Due date filtering
  it("list --due today filters to tasks due today", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Due today", "--due", "today", "--json"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Due later", "--due", "2099-12-31", "--json"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--due", "today", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Due today");
  });

  it("list --due this-week filters to tasks due this week", async () => {
    // Compute a date that is definitely in the current Mon-Sun week
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    const wed = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 2);
    const wedStr = `${wed.getFullYear()}-${String(wed.getMonth() + 1).padStart(2, "0")}-${String(wed.getDate()).padStart(2, "0")}`;

    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Due this week", "--due", wedStr, "--json"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Due far away", "--due", "2099-12-31", "--json"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--due", "this-week", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed.every((t: { title: string }) => t.title !== "Due far away")).toBe(true);
  });

  it("list --overdue filters to overdue tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Overdue task", "--due", "2020-01-01", "--json"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Future task", "--due", "2099-12-31", "--json"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--overdue", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Overdue task");
  });

  it("list --overdue with no overdue tasks returns empty", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Future task", "--due", "2099-12-31"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "list", "--overdue", "--json"]);
    expect(JSON.parse(output.trim())).toEqual([]);
  });

  it("list --due today with no tasks due today returns empty", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Not today", "--due", "2099-12-31"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "list", "--due", "today", "--json"]);
    expect(JSON.parse(output.trim())).toEqual([]);
  });

  // Bulk operations
  it("done accepts multiple IDs", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task A", "--json"]);
    const idA = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Task B", "--json"]);
    const idB = JSON.parse(output.trim()).id;

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "done", idA, idB, "--json"]);
    // Pretty-printed JSON objects separated by newlines; extract via regex
    const objects = output.trim().split(/\n(?=\{)/);
    expect(objects).toHaveLength(2);
    expect(JSON.parse(objects[0]).status).toBe("done");
    expect(JSON.parse(objects[1]).status).toBe("done");
  });

  it("start accepts multiple IDs", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task C", "--json"]);
    const idC = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Task D", "--json"]);
    const idD = JSON.parse(output.trim()).id;

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "start", idC, idD, "--json"]);
    const objects = output.trim().split(/\n(?=\{)/);
    expect(objects).toHaveLength(2);
    expect(JSON.parse(objects[0]).status).toBe("in_progress");
    expect(JSON.parse(objects[1]).status).toBe("in_progress");
  });

  it("delete accepts multiple IDs", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task E", "--json"]);
    const idE = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Task F", "--json"]);
    const idF = JSON.parse(output.trim()).id;

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "delete", idE, idF, "--json"]);
    const objects = output.trim().split(/\n(?=\{)/);
    expect(objects).toHaveLength(2);
    expect(JSON.parse(objects[0])).toEqual({ id: idE, deleted: true });
    expect(JSON.parse(objects[1])).toEqual({ id: idF, deleted: true });
  });

  it("bulk done reports errors for missing IDs without stopping", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Valid task", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "done", "no-such-id", id, "--json"]);
    const objects = output.trim().split(/\n(?=\{)/);
    expect(objects).toHaveLength(2);
    expect(JSON.parse(objects[0]).error).toBe("not_found");
    expect(JSON.parse(objects[1]).status).toBe("done");
  });

  // Label management
  it("labels command lists unique labels", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task A", "--label", "work", "bug"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Task B", "--label", "work", "feature"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "labels"]);
    expect(output).toContain("bug");
    expect(output).toContain("feature");
    expect(output).toContain("work");
  });

  it("labels --json returns sorted array", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task A", "--label", "work", "bug"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Task B", "--label", "work", "feature"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "labels", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toEqual(["bug", "feature", "work"]);
  });

  it("labels with no labels shows empty message", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "labels"]);
    expect(output).toContain("No labels");
  });

  it("labels --json with no labels returns empty array", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "labels", "--json"]);
    expect(JSON.parse(output.trim())).toEqual([]);
  });

  it("update --unlabel removes a label", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Unlabel task", "--label", "work", "bug", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--unlabel", "bug", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["work"]);
  });

  it("update --unlabel removes multiple labels", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "oru",
      "add",
      "Multi unlabel",
      "--label",
      "work",
      "bug",
      "feature",
      "--json",
    ]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--unlabel", "bug", "feature", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["work"]);
  });

  it("update --unlabel with non-existent label is a no-op", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Noop unlabel", "--label", "work", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--unlabel", "nonexistent", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["work"]);
  });

  it("update --label and --unlabel in same command", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Both ops", "--label", "old", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "update",
      id,
      "--label",
      "new",
      "--unlabel",
      "old",
      "--json",
    ]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["new"]);
  });

  // owner tests
  it("add --assign sets owner", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "oru", "add", "Task", "--assign", "agent", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.owner).toBe("agent");
  });

  it("update --assign sets owner", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--assign", "human", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.owner).toBe("human");
  });

  it("update --assign none clears owner", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task", "--assign", "agent", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--assign", "none", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.owner).toBeNull();
  });

  it("list --owner filters by owner", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Agent task", "--assign", "agent"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Human task", "--assign", "human"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--owner", "agent", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Agent task");
  });

  // blocked_by tests
  it("add --blocked-by sets blocked_by", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Blocker", "--json"]);
    const blockerId = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "add",
      "Blocked task",
      "--blocked-by",
      blockerId,
      "--json",
    ]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.blocked_by).toEqual([blockerId]);
  });

  it("update --blocked-by replaces blocked_by list", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Dep A", "--json"]);
    const depA = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Dep B", "--json"]);
    const depB = JSON.parse(output.trim()).id;

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "add", "Task", "--blocked-by", depA, "--json"]);
    const taskId = JSON.parse(output.trim()).id;

    const p4 = createProgram(db, capture());
    await p4.parseAsync(["node", "oru", "update", taskId, "--blocked-by", depB, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.blocked_by).toEqual([depB]);
  });

  it("list --actionable shows only unblocked tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Free task", "--json"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Blocker task", "--json"]);
    const blockerId = JSON.parse(output.trim()).id;

    const p3 = createProgram(db, capture());
    await p3.parseAsync([
      "node",
      "oru",
      "add",
      "Blocked task",
      "--blocked-by",
      blockerId,
      "--json",
    ]);

    const p4 = createProgram(db, capture());
    await p4.parseAsync(["node", "oru", "list", "--actionable"]);
    expect(output).toContain("Free task");
    expect(output).toContain("Blocker task");
    expect(output).not.toContain("Blocked task");
  });

  it("list --actionable --json returns filtered JSON", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Free", "--json"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Blocker", "--json"]);
    const blockerId = JSON.parse(output.trim()).id;

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "add", "Blocked", "--blocked-by", blockerId, "--json"]);

    const p4 = createProgram(db, capture());
    await p4.parseAsync(["node", "oru", "list", "--actionable", "--json"]);
    const parsed = JSON.parse(output.trim());
    const titles = parsed.map((t: { title: string }) => t.title);
    expect(titles).toContain("Free");
    expect(titles).toContain("Blocker");
    expect(titles).not.toContain("Blocked");
  });

  it("list --actionable excludes done tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Active task", "--json"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Finished task", "-s", "done", "--json"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--actionable", "--json"]);
    const parsed = JSON.parse(output.trim());
    const titles = parsed.map((t: { title: string }) => t.title);
    expect(titles).toContain("Active task");
    expect(titles).not.toContain("Finished task");
  });

  it("list --actionable --all still excludes done tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Todo task", "--json"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Done task", "-s", "done", "--json"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--actionable", "--all", "--json"]);
    const parsed = JSON.parse(output.trim());
    const titles = parsed.map((t: { title: string }) => t.title);
    expect(titles).toContain("Todo task");
    expect(titles).not.toContain("Done task");
  });

  it("list --limit returns at most N tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task 1"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Task 2"]);
    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "add", "Task 3"]);

    const p4 = createProgram(db, capture());
    await p4.parseAsync(["node", "oru", "list", "--limit", "2", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveLength(2);
  });

  it("list --offset skips N tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task A", "--priority", "urgent"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Task B", "--priority", "low"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--offset", "1", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Task B");
  });

  it("list --limit --offset paginates correctly", async () => {
    for (let i = 1; i <= 5; i++) {
      const p = createProgram(db, capture());
      await p.parseAsync(["node", "oru", "add", `Task ${i}`]);
    }

    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "list", "--limit", "2", "--offset", "1", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("Task 2");
    expect(parsed[1].title).toBe("Task 3");
  });

  it("list outputs JSON when config sets output_format = json", async () => {
    const config = {
      date_format: "mdy" as const,
      first_day_of_week: "monday" as const,
      output_format: "json" as const,
      next_month: "same_day" as const,
    };
    const p1 = createProgram(db, capture(), config);
    await p1.parseAsync(["node", "oru", "add", "Json list task"]);

    const p2 = createProgram(db, capture(), config);
    await p2.parseAsync(["node", "oru", "list"]);
    const parsed = JSON.parse(output.trim());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].title).toBe("Json list task");
  });

  // Sort tests
  it("list --sort priority sorts by priority (default)", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Low task", "--priority", "low"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Urgent task", "--priority", "urgent"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--sort", "priority", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed[0].title).toBe("Urgent task");
    expect(parsed[1].title).toBe("Low task");
  });

  it("list --sort due sorts by due date with nulls last", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "No due task"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Due later", "--due", "2026-06-01"]);
    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "add", "Due sooner", "--due", "2026-03-01"]);

    const p4 = createProgram(db, capture());
    await p4.parseAsync(["node", "oru", "list", "--sort", "due", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed[0].title).toBe("Due sooner");
    expect(parsed[1].title).toBe("Due later");
    expect(parsed[2].title).toBe("No due task");
  });

  it("list --sort title sorts alphabetically case-insensitive", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "banana"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Apple"]);
    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "add", "cherry"]);

    const p4 = createProgram(db, capture());
    await p4.parseAsync(["node", "oru", "list", "--sort", "title", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.map((t: { title: string }) => t.title)).toEqual(["Apple", "banana", "cherry"]);
  });

  it("list --sort created sorts by creation time", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "First", "--priority", "low"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Second", "--priority", "urgent"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "list", "--sort", "created", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed[0].title).toBe("First");
    expect(parsed[1].title).toBe("Second");
  });

  // Ambiguous prefix tests
  it("get shows ambiguous prefix error in text mode", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "oru",
      "add",
      "Task A",
      "--id",
      "aaaa-1111-0000-0000-000000000000",
    ]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "add",
      "Task B",
      "--id",
      "aaaa-2222-0000-0000-000000000000",
    ]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "get", "aaaa"]);
    expect(output).toContain("ambiguous");
    expect(output).toContain("aaaa-1111-0000-0000-000000000000");
    expect(output).toContain("aaaa-2222-0000-0000-000000000000");
  });

  it("get --json returns ambiguous_prefix error", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "oru",
      "add",
      "Task A",
      "--id",
      "bbbb-1111-0000-0000-000000000000",
    ]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "add",
      "Task B",
      "--id",
      "bbbb-2222-0000-0000-000000000000",
    ]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "get", "bbbb", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("ambiguous_prefix");
    expect(parsed.id).toBe("bbbb");
    expect(parsed.matches).toHaveLength(2);
  });

  it("update shows ambiguous prefix error", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "oru",
      "add",
      "Task A",
      "--id",
      "cccc-1111-0000-0000-000000000000",
    ]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "add",
      "Task B",
      "--id",
      "cccc-2222-0000-0000-000000000000",
    ]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "update", "cccc", "--status", "done", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("ambiguous_prefix");
  });

  it("done shows ambiguous prefix error", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "oru",
      "add",
      "Task A",
      "--id",
      "dddd-1111-0000-0000-000000000000",
    ]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "add",
      "Task B",
      "--id",
      "dddd-2222-0000-0000-000000000000",
    ]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "done", "dddd"]);
    expect(output).toContain("ambiguous");
  });

  // log command tests
  it("log shows oplog entries in text format", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Log task", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--status", "done"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "log", id]);
    expect(output).toContain("CREATE");
    expect(output).toContain("UPDATE");
  });

  it("log --json returns array of oplog entries", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Log json task", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "update", id, "--status", "done"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "log", id, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(2);
    expect(parsed[0].op_type).toBe("create");
    expect(parsed[1].op_type).toBe("update");
  });

  it("log for nonexistent task shows not found error", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "log", "nonexistent"]);
    expect(output).toContain("not found");
  });

  it("log --json for nonexistent task returns error object", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "log", "nonexistent-id", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("not_found");
    expect(parsed.id).toBe("nonexistent-id");
  });

  it("log handles ambiguous prefix error", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "oru",
      "add",
      "Task A",
      "--id",
      "ffff-1111-0000-0000-000000000000",
    ]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "add",
      "Task B",
      "--id",
      "ffff-2222-0000-0000-000000000000",
    ]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "log", "ffff", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("ambiguous_prefix");
  });

  it("self-update command exists", async () => {
    const program = createProgram(db, capture());
    const cmd = program.commands.find((c) => c.name() === "self-update");
    expect(cmd).toBeDefined();
    expect(cmd!.description()).toContain("Update oru");
  });

  it("delete shows ambiguous prefix error", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "oru",
      "add",
      "Task A",
      "--id",
      "eeee-1111-0000-0000-000000000000",
    ]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "add",
      "Task B",
      "--id",
      "eeee-2222-0000-0000-000000000000",
    ]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "delete", "eeee", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("ambiguous_prefix");
  });

  // Multi-value filter tests
  it("list -s with comma-separated statuses filters correctly", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Todo task"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "In progress", "--status", "in_progress"]);
    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "add", "Done task", "--status", "done"]);

    const p4 = createProgram(db, capture());
    await p4.parseAsync(["node", "oru", "list", "-s", "todo,in_progress", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveLength(2);
    const titles = parsed.map((t: { title: string }) => t.title).sort();
    expect(titles).toEqual(["In progress", "Todo task"]);
  });

  it("list -p with comma-separated priorities filters correctly", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Low task", "--priority", "low"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "High task", "--priority", "high"]);
    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "add", "Urgent task", "--priority", "urgent"]);

    const p4 = createProgram(db, capture());
    await p4.parseAsync(["node", "oru", "list", "-p", "high,urgent", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveLength(2);
    const titles = parsed.map((t: { title: string }) => t.title).sort();
    expect(titles).toEqual(["High task", "Urgent task"]);
  });

  it("list -s with invalid comma-separated status rejects", async () => {
    const p = createProgram(db, capture());
    await expect(p.parseAsync(["node", "oru", "list", "-s", "todo,invalid"])).rejects.toThrow();
  });

  it("list -p with invalid comma-separated priority rejects", async () => {
    const p = createProgram(db, capture());
    await expect(p.parseAsync(["node", "oru", "list", "-p", "high,nope"])).rejects.toThrow();
  });

  // context command tests
  it("context with no tasks shows nothing to report", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("Nothing to report");
  });

  it("context shows overdue tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Overdue task", "--due", "2020-01-01"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("Overdue");
    expect(output).toContain("Overdue task");
  });

  it("context shows in_progress tasks in In Progress section", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Active task", "--status", "in_progress"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("In Progress");
    expect(output).toContain("Active task");
  });

  it("context shows in_review tasks in In Progress section", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Review task", "--status", "in_review"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("In Progress");
    expect(output).toContain("Review task");
  });

  it("context shows high/urgent todo tasks in Actionable section", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Urgent item", "--priority", "urgent"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "High item", "--priority", "high"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("Actionable");
    expect(output).toContain("Urgent item");
    expect(output).toContain("High item");
  });

  it("context shows medium/low todo tasks in Actionable", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Medium item", "--priority", "medium"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Low item", "--priority", "low"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("Actionable");
    expect(output).toContain("Medium item");
    expect(output).toContain("Low item");
  });

  it("context with a single medium todo does not report nothing", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Only medium task", "--priority", "medium"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.actionable).toBeDefined();
    expect(parsed.actionable.length).toBe(1);
    expect(parsed.actionable[0].title).toBe("Only medium task");
  });

  it("context shows blocked tasks in Blocked section", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Blocker task", "--json"]);
    const blockerId = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Blocked task", "--blocked-by", blockerId]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("Blocked");
    expect(output).toContain("Blocked task");
  });

  it("context --json returns structured sections", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Urgent task", "--priority", "urgent"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Active task", "--status", "in_progress"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.actionable).toBeDefined();
    expect(parsed.actionable.length).toBe(1);
    expect(parsed.actionable[0].title).toBe("Urgent task");
    expect(parsed.in_progress).toBeDefined();
    expect(parsed.in_progress[0].title).toBe("Active task");
  });

  it("context --json omits empty sections", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Active task", "--status", "in_progress"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.overdue).toBeUndefined();
    expect(parsed.actionable).toBeUndefined();
    expect(parsed.blocked).toBeUndefined();
    expect(parsed.recently_completed).toBeUndefined();
  });

  it("context --owner scopes briefing to owner", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "oru",
      "add",
      "Agent task",
      "--assign",
      "agent",
      "--priority",
      "urgent",
    ]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "oru",
      "add",
      "Human task",
      "--assign",
      "human",
      "--priority",
      "urgent",
    ]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context", "--owner", "agent", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.actionable).toHaveLength(1);
    expect(parsed.actionable[0].title).toBe("Agent task");
  });

  it("context text output shows blocker titles for blocked tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Refactor authentication module", "--json"]);
    const blockerId = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Update API docs", "--blocked-by", blockerId]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("Blocked");
    expect(output).toContain("Refactor authentication module");
    expect(output).toContain("blocked by:");
  });

  it("context --json includes blocker_titles for blocked tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Blocker task", "--json"]);
    const blockerId = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Blocked task", "--blocked-by", blockerId]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.blocker_titles).toBeDefined();
    expect(parsed.blocker_titles[blockerId]).toBe("Blocker task");
  });

  it("context --json omits blocker_titles when no blocked tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Active task", "--status", "in_progress"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.blocker_titles).toBeUndefined();
  });

  it("context empty sections are omitted in text output", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Active task", "--status", "in_progress"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("In Progress");
    expect(output).not.toContain("Overdue");
    expect(output).not.toContain("Actionable");
    expect(output).not.toContain("Blocked");
    expect(output).not.toContain("Recently Completed");
  });

  // Due Soon section in context
  it("context shows task due tomorrow in Due Soon section", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Due tomorrow task", "--due", tomorrowStr]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("Due Soon");
    expect(output).toContain("Due tomorrow task");
  });

  it("context does not show task due in 3 days in Due Soon", async () => {
    const threeDays = new Date();
    threeDays.setDate(threeDays.getDate() + 3);
    const threeDaysStr = `${threeDays.getFullYear()}-${String(threeDays.getMonth() + 1).padStart(2, "0")}-${String(threeDays.getDate()).padStart(2, "0")}`;

    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Due in 3 days", "--due", threeDaysStr]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context"]);
    expect(output).not.toContain("Due Soon");
  });

  it("context shows overdue task in Overdue, not Due Soon", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Past due task", "--due", "2020-01-01"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("Overdue");
    expect(output).toContain("Past due task");
    expect(output).not.toContain("Due Soon");
  });

  it("context --json includes due_soon key", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Soon task", "--due", tomorrowStr]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.due_soon).toBeDefined();
    expect(parsed.due_soon).toHaveLength(1);
    expect(parsed.due_soon[0].title).toBe("Soon task");
  });

  // context --label filter tests
  it("context --label filters to tasks with that label", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "CLI task", "-l", "cli", "-p", "high"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "App task", "-l", "app", "-p", "high"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context", "--label", "cli", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.actionable).toHaveLength(1);
    expect(parsed.actionable[0].title).toBe("CLI task");
  });

  it("context --label excludes tasks without the label", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Unrelated task", "-p", "urgent"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context", "--label", "cli", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.actionable).toBeUndefined();
  });

  it("context --label filters done tasks in recently completed", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Done CLI task", "-l", "cli", "-s", "done"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Done app task", "-l", "app", "-s", "done"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context", "--label", "cli", "--json"]);
    const parsed = JSON.parse(output.trim());
    if (parsed.recently_completed) {
      for (const t of parsed.recently_completed) {
        expect(t.labels).toContain("cli");
      }
    }
  });

  // Context summary tests
  it("context text output starts with summary line showing counts", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Urgent task", "--priority", "urgent"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Active task", "--status", "in_progress"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context"]);
    const firstLine = output.trim().split("\n")[0];
    expect(firstLine).toContain("1 in progress");
    expect(firstLine).toContain("1 actionable");
  });

  it("context summary line only includes non-zero sections", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Active task", "--status", "in_progress"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context"]);
    const firstLine = output.trim().split("\n")[0];
    expect(firstLine).toContain("1 in progress");
    expect(firstLine).not.toContain("overdue");
    expect(firstLine).not.toContain("actionable");
    expect(firstLine).not.toContain("blocked");
    expect(firstLine).not.toContain("recently completed");
  });

  it("context --json includes summary object with all section counts", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Urgent task", "--priority", "urgent"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Active task", "--status", "in_progress"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "context", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.summary).toBeDefined();
    expect(parsed.summary.actionable).toBe(1);
    expect(parsed.summary.in_progress).toBe(1);
  });

  it("context --json summary includes zero counts for empty sections", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Active task", "--status", "in_progress"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "context", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.summary.overdue).toBe(0);
    expect(parsed.summary.actionable).toBe(0);
    expect(parsed.summary.blocked).toBe(0);
    expect(parsed.summary.recently_completed).toBe(0);
    expect(parsed.summary.in_progress).toBe(1);
  });

  it("context with no tasks shows nothing to report without summary", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "context"]);
    expect(output).toContain("Nothing to report");
    expect(output).not.toContain("actionable");
    expect(output).not.toContain("in progress");
    expect(output).not.toContain("overdue");
    expect(output).not.toContain("blocked");
  });
});
