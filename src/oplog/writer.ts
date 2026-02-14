import type Database from "better-sqlite3";
import { generateId } from "../id.js";
import type { OplogEntry, OpType } from "./types.js";

export interface WriteOpInput {
  task_id: string;
  device_id: string;
  op_type: OpType;
  field: string | null;
  value: string | null;
}

export function writeOp(db: Database.Database, input: WriteOpInput): OplogEntry {
  const id = generateId();
  const timestamp = new Date().toISOString();

  db.prepare(
    `INSERT INTO oplog (id, task_id, device_id, op_type, field, value, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.task_id, input.device_id, input.op_type, input.field, input.value, timestamp);

  return {
    id,
    task_id: input.task_id,
    device_id: input.device_id,
    op_type: input.op_type,
    field: input.field,
    value: input.value,
    timestamp,
  };
}
