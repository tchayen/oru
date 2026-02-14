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

  // GAP-2: Same-timestamp conflict resolution uses id as deterministic tiebreaker
  it("same-timestamp updates resolve deterministically by id", () => {
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
        id: "op-2a",
        task_id: "t1",
        device_id: "device-a",
        op_type: "update",
        field: "status",
        value: "in_progress",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-2b",
        task_id: "t1",
        device_id: "device-b",
        op_type: "update",
        field: "status",
        value: "done",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    // "op-2b" > "op-2a" lexicographically, so "done" wins
    expect(task!.status).toBe("done");
  });

  it("same-timestamp delete vs update: update wins", () => {
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
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    // Update at same timestamp as delete should restore the task
    expect(task).toBeDefined();
    expect(task!.deleted_at).toBeNull();
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

  it("caps notes at 1000 per task", () => {
    const ops: OplogEntry[] = [
      makeOp({
        id: "op-0",
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
    ];
    for (let i = 0; i < 1005; i++) {
      ops.push(
        makeOp({
          id: `op-note-${String(i).padStart(5, "0")}`,
          task_id: "t1",
          op_type: "update",
          field: "notes",
          value: `Note ${i}`,
          timestamp: `2024-01-01T01:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
        }),
      );
    }
    replayOps(db, ops);
    const task = getTask(db, "t1");
    expect(task!.notes).toHaveLength(1000);
  });

  it("filters non-string labels from create ops", () => {
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
          labels: ["valid", 42, null, "also-valid"],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.labels).toEqual(["valid", "also-valid"]);
  });

  it("filters non-string labels from update ops", () => {
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
        field: "labels",
        value: JSON.stringify(["good", 123, true, "fine"]),
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.labels).toEqual(["good", "fine"]);
  });

  it("trims notes before dedup comparison", () => {
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
        value: "Hello",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "notes",
        value: "  Hello  ",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.notes).toEqual(["Hello"]);
  });

  it("rejects whitespace-only notes", () => {
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
        value: "   ",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "notes",
        value: "",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task!.notes).toEqual([]);
  });

  it("skips create ops with null value", () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: null,
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    const task = getTask(db, "t1");
    expect(task).toBeNull();
  });
});
