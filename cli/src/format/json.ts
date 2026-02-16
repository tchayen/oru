import type { Task } from "../tasks/types.js";
import type { OplogEntry } from "../oplog/types.js";
import type { ContextSections } from "./text.js";

export function formatContextJson(sections: ContextSections): string {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sections)) {
    if (key === "blockerTitles") {
      continue;
    }
    if (Array.isArray(value) && value.length > 0) {
      result[key] = value;
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
