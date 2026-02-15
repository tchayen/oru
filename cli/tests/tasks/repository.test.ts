import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { Kysely } from "kysely";
import type { DB } from "../../src/db/kysely.js";
import { createTestDb, createTestKysely } from "../helpers/test-db.js";
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  appendNote,
  deleteTask,
  AmbiguousPrefixError,
} from "../../src/tasks/repository.js";

describe("task repository", () => {
  let db: Database.Database;
  let ky: Kysely<DB>;

  beforeEach(() => {
    db = createTestDb();
    ky = createTestKysely(db);
  });

  it("creates a task with defaults", async () => {
    const task = await createTask(ky, { title: "Buy milk" });
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

  it("creates a task with all fields", async () => {
    const task = await createTask(ky, {
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

  it("creates a task with a given id", async () => {
    const task = await createTask(ky, { id: "custom-id-123", title: "With ID" });
    expect(task.id).toBe("custom-id-123");
  });

  it("lists tasks excluding deleted", async () => {
    await createTask(ky, { title: "A" });
    await createTask(ky, { title: "B" });
    const c = await createTask(ky, { title: "C" });
    await deleteTask(ky, c.id);

    const tasks = await listTasks(ky);
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.title)).toEqual(expect.arrayContaining(["A", "B"]));
  });

  it("filters by status", async () => {
    await createTask(ky, { title: "Todo", status: "todo" });
    await createTask(ky, { title: "Done", status: "done" });

    const tasks = await listTasks(ky, { status: "done" });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Done");
  });

  it("filters by label", async () => {
    await createTask(ky, { title: "Work", labels: ["work"] });
    await createTask(ky, { title: "Home", labels: ["home"] });
    await createTask(ky, { title: "Both", labels: ["work", "home"] });

    const tasks = await listTasks(ky, { label: "work" });
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.title).sort()).toEqual(["Both", "Work"]);
  });

  it("filters by priority", async () => {
    await createTask(ky, { title: "Low", priority: "low" });
    await createTask(ky, { title: "High", priority: "high" });

    const tasks = await listTasks(ky, { priority: "high" });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("High");
  });

  it("gets a task by id", async () => {
    const created = await createTask(ky, { title: "Find me" });
    const found = await getTask(ky, created.id);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Find me");
  });

  it("returns null for nonexistent task", async () => {
    const found = await getTask(ky, "nonexistent-id");
    expect(found).toBeNull();
  });

  it("updates task fields", async () => {
    const task = await createTask(ky, { title: "Old title", priority: "low" });
    // Ensure distinct timestamp
    await new Promise((r) => {
      setTimeout(r, 5);
    });
    const updated = await updateTask(ky, task.id, { title: "New title", priority: "high" });
    expect(updated!.title).toBe("New title");
    expect(updated!.priority).toBe("high");
    expect(updated!.updated_at).not.toBe(task.updated_at);
  });

  it("appends a note", async () => {
    const task = await createTask(ky, { title: "Task" });
    await appendNote(ky, task.id, "First note");
    await appendNote(ky, task.id, "Second note");
    const found = await getTask(ky, task.id);
    expect(found!.notes).toEqual(["First note", "Second note"]);
  });

  it("soft deletes a task", async () => {
    const task = await createTask(ky, { title: "Delete me" });
    await deleteTask(ky, task.id);
    const found = await getTask(ky, task.id);
    expect(found).toBeNull();

    // But it still exists in the DB
    const raw = db.prepare("SELECT deleted_at FROM tasks WHERE id = ?").get(task.id) as {
      deleted_at: string | null;
    };
    expect(raw.deleted_at).toBeTruthy();
  });

  it("stores labels as JSON", async () => {
    const task = await createTask(ky, { title: "T", labels: ["a", "b"] });
    const raw = db.prepare("SELECT labels FROM tasks WHERE id = ?").get(task.id) as {
      labels: string;
    };
    expect(JSON.parse(raw.labels)).toEqual(["a", "b"]);
  });

  it("stores metadata as JSON", async () => {
    const task = await createTask(ky, { title: "T", metadata: { key: "value" } });
    const raw = db.prepare("SELECT metadata FROM tasks WHERE id = ?").get(task.id) as {
      metadata: string;
    };
    expect(JSON.parse(raw.metadata)).toEqual({ key: "value" });
  });

  it("getTask matches by prefix when unique", async () => {
    const task = await createTask(ky, { title: "Prefix match" });
    const prefix = task.id.slice(0, 4);
    const found = await getTask(ky, prefix);
    expect(found).toBeDefined();
    expect(found!.id).toBe(task.id);
  });

  it("getTask throws AmbiguousPrefixError for ambiguous prefix", async () => {
    // Create two tasks whose IDs share the same first character
    await createTask(ky, { id: "aaaa-1111-test-task-aaaa-aaaaaaaaaaaa", title: "A" });
    await createTask(ky, { id: "aaaa-2222-test-task-aaaa-aaaaaaaaaaaa", title: "B" });
    // Prefix "aaaa" matches both, should throw
    await expect(getTask(ky, "aaaa")).rejects.toThrow(AmbiguousPrefixError);
    try {
      await getTask(ky, "aaaa");
    } catch (err) {
      expect(err).toBeInstanceOf(AmbiguousPrefixError);
      const ambErr = err as AmbiguousPrefixError;
      expect(ambErr.prefix).toBe("aaaa");
      expect(ambErr.matches).toHaveLength(2);
      expect(ambErr.matches).toContain("aaaa-1111-test-task-aaaa-aaaaaaaaaaaa");
      expect(ambErr.matches).toContain("aaaa-2222-test-task-aaaa-aaaaaaaaaaaa");
    }
  });

  it("lists tasks sorted by priority (urgent first)", async () => {
    await createTask(ky, { title: "Low task", priority: "low" });
    await createTask(ky, { title: "Urgent task", priority: "urgent" });
    await createTask(ky, { title: "Medium task", priority: "medium" });
    await createTask(ky, { title: "High task", priority: "high" });

    const tasks = await listTasks(ky);
    expect(tasks.map((t) => t.priority)).toEqual(["urgent", "high", "medium", "low"]);
  });

  it("sorts by priority then by creation time", async () => {
    await createTask(ky, { title: "First high" }, "2024-01-01T00:00:00.000Z");
    await createTask(ky, { title: "Second high" }, "2024-01-02T00:00:00.000Z");
    await createTask(ky, { title: "Urgent task", priority: "urgent" });

    const tasks = await listTasks(ky);
    expect(tasks.map((t) => t.title)).toEqual(["Urgent task", "First high", "Second high"]);
  });

  it("filters by search term (case-insensitive)", async () => {
    await createTask(ky, { title: "Buy milk" });
    await createTask(ky, { title: "Buy eggs" });
    await createTask(ky, { title: "Walk the dog" });

    const tasks = await listTasks(ky, { search: "buy" });
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.title).sort()).toEqual(["Buy eggs", "Buy milk"]);
  });

  it("updateTask works with prefix ID", async () => {
    const task = await createTask(ky, { title: "Original" });
    const prefix = task.id.slice(0, 4);
    const updated = await updateTask(ky, prefix, { title: "Updated via prefix" });
    expect(updated).toBeDefined();
    expect(updated!.title).toBe("Updated via prefix");
    // Verify the actual DB row was updated
    const found = await getTask(ky, task.id);
    expect(found!.title).toBe("Updated via prefix");
  });

  it("appendNote works with prefix ID", async () => {
    const task = await createTask(ky, { title: "Note task" });
    const prefix = task.id.slice(0, 4);
    const updated = await appendNote(ky, prefix, "Note via prefix");
    expect(updated).toBeDefined();
    expect(updated!.notes).toEqual(["Note via prefix"]);
    // Verify the actual DB row was updated
    const found = await getTask(ky, task.id);
    expect(found!.notes).toEqual(["Note via prefix"]);
  });

  it("deleteTask works with prefix ID", async () => {
    const task = await createTask(ky, { title: "Delete via prefix" });
    const prefix = task.id.slice(0, 4);
    const result = await deleteTask(ky, prefix);
    expect(result).toBe(true);
    // Verify it's actually deleted
    const found = await getTask(ky, task.id);
    expect(found).toBeNull();
  });

  it("search escapes LIKE wildcards", async () => {
    await createTask(ky, { title: "100% done" });
    await createTask(ky, { title: "Regular task" });

    const tasks = await listTasks(ky, { search: "%" });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("100% done");
  });

  it("handles corrupt JSON in labels/notes/metadata gracefully", async () => {
    const task = await createTask(ky, { title: "Corrupt" });
    // Directly corrupt the JSON columns
    db.prepare("UPDATE tasks SET labels = ?, notes = ?, metadata = ? WHERE id = ?").run(
      "not-json",
      "{broken",
      "{{bad",
      task.id,
    );
    const found = await getTask(ky, task.id);
    expect(found).toBeDefined();
    expect(found!.labels).toEqual([]);
    expect(found!.notes).toEqual([]);
    expect(found!.metadata).toEqual({});
  });
});
