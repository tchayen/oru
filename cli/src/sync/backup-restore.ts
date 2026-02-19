import fs from "fs";
import path from "path";
import os from "os";
import type Database from "better-sqlite3";
import type { RemoteBackend } from "./remote";
import { SyncEngine } from "./engine";

export async function syncWithBackup(
  db: Database.Database,
  remote: RemoteBackend & { close?: () => void },
  deviceId: string,
): Promise<{ pushed: number; pulled: number }> {
  const dbPath = db.name;
  const backupPath = path.join(os.tmpdir(), `oru-sync-backup-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  try {
    const engine = new SyncEngine(db, remote, deviceId);
    return await engine.sync();
  } catch (err) {
    db.close();
    for (const ext of ["-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbPath + ext);
      } catch {}
    }
    fs.copyFileSync(backupPath, dbPath);
    throw err;
  } finally {
    remote.close?.();
    try {
      fs.unlinkSync(backupPath);
    } catch {}
  }
}
