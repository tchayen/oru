import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { createTestDb, createTestKysely } from "../helpers/test-db.js";
import { FsRemote } from "../../src/sync/fs-remote.js";
import { SyncEngine } from "../../src/sync/engine.js";
import { writeOp } from "../../src/oplog/writer.js";
import { createTask, getTask } from "../../src/tasks/repository.js";

describe("e2e sync scenarios", () => {
  let tmpDir: string;
  let remote: FsRemote;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-e2e-test-"));
    remote = new FsRemote(path.join(tmpDir, "remote-oplog.db"));
  });

  afterEach(() => {
    remote.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("shopping list: PC creates, phone edits offline, both sync", async () => {
    const pc = createTestDb();
    const pcKy = createTestKysely(pc);
    const phone = createTestDb();
    const phoneKy = createTestKysely(phone);

    const enginePC = new SyncEngine(pc, remote, "pc");
    const enginePhone = new SyncEngine(phone, remote, "phone");

    // PC creates tasks
    const createVal = (title: string) =>
      JSON.stringify({
        title,
        status: "todo",
        priority: "medium",
        labels: [],
        notes: [],
        metadata: {},
      });

    await writeOp(pcKy, {
      task_id: "t1",
      device_id: "pc",
      op_type: "create",
      field: null,
      value: createVal("Buy milk"),
    });
    await createTask(pcKy, { id: "t1", title: "Buy milk" });
    await writeOp(pcKy, {
      task_id: "t2",
      device_id: "pc",
      op_type: "create",
      field: null,
      value: createVal("Buy eggs"),
    });
    await createTask(pcKy, { id: "t2", title: "Buy eggs" });

    // PC syncs
    await enginePC.push();

    // Phone syncs to get tasks
    await enginePhone.pull();

    // Phone goes offline and makes edits
    await writeOp(phoneKy, {
      task_id: "t1",
      device_id: "phone",
      op_type: "update",
      field: "status",
      value: "done",
    });
    await writeOp(phoneKy, {
      task_id: "t2",
      device_id: "phone",
      op_type: "update",
      field: "notes",
      value: "Get organic",
    });

    // PC also makes edits offline
    await writeOp(pcKy, {
      task_id: "t1",
      device_id: "pc",
      op_type: "update",
      field: "priority",
      value: "high",
    });

    // Both sync
    await enginePC.push();
    await enginePhone.push();
    await enginePC.pull();
    await enginePhone.pull();

    // Both devices converge
    const pcT1 = await getTask(pcKy, "t1");
    const phoneT1 = await getTask(phoneKy, "t1");
    expect(pcT1!.status).toBe("done");
    expect(pcT1!.priority).toBe("high");
    expect(phoneT1!.status).toBe("done");
    expect(phoneT1!.priority).toBe("high");

    const pcT2 = await getTask(pcKy, "t2");
    const phoneT2 = await getTask(phoneKy, "t2");
    expect(pcT2!.notes).toContain("Get organic");
    expect(phoneT2!.notes).toContain("Get organic");

    pc.close();
    phone.close();
  });

  it("three devices, staggered syncs, all converge", async () => {
    const d1 = createTestDb();
    const d1Ky = createTestKysely(d1);
    const d2 = createTestDb();
    const d2Ky = createTestKysely(d2);
    const d3 = createTestDb();
    const d3Ky = createTestKysely(d3);

    const e1 = new SyncEngine(d1, remote, "d1");
    const e2 = new SyncEngine(d2, remote, "d2");
    const e3 = new SyncEngine(d3, remote, "d3");

    // d1 creates a task
    const createVal = JSON.stringify({
      title: "Shared",
      status: "todo",
      priority: "low",
      labels: [],
      notes: [],
      metadata: {},
    });
    await writeOp(d1Ky, {
      task_id: "t1",
      device_id: "d1",
      op_type: "create",
      field: null,
      value: createVal,
    });
    await createTask(d1Ky, { id: "t1", title: "Shared", priority: "low" });

    await e1.push();

    // d2 syncs and updates
    await e2.pull();
    await writeOp(d2Ky, {
      task_id: "t1",
      device_id: "d2",
      op_type: "update",
      field: "status",
      value: "in_progress",
    });
    await e2.push();

    // d3 syncs (gets create + d2's update)
    await e3.pull();
    await writeOp(d3Ky, {
      task_id: "t1",
      device_id: "d3",
      op_type: "update",
      field: "priority",
      value: "urgent",
    });
    await e3.push();

    // Everyone syncs
    await e1.pull();
    await e2.pull();
    await e3.pull();

    const t1 = await getTask(d1Ky, "t1");
    const t2 = await getTask(d2Ky, "t1");
    const t3 = await getTask(d3Ky, "t1");

    // All converge to same state
    expect(t1!.status).toBe("in_progress");
    expect(t1!.priority).toBe("urgent");
    expect(t2!.status).toBe("in_progress");
    expect(t2!.priority).toBe("urgent");
    expect(t3!.status).toBe("in_progress");
    expect(t3!.priority).toBe("urgent");

    d1.close();
    d2.close();
    d3.close();
  });

  it("delete vs update: update wins after sync", async () => {
    const deleter = createTestDb();
    const deleterKy = createTestKysely(deleter);
    const updater = createTestDb();
    const updaterKy = createTestKysely(updater);

    const eDeleter = new SyncEngine(deleter, remote, "deleter");
    const eUpdater = new SyncEngine(updater, remote, "updater");

    // Both start with same task
    const createVal = JSON.stringify({
      title: "Task",
      status: "todo",
      priority: "medium",
      labels: [],
      notes: [],
      metadata: {},
    });
    await writeOp(deleterKy, {
      task_id: "t1",
      device_id: "deleter",
      op_type: "create",
      field: null,
      value: createVal,
    });
    await createTask(deleterKy, { id: "t1", title: "Task" });
    await eDeleter.push();
    await eUpdater.pull();

    // Deleter deletes
    await writeOp(deleterKy, {
      task_id: "t1",
      device_id: "deleter",
      op_type: "delete",
      field: null,
      value: null,
    });

    // Updater updates (later timestamp)
    await new Promise((r) => {
      setTimeout(r, 5);
    });
    await writeOp(updaterKy, {
      task_id: "t1",
      device_id: "updater",
      op_type: "update",
      field: "status",
      value: "done",
    });

    // Both sync
    await eDeleter.push();
    await eUpdater.push();
    await eDeleter.pull();
    await eUpdater.pull();

    // Update wins – task should exist on both
    const tDel = await getTask(deleterKy, "t1");
    const tUpd = await getTask(updaterKy, "t1");
    expect(tDel).toBeDefined();
    expect(tUpd).toBeDefined();
    expect(tDel!.status).toBe("done");
    expect(tUpd!.status).toBe("done");

    deleter.close();
    updater.close();
  });
});
