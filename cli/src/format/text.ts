import type { Task } from "../tasks/types.js";

function formatDue(dueAt: string): string {
  // dueAt is "YYYY-MM-DDTHH:MM:SS" local time
  const date = dueAt.slice(0, 10);
  const time = dueAt.slice(11, 16);
  if (time === "00:00") {
    return date;
  }
  return `${date} ${time}`;
}

export function formatTaskText(task: Task): string {
  const lines: string[] = [];
  lines.push(`${task.id}  ${task.title}`);
  let statusLine = `  Status: ${task.status}  Priority: ${task.priority}`;
  if (task.due_at) {
    statusLine += `  Due: ${formatDue(task.due_at)}`;
  }
  lines.push(statusLine);
  if (task.labels.length > 0) {
    lines.push(`  Labels: ${task.labels.join(", ")}`);
  }
  if (task.notes.length > 0) {
    lines.push(`  Notes:`);
    for (const note of task.notes) {
      lines.push(`    - ${note}`);
    }
  }
  return lines.join("\n");
}

export function formatTasksText(tasks: Task[]): string {
  if (tasks.length === 0) {
    return "No tasks found.";
  }
  const header = `     ${"ID".padEnd(8)}  ${"PRI".padEnd(6)}  ${"DUE".padEnd(16)}  ${"LABELS".padEnd(12)}  TITLE`;
  const rows = tasks.map((t) => {
    const check = t.status === "done" ? "[x]" : t.status === "in_progress" ? "[~]" : "[ ]";
    const due = t.due_at ? formatDue(t.due_at) : "";
    const labels = t.labels.length > 0 ? t.labels.join(", ") : "";
    return `${check}  ${t.id.padEnd(8)}  ${t.priority.padEnd(6)}  ${due.padEnd(16)}  ${labels.padEnd(12)}  ${t.title}`;
  });
  return [header, ...rows].join("\n");
}
