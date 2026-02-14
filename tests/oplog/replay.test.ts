import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../helpers/test-db.js";
import { replayOps } from "../../src/oplog/replay.js";
import type { OplogEntry } from "../../src/oplog/types.js";
import { getTask } from "../../src/tasks/repository.js";

function makeOp(overrides: Partial<OplogEntry> & { id: string; task_id: string }): OplogEntry {
  return {
    device_id: "device-1",
    op_type: "update",
    field: null,
    value: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("oplog replay", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("replays a create op", () => {
    const ops: OplogEntry[] = [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Buy milk",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
      }),
    ];
    replayOps(db, ops);
    const task = getTask(db, "t1");
    expect(task).toBeDefined();
    expect(task!.title).toBe("Buy milk");
    expect(task!.status).toBe("todo");
  });

  it("replays an update op", () => {
    // First create the task
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    // Then update it
    replayOps(db, [
      makeOp({
        id: "op-2",
        task_id: "t1",
        op_type: "update",
        field: "status",
        value: "done",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.status).toBe("done");
  });

  it("replays a delete op", () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    replayOps(db, [
      makeOp({
        id: "op-2",
        task_id: "t1",
        op_type: "delete",
        field: null,
        value: null,
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task).toBeNull();
  });

  it("last-write-wins: later update wins", () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
      makeOp({
        id: "op-2",
        task_id: "t1",
        device_id: "device-a",
        op_type: "update",
        field: "status",
        value: "in_progress",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        device_id: "device-b",
        op_type: "update",
        field: "status",
        value: "done",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.status).toBe("done");
  });

  it("last-write-wins: earlier update does not override later", () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    // Apply later update first
    replayOps(db, [
      makeOp({
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "status",
        value: "done",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    // Then apply earlier update — should NOT override
    replayOps(db, [
      makeOp({
        id: "op-2",
        task_id: "t1",
        op_type: "update",
        field: "status",
        value: "in_progress",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.status).toBe("done");
  });

  it("updates beat deletes: update after delete restores task", () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
      makeOp({
        id: "op-2",
        task_id: "t1",
        op_type: "delete",
        field: null,
        value: null,
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "status",
        value: "done",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task).toBeDefined();
    expect(task!.status).toBe("done");
    expect(task!.deleted_at).toBeNull();
  });

  it("notes are append-only and accumulate", () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
      makeOp({
        id: "op-2",
        task_id: "t1",
        op_type: "update",
        field: "notes",
        value: "Note A",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "notes",
        value: "Note B",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.notes).toEqual(["Note A", "Note B"]);
  });

  it("notes are deduped", () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
      makeOp({
        id: "op-2",
        task_id: "t1",
        op_type: "update",
        field: "notes",
        value: "Same note",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "notes",
        value: "Same note",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.notes).toEqual(["Same note"]);
  });

  it("per-field resolution: different fields from different devices both kept", () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "low",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
      makeOp({
        id: "op-2",
        task_id: "t1",
        device_id: "device-a",
        op_type: "update",
        field: "status",
        value: "done",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        device_id: "device-b",
        op_type: "update",
        field: "priority",
        value: "urgent",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.status).toBe("done");
    expect(task!.priority).toBe("urgent");
  });

  it("idempotent replay — applying same ops twice has no extra effect", () => {
    const ops: OplogEntry[] = [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
      makeOp({
        id: "op-2",
        task_id: "t1",
        op_type: "update",
        field: "status",
        value: "done",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ];
    replayOps(db, ops);
    replayOps(db, ops);
    const task = getTask(db, "t1");
    expect(task!.status).toBe("done");
  });

  it("handles out-of-order ops correctly", () => {
    // Deliver ops in reverse order
    replayOps(db, [
      makeOp({
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "status",
        value: "done",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
      makeOp({
        id: "op-2",
        task_id: "t1",
        op_type: "update",
        field: "status",
        value: "in_progress",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.title).toBe("Task");
    expect(task!.status).toBe("done");
  });
});
