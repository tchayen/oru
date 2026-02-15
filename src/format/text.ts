import type { Task } from "../tasks/types.js";

export function formatTaskText(task: Task): string {
  const lines: string[] = [];
  lines.push(`${task.id}  ${task.title}`);
  lines.push(`  Status: ${task.status}  Priority: ${task.priority}`);
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
  const header = `${"ID".padEnd(8)}  ${"STATUS".padEnd(11)}  ${"PRI".padEnd(6)}  TITLE`;
  const rows = tasks.map(
    (t) =>
      `${t.id.slice(0, 8)}  ${t.status.padEnd(11)}  ${t.priority.padEnd(6)}  ${t.title}`,
  );
  return [header, ...rows].join("\n");
}
