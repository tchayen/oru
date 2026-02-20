import type { Task } from "../tasks/types";
import type { OplogEntry } from "../oplog/types";
import type { ContextSections } from "./text";

export function stripInternal(task: Task): Omit<Task, "deleted_at"> {
  const { deleted_at: _, ...rest } = task;
  return rest;
}

export function formatContextJson(sections: ContextSections): string {
  const summary: Record<string, number> = {};
  for (const [key, value] of Object.entries(sections)) {
    if (key === "blockerTitles") {
      continue;
    }
    summary[key] = (value as Task[]).length;
  }

  const result: Record<string, unknown> = { summary };
  for (const [key, value] of Object.entries(sections)) {
    if (key === "blockerTitles") {
      continue;
    }
    if (Array.isArray(value) && value.length > 0) {
      result[key] = (value as Task[]).map(stripInternal);
    }
  }
  if (sections.blockerTitles && sections.blocked.length > 0) {
    const referenced = new Set(sections.blocked.flatMap((t) => t.blocked_by));
    const titles: Record<string, string> = {};
    for (const id of referenced) {
      const title = sections.blockerTitles.get(id);
      if (title) {
        titles[id] = title;
      }
    }
    if (Object.keys(titles).length > 0) {
      result.blocker_titles = titles;
    }
  }
  return JSON.stringify(result, null, 2);
}

export function formatTaskJson(task: Task): string {
  const { deleted_at: _, ...rest } = task;
  return JSON.stringify(rest, null, 2);
}

export function formatTasksJson(tasks: Task[]): string {
  return JSON.stringify(tasks.map(stripInternal), null, 2);
}

export function formatLabelsJson(labels: string[]): string {
  return JSON.stringify(labels, null, 2);
}

export function formatLogJson(entries: OplogEntry[]): string {
  return JSON.stringify(entries, null, 2);
}
