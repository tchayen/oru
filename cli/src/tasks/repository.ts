import { sql } from "kysely";
import type { Kysely, SqlBool } from "kysely";
import { generateId } from "../id";
import type { DB } from "../db/kysely";
import type { Task, CreateTaskInput, UpdateTaskInput, Status, Priority } from "./types";

export const SORT_FIELDS = ["priority", "due", "title", "created"] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export class AmbiguousPrefixError extends Error {
  readonly prefix: string;
  readonly matches: string[];

  constructor(prefix: string, matches: string[]) {
    super(`Prefix '${prefix}' is ambiguous, matches: ${matches.join(", ")}`);
    this.name = "AmbiguousPrefixError";
    this.prefix = prefix;
    this.matches = matches;
  }
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  owner: string | null;
  recurrence: string | null;
  blocked_by: string;
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
    owner: row.owner,
    due_at: row.due_at,
    recurrence: row.recurrence,
    blocked_by: safeParseJson<string[]>(row.blocked_by, []),
    labels: safeParseJson<string[]>(row.labels, []),
    notes: safeParseJson<string[]>(row.notes, []),
    metadata: safeParseJson<Record<string, unknown>>(row.metadata, {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

export async function createTask(
  db: Kysely<DB>,
  input: CreateTaskInput,
  now?: string,
): Promise<Task> {
  const id = input.id ?? generateId();
  const timestamp = now ?? new Date().toISOString();
  const task: Task = {
    id,
    title: input.title,
    status: input.status ?? "todo",
    priority: input.priority ?? "medium",
    owner: input.owner ?? null,
    due_at: input.due_at ?? null,
    recurrence: input.recurrence ?? null,
    blocked_by: input.blocked_by ?? [],
    labels: input.labels ?? [],
    notes: input.notes ?? [],
    metadata: input.metadata ?? {},
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };

  await db
    .insertInto("tasks")
    .values({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      owner: task.owner,
      due_at: task.due_at,
      recurrence: task.recurrence,
      blocked_by: JSON.stringify(task.blocked_by),
      labels: JSON.stringify(task.labels),
      notes: JSON.stringify(task.notes),
      metadata: JSON.stringify(task.metadata),
      created_at: task.created_at,
      updated_at: task.updated_at,
      deleted_at: task.deleted_at,
    })
    .execute();

  return task;
}

export interface ListFilters {
  status?: Status | Status[];
  priority?: Priority | Priority[];
  owner?: string;
  label?: string;
  search?: string;
  sort?: SortField;
  actionable?: boolean;
  limit?: number;
  offset?: number;
  sql?: string;
}

export async function listTasks(db: Kysely<DB>, filters?: ListFilters): Promise<Task[]> {
  let query = db.selectFrom("tasks").selectAll().where("deleted_at", "is", null);

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.where("status", "in", filters.status);
    } else {
      query = query.where("status", "=", filters.status);
    }
  }
  if (filters?.priority) {
    if (Array.isArray(filters.priority)) {
      query = query.where("priority", "in", filters.priority);
    } else {
      query = query.where("priority", "=", filters.priority);
    }
  }
  if (filters?.owner) {
    query = query.where("owner", "=", filters.owner);
  }
  if (filters?.label) {
    const label = filters.label;
    query = query.where(
      sql<SqlBool>`EXISTS (SELECT 1 FROM json_each(labels) WHERE json_each.value = ${label})`,
    );
  }
  if (filters?.search) {
    const escaped = filters.search.replace(/[\\%_]/g, "\\$&");
    query = query.where(
      sql<SqlBool>`title LIKE '%' || ${escaped} || '%' ESCAPE '\\' COLLATE NOCASE`,
    );
  }
  if (filters?.actionable) {
    query = query.where("status", "!=", "done").where(
      sql<SqlBool>`NOT EXISTS (
          SELECT 1 FROM json_each(tasks.blocked_by) AS dep
          JOIN tasks AS blocker ON blocker.id = dep.value
          WHERE blocker.status != 'done' AND blocker.deleted_at IS NULL
        )`,
    );
  }
  if (filters?.sql) {
    query = query.where(sql<SqlBool>`(${sql.raw(filters.sql)})`);
  }

  const sort = filters?.sort ?? "priority";
  switch (sort) {
    case "due":
      query = query
        .orderBy(sql`CASE WHEN due_at IS NULL THEN 1 ELSE 0 END`, "asc")
        .orderBy("due_at", "asc")
        .orderBy("created_at", "asc");
      break;
    case "title":
      query = query.orderBy(sql`title COLLATE NOCASE`, "asc").orderBy("created_at", "asc");
      break;
    case "created":
      query = query.orderBy("created_at", "asc");
      break;
    case "priority":
    default:
      query = query
        .orderBy(
          sql`CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`,
        )
        .orderBy("created_at", "asc");
      break;
  }

  if (filters?.limit !== undefined || filters?.offset !== undefined) {
    query = query.limit(filters.limit ?? -1);
  }
  if (filters?.offset !== undefined) {
    query = query.offset(filters.offset);
  }

  const rows = await query.execute();
  return rows.map(rowToTask);
}

export async function getTask(db: Kysely<DB>, id: string): Promise<Task | null> {
  const row = await db
    .selectFrom("tasks")
    .selectAll()
    .where("id", "=", id)
    .where("deleted_at", "is", null)
    .executeTakeFirst();

  if (row) {
    return rowToTask(row);
  }

  // Prefix matching: if exact match failed, try prefix lookup
  const escaped = id.replace(/[\\%_]/g, "\\$&");
  const rows = await db
    .selectFrom("tasks")
    .selectAll()
    .where(sql<SqlBool>`id LIKE ${escaped} || '%' ESCAPE '\\'`)
    .where("deleted_at", "is", null)
    .execute();
  if (rows.length === 1) {
    return rowToTask(rows[0]);
  }

  if (rows.length > 1) {
    throw new AmbiguousPrefixError(
      id,
      rows.map((r) => r.id),
    );
  }

  return null;
}

export async function updateTask(
  db: Kysely<DB>,
  id: string,
  input: UpdateTaskInput,
  timestamp?: string,
): Promise<Task | null> {
  const existing = await getTask(db, id);
  if (!existing) {
    return null;
  }

  const now = timestamp ?? new Date().toISOString();
  const updates: Record<string, string | null> = { updated_at: now };

  if (input.title !== undefined) {
    updates.title = input.title;
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }
  if (input.priority !== undefined) {
    updates.priority = input.priority;
  }
  if (input.owner !== undefined) {
    updates.owner = input.owner;
  }
  if (input.due_at !== undefined) {
    updates.due_at = input.due_at;
  }
  if (input.recurrence !== undefined) {
    updates.recurrence = input.recurrence;
  }
  if (input.blocked_by !== undefined) {
    updates.blocked_by = JSON.stringify(input.blocked_by);
  }
  if (input.labels !== undefined) {
    updates.labels = JSON.stringify(input.labels);
  }
  if (input.metadata !== undefined) {
    updates.metadata = JSON.stringify(input.metadata);
  }

  await db.updateTable("tasks").set(updates).where("id", "=", existing.id).execute();

  return getTask(db, existing.id);
}

export async function appendNote(
  db: Kysely<DB>,
  id: string,
  note: string,
  timestamp?: string,
): Promise<Task | null> {
  const existing = await getTask(db, id);
  if (!existing) {
    return null;
  }

  const trimmed = note.trim();
  if (trimmed.length === 0 || existing.notes.some((n) => n.trim() === trimmed)) {
    return existing;
  }

  const notes = [...existing.notes, trimmed];
  const now = timestamp ?? new Date().toISOString();
  await db
    .updateTable("tasks")
    .set({ notes: JSON.stringify(notes), updated_at: now })
    .where("id", "=", existing.id)
    .execute();

  return getTask(db, existing.id);
}

export async function setNotes(
  db: Kysely<DB>,
  id: string,
  notes: string[],
  timestamp?: string,
): Promise<Task | null> {
  const existing = await getTask(db, id);
  if (!existing) {
    return null;
  }

  const now = timestamp ?? new Date().toISOString();
  await db
    .updateTable("tasks")
    .set({ notes: JSON.stringify(notes), updated_at: now })
    .where("id", "=", existing.id)
    .execute();

  return getTask(db, existing.id);
}

export async function deleteTask(db: Kysely<DB>, id: string, timestamp?: string): Promise<boolean> {
  const existing = await getTask(db, id);
  if (!existing) {
    return false;
  }

  const now = timestamp ?? new Date().toISOString();
  const result = await db
    .updateTable("tasks")
    .set({ deleted_at: now, updated_at: now })
    .where("id", "=", existing.id)
    .where("deleted_at", "is", null)
    .executeTakeFirst();

  return BigInt(result.numUpdatedRows) > 0n;
}
