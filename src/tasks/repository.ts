import type Database from "better-sqlite3";
import { generateId } from "../id.js";
import type { Task, CreateTaskInput, UpdateTaskInput, Status, Priority } from "./types.js";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  labels: string;
  notes: string;
  metadata: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status as Status,
    priority: row.priority as Priority,
    labels: JSON.parse(row.labels),
    notes: JSON.parse(row.notes),
    metadata: JSON.parse(row.metadata),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export function createTask(db: Database.Database, input: CreateTaskInput): Task {
  const id = input.id ?? generateId();
  const now = new Date().toISOString();
  const task: Task = {
    id,
    title: input.title,
    status: input.status ?? "todo",
    priority: input.priority ?? "medium",
    labels: input.labels ?? [],
    notes: input.notes ?? [],
    metadata: input.metadata ?? {},
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  db.prepare(
    `INSERT INTO tasks (id, title, status, priority, labels, notes, metadata, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    task.id,
    task.title,
    task.status,
    task.priority,
    JSON.stringify(task.labels),
    JSON.stringify(task.notes),
    JSON.stringify(task.metadata),
    task.created_at,
    task.updated_at,
    task.deleted_at
  );

  return task;
}

export interface ListFilters {
  status?: Status;
  priority?: Priority;
  label?: string;
}

export function listTasks(db: Database.Database, filters?: ListFilters): Task[] {
  let sql = "SELECT * FROM tasks WHERE deleted_at IS NULL";
  const params: unknown[] = [];

  if (filters?.status) {
    sql += " AND status = ?";
    params.push(filters.status);
  }
  if (filters?.priority) {
    sql += " AND priority = ?";
    params.push(filters.priority);
  }
  if (filters?.label) {
    sql += " AND EXISTS (SELECT 1 FROM json_each(labels) WHERE json_each.value = ?)";
    params.push(filters.label);
  }

  sql += " ORDER BY created_at ASC";
  const rows = db.prepare(sql).all(...params) as TaskRow[];
  return rows.map(rowToTask);
}

export function getTask(db: Database.Database, id: string): Task | null {
  const row = db
    .prepare("SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL")
    .get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : null;
}

export function updateTask(
  db: Database.Database,
  id: string,
  input: UpdateTaskInput
): Task | null {
  const existing = getTask(db, id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updates: string[] = ["updated_at = ?"];
  const params: unknown[] = [now];

  if (input.title !== undefined) {
    updates.push("title = ?");
    params.push(input.title);
  }
  if (input.status !== undefined) {
    updates.push("status = ?");
    params.push(input.status);
  }
  if (input.priority !== undefined) {
    updates.push("priority = ?");
    params.push(input.priority);
  }
  if (input.labels !== undefined) {
    updates.push("labels = ?");
    params.push(JSON.stringify(input.labels));
  }
  if (input.metadata !== undefined) {
    updates.push("metadata = ?");
    params.push(JSON.stringify(input.metadata));
  }

  params.push(id);
  db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  return getTask(db, id);
}

export function appendNote(db: Database.Database, id: string, note: string): Task | null {
  const existing = getTask(db, id);
  if (!existing) return null;

  const notes = [...existing.notes, note];
  const now = new Date().toISOString();
  db.prepare("UPDATE tasks SET notes = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify(notes),
    now,
    id
  );

  return getTask(db, id);
}

export function deleteTask(db: Database.Database, id: string): boolean {
  const now = new Date().toISOString();
  const result = db
    .prepare("UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
    .run(now, now, id);
  return result.changes > 0;
}
