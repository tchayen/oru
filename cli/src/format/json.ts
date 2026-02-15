import type { Task } from "../tasks/types.js";
import type { OplogEntry } from "../oplog/types.js";
import type { ContextSections } from "./text.js";

export function formatContextJson(sections: ContextSections): string {
  const result: Record<string, Task[]> = {};
  for (const [key, tasks] of Object.entries(sections)) {
    if ((tasks as Task[]).length > 0) {
      result[key] = tasks as Task[];
    }
  }
  return JSON.stringify(result, null, 2);
}

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
