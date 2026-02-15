import type { Task } from "../tasks/types.js";
import { bold, dim, italic, red, green, yellow, cyan } from "./colors.js";

function isOverdue(dueAt: string, now?: Date): boolean {
  const ref = now ?? new Date();
  const dueDate = new Date(
    Number(dueAt.slice(0, 4)),
    Number(dueAt.slice(5, 7)) - 1,
    Number(dueAt.slice(8, 10)),
    Number(dueAt.slice(11, 13)) || 0,
    Number(dueAt.slice(14, 16)) || 0,
  );
  // For all-day tasks (00:00), compare against end of the due day
  if (dueAt.slice(11, 16) === "00:00") {
    dueDate.setDate(dueDate.getDate() + 1);
  }
  return dueDate < ref;
}

function formatDue(dueAt: string, now?: Date): string {
  // dueAt is "YYYY-MM-DDTHH:MM:SS" local time
  const date = dueAt.slice(0, 10);
  const time = dueAt.slice(11, 16);
  const text = time === "00:00" ? date : `${date} ${time}`;
  if (isOverdue(dueAt, now)) {
    return red(text);
  }
  return text;
}

function colorPriority(p: string): string {
  switch (p) {
    case "urgent":
      return bold(red(p));
    case "high":
      return yellow(p);
    case "low":
      return dim(p);
    default:
      return p;
  }
}

function colorStatus(s: string): string {
  switch (s) {
    case "done":
      return green(s);
    case "in_progress":
      return yellow(s);
    default:
      return s;
  }
}

function colorCheck(status: string): string {
  switch (status) {
    case "done":
      return green("[x]");
    case "in_progress":
      return yellow("[~]");
    default:
      return dim("[ ]");
  }
}

export function formatTaskText(task: Task, now?: Date): string {
  const lines: string[] = [];
  lines.push(`${dim(task.id)}  ${bold(task.title)}`);
  let statusLine = `  Status: ${colorStatus(task.status)}  Priority: ${colorPriority(task.priority)}`;
  if (task.due_at) {
    statusLine += `  Due: ${formatDue(task.due_at, now)}`;
  }
  lines.push(statusLine);
  if (task.labels.length > 0) {
    lines.push(`  Labels: ${cyan(task.labels.join(", "))}`);
  }
  if (task.notes.length > 0) {
    lines.push(`  ${dim("Notes:")}`);
    for (const note of task.notes) {
      lines.push(`    ${dim("-")} ${italic(note)}`);
    }
  }
  return lines.join("\n");
}

export function formatLabelsText(labels: string[]): string {
  if (labels.length === 0) {
    return dim("No labels found.");
  }
  return labels.map((l) => cyan(l)).join("\n");
}

export function formatTasksText(tasks: Task[], now?: Date): string {
  if (tasks.length === 0) {
    return dim("No tasks found.");
  }
  const header = dim(
    `     ${"ID".padEnd(8)}  ${"PRI".padEnd(6)}  ${"DUE".padEnd(16)}  ${"LABELS".padEnd(12)}  TITLE`,
  );
  const rows = tasks.map((t) => {
    const check = colorCheck(t.status);
    const due = t.due_at ? formatDue(t.due_at, now) : "";
    const labels = t.labels.length > 0 ? t.labels.join(", ") : "";
    return `${check}  ${dim(t.id.padEnd(8))}  ${colorPriority(t.priority.padEnd(6))}  ${due.padEnd(16)}  ${cyan(labels.padEnd(12))}  ${bold(t.title)}`;
  });
  return [header, ...rows].join("\n");
}

export type DueFilter = "today" | "this-week" | "overdue";

export function filterByDue(tasks: Task[], filter: DueFilter, now?: Date): Task[] {
  const ref = now ?? new Date();
  const todayStr = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(ref.getDate()).padStart(2, "0")}`;

  switch (filter) {
    case "today":
      return tasks.filter((t) => t.due_at?.slice(0, 10) === todayStr);
    case "this-week": {
      // Monday through Sunday of the current week
      const day = ref.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffToMonday);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
      return tasks.filter((t) => {
        if (!t.due_at) {
          return false;
        }
        const dateStr = t.due_at.slice(0, 10);
        return dateStr >= mondayStr && dateStr <= sundayStr;
      });
    }
    case "overdue":
      return tasks.filter((t) => {
        if (!t.due_at) {
          return false;
        }
        return isOverdue(t.due_at, ref);
      });
  }
}
