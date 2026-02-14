import type Database from "better-sqlite3";
import type { OplogEntry } from "./types.js";

/**
 * Replay oplog entries onto the tasks table.
 *
 * Conflict resolution rules:
 * - Last-write-wins per field (based on timestamp)
 * - Updates beat deletes (an update after a delete restores the task)
 * - Notes are append-only and deduped
 * - Idempotent — replaying same ops has no extra effect
 */
export function replayOps(db: Database.Database, ops: OplogEntry[]): void {
  // First, insert all ops into the oplog table (idempotent)
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO oplog (id, task_id, device_id, op_type, field, value, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const op of ops) {
    insertStmt.run(op.id, op.task_id, op.device_id, op.op_type, op.field, op.value, op.timestamp);
  }

  // Collect all affected task IDs
  const taskIds = [...new Set(ops.map((op) => op.task_id))];

  // Rebuild each affected task from its full oplog
  for (const taskId of taskIds) {
    rebuildTask(db, taskId);
  }
}

function rebuildTask(db: Database.Database, taskId: string): void {
  // Get ALL ops for this task, sorted by timestamp
  const ops = db
    .prepare("SELECT * FROM oplog WHERE task_id = ? ORDER BY timestamp ASC, id ASC")
    .all(taskId) as OplogEntry[];

  if (ops.length === 0) return;

  // Find the create op
  const createOp = ops.find((op) => op.op_type === "create");
  if (!createOp) return;

  const data = JSON.parse(createOp.value!);

  // Start with created state
  let title = data.title;
  let status = data.status ?? "todo";
  let priority = data.priority ?? "medium";
  let labels = JSON.stringify(data.labels ?? []);
  let metadata = JSON.stringify(data.metadata ?? {});
  const notes: string[] = [...(data.notes ?? [])];
  let deletedAt: string | null = null;
  let updatedAt = createOp.timestamp;

  // Track latest timestamp per field for LWW
  const fieldTimestamps: Record<string, string> = {};

  // Apply all ops in order
  for (const op of ops) {
    if (op.op_type === "create") continue; // Already handled

    if (op.op_type === "delete") {
      // Only apply if no later update exists
      const hasLaterUpdate = ops.some(
        (o) => o.op_type === "update" && o.timestamp > op.timestamp
      );
      if (!hasLaterUpdate) {
        deletedAt = op.timestamp;
        if (op.timestamp > updatedAt) updatedAt = op.timestamp;
      }
      continue;
    }

    if (op.op_type === "update") {
      const field = op.field!;

      // Notes: append-only with dedup
      if (field === "notes") {
        if (!notes.includes(op.value!)) {
          notes.push(op.value!);
        }
        if (op.timestamp > updatedAt) updatedAt = op.timestamp;
        // An update always clears deleted status if it comes after
        if (deletedAt && op.timestamp > deletedAt) {
          deletedAt = null;
        }
        continue;
      }

      // LWW per field: only apply if this is the latest for this field
      const currentTs = fieldTimestamps[field];
      if (currentTs && op.timestamp < currentTs) continue;
      // If same timestamp, use id as tiebreaker (already sorted)
      fieldTimestamps[field] = op.timestamp;

      switch (field) {
        case "title":
          title = op.value!;
          break;
        case "status":
          status = op.value!;
          break;
        case "priority":
          priority = op.value!;
          break;
        case "labels":
          labels = op.value!;
          break;
        case "metadata":
          metadata = op.value!;
          break;
      }

      if (op.timestamp > updatedAt) updatedAt = op.timestamp;

      // An update after a delete restores the task
      if (deletedAt && op.timestamp > deletedAt) {
        deletedAt = null;
      }
    }
  }

  // Upsert the task
  db.prepare(
    `INSERT INTO tasks (id, title, status, priority, labels, notes, metadata, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       status = excluded.status,
       priority = excluded.priority,
       labels = excluded.labels,
       notes = excluded.notes,
       metadata = excluded.metadata,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at`
  ).run(
    taskId,
    title,
    status,
    priority,
    labels,
    JSON.stringify(notes),
    metadata,
    createOp.timestamp,
    updatedAt,
    deletedAt
  );
}
