export const STATUSES = ["todo", "in_progress", "in_review", "done"] as const;
export type Status = (typeof STATUSES)[number];
export const VALID_STATUSES: ReadonlySet<string> = new Set<string>(STATUSES);

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const VALID_PRIORITIES: ReadonlySet<string> = new Set<string>(PRIORITIES);

export interface Task {
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
}

export interface CreateTaskInput {
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
}

export interface UpdateTaskInput {
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
}
