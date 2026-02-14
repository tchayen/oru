import type Database from "better-sqlite3";
import type { OplogEntry } from "./types.js";

interface ReadOpsOptions {
  excludeDevice?: string;
}

export function readOps(db: Database.Database, options?: ReadOpsOptions): OplogEntry[] {
  if (options?.excludeDevice) {
    return db
      .prepare("SELECT * FROM oplog WHERE device_id != ? ORDER BY timestamp ASC, id ASC")
      .all(options.excludeDevice) as OplogEntry[];
  }
  return db.prepare("SELECT * FROM oplog ORDER BY timestamp ASC, id ASC").all() as OplogEntry[];
}

export function readOpsByTask(db: Database.Database, taskId: string): OplogEntry[] {
  return db
    .prepare("SELECT * FROM oplog WHERE task_id = ? ORDER BY timestamp ASC, id ASC")
    .all(taskId) as OplogEntry[];
}

export function readOpsAfter(db: Database.Database, after: string): OplogEntry[] {
  return db
    .prepare("SELECT * FROM oplog WHERE timestamp > ? ORDER BY timestamp ASC, id ASC")
    .all(after) as OplogEntry[];
}

export function readOpsByDevice(db: Database.Database, deviceId: string): OplogEntry[] {
  return db
    .prepare("SELECT * FROM oplog WHERE device_id = ? ORDER BY timestamp ASC, id ASC")
    .all(deviceId) as OplogEntry[];
}
