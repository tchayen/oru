import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { Kysely } from "kysely";
import type { DB } from "../../src/db/kysely";
import { createTestDb, createTestKysely } from "../helpers/test-db";
import { writeOp } from "../../src/oplog/writer";

describe("oplog writer", () => {
  let db: Database.Database;
  let ky: Kysely<DB>;

  beforeEach(() => {
    db = createTestDb();
    ky = createTestKysely(db);
  });

  it("records a create op", async () => {
    const entry = await writeOp(ky, {
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

  it("records an update op", async () => {
    const entry = await writeOp(ky, {
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

  it("records a delete op", async () => {
    const entry = await writeOp(ky, {
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

  it("generates unique UUIDv7 ids", async () => {
    const e1 = await writeOp(ky, {
      task_id: "t1",
      device_id: "d1",
      op_type: "create",
      field: null,
      value: "{}",
    });
    const e2 = await writeOp(ky, {
      task_id: "t2",
      device_id: "d1",
      op_type: "create",
      field: null,
      value: "{}",
    });
    expect(e1.id).not.toBe(e2.id);
  });

  it("stores device_id correctly", async () => {
    await writeOp(ky, {
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

  it("accepts explicit timestamp", async () => {
    const ts = "2024-06-01T00:00:00.000Z";
    const entry = await writeOp(
      ky,
      {
        task_id: "t1",
        device_id: "d1",
        op_type: "create",
        field: null,
        value: "{}",
      },
      ts,
    );
    expect(entry.timestamp).toBe(ts);
  });
});
