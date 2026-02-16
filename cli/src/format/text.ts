import type { Task } from "../tasks/types.js";
import type { OplogEntry } from "../oplog/types.js";
import { bold, dim, italic, red, green, yellow, magenta, cyan, orange } from "./colors.js";

export function isOverdue(dueAt: string, now?: Date): boolean {
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

export function isDueSoon(dueAt: string, now?: Date): boolean {
  if (isOverdue(dueAt, now)) {
    return false;
  }
  const ref = now ?? new Date();
  const dueDate = new Date(
    Number(dueAt.slice(0, 4)),
    Number(dueAt.slice(5, 7)) - 1,
    Number(dueAt.slice(8, 10)),
    Number(dueAt.slice(11, 13)) || 0,
    Number(dueAt.slice(14, 16)) || 0,
  );
  // For all-day tasks (00:00), use end of the due day as the effective deadline
  if (dueAt.slice(11, 16) === "00:00") {
    dueDate.setDate(dueDate.getDate() + 1);
  }
  const hoursUntilDue = (dueDate.getTime() - ref.getTime()) / (1000 * 60 * 60);
  return hoursUntilDue <= 48;
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
    case "in_review":
      return magenta(s);
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
    case "in_review":
      return magenta("[r]");
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
  if (task.owner) {
    lines.push(`  Owner: ${task.owner}`);
  }
  if (task.blocked_by.length > 0) {
    lines.push(`  Blocked by: ${task.blocked_by.join(", ")}`);
  }
  if (task.labels.length > 0) {
    lines.push(`  Labels: ${cyan(task.labels.join(", "))}`);
  }
  if (task.notes.length > 0) {
    lines.push(`  ${dim("Notes:")}`);
    for (const note of task.notes) {
      lines.push(`    ${dim("-")} ${italic(note)}`);
    }
  }
  const metaKeys = Object.keys(task.metadata);
  if (metaKeys.length > 0) {
    lines.push(`  ${dim("Metadata:")}`);
    for (const key of metaKeys) {
      lines.push(`    ${dim(key + ":")} ${String(task.metadata[key])}`);
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

  const idW = Math.max(2, ...tasks.map((t) => t.id.length));
  const priW = Math.max(3, ...tasks.map((t) => t.priority.length));
  const ownerW = Math.max(5, ...tasks.map((t) => (t.owner ?? "").length));
  const dueW = Math.max(3, ...tasks.map((t) => (t.due_at ? formatDue(t.due_at, now) : "").length));
  const labelsW = Math.max(
    6,
    ...tasks.map((t) => (t.labels.length > 0 ? t.labels.join(", ") : "").length),
  );
  const metaW = Math.max(
    4,
    ...tasks.map((t) => {
      const keys = Object.keys(t.metadata);
      return keys.length > 0 ? keys.map((k) => `${k}=${t.metadata[k]}`).join(", ").length : 0;
    }),
  );

  const header = dim(
    `     ${"ID".padEnd(idW)}  ${"PRI".padEnd(priW)}  ${"OWNER".padEnd(ownerW)}  ${"DUE".padEnd(dueW)}  ${"LABELS".padEnd(labelsW)}  ${"META".padEnd(metaW)}  TITLE`,
  );
  const rows = tasks.map((t) => {
    const check = colorCheck(t.status);
    const ownerStr = t.owner ?? "";
    const due = t.due_at ? formatDue(t.due_at, now) : "";
    const labels = t.labels.length > 0 ? t.labels.join(", ") : "";
    const metaKeys = Object.keys(t.metadata);
    const meta = metaKeys.length > 0 ? metaKeys.map((k) => `${k}=${t.metadata[k]}`).join(", ") : "";
    return `${check}  ${dim(t.id.padEnd(idW))}  ${colorPriority(t.priority.padEnd(priW))}  ${ownerStr.padEnd(ownerW)}  ${due.padEnd(dueW)}  ${cyan(labels.padEnd(labelsW))}  ${meta.padEnd(metaW)}  ${bold(t.title)}`;
  });
  return [header, ...rows].join("\n");
}

export function formatLogText(entries: OplogEntry[]): string {
  if (entries.length === 0) {
    return dim("No log entries found.");
  }

  const lines: string[] = [];
  for (const entry of entries) {
    const ts = dim(entry.timestamp);
    const device = dim(`(${entry.device_id})`);
    let opLabel: string;
    switch (entry.op_type) {
      case "create":
        opLabel = green("CREATE");
        break;
      case "delete":
        opLabel = red("DELETE");
        break;
      case "update":
        opLabel = yellow("UPDATE");
        break;
    }

    if (entry.op_type === "create") {
      lines.push(`${ts}  ${opLabel}  ${device}`);
      if (entry.value) {
        try {
          const obj = JSON.parse(entry.value);
          const parts: string[] = [];
          for (const [k, v] of Object.entries(obj)) {
            if (v !== null && v !== undefined) {
              parts.push(`${k} = ${JSON.stringify(v)}`);
            }
          }
          if (parts.length > 0) {
            lines.push(`  ${parts.join(", ")}`);
          }
        } catch {
          lines.push(`  ${entry.value}`);
        }
      }
    } else if (entry.op_type === "update") {
      const field = entry.field ?? "";
      lines.push(`${ts}  ${opLabel}  ${field} ${device}`);
      if (entry.value !== null) {
        lines.push(`  ${field} = ${JSON.stringify(entry.value)}`);
      }
    } else {
      lines.push(`${ts}  ${opLabel}  ${device}`);
    }
  }

  return lines.join("\n");
}

export interface ContextSections {
  overdue: Task[];
  due_soon: Task[];
  in_progress: Task[];
  actionable: Task[];
  blocked: Task[];
  recently_completed: Task[];
  blockerTitles?: Map<string, string>;
}

export function formatContextText(sections: ContextSections, now?: Date): string {
  const entries: [string, Task[]][] = [
    ["Overdue", sections.overdue],
    ["Due Soon", sections.due_soon],
    ["In Progress", sections.in_progress],
    ["Actionable", sections.actionable],
    ["Blocked", sections.blocked],
    ["Recently Completed", sections.recently_completed],
  ];

  const nonEmpty = entries.filter(([, tasks]) => tasks.length > 0);
  if (nonEmpty.length === 0) {
    return dim("Nothing to report.");
  }

  const parts: string[] = [];
  for (const [name, tasks] of nonEmpty) {
    parts.push(`${orange(name)} ${dim(`(${tasks.length})`)}`);
    parts.push(formatTasksText(tasks, now));
    if (name === "Blocked" && sections.blockerTitles) {
      for (const task of tasks) {
        if (task.blocked_by.length > 0) {
          const blockerDescs = task.blocked_by
            .map((id) => {
              const title = sections.blockerTitles!.get(id);
              return title ? `${id} (${title})` : id;
            })
            .join(", ");
          parts.push(dim(`  ${task.id} blocked by: ${blockerDescs}`));
        }
      }
    }
  }
  return parts.join("\n\n");
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
