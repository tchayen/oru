import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { Kysely } from "kysely";
import type { DB } from "../../src/db/kysely";
import { createTestDb, createTestKysely } from "../helpers/test-db";
import { replayOps } from "../../src/oplog/replay";
import type { OplogEntry } from "../../src/oplog/types";
import { getTask } from "../../src/tasks/repository";

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
  let ky: Kysely<DB>;

  beforeEach(() => {
    db = createTestDb();
    ky = createTestKysely(db);
  });

  it("replays a create op", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task).toBeDefined();
    expect(task!.title).toBe("Buy milk");
    expect(task!.status).toBe("todo");
  });

  it("replays an update op", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.status).toBe("done");
  });

  it("replays a delete op", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task).toBeNull();
  });

  it("last-write-wins: later update wins", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.status).toBe("done");
  });

  it("last-write-wins: earlier update does not override later", async () => {
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
    // Then apply earlier update - should NOT override
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
    const task = await getTask(ky, "t1");
    expect(task!.status).toBe("done");
  });

  it("updates beat deletes: update after delete restores task", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task).toBeDefined();
    expect(task!.status).toBe("done");
    expect(task!.deleted_at).toBeNull();
  });

  it("notes are append-only and accumulate", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.notes).toEqual(["Note A", "Note B"]);
  });

  it("notes are deduped", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.notes).toEqual(["Same note"]);
  });

  it("per-field resolution: different fields from different devices both kept", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.status).toBe("done");
    expect(task!.priority).toBe("urgent");
  });

  it("idempotent replay - applying same ops twice has no extra effect", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.status).toBe("done");
  });

  it("same-timestamp updates resolve deterministically by id", async () => {
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
    const task = await getTask(ky, "t1");
    // "op-2b" > "op-2a" lexicographically, so "done" wins
    expect(task!.status).toBe("done");
  });

  it("same-timestamp delete vs update: update wins", async () => {
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
    const task = await getTask(ky, "t1");
    // Update at same timestamp as delete should restore the task
    expect(task).toBeDefined();
    expect(task!.deleted_at).toBeNull();
    expect(task!.status).toBe("done");
  });

  it("handles out-of-order ops correctly", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.title).toBe("Task");
    expect(task!.status).toBe("done");
  });

  it("caps notes at 1000 per task", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.notes).toHaveLength(1000);
  });

  it("filters non-string labels from create ops", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.labels).toEqual(["valid", "also-valid"]);
  });

  it("filters non-string labels from update ops", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.labels).toEqual(["good", "fine"]);
  });

  it("trims notes before dedup comparison", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.notes).toEqual(["Hello"]);
  });

  it("stores notes trimmed after replay", async () => {
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
        value: "  Hello  ",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "notes",
        value: "\tWorld\n",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.notes).toEqual(["Hello", "World"]);
  });

  it("notes_clear removes all accumulated notes", async () => {
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
          notes: ["initial note"],
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
        field: "notes_clear",
        value: "",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.notes).toEqual([]);
  });

  it("notes added after notes_clear are kept", async () => {
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
        value: "Old note",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "notes_clear",
        value: "",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
      makeOp({
        id: "op-4",
        task_id: "t1",
        op_type: "update",
        field: "notes",
        value: "New note",
        timestamp: "2024-01-01T00:03:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.notes).toEqual(["New note"]);
  });

  it("rejects whitespace-only notes", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task!.notes).toEqual([]);
  });

  it("skips create ops with null value", async () => {
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
    const task = await getTask(ky, "t1");
    expect(task).toBeNull();
  });

  it("replays create with owner", async () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Owned task",
          status: "todo",
          priority: "medium",
          owner: "agent",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.owner).toBe("agent");
  });

  it("replays update to owner", async () => {
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
        field: "owner",
        value: "human",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.owner).toBe("human");
  });

  it("normalizes empty string owner to null in create op", async () => {
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
          owner: "",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    // Empty string owner from create op should be normalized to null
    expect(task!.owner).toBeNull();
  });

  it("clears owner with empty value", async () => {
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
          owner: "agent",
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
        field: "owner",
        value: "",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.owner).toBeNull();
  });

  it("replays create with blocked_by", async () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Blocked task",
          status: "todo",
          priority: "medium",
          blocked_by: ["dep-1", "dep-2"],
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.blocked_by).toEqual(["dep-1", "dep-2"]);
  });

  it("replays update to blocked_by", async () => {
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
          blocked_by: ["dep-1"],
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
        field: "blocked_by",
        value: JSON.stringify(["dep-2", "dep-3"]),
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.blocked_by).toEqual(["dep-2", "dep-3"]);
  });

  it("valid op is not blocked by a later invalid op (D-10 LWW poisoning)", async () => {
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
        field: "status",
        value: "in_progress",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "status",
        value: "invalid_xyz",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    // Op B (invalid) should not poison the LWW tiebreaker - Op A's valid value is preserved
    expect(task!.status).toBe("in_progress");
  });

  it("after invalid op, earlier valid op value is preserved across replays", async () => {
    // First replay: create + invalid op
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
        id: "op-3",
        task_id: "t1",
        op_type: "update",
        field: "priority",
        value: "not_a_priority",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    // Second replay: deliver the earlier valid op
    replayOps(db, [
      makeOp({
        id: "op-2",
        task_id: "t1",
        op_type: "update",
        field: "priority",
        value: "high",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    // The valid op should win because the invalid op was never recorded as a field winner
    expect(task!.priority).toBe("high");
  });

  it("metadata update with array value is rejected (D-9)", async () => {
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
          metadata: { key: "value" },
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
      makeOp({
        id: "op-2",
        task_id: "t1",
        op_type: "update",
        field: "metadata",
        value: JSON.stringify(["not", "an", "object"]),
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    // Array metadata should be rejected; original object metadata preserved
    expect(task!.metadata).toEqual({ key: "value" });
  });

  it("filters non-string blocked_by from create ops", async () => {
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
          blocked_by: ["valid", 42, null, "also-valid"],
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.blocked_by).toEqual(["valid", "also-valid"]);
  });

  it("notes_clear sorts before notes ops at the same timestamp regardless of ID order", async () => {
    // The notes op ID ("AAAnotes") sorts before the notes_clear ID ("ZZZclear")
    // alphabetically. Without the fix, notes would be applied first and then cleared,
    // leaving the task with empty notes. With the fix, notes_clear runs first so the
    // notes added in the same batch are kept.
    const ts = "2026-01-01T00:00:00.000Z";
    replayOps(db, [
      makeOp({
        id: "op-create",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: ["old note"],
          metadata: {},
        }),
        timestamp: "2025-01-01T00:00:00.000Z",
      }),
      // notes op ID sorts BEFORE notes_clear ID: "AAAnotes" < "ZZZclear"
      makeOp({
        id: "AAAnotes",
        task_id: "t1",
        op_type: "update",
        field: "notes",
        value: "Kept note",
        timestamp: ts,
      }),
      makeOp({
        id: "ZZZclear",
        task_id: "t1",
        op_type: "update",
        field: "notes_clear",
        value: "",
        timestamp: ts,
      }),
      makeOp({
        id: "ZZZnote2",
        task_id: "t1",
        op_type: "update",
        field: "notes",
        value: "Also kept",
        timestamp: ts,
      }),
    ]);
    const task = await getTask(ky, "t1");
    // notes_clear runs first (sort weight 0), then both notes are appended
    expect(task!.notes).toEqual(["Kept note", "Also kept"]);
  });

  it("replays create with due_tz set", async () => {
    replayOps(db, [
      makeOp({
        id: "op-1",
        task_id: "t1",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Task with timezone",
          status: "todo",
          priority: "medium",
          due_tz: "America/New_York",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task).toBeDefined();
    expect(task!.due_tz).toBe("America/New_York");
  });

  it("replays update that sets due_tz", async () => {
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
        field: "due_tz",
        value: "America/New_York",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.due_tz).toBe("America/New_York");
  });

  it("replays update that clears due_tz with empty string", async () => {
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
          due_tz: "Europe/London",
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
        field: "due_tz",
        value: "",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.due_tz).toBeNull();
  });

  it("last-write-wins for due_tz: later timestamp wins", async () => {
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
        field: "due_tz",
        value: "America/New_York",
        timestamp: "2024-01-01T00:01:00.000Z",
      }),
      makeOp({
        id: "op-3",
        task_id: "t1",
        device_id: "device-b",
        op_type: "update",
        field: "due_tz",
        value: "Asia/Tokyo",
        timestamp: "2024-01-01T00:02:00.000Z",
      }),
    ]);
    const task = await getTask(ky, "t1");
    expect(task!.due_tz).toBe("Asia/Tokyo");
  });
});
