import type Database from "better-sqlite3";
import { generateId } from "./id.js";

export function getDeviceId(db: Database.Database): string {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'device_id'").get() as
    | { value: string }
    | undefined;

  if (row) {
    return row.value;
  }

  const deviceId = generateId();
  // INSERT OR IGNORE avoids UNIQUE constraint violation if two processes race
  db.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES ('device_id', ?)").run(deviceId);

  // Re-read to get the winning value (may differ from ours if another process won)
  const actual = db.prepare("SELECT value FROM meta WHERE key = 'device_id'").get() as {
    value: string;
  };
  return actual.value;
}
