import { Kysely, SqliteDialect } from "kysely";
import type BetterSqlite3 from "better-sqlite3";

export type TaskTable = {
  id: string;
  title: string;
  status: string;
  priority: string;
  blocked_by: string;
  labels: string;
  notes: string;
  metadata: string;
  created_at: string;
  due_at: string | null;
  owner: string | null;
  recurrence: string | null;
  updated_at: string;
  deleted_at: string | null;
};

export type OplogTable = {
  id: string;
  task_id: string;
  device_id: string;
  op_type: string;
  field: string | null;
  value: string | null;
  timestamp: string;
};

export type MetaTable = {
  key: string;
  value: string;
};

export type DB = {
  tasks: TaskTable;
  oplog: OplogTable;
  meta: MetaTable;
};

export function createKysely(db: BetterSqlite3.Database): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new SqliteDialect({ database: db }),
  });
}
