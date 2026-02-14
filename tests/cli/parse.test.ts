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
    await p1.parseAsync(["node", "ao", "add", "Find me"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "get", id]);
    expect(output).toContain("Find me");
  });

  it("get --json outputs valid JSON", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "JSON get"]);
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
    await p1.parseAsync(["node", "ao", "add", "Old title"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--title", "New title"]);
    expect(output).toContain("New title");
  });

  it("update --status changes status", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "In progress"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--status", "done"]);
    expect(output).toContain("done");
  });

  it("update --note appends a note", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Task with notes"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--note", "A note"]);
    expect(output).toContain("A note");
  });

  it("delete command removes a task", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Delete me"]);
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

  it("add always outputs JSON (for agent parsing)", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "add", "Agent task"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.id).toBeTruthy();
    expect(parsed.title).toBe("Agent task");
  });

  // GAP-1: Combined --note + --status in a single atomic update
  it("update --note + --status applies both atomically", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Atomic task"]);
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
    await p.parseAsync(["node", "ao", "add", "ID task", "--id", "custom-id-123"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.id).toBe("custom-id-123");
  });

  it("add --id is idempotent — returns existing task on re-run", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "First run", "--id", "idem-id"]);
    const first = JSON.parse(output.trim());

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "add", "Second run", "--id", "idem-id"]);
    const second = JSON.parse(output.trim());

    expect(second.id).toBe(first.id);
    expect(second.title).toBe("First run"); // Original title preserved
  });

  // AGENT-8a: --note on add
  it("add --note creates task with initial note", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "add", "Noted task", "--note", "initial context"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.notes).toContain("initial context");
  });

  // AGENT-8b: --label on update
  it("update --label appends a label", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Label task"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--label", "urgent", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toContain("urgent");
  });

  it("update --label deduplicates", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Dedup task", "--label", "work"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "update", id, "--label", "work", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed.labels).toEqual(["work"]);
  });

  // AGENT-7: --json on delete
  it("delete --json returns structured response", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Delete json"]);
    const id = JSON.parse(output.trim()).id;

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "delete", id, "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toEqual({ id, deleted: true });
  });

  it("delete --json for non-existent task", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "delete", "no-such-id", "--json"]);
    const parsed = JSON.parse(output.trim());
    expect(parsed).toEqual({ id: "no-such-id", deleted: false });
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
});
