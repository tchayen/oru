import type Database from "better-sqlite3";
import { runMigrations, type Migration } from "./migrations.js";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      labels TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '[]',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS oplog (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      op_type TEXT NOT NULL,
      field TEXT,
      value TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');
  `);

  runMigrations(db, appMigrations);
}

export const appMigrations: Migration[] = [
  {
    version: 2,
    up: (d) => {
      d.exec("CREATE INDEX IF NOT EXISTS idx_oplog_task_id ON oplog(task_id)");
      d.exec("CREATE INDEX IF NOT EXISTS idx_oplog_device_id ON oplog(device_id)");
    },
  },
  {
    version: 3,
    up: (d) => {
      d.exec(
        "CREATE INDEX IF NOT EXISTS idx_oplog_task_timestamp ON oplog(task_id, timestamp, id)",
      );
    },
  },
  {
    version: 4,
    up: (d) => {
      d.exec("ALTER TABLE tasks ADD COLUMN due_at TEXT");
    },
  },
  {
    version: 5,
    up: (d) => {
      d.exec("ALTER TABLE tasks ADD COLUMN blocked_by TEXT NOT NULL DEFAULT '[]'");
    },
  },
  {
    version: 6,
    up: (d) => {
      d.exec("ALTER TABLE tasks ADD COLUMN owner TEXT");
    },
  },
  {
    version: 7,
    up: (d) => {
      d.exec("ALTER TABLE tasks ADD COLUMN recurrence TEXT");
    },
  },
];
