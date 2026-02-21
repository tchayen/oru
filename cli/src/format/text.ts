import type { Task } from "../tasks/types";
import type { OplogEntry } from "../oplog/types";
import type { Weekday } from "../config/config";
import { bold, dim, italic, white } from "./colors";
import { formatRecurrence } from "../recurrence/format";
import { WEEKDAY_NUMBERS } from "../dates/weekdays";
import { resolveToUtcMs, getTimezoneAbbr, todayInTz } from "../dates/timezone";

// Parses dueAt using manual field extraction rather than new Date(str) to
// ensure consistent local-time interpretation regardless of JS engine behavior
// with timezone-naive strings. Matches the naive local-time storage format
// written by formatLocal() in dates/parse.ts.
export function isOverdue(dueAt: string, now?: Date, dueTz?: string | null): boolean {
  const ref = now ?? new Date();

  if (dueTz) {
    let utcMs = resolveToUtcMs(dueAt, dueTz);
    // For all-day tasks (00:00), compare against end of the due day
    if (dueAt.slice(11, 16) === "00:00" || !dueAt.includes("T")) {
      utcMs += 24 * 60 * 60 * 1000;
    }
    return utcMs < ref.getTime();
  }

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

export function isDueSoon(dueAt: string, now?: Date, dueTz?: string | null): boolean {
  if (isOverdue(dueAt, now, dueTz)) {
    return false;
  }
  const ref = now ?? new Date();

  if (dueTz) {
    let utcMs = resolveToUtcMs(dueAt, dueTz);
    if (dueAt.slice(11, 16) === "00:00" || !dueAt.includes("T")) {
      utcMs += 24 * 60 * 60 * 1000;
    }
    const hoursUntilDue = (utcMs - ref.getTime()) / (1000 * 60 * 60);
    return hoursUntilDue <= 48;
  }

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

function formatDue(dueAt: string, now?: Date, dueTz?: string | null): string {
  const date = dueAt.slice(0, 10);
  const time = dueAt.slice(11, 16);
  let text = time === "00:00" ? date : `${date} ${time}`;
  if (dueTz) {
    const utcMs = resolveToUtcMs(dueAt, dueTz);
    const abbr = getTimezoneAbbr(utcMs, dueTz);
    text += ` ${abbr}`;
  }
  if (isOverdue(dueAt, now, dueTz)) {
    return bold(text);
  }
  return text;
}

function formatDueText(dueAt: string, dueTz?: string | null): string {
  const date = dueAt.slice(0, 10);
  const time = dueAt.slice(11, 16);
  let text = time === "00:00" ? date : `${date} ${time}`;
  if (dueTz) {
    const utcMs = resolveToUtcMs(dueAt, dueTz);
    const abbr = getTimezoneAbbr(utcMs, dueTz);
    text += ` ${abbr}`;
  }
  return text;
}

function colorPriority(p: string): string {
  switch (p) {
    case "urgent":
      return bold(p);
    case "low":
      return dim(p);
    default:
      return p;
  }
}

function colorStatus(s: string): string {
  switch (s) {
    case "done":
      return dim(s);
    case "in_progress":
      return bold(s);
    case "in_review":
      return italic(s);
    default:
      return s;
  }
}

function colorCheck(status: string): string {
  switch (status) {
    case "done":
      return dim("[x]");
    case "in_progress":
      return bold("[~]");
    case "in_review":
      return white("[r]");
    default:
      return dim("[ ]");
  }
}

export function formatTaskText(task: Task, now?: Date): string {
  const lines: string[] = [];
  lines.push(`${dim(task.id)}  ${bold(task.title)}`);
  let statusLine = `  Status: ${colorStatus(task.status)}  Priority: ${colorPriority(task.priority)}`;
  if (task.due_at) {
    statusLine += `  Due: ${formatDue(task.due_at, now, task.due_tz)}`;
  }
  lines.push(statusLine);
  if (task.recurrence) {
    lines.push(`  Recurrence: ${formatRecurrence(task.recurrence)}`);
  }
  if (task.owner) {
    lines.push(`  Owner: ${task.owner}`);
  }
  if (task.blocked_by.length > 0) {
    lines.push(`  Blocked by: ${task.blocked_by.join(", ")}`);
  }
  if (task.labels.length > 0) {
    lines.push(`  Labels: ${task.labels.join(", ")}`);
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
      lines.push(`    ${dim(`${key}:`)} ${String(task.metadata[key])}`);
    }
  }
  return lines.join("\n");
}

export function formatLabelsText(labels: string[]): string {
  if (labels.length === 0) {
    return dim("No labels found.");
  }
  return labels.join("\n");
}

export function formatTasksText(tasks: Task[], now?: Date): string {
  if (tasks.length === 0) {
    return `${dim("No tasks found.")}\n${dim('Create one with: oru add "Task title"')}`;
  }

  const idW = Math.max(2, ...tasks.map((t) => t.id.length));
  const priW = Math.max(3, ...tasks.map((t) => t.priority.length));
  const ownerW = Math.max(5, ...tasks.map((t) => (t.owner ?? "").length));
  const dueW = Math.max(
    3,
    ...tasks.map((t) => {
      if (!t.due_at) {
        return 0;
      }
      const time = t.due_at.slice(11, 16);
      let w = time === "00:00" ? 10 : 16; // "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
      if (t.due_tz) {
        const utcMs = resolveToUtcMs(t.due_at, t.due_tz);
        const abbr = getTimezoneAbbr(utcMs, t.due_tz);
        w += 1 + abbr.length; // " EST"
      }
      return w;
    }),
  );
  const labelsW = Math.max(
    6,
    ...tasks.map((t) => (t.labels.length > 0 ? t.labels.join(", ") : "").length),
  );
  const titleW = Math.max(5, ...tasks.map((t) => t.title.length));

  const header = dim(
    `     ${"ID".padEnd(idW)}  ${"TITLE".padEnd(titleW)}  ${"PRI".padEnd(priW)}  ${"OWNER".padEnd(ownerW)}  ${"DUE".padEnd(dueW)}  ${"LABELS".padEnd(labelsW)}  META`,
  );
  const rows = tasks.map((t) => {
    const check = colorCheck(t.status);
    const ownerStr = t.owner ?? "";
    const dueText = t.due_at ? formatDueText(t.due_at, t.due_tz) : "";
    const dueOverdue = t.due_at ? isOverdue(t.due_at, now, t.due_tz) : false;
    const labels = t.labels.length > 0 ? t.labels.join(", ") : "";
    const metaKeys = Object.keys(t.metadata);
    const meta = metaKeys.length > 0 ? metaKeys.map((k) => `${k}=${t.metadata[k]}`).join(", ") : "";
    const duePadded = dueText.padEnd(dueW);
    const dueCol = dueOverdue ? bold(duePadded) : duePadded;
    return `${check}  ${dim(t.id.padEnd(idW))}  ${bold(t.title.padEnd(titleW))}  ${colorPriority(t.priority.padEnd(priW))}  ${ownerStr.padEnd(ownerW)}  ${dueCol}  ${labels.padEnd(labelsW)}  ${meta}`;
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
        opLabel = bold("CREATE");
        break;
      case "delete":
        opLabel = dim("DELETE");
        break;
      case "update":
        opLabel = "UPDATE";
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

export type ContextSections = {
  overdue: Task[];
  due_soon: Task[];
  in_progress: Task[];
  actionable: Task[];
  blocked: Task[];
  recently_completed: Task[];
  blockerTitles?: Map<string, string>;
};

export function formatContextText(sections: ContextSections, now?: Date): string {
  const entries: [string, Task[]][] = [
    ["Overdue", sections.overdue],
    ["Due Soon", sections.due_soon],
    ["In Progress", sections.in_progress],
    ["Actionable", sections.actionable],
    ["Blocked", sections.blocked],
    ["Recently Completed", sections.recently_completed],
  ];

  const sectionNames: Record<string, string> = {
    Overdue: "overdue",
    "Due Soon": "due soon",
    "In Progress": "in progress",
    Actionable: "actionable",
    Blocked: "blocked",
    "Recently Completed": "recently completed",
  };

  const nonEmpty = entries.filter(([, tasks]) => tasks.length > 0);
  if (nonEmpty.length === 0) {
    return dim("Nothing to report.");
  }

  const summaryParts = nonEmpty.map(
    ([name, tasks]) => `${bold(String(tasks.length))} ${sectionNames[name]}`,
  );
  const summaryLine = dim(summaryParts.join(", "));

  const parts: string[] = [summaryLine];
  for (const [name, tasks] of nonEmpty) {
    parts.push(`${bold(name)} ${dim(`(${tasks.length})`)}`);
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

export function filterByDue(
  tasks: Task[],
  filter: DueFilter,
  now?: Date,
  firstDayOfWeek: Weekday = "monday",
): Task[] {
  const ref = now ?? new Date();
  const todayStr = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(ref.getDate()).padStart(2, "0")}`;

  switch (filter) {
    case "today":
      return tasks.filter((t) => {
        if (!t.due_at) {
          return false;
        }
        if (t.due_tz) {
          const tzToday = todayInTz(t.due_tz, ref);
          return t.due_at.slice(0, 10) === tzToday;
        }
        return t.due_at.slice(0, 10) === todayStr;
      });
    case "this-week": {
      const day = ref.getDay(); // 0=Sun, 1=Mon, ...
      const startIndex = WEEKDAY_NUMBERS[firstDayOfWeek];
      const diff = (day - startIndex + 7) % 7;
      const weekStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - diff);
      const weekEnd = new Date(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        weekStart.getDate() + 6,
      );
      const startStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
      const endStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;
      return tasks.filter((t) => {
        if (!t.due_at) {
          return false;
        }
        const dateStr = t.due_at.slice(0, 10);
        return dateStr >= startStr && dateStr <= endStr;
      });
    }
    case "overdue":
      return tasks.filter((t) => {
        if (!t.due_at) {
          return false;
        }
        return isOverdue(t.due_at, ref, t.due_tz);
      });
  }
}
