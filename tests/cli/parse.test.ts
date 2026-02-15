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
    await program.parseAsync(["node", "ao", "add", "Buy milk"]);
    expect(output).toContain("Buy milk");
  });

  it("add outputs plain text by default", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "ao", "add", "Buy milk"]);
    // Should NOT be valid JSON
    expect(() => JSON.parse(output.trim())).toThrow();
    expect(output).toContain("Buy milk");
    expect(output).toContain("Status:");
  });

  it("add --json outputs valid JSON", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "ao", "add", "Buy milk", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.title).toBe("Buy milk");
    expect(parsed.id).toBeTruthy();
  });

  it("add with --priority flag", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "ao", "add", "Urgent task", "--priority", "high"]);
    expect(output).toContain("high");
  });

  it("add with --label flag", async () => {
    const program = createProgram(db, capture());
    await program.parseAsync(["node", "ao", "add", "Work task", "--label", "work"]);
    expect(output).toContain("work");
  });

  it("list command shows tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Task A"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "list"]);
    expect(output).toContain("Task A");
  });

  it("list with --status filter", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Todo task"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "add", "Done task", "--status", "done"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "ao", "list", "--status", "done"]);
    expect(output).toContain("Done task");
    expect(output).not.toContain("Todo task");
  });

  it("list --json outputs valid JSON", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "JSON task"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "list", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].title).toBe("JSON task");
  });

  it("get command shows a task", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Find me", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "get", id]);
    expect(output).toContain("Find me");
  });

  it("get --json outputs valid JSON", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "JSON get", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "get", id, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.title).toBe("JSON get");
  });

  it("get nonexistent task shows error", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "get", "nonexistent"]);
    expect(output).toContain("not found");
  });

  it("update command updates a task", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Old title", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--title", "New title"]);
    expect(output).toContain("New title");
  });

  it("update --status changes status", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "In progress", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--status", "done"]);
    expect(output).toContain("done");
  });

  it("update --note appends a note", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Task with notes", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--note", "A note"]);
    expect(output).toContain("A note");
  });

  it("delete command removes a task", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Delete me", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "delete", id]);
    expect(output).toContain("Deleted");

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "ao", "get", id]);
    expect(output).toContain("not found");
  });

  it("list with no tasks shows empty message", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "list"]);
    expect(output).toContain("No tasks");
  });

  it("list --json with no tasks returns empty array", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "list", "--json"]);
    expect(JSON.parse(output.trim())).toEqual([]);
  });

  // GAP-1: Combined --note + --status in a single atomic update
  it("update --note + --status applies both atomically", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Atomic task", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync([
      "node",
      "ao",
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

  // AGENT-3: Idempotent create with --id
  it("add --id creates task with given ID", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "add", "ID task", "--id", "custom-id-123", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.id).toBe("custom-id-123");
  });

  it("add --id is idempotent — returns existing task on re-run", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "First run", "--id", "idem-id", "--json"]);
    const first = JSON.parse(output.trim());

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "add", "Second run", "--id", "idem-id", "--json"]);
    const second = JSON.parse(output.trim());

    expect(second.id).toBe(first.id);
    expect(second.title).toBe("First run"); // Original title preserved
  });

  // AGENT-8a: --note on add
  it("add --note creates task with initial note", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "add", "Noted task", "--note", "initial context", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.notes).toContain("initial context");
  });

  // AGENT-8b: --label on update
  it("update --label appends a label", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Label task", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--label", "urgent", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toContain("urgent");
  });

  it("update --label deduplicates", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Dedup task", "--label", "work", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--label", "work", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["work"]);
  });

  // AGENT-7: --json on delete
  it("delete --json returns structured response", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Delete json", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "delete", id, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toEqual({ id, deleted: true });
  });

  it("delete --json for non-existent task returns error", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "delete", "no-such-id", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toEqual({ error: "not_found", id: "no-such-id" });
  });

  // GAP-8: --label filtering via CLI
  it("list --label filters by label", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Work task", "--label", "work"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "add", "Home task", "--label", "home"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "ao", "list", "--label", "work"]);
    expect(output).toContain("Work task");
    expect(output).not.toContain("Home task");
  });

  // AGENT-4: AO_FORMAT=json env var
  it("AO_FORMAT=json makes list output JSON", async () => {
    process.env.AO_FORMAT = "json";
    try {
      const p1 = createProgram(db, capture());
      await p1.parseAsync(["node", "ao", "add", "Env task"]);

      const p2 = createProgram(db, capture());
      await p2.parseAsync(["node", "ao", "list"]);
      const parsed = JSON.parse(output.trim());
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].title).toBe("Env task");
    } finally {
      delete process.env.AO_FORMAT;
    }
  });

  // GAP-5: CLI sync command
  it("sync command pushes and pulls", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ao-cli-sync-test-"));
    const remotePath = path.join(tmpDir, "remote.db");

    try {
      // Create a task first
      const p1 = createProgram(db, capture());
      await p1.parseAsync(["node", "ao", "add", "Sync task"]);

      // Run sync
      const p2 = createProgram(db, capture());
      await p2.parseAsync(["node", "ao", "sync", remotePath]);
      expect(output).toContain("Pushed");
      expect(output).toContain("ops");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("get --json returns error object for non-existent task", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "get", "nonexistent-id", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("not_found");
    expect(parsed.id).toBe("nonexistent-id");
  });

  it("update --json returns error object for non-existent task", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "update", "nonexistent-id", "--status", "done", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("not_found");
    expect(parsed.id).toBe("nonexistent-id");
  });

  it("list --search filters tasks by title", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Buy milk"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "add", "Walk the dog"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "ao", "list", "--search", "milk"]);
    expect(output).toContain("Buy milk");
    expect(output).not.toContain("Walk the dog");
  });

  it("list --search --json returns filtered JSON", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Buy milk"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "add", "Walk the dog"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "ao", "list", "--search", "milk", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Buy milk");
  });

  it("add --meta sets metadata key=value pairs", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync([
      "node",
      "ao",
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
    await p1.parseAsync(["node", "ao", "add", "Meta update", "--meta", "key1=val1", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--meta", "key2=val2", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.metadata).toEqual({ key1: "val1", key2: "val2" });
  });

  it("add --label accepts multiple labels", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "add", "Multi label", "--label", "work", "urgent", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["work", "urgent"]);
  });

  it("update --label appends multiple labels", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Label update", "--label", "work", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--label", "urgent", "bug", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["work", "urgent", "bug"]);
  });

  it("update rejects empty title", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Some task", "--json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--title", "   "]);
    expect(output).toContain("cannot be empty");
  });

  it("add rejects title exceeding max length", async () => {
    const longTitle = "a".repeat(1001);
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "add", longTitle]);
    expect(output).toContain("Title exceeds maximum length");
  });

  it("add rejects note exceeding max length", async () => {
    const longNote = "n".repeat(10001);
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "add", "Task", "--note", longNote]);
    expect(output).toContain("Note exceeds maximum length");
  });

  it("add rejects label exceeding max length", async () => {
    const longLabel = "l".repeat(201);
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "add", "Task", "--label", longLabel]);
    expect(output).toContain("Label exceeds maximum length");
  });

  it("add validation errors output JSON with --json", async () => {
    const longTitle = "a".repeat(1001);
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "add", longTitle, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("validation");
    expect(parsed.message).toContain("Title");
  });
});
