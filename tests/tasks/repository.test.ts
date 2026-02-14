import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../helpers/test-db.js";
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  appendNote,
  deleteTask,
} from "../../src/tasks/repository.js";

describe("task repository", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("creates a task with defaults", () => {
    const task = createTask(db, { title: "Buy milk" });
    expect(task.title).toBe("Buy milk");
    expect(task.status).toBe("todo");
    expect(task.priority).toBe("medium");
    expect(task.labels).toEqual([]);
    expect(task.notes).toEqual([]);
    expect(task.metadata).toEqual({});
    expect(task.deleted_at).toBeNull();
    expect(task.id).toBeTruthy();
    expect(task.created_at).toBeTruthy();
    expect(task.updated_at).toBeTruthy();
  });

  it("creates a task with all fields", () => {
    const task = createTask(db, {
      title: "Deploy app",
      status: "in_progress",
      priority: "urgent",
      labels: ["work", "devops"],
      notes: ["Check CI first"],
      metadata: { sprint: 5 },
    });
    expect(task.title).toBe("Deploy app");
    expect(task.status).toBe("in_progress");
    expect(task.priority).toBe("urgent");
    expect(task.labels).toEqual(["work", "devops"]);
    expect(task.notes).toEqual(["Check CI first"]);
    expect(task.metadata).toEqual({ sprint: 5 });
  });

  it("creates a task with a given id", () => {
    const task = createTask(db, { id: "custom-id-123", title: "With ID" });
    expect(task.id).toBe("custom-id-123");
  });

  it("lists tasks excluding deleted", () => {
    createTask(db, { title: "A" });
    createTask(db, { title: "B" });
    const c = createTask(db, { title: "C" });
    deleteTask(db, c.id);

    const tasks = listTasks(db);
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.title)).toEqual(expect.arrayContaining(["A", "B"]));
  });

  it("filters by status", () => {
    createTask(db, { title: "Todo", status: "todo" });
    createTask(db, { title: "Done", status: "done" });

    const tasks = listTasks(db, { status: "done" });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Done");
  });

  it("filters by label", () => {
    createTask(db, { title: "Work", labels: ["work"] });
    createTask(db, { title: "Home", labels: ["home"] });
    createTask(db, { title: "Both", labels: ["work", "home"] });

    const tasks = listTasks(db, { label: "work" });
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.title).sort()).toEqual(["Both", "Work"]);
  });

  it("filters by priority", () => {
    createTask(db, { title: "Low", priority: "low" });
    createTask(db, { title: "High", priority: "high" });

    const tasks = listTasks(db, { priority: "high" });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("High");
  });

  it("gets a task by id", () => {
    const created = createTask(db, { title: "Find me" });
    const found = getTask(db, created.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Find me");
  });

  it("returns null for nonexistent task", () => {
    const found = getTask(db, "nonexistent-id");
    expect(found).toBeNull();
  });

  it("updates task fields", async () => {
    const task = createTask(db, { title: "Old title", priority: "low" });
    // Ensure distinct timestamp
    await new Promise((r) => setTimeout(r, 5));
    const updated = updateTask(db, task.id, { title: "New title", priority: "high" });
    expect(updated!.title).toBe("New title");
    expect(updated!.priority).toBe("high");
    expect(updated!.updated_at).not.toBe(task.updated_at);
  });

  it("appends a note", () => {
    const task = createTask(db, { title: "Task" });
    appendNote(db, task.id, "First note");
    appendNote(db, task.id, "Second note");
    const found = getTask(db, task.id);
    expect(found!.notes).toEqual(["First note", "Second note"]);
  });

  it("soft deletes a task", () => {
    const task = createTask(db, { title: "Delete me" });
    deleteTask(db, task.id);
    const found = getTask(db, task.id);
    expect(found).toBeNull();

    // But it still exists in the DB
    const raw = db.prepare("SELECT deleted_at FROM tasks WHERE id = ?").get(task.id) as {
      deleted_at: string | null;
    };
    expect(raw.deleted_at).toBeTruthy();
  });

  it("stores labels as JSON", () => {
    const task = createTask(db, { title: "T", labels: ["a", "b"] });
    const raw = db.prepare("SELECT labels FROM tasks WHERE id = ?").get(task.id) as {
      labels: string;
    };
    expect(JSON.parse(raw.labels)).toEqual(["a", "b"]);
  });

  it("stores metadata as JSON", () => {
    const task = createTask(db, { title: "T", metadata: { key: "value" } });
    const raw = db.prepare("SELECT metadata FROM tasks WHERE id = ?").get(task.id) as {
      metadata: string;
    };
    expect(JSON.parse(raw.metadata)).toEqual({ key: "value" });
  });
});
