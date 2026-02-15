import type { Task } from "../tasks/types.js";
import { bold, dim, italic, red, green, yellow, cyan } from "./colors.js";

function formatDue(dueAt: string): string {
  // dueAt is "YYYY-MM-DDTHH:MM:SS" local time
  const date = dueAt.slice(0, 10);
  const time = dueAt.slice(11, 16);
  if (time === "00:00") {
    return date;
  }
  return `${date} ${time}`;
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

export function formatTaskText(task: Task): string {
  const lines: string[] = [];
  lines.push(`${dim(task.id)}  ${bold(task.title)}`);
  let statusLine = `  Status: ${colorStatus(task.status)}  Priority: ${colorPriority(task.priority)}`;
  if (task.due_at) {
    statusLine += `  Due: ${formatDue(task.due_at)}`;
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

export function formatTasksText(tasks: Task[]): string {
  if (tasks.length === 0) {
    return dim("No tasks found.");
  }
  const header = dim(
    `     ${"ID".padEnd(8)}  ${"PRI".padEnd(6)}  ${"DUE".padEnd(16)}  ${"LABELS".padEnd(12)}  TITLE`,
  );
  const rows = tasks.map((t) => {
    const check = colorCheck(t.status);
    const due = t.due_at ? formatDue(t.due_at) : "";
    const labels = t.labels.length > 0 ? t.labels.join(", ") : "";
    return `${check}  ${dim(t.id.padEnd(8))}  ${colorPriority(t.priority.padEnd(6))}  ${due.padEnd(16)}  ${cyan(labels.padEnd(12))}  ${bold(t.title)}`;
  });
  return [header, ...rows].join("\n");
}
