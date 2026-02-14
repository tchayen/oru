export type Status = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
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
  labels?: string[];
  notes?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  title?: string;
  status?: Status;
  priority?: Priority;
  labels?: string[];
  metadata?: Record<string, unknown>;
}
