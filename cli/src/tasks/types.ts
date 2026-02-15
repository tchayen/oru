export const STATUSES = ["todo", "in_progress", "done"] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Task {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  due_at: string | null;
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
  due_at?: string | null;
  labels?: string[];
  notes?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  title?: string;
  status?: Status;
  priority?: Priority;
  due_at?: string | null;
  labels?: string[];
  metadata?: Record<string, unknown>;
}
