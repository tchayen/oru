import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { Kysely } from "kysely";
import type { DB } from "../src/db/kysely.js";
import { createTestDb, createTestKysely } from "./helpers/test-db.js";
import { TaskService } from "../src/main.js";
import { replayOps } from "../src/oplog/replay.js";
import { getTask } from "../src/tasks/repository.js";

describe("TaskService", () => {
  let db: Database.Database;
  let ky: Kysely<DB>;
  let service: TaskService;

  beforeEach(() => {
    db = createTestDb();
    ky = createTestKysely(db);
    service = new TaskService(ky, "test-device");
  });

  describe("add", () => {
    it("creates a task and writes oplog entry", async () => {
      const task = await service.add({ title: "Buy milk" });
      expect(task.title).toBe("Buy milk");
      expect(task.status).toBe("todo");
      expect(task.priority).toBe("medium");
      expect(task.id).toBeTruthy();

      const log = await service.log(task.id);
      expect(log).toHaveLength(1);
      expect(log![0].op_type).toBe("create");
      expect(log![0].task_id).toBe(task.id);
      expect(log![0].device_id).toBe("test-device");

      const value = JSON.parse(log![0].value!);
      expect(value.title).toBe("Buy milk");
      expect(value.status).toBe("todo");
      expect(value.priority).toBe("medium");
    });

    it("throws on duplicate custom ID", async () => {
      const customId = "custom-id-for-dup-test";
      await service.add({ id: customId, title: "First" });
      await expect(service.add({ id: customId, title: "Second" })).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("returns tasks with filters", async () => {
      await service.add({ title: "High task", priority: "high" });
      await service.add({ title: "Low task", priority: "low" });
      await service.add({ title: "Another high", priority: "high" });

      const all = await service.list();
      expect(all).toHaveLength(3);

      const highOnly = await service.list({ priority: "high" });
      expect(highOnly).toHaveLength(2);
      expect(highOnly.every((t) => t.priority === "high")).toBe(true);
    });
  });

  describe("get", () => {
    it("returns task by ID", async () => {
      const created = await service.add({ title: "Find me" });
      const found = await service.get(created.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe("Find me");
    });

    it("returns task by prefix", async () => {
      const created = await service.add({ title: "Prefix test" });
      const prefix = created.id.slice(0, 4);
      const found = await service.get(prefix);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it("returns null for missing ID", async () => {
      const found = await service.get("nonexistent-id");
      expect(found).toBeNull();
    });
  });

  describe("update", () => {
    it("updates fields and writes oplog entries", async () => {
      const task = await service.add({ title: "Original" });
      await new Promise((r) => {
        setTimeout(r, 5);
      });
      const updated = await service.update(task.id, { title: "Updated", priority: "high" });
      expect(updated!.title).toBe("Updated");
      expect(updated!.priority).toBe("high");

      const log = await service.log(task.id);
      // 1 create + 2 update ops (title and priority)
      expect(log).toHaveLength(3);
      const updateOps = log!.filter((e) => e.op_type === "update");
      expect(updateOps).toHaveLength(2);
      const fields = updateOps.map((e) => e.field).sort();
      expect(fields).toEqual(["priority", "title"]);
    });

    it("returns null for missing task", async () => {
      const result = await service.update("nonexistent", { title: "Nope" });
      expect(result).toBeNull();
    });
  });

  describe("addNote", () => {
    it("appends a note and writes oplog", async () => {
      const task = await service.add({ title: "Note task" });
      const updated = await service.addNote(task.id, "First note");
      expect(updated!.notes).toEqual(["First note"]);

      const log = await service.log(task.id);
      const noteOps = log!.filter((e) => e.op_type === "update" && e.field === "notes");
      expect(noteOps).toHaveLength(1);
      expect(noteOps[0].value).toBe("First note");
    });

    it("deduplicates identical notes", async () => {
      const task = await service.add({ title: "Dedup task" });
      await service.addNote(task.id, "Same note");
      const result = await service.addNote(task.id, "Same note");
      expect(result!.notes).toEqual(["Same note"]);

      const log = await service.log(task.id);
      const noteOps = log!.filter((e) => e.op_type === "update" && e.field === "notes");
      expect(noteOps).toHaveLength(1);
    });

    it("skips empty notes", async () => {
      const task = await service.add({ title: "Empty note task" });
      const result = await service.addNote(task.id, "   ");
      expect(result!.notes).toEqual([]);

      const log = await service.log(task.id);
      const noteOps = log!.filter((e) => e.op_type === "update" && e.field === "notes");
      expect(noteOps).toHaveLength(0);
    });

    it("returns null for missing task", async () => {
      const result = await service.addNote("nonexistent", "A note");
      expect(result).toBeNull();
    });
  });

  describe("updateWithNote", () => {
    it("updates fields and appends note atomically", async () => {
      const task = await service.add({ title: "Combo task" });
      const updated = await service.updateWithNote(
        task.id,
        { status: "in_progress" },
        "Started working",
      );
      expect(updated!.status).toBe("in_progress");
      expect(updated!.notes).toContain("Started working");

      const log = await service.log(task.id);
      const updateOps = log!.filter((e) => e.op_type === "update");
      const fields = updateOps.map((e) => e.field);
      expect(fields).toContain("status");
      expect(fields).toContain("notes");
    });

    it("returns null for missing task", async () => {
      const result = await service.updateWithNote("nonexistent", { title: "Nope" }, "A note");
      expect(result).toBeNull();
    });

    it("skips empty note but still updates fields", async () => {
      const task = await service.add({ title: "No note" });
      const updated = await service.updateWithNote(task.id, { priority: "high" }, "   ");
      expect(updated!.priority).toBe("high");
      expect(updated!.notes).toEqual([]);

      const log = await service.log(task.id);
      const noteOps = log!.filter((e) => e.op_type === "update" && e.field === "notes");
      expect(noteOps).toHaveLength(0);
    });
  });

  describe("clearNotes", () => {
    it("clears all notes and writes oplog", async () => {
      const task = await service.add({ title: "Clear notes task" });
      await service.addNote(task.id, "Note 1");
      await service.addNote(task.id, "Note 2");

      const cleared = await service.clearNotes(task.id);
      expect(cleared!.notes).toEqual([]);

      const log = await service.log(task.id);
      const clearOps = log!.filter((e) => e.field === "notes_clear");
      expect(clearOps).toHaveLength(1);
      expect(clearOps[0].value).toBe("");
    });

    it("returns null for missing task", async () => {
      const result = await service.clearNotes("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("replaceNotes", () => {
    it("replaces notes with new set", async () => {
      const task = await service.add({ title: "Replace notes task" });
      await service.addNote(task.id, "Old note");

      const replaced = await service.replaceNotes(task.id, ["New note 1", "New note 2"]);
      expect(replaced!.notes).toEqual(["New note 1", "New note 2"]);

      const log = await service.log(task.id);
      const clearOps = log!.filter((e) => e.field === "notes_clear");
      expect(clearOps).toHaveLength(1);
      const noteOps = log!.filter((e) => e.field === "notes");
      // 1 from addNote + 2 from replaceNotes
      expect(noteOps).toHaveLength(3);
    });

    it("returns null for missing task", async () => {
      const result = await service.replaceNotes("nonexistent", ["a"]);
      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("deletes a task and writes oplog", async () => {
      const task = await service.add({ title: "Delete me" });
      const result = await service.delete(task.id);
      expect(result).toBe(true);

      const found = await service.get(task.id);
      expect(found).toBeNull();

      // Oplog should have create + delete
      const rows = db
        .prepare("SELECT * FROM oplog WHERE task_id = ? ORDER BY id")
        .all(task.id) as Array<{ op_type: string }>;
      expect(rows).toHaveLength(2);
      expect(rows[0].op_type).toBe("create");
      expect(rows[1].op_type).toBe("delete");
    });

    it("returns false for missing task", async () => {
      const result = await service.delete("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("listLabels", () => {
    it("returns sorted unique labels", async () => {
      await service.add({ title: "A", labels: ["backend", "urgent"] });
      await service.add({ title: "B", labels: ["frontend", "backend"] });
      await service.add({ title: "C", labels: [] });

      const labels = await service.listLabels();
      expect(labels).toEqual(["backend", "frontend", "urgent"]);
    });

    it("returns empty array when no labels exist", async () => {
      await service.add({ title: "No labels" });
      const labels = await service.listLabels();
      expect(labels).toEqual([]);
    });
  });

  describe("log", () => {
    it("returns oplog entries for a task", async () => {
      const task = await service.add({ title: "Log task" });
      await service.update(task.id, { title: "Updated" });

      const log = await service.log(task.id);
      expect(log).not.toBeNull();
      expect(log!.length).toBeGreaterThanOrEqual(2);
      expect(log![0].op_type).toBe("create");
      expect(log![1].op_type).toBe("update");
      expect(log![0].timestamp <= log![1].timestamp).toBe(true);
    });

    it("returns null for missing task", async () => {
      const log = await service.log("nonexistent");
      expect(log).toBeNull();
    });
  });

  describe("null value serialization", () => {
    it("clearing owner produces null oplog value, not 'null' string", async () => {
      const task = await service.add({ title: "Owner task", owner: "agent" });
      await service.update(task.id, { owner: null });

      const log = await service.log(task.id);
      const ownerOps = log!.filter((e) => e.op_type === "update" && e.field === "owner");
      expect(ownerOps).toHaveLength(1);
      expect(ownerOps[0].value).toBeNull();
    });

    it("clearing due_at produces null oplog value, not 'null' string", async () => {
      const task = await service.add({ title: "Due task", due_at: "2025-12-31T00:00:00.000Z" });
      await service.update(task.id, { due_at: null });

      const log = await service.log(task.id);
      const dueOps = log!.filter((e) => e.op_type === "update" && e.field === "due_at");
      expect(dueOps).toHaveLength(1);
      expect(dueOps[0].value).toBeNull();
    });

    it("after replay, cleared owner is actually null", async () => {
      const task = await service.add({ title: "Replay owner task", owner: "agent" });
      await service.update(task.id, { owner: null });

      // Get all oplog entries and replay them onto a fresh DB
      const log = await service.log(task.id);
      const freshDb = createTestDb();
      const freshKy = createTestKysely(freshDb);
      replayOps(freshDb, log!);

      const replayed = await getTask(freshKy, task.id);
      expect(replayed).toBeDefined();
      expect(replayed!.owner).toBeNull();
    });

    it("after replay, cleared due_at is actually null", async () => {
      const task = await service.add({
        title: "Replay due task",
        due_at: "2025-12-31T00:00:00.000Z",
      });
      await service.update(task.id, { due_at: null });

      const log = await service.log(task.id);
      const freshDb = createTestDb();
      const freshKy = createTestKysely(freshDb);
      replayOps(freshDb, log!);

      const replayed = await getTask(freshKy, task.id);
      expect(replayed).toBeDefined();
      expect(replayed!.due_at).toBeNull();
    });

    it("clearing owner via updateWithNote produces null oplog value", async () => {
      const task = await service.add({ title: "Combo null task", owner: "agent" });
      await service.updateWithNote(task.id, { owner: null }, "clearing owner");

      const log = await service.log(task.id);
      const ownerOps = log!.filter((e) => e.op_type === "update" && e.field === "owner");
      expect(ownerOps).toHaveLength(1);
      expect(ownerOps[0].value).toBeNull();
    });
  });

  describe("note field filtering", () => {
    it("note field from UpdateTaskInput is not written to oplog", async () => {
      const task = await service.add({ title: "Note field task" });
      await service.update(task.id, { title: "Renamed", note: "a note" } as any);

      const log = await service.log(task.id);
      const updateOps = log!.filter((e) => e.op_type === "update");
      const fields = updateOps.map((e) => e.field);
      expect(fields).toContain("title");
      expect(fields).not.toContain("note");
    });

    it("note field is not written via updateWithNote either", async () => {
      const task = await service.add({ title: "Note field combo task" });
      await service.updateWithNote(
        task.id,
        { status: "done", note: "inline note" } as any,
        "real note",
      );

      const log = await service.log(task.id);
      const updateOps = log!.filter((e) => e.op_type === "update");
      const fields = updateOps.map((e) => e.field);
      expect(fields).toContain("status");
      expect(fields).toContain("notes");
      expect(fields).not.toContain("note");
    });
  });

  describe("whitespace edge cases", () => {
    it("add with whitespace-only title creates task (no validation at service layer)", async () => {
      // Service layer does not validate - validation happens in CLI layer
      const task = await service.add({ title: "   " });
      expect(task.title).toBe("   ");
    });

    it("addNote with empty string is a no-op", async () => {
      const task = await service.add({ title: "Task" });
      const result = await service.addNote(task.id, "");
      // service.addNote() trims and returns early if empty
      expect(result!.notes).toEqual([]);

      const log = await service.log(task.id);
      const noteOps = log!.filter((e) => e.field === "notes");
      // No note op should be written
      expect(noteOps).toHaveLength(0);
    });

    it("addNote with whitespace-only string is a no-op", async () => {
      const task = await service.add({ title: "Task" });
      const result = await service.addNote(task.id, "   \t\n  ");
      // service.addNote() trims to empty and returns early
      expect(result!.notes).toEqual([]);

      const log = await service.log(task.id);
      const noteOps = log!.filter((e) => e.field === "notes");
      expect(noteOps).toHaveLength(0);
    });

    it("addNote with whitespace-only duplicate is a no-op", async () => {
      const task = await service.add({ title: "Task" });
      await service.addNote(task.id, "Note");
      const result = await service.addNote(task.id, "  Note  ");
      // Trimmed duplicate is detected and skipped
      expect(result!.notes).toEqual(["Note"]);

      const log = await service.log(task.id);
      const noteOps = log!.filter((e) => e.field === "notes");
      // Only the first note should be written
      expect(noteOps).toHaveLength(1);
    });

    it("addNote trims before storing", async () => {
      const task = await service.add({ title: "Task" });
      await service.addNote(task.id, "  padded note  ");
      const result = await service.get(task.id);
      expect(result!.notes).toEqual(["padded note"]);
    });

    it("updateWithNote with empty note string is a no-op for note", async () => {
      const task = await service.add({ title: "Task" });
      const result = await service.updateWithNote(task.id, { status: "done" }, "");
      // Status update happens, but empty note is skipped
      expect(result!.status).toBe("done");
      expect(result!.notes).toEqual([]);

      const log = await service.log(task.id);
      const noteOps = log!.filter((e) => e.field === "notes");
      expect(noteOps).toHaveLength(0);
    });

    it("updateWithNote with whitespace-only note is a no-op for note", async () => {
      const task = await service.add({ title: "Task" });
      const result = await service.updateWithNote(task.id, { status: "done" }, "   ");
      expect(result!.status).toBe("done");
      expect(result!.notes).toEqual([]);

      const log = await service.log(task.id);
      const noteOps = log!.filter((e) => e.field === "notes");
      expect(noteOps).toHaveLength(0);
    });
  });
});
