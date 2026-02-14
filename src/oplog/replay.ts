import type Database from "better-sqlite3";
import type { OplogEntry } from "./types.js";

const VALID_STATUSES = new Set(["todo", "in_progress", "done"]);
const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const VALID_OP_TYPES = new Set(["create", "update", "delete"]);

function isValidJson(s: string): boolean {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

/**
 * Replay oplog entries onto the tasks table.
 *
 * Conflict resolution rules:
 * - Last-write-wins per field (based on timestamp, then id as tiebreaker)
 * - Updates beat deletes (an update at or after a delete restores the task)
 * - Notes are append-only and deduped
 * - Idempotent — replaying same ops has no extra effect
 */
export function replayOps(db: Database.Database, ops: OplogEntry[]): void {
  // First, insert all ops into the oplog table (idempotent)
  // Skip entries with invalid op_type
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO oplog (id, task_id, device_id, op_type, field, value, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const op of ops) {
    if (!VALID_OP_TYPES.has(op.op_type)) continue;
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

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(createOp.value!) as Record<string, unknown>;
  } catch {
    return; // Malformed create op, skip this task
  }

  // Start with created state
  let title = typeof data.title === "string" ? data.title : "Untitled";
  let status = VALID_STATUSES.has(data.status as string) ? (data.status as string) : "todo";
  let priority = VALID_PRIORITIES.has(data.priority as string)
    ? (data.priority as string)
    : "medium";
  let labels = JSON.stringify(Array.isArray(data.labels) ? data.labels : []);
  let metadata = JSON.stringify(
    data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? data.metadata
      : {},
  );
  const notes: string[] = [...(Array.isArray(data.notes) ? data.notes : [])];
  let deletedAt: string | null = null;
  let updatedAt = createOp.timestamp;

  // Precompute: does any update exist at or after each timestamp?
  // This avoids O(n^2) scanning in the delete handler.
  let latestUpdateTimestamp: string | null = null;
  for (const op of ops) {
    if (op.op_type === "update") {
      if (!latestUpdateTimestamp || op.timestamp > latestUpdateTimestamp) {
        latestUpdateTimestamp = op.timestamp;
      }
    }
  }

  // Track latest timestamp+id per field for LWW tiebreaking
  const fieldWinners: Record<string, { timestamp: string; id: string }> = {};

  // Apply all ops in order
  for (const op of ops) {
    if (op.op_type === "create") continue; // Already handled

    if (op.op_type === "delete") {
      // Updates beat deletes: only apply if no update exists at or after this delete
      const hasLaterOrEqualUpdate =
        latestUpdateTimestamp !== null && latestUpdateTimestamp >= op.timestamp;
      if (!hasLaterOrEqualUpdate) {
        deletedAt = op.timestamp;
        if (op.timestamp > updatedAt) updatedAt = op.timestamp;
      }
      continue;
    }

    if (op.op_type === "update") {
      const field = op.field;
      if (!field) continue;

      // Notes: append-only with dedup
      if (field === "notes") {
        if (op.value && !notes.includes(op.value)) {
          notes.push(op.value);
        }
        if (op.timestamp > updatedAt) updatedAt = op.timestamp;
        if (deletedAt && op.timestamp >= deletedAt) {
          deletedAt = null;
        }
        continue;
      }

      // LWW per field with explicit id tiebreaker
      const current = fieldWinners[field];
      if (current) {
        if (op.timestamp < current.timestamp) continue;
        if (op.timestamp === current.timestamp && op.id < current.id) continue;
      }
      fieldWinners[field] = { timestamp: op.timestamp, id: op.id };

      // Validate and apply
      switch (field) {
        case "title":
          if (typeof op.value === "string") title = op.value;
          break;
        case "status":
          if (op.value && VALID_STATUSES.has(op.value)) status = op.value;
          break;
        case "priority":
          if (op.value && VALID_PRIORITIES.has(op.value)) priority = op.value;
          break;
        case "labels":
          if (op.value && isValidJson(op.value)) labels = op.value;
          break;
        case "metadata":
          if (op.value && isValidJson(op.value)) metadata = op.value;
          break;
      }

      if (op.timestamp > updatedAt) updatedAt = op.timestamp;

      // An update at or after a delete restores the task
      if (deletedAt && op.timestamp >= deletedAt) {
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
       deleted_at = excluded.deleted_at`,
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
    deletedAt,
  );
}
