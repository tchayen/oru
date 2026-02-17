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

function authHeaders(token: string | null): Record<string, string> {
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

function requireServer(serverUrl: string | null): asserts serverUrl is string {
  if (!serverUrl) {
    throw new Error("Not connected to a server");
  }
}

export async function fetchTasks(
  serverUrl: string | null,
  authToken: string | null,
): Promise<Task[]> {
  requireServer(serverUrl);
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
  requireServer(serverUrl);
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
  requireServer(serverUrl);
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
  requireServer(serverUrl);
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
  requireServer(serverUrl);
  const res = await fetch(`${serverUrl}/tasks/${id}`, {
    method: "DELETE",
    headers: authHeaders(authToken),
  });
  if (!res.ok) {
    throw new Error(`Failed to delete task: ${res.status}`);
  }
}
