import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../helpers/test-db.js";
import { createProgram } from "../../src/cli.js";

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
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Buy milk", "--id", "task-001"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "_complete", "tasks"]);
    expect(output).toContain("task-001");
    expect(output).toContain("Buy milk");
  });

  it("filters tasks by prefix", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "First", "--id", "abc-001"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "add", "Second", "--id", "xyz-002"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "ao", "_complete", "tasks", "abc"]);
    expect(output).toContain("abc-001");
    expect(output).not.toContain("xyz-002");
  });

  it("returns unique labels", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Task A", "--label", "work"]);
    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "add", "Task B", "--label", "work", "home"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "ao", "_complete", "labels"]);
    const lines = output.trim().split("\n");
    expect(lines).toContain("home");
    expect(lines).toContain("work");
    // "work" should appear only once (deduped)
    expect(lines.filter((l) => l === "work")).toHaveLength(1);
  });

  it("filters labels by prefix", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Task", "--label", "work", "personal"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "_complete", "labels", "wo"]);
    expect(output).toContain("work");
    expect(output).not.toContain("personal");
  });

  it("excludes deleted tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync(["node", "ao", "add", "Deleted task", "--id", "del-001", "--json"]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "delete", "del-001"]);

    const p3 = createProgram(db, capture());
    await p3.parseAsync(["node", "ao", "_complete", "tasks"]);
    expect(output).not.toContain("del-001");
  });

  it("returns empty for unknown type", async () => {
    const p = createProgram(db, capture());
    await p.parseAsync(["node", "ao", "_complete", "unknown"]);
    expect(output.trim()).toBe("");
  });

  it("includes labels from done tasks", async () => {
    const p1 = createProgram(db, capture());
    await p1.parseAsync([
      "node",
      "ao",
      "add",
      "Done task",
      "--status",
      "done",
      "--label",
      "archived",
    ]);

    const p2 = createProgram(db, capture());
    await p2.parseAsync(["node", "ao", "_complete", "labels"]);
    expect(output).toContain("archived");
  });
});
