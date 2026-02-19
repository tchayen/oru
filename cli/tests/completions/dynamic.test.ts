import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../helpers/test-db";
import { createProgram } from "../../src/cli";

describe("_complete command", () => {
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

  it("returns task IDs with titles", async () => {
    const taskId = "TASKaaaaaaa";
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Buy milk", "--id", taskId]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "_complete", "tasks"]);
    expect(output).toContain(taskId);
    expect(output).toContain("Buy milk");
  });

  it("filters tasks by prefix", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "First", "--id", "abc00000000"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Second", "--id", "xyz00000000"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "_complete", "tasks", "abc"]);
    expect(output).toContain("abc00000000");
    expect(output).not.toContain("xyz00000000");
  });

  it("returns unique labels", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task A", "--label", "work"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "add", "Task B", "--label", "work", "home"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "_complete", "labels"]);
    const lines = output.trim().split("\n");
    expect(lines).toContain("home");
    expect(lines).toContain("work");
    // "work" should appear only once (deduped)
    expect(lines.filter((l) => l === "work")).toHaveLength(1);
  });

  it("filters labels by prefix", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Task", "--label", "work", "personal"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "_complete", "labels", "wo"]);
    expect(output).toContain("work");
    expect(output).not.toContain("personal");
  });

  it("excludes deleted tasks", async () => {
    const delId = "del00000000";
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "oru", "add", "Deleted task", "--id", delId, "--json"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "delete", delId]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "oru", "_complete", "tasks"]);
    expect(output).not.toContain(delId);
  });

  it("returns empty for unknown type", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "oru", "_complete", "unknown"]);
    expect(output.trim()).toBe("");
  });

  it("includes labels from done tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "oru",
      "add",
      "Done task",
      "--status",
      "done",
      "--label",
      "archived",
    ]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "oru", "_complete", "labels"]);
    expect(output).toContain("archived");
  });
});
