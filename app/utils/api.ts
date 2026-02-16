export type { Status, Priority, Task, CreateTaskInput, UpdateTaskInput } from "@oru/types";
import type { Priority, Task, CreateTaskInput, UpdateTaskInput } from "@oru/types";

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

let mockTasks: Task[] = [
  {
    id: "019539a1-0000-7000-8000-000000000001",
    title: "Design mobile app screens",
    status: "in_progress",
    priority: "urgent",
    owner: null,
    blocked_by: [],
    labels: ["mobile", "design"],
    notes: ["Started with Figma mockups"],
    due_at: "2026-02-18T00:00:00",
    metadata: {},
    created_at: "2026-02-13T09:00:00Z",
    updated_at: "2026-02-15T08:00:00Z",
    deleted_at: null,
  },
  {
    id: "019539a1-0000-7000-8000-000000000002",
    title: "Set up CI/CD pipeline",
    status: "todo",
    priority: "high",
    owner: null,
    blocked_by: [],
    labels: ["infra"],
    notes: [],
    due_at: "2026-02-10T00:00:00",
    metadata: {},
    created_at: "2026-02-14T10:00:00Z",
    updated_at: "2026-02-14T10:00:00Z",
    deleted_at: null,
  },
  {
    id: "019539a1-0000-7000-8000-000000000003",
    title: "Fix oplog replay edge case",
    status: "in_progress",
    priority: "high",
    owner: null,
    blocked_by: [],
    labels: ["bug"],
    notes: ["Happens when two clients sync simultaneously"],
    due_at: "2026-02-20T00:00:00",
    metadata: {},
    created_at: "2026-02-10T11:00:00Z",
    updated_at: "2026-02-14T15:00:00Z",
    deleted_at: null,
  },
  {
    id: "019539a1-0000-7000-8000-000000000004",
    title: "Write unit tests for sync engine",
    status: "todo",
    priority: "medium",
    owner: null,
    blocked_by: [],
    labels: ["testing"],
    notes: [],
    due_at: null,
    metadata: {},
    created_at: "2026-02-12T14:00:00Z",
    updated_at: "2026-02-12T14:00:00Z",
    deleted_at: null,
  },
  {
    id: "019539a1-0000-7000-8000-000000000005",
    title: "Update README with API docs",
    status: "todo",
    priority: "low",
    owner: null,
    blocked_by: [],
    labels: ["docs"],
    notes: [],
    due_at: null,
    metadata: {},
    created_at: "2026-02-11T16:00:00Z",
    updated_at: "2026-02-11T16:00:00Z",
    deleted_at: null,
  },
  {
    id: "019539a1-0000-7000-8000-000000000006",
    title: "Implement offline queue",
    status: "done",
    priority: "high",
    owner: null,
    blocked_by: [],
    labels: ["sync"],
    notes: ["Completed and tested"],
    due_at: "2026-02-13T00:00:00",
    metadata: {},
    created_at: "2026-02-09T10:00:00Z",
    updated_at: "2026-02-13T12:00:00Z",
    deleted_at: null,
  },
];

function getMockTasks(): Task[] {
  return mockTasks.filter((t) => t.deleted_at === null);
}

function authHeaders(token: string | null): Record<string, string> {
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

export async function fetchTasks(
  serverUrl: string | null,
  authToken: string | null,
): Promise<Task[]> {
  if (!serverUrl) {
    return getMockTasks();
  }

  const res = await fetch(`${serverUrl}/tasks`, { headers: authHeaders(authToken) });
  if (!res.ok) {
    throw new Error(`Failed to fetch tasks: ${res.status}`);
  }
  return res.json();
}

export async function fetchTask(
  serverUrl: string | null,
  authToken: string | null,
  id: string,
): Promise<Task | null> {
  if (!serverUrl) {
    return mockTasks.find((t) => t.id === id) ?? null;
  }

  const res = await fetch(`${serverUrl}/tasks/${id}`, { headers: authHeaders(authToken) });
  if (!res.ok) {
    throw new Error(`Failed to fetch task: ${res.status}`);
  }
  return res.json();
}

export async function createTask(
  serverUrl: string | null,
  authToken: string | null,
  input: CreateTaskInput,
): Promise<Task> {
  if (!serverUrl) {
    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      title: input.title,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      owner: input.owner ?? null,
      blocked_by: [],
      labels: [],
      notes: [],
      due_at: input.due_at ?? null,
      metadata: {},
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    mockTasks = [task, ...mockTasks];
    return task;
  }

  const res = await fetch(`${serverUrl}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(authToken) },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to create task: ${res.status}`);
  }
  return res.json();
}

export async function updateTask(
  serverUrl: string | null,
  authToken: string | null,
  id: string,
  input: UpdateTaskInput,
): Promise<Task> {
  if (!serverUrl) {
    mockTasks = mockTasks.map((t) => {
      if (t.id !== id) {
        return t;
      }
      const { note, ...fields } = input;
      const updated = { ...t, ...fields, updated_at: new Date().toISOString() };
      if (note) {
        updated.notes = [...t.notes, note];
      }
      return updated;
    });
    const task = mockTasks.find((t) => t.id === id);
    if (!task) {
      throw new Error("Task not found");
    }
    return task;
  }

  const res = await fetch(`${serverUrl}/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(authToken) },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Failed to update task: ${res.status}`);
  }
  return res.json();
}

export async function deleteTask(
  serverUrl: string | null,
  authToken: string | null,
  id: string,
): Promise<void> {
  if (!serverUrl) {
    mockTasks = mockTasks.map((t) =>
      t.id === id ? { ...t, deleted_at: new Date().toISOString() } : t,
    );
    return;
  }

  const res = await fetch(`${serverUrl}/tasks/${id}`, {
    method: "DELETE",
    headers: authHeaders(authToken),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete task: ${res.status}`);
  }
}
