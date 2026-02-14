import type Database from "better-sqlite3";
import { generateId } from "./id.js";

export function getDeviceId(db: Database.Database): string {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'device_id'").get() as
    | { value: string }
    | undefined;

  if (row) return row.value;

  const deviceId = generateId();
  db.prepare("INSERT INTO meta (key, value) VALUES ('device_id', ?)").run(deviceId);
  return deviceId;
}
