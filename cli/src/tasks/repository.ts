import { type Kysely, type SqlBool, sql } from "kysely";
import { generateId } from "../id.js";
import type { DB } from "../db/kysely.js";
import type { Task, CreateTaskInput, UpdateTaskInput, Status, Priority } from "./types.js";

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
    due_at: row.due_at,
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
    due_at: input.due_at ?? null,
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
      due_at: task.due_at,
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
  status?: Status;
  priority?: Priority;
  label?: string;
  search?: string;
}

export async function listTasks(db: Kysely<DB>, filters?: ListFilters): Promise<Task[]> {
  let query = db.selectFrom("tasks").selectAll().where("deleted_at", "is", null);

  if (filters?.status) {
    query = query.where("status", "=", filters.status);
  }
  if (filters?.priority) {
    query = query.where("priority", "=", filters.priority);
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

  query = query
    .orderBy(
      sql`CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`,
    )
    .orderBy("created_at", "asc");
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
  if (input.due_at !== undefined) {
    updates.due_at = input.due_at;
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

  const notes = [...existing.notes, note];
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
