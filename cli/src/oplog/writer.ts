import type { Kysely } from "kysely";
import { generateId } from "../id";
import type { DB } from "../db/kysely";
import type { OplogEntry, OpType } from "./types";

export interface WriteOpInput {
  task_id: string;
  device_id: string;
  op_type: OpType;
  field: string | null;
  value: string | null;
}

export async function writeOp(
  db: Kysely<DB>,
  input: WriteOpInput,
  timestamp?: string,
): Promise<OplogEntry> {
  const id = generateId();
  const ts = timestamp ?? new Date().toISOString();

  await db
    .insertInto("oplog")
    .values({
      id,
      task_id: input.task_id,
      device_id: input.device_id,
      op_type: input.op_type,
      field: input.field,
      value: input.value,
      timestamp: ts,
    })
    .execute();

  return {
    id,
    task_id: input.task_id,
    device_id: input.device_id,
    op_type: input.op_type,
    field: input.field,
    value: input.value,
    timestamp: ts,
  };
}
