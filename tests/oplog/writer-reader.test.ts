import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../helpers/test-db.js";
import { writeOp } from "../../src/oplog/writer.js";
import { readOps, readOpsByTask, readOpsByDevice, readOpsAfter } from "../../src/oplog/reader.js";
import type { OplogEntry } from "../../src/oplog/types.js";

describe("oplog writer", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("records a create op", () => {
    const entry = writeOp(db, {
      task_id: "task-1",
      device_id: "device-a",
      op_type: "create",
      field: null,
      value: JSON.stringify({ title: "Buy milk", status: "todo", priority: "medium" }),
    });
    expect(entry.id).toBeTruthy();
    expect(entry.task_id).toBe("task-1");
    expect(entry.op_type).toBe("create");
    expect(entry.device_id).toBe("device-a");
    expect(entry.timestamp).toBeTruthy();
  });

  it("records an update op", () => {
    const entry = writeOp(db, {
      task_id: "task-1",
      device_id: "device-a",
      op_type: "update",
      field: "status",
      value: "done",
    });
    expect(entry.op_type).toBe("update");
    expect(entry.field).toBe("status");
    expect(entry.value).toBe("done");
  });

  it("records a delete op", () => {
    const entry = writeOp(db, {
      task_id: "task-1",
      device_id: "device-a",
      op_type: "delete",
      field: null,
      value: null,
    });
    expect(entry.op_type).toBe("delete");
    expect(entry.field).toBeNull();
    expect(entry.value).toBeNull();
  });

  it("generates unique UUIDv7 ids", () => {
    const e1 = writeOp(db, {
      task_id: "t1",
      device_id: "d1",
      op_type: "create",
      field: null,
      value: "{}",
    });
    const e2 = writeOp(db, {
      task_id: "t2",
      device_id: "d1",
      op_type: "create",
      field: null,
      value: "{}",
    });
    expect(e1.id).not.toBe(e2.id);
  });

  it("stores device_id correctly", () => {
    writeOp(db, {
      task_id: "t1",
      device_id: "my-device",
      op_type: "create",
      field: null,
      value: "{}",
    });
    const raw = db.prepare("SELECT device_id FROM oplog WHERE task_id = 't1'").get() as {
      device_id: string;
    };
    expect(raw.device_id).toBe("my-device");
  });
});

describe("oplog reader", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("reads ops by task", () => {
    writeOp(db, { task_id: "t1", device_id: "d1", op_type: "create", field: null, value: "{}" });
    writeOp(db, {
      task_id: "t1",
      device_id: "d1",
      op_type: "update",
      field: "status",
      value: "done",
    });
    writeOp(db, { task_id: "t2", device_id: "d1", op_type: "create", field: null, value: "{}" });

    const ops = readOpsByTask(db, "t1");
    expect(ops).toHaveLength(2);
    expect(ops.every((o: OplogEntry) => o.task_id === "t1")).toBe(true);
  });

  it("reads ops after a timestamp", async () => {
    writeOp(db, { task_id: "t1", device_id: "d1", op_type: "create", field: null, value: "{}" });
    const before = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 5));
    writeOp(db, {
      task_id: "t1",
      device_id: "d1",
      op_type: "update",
      field: "status",
      value: "done",
    });

    const ops = readOpsAfter(db, before);
    expect(ops).toHaveLength(1);
    expect(ops[0].op_type).toBe("update");
  });

  it("reads ops by device", () => {
    writeOp(db, { task_id: "t1", device_id: "d1", op_type: "create", field: null, value: "{}" });
    writeOp(db, {
      task_id: "t1",
      device_id: "d2",
      op_type: "update",
      field: "status",
      value: "done",
    });

    const ops = readOpsByDevice(db, "d2");
    expect(ops).toHaveLength(1);
    expect(ops[0].device_id).toBe("d2");
  });

  it("reads all ops in order", () => {
    writeOp(db, { task_id: "t1", device_id: "d1", op_type: "create", field: null, value: "{}" });
    writeOp(db, { task_id: "t2", device_id: "d1", op_type: "create", field: null, value: "{}" });

    const ops = readOps(db);
    expect(ops).toHaveLength(2);
    // Should be ordered by timestamp
    expect(ops[0].timestamp <= ops[1].timestamp).toBe(true);
  });

  it("reads ops from other devices (excludes given device)", () => {
    writeOp(db, { task_id: "t1", device_id: "d1", op_type: "create", field: null, value: "{}" });
    writeOp(db, {
      task_id: "t1",
      device_id: "d2",
      op_type: "update",
      field: "status",
      value: "done",
    });

    const ops = readOps(db, { excludeDevice: "d1" });
    expect(ops).toHaveLength(1);
    expect(ops[0].device_id).toBe("d2");
  });
});
