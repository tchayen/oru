import type { Task } from "../tasks/types.js";
import type { OplogEntry } from "../oplog/types.js";

export function formatTaskJson(task: Task): string {
  return JSON.stringify(task, null, 2);
}

export function formatTasksJson(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2);
}

export function formatLabelsJson(labels: string[]): string {
  return JSON.stringify(labels, null, 2);
}

export function formatLogJson(entries: OplogEntry[]): string {
  return JSON.stringify(entries, null, 2);
}
