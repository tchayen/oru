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
