import type Database from "better-sqlite3";
import type { OplogEntry } from "./types.js";
import { VALID_STATUSES, VALID_PRIORITIES } from "../tasks/types.js";
const VALID_OP_TYPES = new Set(["create", "update", "delete"]);
const MAX_NOTES_PER_TASK = 1000;

function isValidJson(s: string): boolean {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

function filterStringArray(arr: unknown[]): string[] {
  return arr.filter((item): item is string => typeof item === "string");
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
  db.transaction(() => {
    // First, insert all ops into the oplog table (idempotent)
    // Skip entries with invalid op_type
    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO oplog (id, task_id, device_id, op_type, field, value, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const op of ops) {
      if (!VALID_OP_TYPES.has(op.op_type)) {
        continue;
      }
      insertStmt.run(op.id, op.task_id, op.device_id, op.op_type, op.field, op.value, op.timestamp);
    }

    // Collect all affected task IDs
    const taskIds = [...new Set(ops.map((op) => op.task_id))];

    // Rebuild each affected task from its full oplog
    for (const taskId of taskIds) {
      rebuildTask(db, taskId);
    }
  })();
}

function rebuildTask(db: Database.Database, taskId: string): void {
  // Get ALL ops for this task, sorted by timestamp
  const ops = db
    .prepare("SELECT * FROM oplog WHERE task_id = ? ORDER BY timestamp ASC, id ASC")
    .all(taskId) as OplogEntry[];

  if (ops.length === 0) {
    return;
  }

  // Find the create op
  const createOp = ops.find((op) => op.op_type === "create");
  if (!createOp) {
    return;
  }

  if (createOp.value === null || createOp.value === undefined) {
    return;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(createOp.value) as Record<string, unknown>;
  } catch {
    return; // Malformed create op, skip this task
  }

  // Start with created state
  let title = typeof data.title === "string" ? data.title : "Untitled";
  let status = VALID_STATUSES.has(data.status as string) ? (data.status as string) : "todo";
  let priority = VALID_PRIORITIES.has(data.priority as string)
    ? (data.priority as string)
    : "medium";
  let owner: string | null = typeof data.owner === "string" ? data.owner : null;
  let dueAt: string | null = typeof data.due_at === "string" ? data.due_at : null;
  let blockedBy = JSON.stringify(
    Array.isArray(data.blocked_by) ? filterStringArray(data.blocked_by) : [],
  );
  let labels = JSON.stringify(Array.isArray(data.labels) ? filterStringArray(data.labels) : []);
  let metadata = JSON.stringify(
    data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? data.metadata
      : {},
  );
  const notes: string[] = [...(Array.isArray(data.notes) ? filterStringArray(data.notes) : [])];
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
    if (op.op_type === "create") {
      continue; // Already handled
    }

    if (op.op_type === "delete") {
      // Updates beat deletes: only apply if no update exists at or after this delete
      const hasLaterOrEqualUpdate =
        latestUpdateTimestamp !== null && latestUpdateTimestamp >= op.timestamp;
      if (!hasLaterOrEqualUpdate) {
        deletedAt = op.timestamp;
        if (op.timestamp > updatedAt) {
          updatedAt = op.timestamp;
        }
      }
      continue;
    }

    if (op.op_type === "update") {
      const field = op.field;
      if (!field) {
        continue;
      }

      // Notes clear: wipe accumulated notes
      if (field === "notes_clear") {
        notes.length = 0;
        if (op.timestamp > updatedAt) {
          updatedAt = op.timestamp;
        }
        if (deletedAt && op.timestamp >= deletedAt) {
          deletedAt = null;
        }
        continue;
      }

      // Notes: append with dedup
      if (field === "notes") {
        if (op.value && op.value.trim().length > 0) {
          const trimmed = op.value.trim();
          if (notes.length < MAX_NOTES_PER_TASK && !notes.some((n) => n.trim() === trimmed)) {
            notes.push(trimmed);
          }
        }
        if (op.timestamp > updatedAt) {
          updatedAt = op.timestamp;
        }
        if (deletedAt && op.timestamp >= deletedAt) {
          deletedAt = null;
        }
        continue;
      }

      // LWW per field with explicit id tiebreaker
      const current = fieldWinners[field];
      if (current) {
        if (op.timestamp < current.timestamp) {
          continue;
        }
        if (op.timestamp === current.timestamp && op.id < current.id) {
          continue;
        }
      }

      // Validate and apply — only update fieldWinners if the value is actually applied
      let applied = false;
      switch (field) {
        case "title":
          if (typeof op.value === "string") {
            title = op.value;
            applied = true;
          }
          break;
        case "status":
          if (op.value && VALID_STATUSES.has(op.value)) {
            status = op.value;
            applied = true;
          }
          break;
        case "priority":
          if (op.value && VALID_PRIORITIES.has(op.value)) {
            priority = op.value;
            applied = true;
          }
          break;
        case "owner":
          owner = op.value && op.value.trim().length > 0 ? op.value : null;
          applied = true;
          break;
        case "due_at":
          // null or empty string clears the due date
          dueAt = op.value && op.value.trim().length > 0 ? op.value : null;
          applied = true;
          break;
        case "blocked_by":
          if (op.value && isValidJson(op.value)) {
            const parsed = JSON.parse(op.value);
            if (Array.isArray(parsed)) {
              blockedBy = JSON.stringify(filterStringArray(parsed));
              applied = true;
            }
          }
          break;
        case "labels":
          if (op.value && isValidJson(op.value)) {
            const parsed = JSON.parse(op.value);
            if (Array.isArray(parsed)) {
              labels = JSON.stringify(filterStringArray(parsed));
              applied = true;
            }
          }
          break;
        case "metadata":
          if (op.value && isValidJson(op.value)) {
            const parsed = JSON.parse(op.value);
            if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
              metadata = op.value;
              applied = true;
            }
          }
          break;
      }

      if (applied) {
        fieldWinners[field] = { timestamp: op.timestamp, id: op.id };
      }

      if (op.timestamp > updatedAt) {
        updatedAt = op.timestamp;
      }

      // An update at or after a delete restores the task
      if (deletedAt && op.timestamp >= deletedAt) {
        deletedAt = null;
      }
    }
  }

  // Upsert the task
  db.prepare(
    `INSERT INTO tasks (id, title, status, priority, owner, due_at, blocked_by, labels, notes, metadata, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       status = excluded.status,
       priority = excluded.priority,
       owner = excluded.owner,
       due_at = excluded.due_at,
       blocked_by = excluded.blocked_by,
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
    owner,
    dueAt,
    blockedBy,
    labels,
    JSON.stringify(notes),
    metadata,
    createOp.timestamp,
    updatedAt,
    deletedAt,
  );
}
