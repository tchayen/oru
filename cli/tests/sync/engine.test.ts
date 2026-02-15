import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import type Database from "better-sqlite3";
import type { Kysely } from "kysely";
import type { DB } from "../../src/db/kysely.js";
import { createTestDb, createTestKysely } from "../helpers/test-db.js";
import { FsRemote } from "../../src/sync/fs-remote.js";
import { SyncEngine } from "../../src/sync/engine.js";
import { writeOp } from "../../src/oplog/writer.js";
import { getTask } from "../../src/tasks/repository.js";
import { createTask } from "../../src/tasks/repository.js";

describe("SyncEngine", () => {
  let tmpDir: string;
  let remote: FsRemote;
  let db: Database.Database;
  let ky: Kysely<DB>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ao-engine-test-"));
    remote = new FsRemote(path.join(tmpDir, "remote-oplog.db"));
    db = createTestDb();
    ky = createTestKysely(db);
  });

  afterEach(() => {
    remote.close();
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("pushes local ops to remote", async () => {
    await writeOp(ky, {
      task_id: "t1",
      device_id: "device-a",
      op_type: "create",
      field: null,
      value: JSON.stringify({
        title: "Task 1",
        status: "todo",
        priority: "medium",
        labels: [],
        notes: [],
        metadata: {},
      }),
    });

    const engine = new SyncEngine(db, remote, "device-a");
    await engine.push();

    const { entries: remoteOps } = await remote.pull(null);
    expect(remoteOps).toHaveLength(1);
    expect(remoteOps[0].task_id).toBe("t1");
  });

  it("pulls remote ops to local", async () => {
    // Push from "another device"
    await remote.push([
      {
        id: "op-remote-1",
        task_id: "t-remote",
        device_id: "device-b",
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: "Remote Task",
          status: "todo",
          priority: "medium",
          labels: [],
          notes: [],
          metadata: {},
        }),
        timestamp: "2024-01-01T00:00:00.000Z",
      },
    ]);

    const engine = new SyncEngine(db, remote, "device-a");
    await engine.pull();

    const task = await getTask(ky, "t-remote");
    expect(task).toBeDefined();
    expect(task!.title).toBe("Remote Task");
  });

  it("round-trip: push then pull on different device", async () => {
    const db2 = createTestDb();
    const ky2 = createTestKysely(db2);

    // Device A creates a task
    await writeOp(ky, {
      task_id: "t1",
      device_id: "device-a",
      op_type: "create",
      field: null,
      value: JSON.stringify({
        title: "Shared Task",
        status: "todo",
        priority: "medium",
        labels: [],
        notes: [],
        metadata: {},
      }),
    });
    await createTask(ky, { id: "t1", title: "Shared Task" });

    const engineA = new SyncEngine(db, remote, "device-a");
    await engineA.push();

    // Device B pulls
    const engineB = new SyncEngine(db2, remote, "device-b");
    await engineB.pull();

    const task = await getTask(ky2, "t1");
    expect(task).toBeDefined();
    expect(task!.title).toBe("Shared Task");

    db2.close();
  });

  it("bidirectional merge", async () => {
    const db2 = createTestDb();
    const ky2 = createTestKysely(db2);

    // Both devices create different tasks locally
    await writeOp(ky, {
      task_id: "t-a",
      device_id: "device-a",
      op_type: "create",
      field: null,
      value: JSON.stringify({
        title: "From A",
        status: "todo",
        priority: "medium",
        labels: [],
        notes: [],
        metadata: {},
      }),
    });
    await createTask(ky, { id: "t-a", title: "From A" });

    await writeOp(ky2, {
      task_id: "t-b",
      device_id: "device-b",
      op_type: "create",
      field: null,
      value: JSON.stringify({
        title: "From B",
        status: "todo",
        priority: "medium",
        labels: [],
        notes: [],
        metadata: {},
      }),
    });
    await createTask(ky2, { id: "t-b", title: "From B" });

    // Both push and pull
    const engineA = new SyncEngine(db, remote, "device-a");
    const engineB = new SyncEngine(db2, remote, "device-b");

    await engineA.push();
    await engineB.push();
    await engineA.pull();
    await engineB.pull();

    // Both should have both tasks
    expect(await getTask(ky, "t-a")).toBeDefined();
    expect(await getTask(ky, "t-b")).toBeDefined();
    expect(await getTask(ky2, "t-a")).toBeDefined();
    expect(await getTask(ky2, "t-b")).toBeDefined();

    db2.close();
  });

  // GAP-6: Push idempotency — pushing same ops twice doesn't duplicate
  it("push is idempotent — double push does not duplicate", async () => {
    await writeOp(ky, {
      task_id: "t1",
      device_id: "device-a",
      op_type: "create",
      field: null,
      value: JSON.stringify({
        title: "Task 1",
        status: "todo",
        priority: "medium",
        labels: [],
        notes: [],
        metadata: {},
      }),
    });

    const engine = new SyncEngine(db, remote, "device-a");

    const pushed1 = await engine.push();
    expect(pushed1).toBe(1);

    // Second push should push 0 (already tracked)
    const pushed2 = await engine.push();
    expect(pushed2).toBe(0);

    // Remote should have exactly 1 entry
    const { entries } = await remote.pull(null);
    expect(entries).toHaveLength(1);
  });

  it("conflict resolution through sync", async () => {
    const db2 = createTestDb();
    const ky2 = createTestKysely(db2);

    // Both devices start with the same task
    const createValue = JSON.stringify({
      title: "Task",
      status: "todo",
      priority: "medium",
      labels: [],
      notes: [],
      metadata: {},
    });

    await writeOp(ky, {
      task_id: "t1",
      device_id: "device-a",
      op_type: "create",
      field: null,
      value: createValue,
    });
    await createTask(ky, { id: "t1", title: "Task" });

    const engineA = new SyncEngine(db, remote, "device-a");
    await engineA.push();

    const engineB = new SyncEngine(db2, remote, "device-b");
    await engineB.pull();

    // Device A updates status
    await writeOp(ky, {
      task_id: "t1",
      device_id: "device-a",
      op_type: "update",
      field: "status",
      value: "done",
    });

    // Device B updates priority
    await writeOp(ky2, {
      task_id: "t1",
      device_id: "device-b",
      op_type: "update",
      field: "priority",
      value: "urgent",
    });

    // Sync both
    await engineA.push();
    await engineB.push();
    await engineA.pull();
    await engineB.pull();

    // Both should have per-field merge
    const taskA = await getTask(ky, "t1");
    const taskB = await getTask(ky2, "t1");
    expect(taskA!.status).toBe("done");
    expect(taskA!.priority).toBe("urgent");
    expect(taskB!.status).toBe("done");
    expect(taskB!.priority).toBe("urgent");

    db2.close();
  });
});
