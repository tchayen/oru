import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { Kysely } from "kysely";
import type { DB } from "../../src/db/kysely.js";
import { createTestDb, createTestKysely } from "../helpers/test-db.js";
import { TaskService } from "../../src/main.js";
import { spawnId } from "../../src/recurrence/spawn-id.js";

describe("recurring task spawn", () => {
  let db: Database.Database;
  let ky: Kysely<DB>;
  let service: TaskService;

  beforeEach(() => {
    db = createTestDb();
    ky = createTestKysely(db);
    service = new TaskService(ky, "test-device");
  });

  it("spawns a child task when a recurring task is marked done", async () => {
    const parent = await service.add({
      title: "Water plants",
      recurrence: "FREQ=DAILY;INTERVAL=3",
      due_at: "2026-03-10",
    });

    const updated = await service.update(parent.id, { status: "done" });
    expect(updated!.status).toBe("done");

    const child = await service.getSpawnedTask(parent.id);
    expect(child).not.toBeNull();
    expect(child!.title).toBe("Water plants");
    expect(child!.status).toBe("todo");
    expect(child!.recurrence).toBe("FREQ=DAILY;INTERVAL=3");
    expect(child!.due_at).toMatch(/^2026-03-13T/);
    expect(child!.id).toBe(spawnId(parent.id));
  });

  it("does not spawn when a non-recurring task is marked done", async () => {
    const task = await service.add({ title: "One-off task" });
    await service.update(task.id, { status: "done" });

    const child = await service.getSpawnedTask(task.id);
    expect(child).toBeNull();
  });

  it("carries over labels, owner, priority, metadata", async () => {
    const parent = await service.add({
      title: "Standup",
      recurrence: "FREQ=WEEKLY",
      due_at: "2026-03-10",
      priority: "high",
      owner: "alice",
      labels: ["meeting", "team"],
      metadata: { room: "A1" },
    });

    await service.update(parent.id, { status: "done" });
    const child = await service.getSpawnedTask(parent.id);

    expect(child!.priority).toBe("high");
    expect(child!.owner).toBe("alice");
    expect(child!.labels).toEqual(["meeting", "team"]);
    expect(child!.metadata).toEqual({ room: "A1" });
  });

  it("resets notes and blocked_by on spawn", async () => {
    const blocker = await service.add({ title: "Blocker" });
    const parent = await service.add({
      title: "Task",
      recurrence: "FREQ=DAILY",
      due_at: "2026-03-10",
      blocked_by: [blocker.id],
      notes: ["initial note"],
    });

    await service.update(parent.id, { status: "done" });
    const child = await service.getSpawnedTask(parent.id);

    expect(child!.notes).toEqual([]);
    expect(child!.blocked_by).toEqual([]);
  });

  it("uses completion-based anchor with after: prefix", async () => {
    const parent = await service.add({
      title: "Laundry",
      recurrence: "after:FREQ=WEEKLY",
      due_at: "2026-01-01",
    });

    await service.update(parent.id, { status: "done" });
    const child = await service.getSpawnedTask(parent.id);

    // after: uses completion time (now) as anchor, not the old due_at
    // The due_at should be ~7 days from now, not from 2026-01-01
    const childDue = new Date(child!.due_at!);
    const now = new Date();
    const daysDiff = (childDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThan(6);
    expect(daysDiff).toBeLessThan(8);
  });

  it("is idempotent — marking done twice does not create duplicate", async () => {
    const parent = await service.add({
      title: "Water plants",
      recurrence: "FREQ=DAILY",
      due_at: "2026-03-10",
    });

    await service.update(parent.id, { status: "done" });
    const child1 = await service.getSpawnedTask(parent.id);

    // Try to trigger spawn again (e.g. via updateWithNote)
    await service.updateWithNote(parent.id, {}, "extra note");
    const child2 = await service.getSpawnedTask(parent.id);

    expect(child1!.id).toBe(child2!.id);

    // Only one child should exist
    const tasks = await service.list();
    const children = tasks.filter((t) => t.id === spawnId(parent.id));
    expect(children).toHaveLength(1);
  });

  it("spawns via updateWithNote when status becomes done", async () => {
    const parent = await service.add({
      title: "Weekly review",
      recurrence: "FREQ=WEEKLY",
      due_at: "2026-03-10",
    });

    await service.updateWithNote(parent.id, { status: "done" }, "All reviewed");
    const child = await service.getSpawnedTask(parent.id);
    expect(child).not.toBeNull();
    expect(child!.title).toBe("Weekly review");
  });

  it("deterministic child ID enables chain: A → B → C", async () => {
    const a = await service.add({
      title: "Recurring chain",
      recurrence: "FREQ=DAILY",
      due_at: "2026-03-10",
    });

    await service.update(a.id, { status: "done" });
    const b = await service.getSpawnedTask(a.id);
    expect(b).not.toBeNull();

    await service.update(b!.id, { status: "done" });
    const c = await service.getSpawnedTask(b!.id);
    expect(c).not.toBeNull();
    expect(c!.title).toBe("Recurring chain");
    expect(c!.id).toBe(spawnId(b!.id));
    expect(c!.id).not.toBe(b!.id);
  });

  it("does not spawn if recurrence is removed before completing", async () => {
    const parent = await service.add({
      title: "Temp recurring",
      recurrence: "FREQ=DAILY",
      due_at: "2026-03-10",
    });

    await service.update(parent.id, { recurrence: null });
    await service.update(parent.id, { status: "done" });

    const child = await service.getSpawnedTask(parent.id);
    expect(child).toBeNull();
  });

  it("falls back to now as anchor when no due_at and calendar-based", async () => {
    const parent = await service.add({
      title: "No due date",
      recurrence: "FREQ=DAILY;INTERVAL=5",
    });

    await service.update(parent.id, { status: "done" });
    const child = await service.getSpawnedTask(parent.id);
    expect(child).not.toBeNull();

    const childDue = new Date(child!.due_at!);
    const now = new Date();
    const daysDiff = (childDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThan(4);
    expect(daysDiff).toBeLessThan(6);
  });
});
