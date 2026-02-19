import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";
import { initSchema } from "../../src/db/schema";
import { syncWithBackup } from "../../src/sync/backup-restore";
import type { RemoteBackend, PullResult } from "../../src/sync/remote";

function makePassingRemote(): RemoteBackend {
  return {
    push: async () => {},
    pull: async (): Promise<PullResult> => ({ entries: [], cursor: null }),
  };
}

function makePushFailingRemote(): RemoteBackend {
  return {
    push: async () => {
      throw new Error("push failed");
    },
    pull: async (): Promise<PullResult> => ({ entries: [], cursor: null }),
  };
}

describe("syncWithBackup", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-sync-backup-test-"));
    dbPath = path.join(tmpDir, "oru.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initSchema(db);
    db.exec(
      `INSERT INTO tasks (id, title, status, priority, labels, notes, metadata, created_at, updated_at) VALUES ('test-id-1', 'Test Task', 'todo', 'medium', '[]', '[]', '{}', '2026-01-01T00:00:00', '2026-01-01T00:00:00')`,
    );
    // Insert an oplog entry for device-1 so SyncEngine.push() actually calls remote.push()
    db.exec(
      `INSERT INTO oplog (id, task_id, device_id, op_type, field, value, timestamp) VALUES ('op-1', 'test-id-1', 'device-1', 'create', NULL, NULL, '2026-01-01T00:00:00')`,
    );
  });

  afterEach(() => {
    try {
      db.close();
    } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("happy path: sync succeeds and returns counts", async () => {
    const remote = makePassingRemote();
    const result = await syncWithBackup(db, remote, "device-1");
    expect(result).toEqual({ pushed: expect.any(Number), pulled: 0 });
    // DB is still open and readable
    const row = db.prepare("SELECT title FROM tasks WHERE id = 'test-id-1'").get() as {
      title: string;
    };
    expect(row.title).toBe("Test Task");
  });

  it("backup file is cleaned up after successful sync", async () => {
    const remote = makePassingRemote();
    const tmpFilesBefore = fs
      .readdirSync(os.tmpdir())
      .filter((f) => f.startsWith("oru-sync-backup-") && f.endsWith(".db"));
    await syncWithBackup(db, remote, "device-1");
    const tmpFilesAfter = fs
      .readdirSync(os.tmpdir())
      .filter((f) => f.startsWith("oru-sync-backup-") && f.endsWith(".db"));
    expect(tmpFilesAfter.length).toBeLessThanOrEqual(tmpFilesBefore.length);
  });

  it("push fails: DB file is intact with original data after restore", async () => {
    const remote = makePushFailingRemote();
    await expect(syncWithBackup(db, remote, "device-1")).rejects.toThrow("push failed");
    // Re-open the DB and verify original data is there
    const restored = new Database(dbPath);
    const row = restored.prepare("SELECT title FROM tasks WHERE id = 'test-id-1'").get() as
      | { title: string }
      | undefined;
    expect(row?.title).toBe("Test Task");
    restored.close();
  });

  it("backup file is deleted after a failed sync", async () => {
    const tmpFilesBefore = fs
      .readdirSync(os.tmpdir())
      .filter((f) => f.startsWith("oru-sync-backup-") && f.endsWith(".db"));
    const remote = makePushFailingRemote();
    await expect(syncWithBackup(db, remote, "device-1")).rejects.toThrow("push failed");
    const tmpFilesAfter = fs
      .readdirSync(os.tmpdir())
      .filter((f) => f.startsWith("oru-sync-backup-") && f.endsWith(".db"));
    expect(tmpFilesAfter.length).toBeLessThanOrEqual(tmpFilesBefore.length);
  });
});
