export const STATUSES = ["todo", "in_progress", "in_review", "done"] as const;
export type Status = (typeof STATUSES)[number];
export const VALID_STATUSES: ReadonlySet<string> = new Set<string>(STATUSES);

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const VALID_PRIORITIES: ReadonlySet<string> = new Set<string>(PRIORITIES);

/** Mutable task fields that appear in oplog update operations. */
export const TASK_FIELDS = [
  "title",
  "status",
  "priority",
  "owner",
  "due_at",
  "recurrence",
  "blocked_by",
  "labels",
  "metadata",
] as const;
export type TaskField = (typeof TASK_FIELDS)[number];
export const VALID_TASK_FIELDS: ReadonlySet<string> = new Set<string>(TASK_FIELDS);

export type Task = {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  owner: string | null;
  due_at: string | null;
  recurrence: string | null;
  blocked_by: string[];
  labels: string[];
  notes: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreateTaskInput = {
  id?: string;
  title: string;
  status?: Status;
  priority?: Priority;
  owner?: string | null;
  due_at?: string | null;
  recurrence?: string | null;
  blocked_by?: string[];
  labels?: string[];
  notes?: string[];
  metadata?: Record<string, unknown>;
};

export type UpdateTaskInput = {
  title?: string;
  status?: Status;
  priority?: Priority;
  owner?: string | null;
  due_at?: string | null;
  recurrence?: string | null;
  blocked_by?: string[];
  labels?: string[];
  note?: string;
  metadata?: Record<string, unknown>;
};
