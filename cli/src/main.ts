import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { DB } from "./db/kysely";
import type { Task, CreateTaskInput, UpdateTaskInput } from "./tasks/types";
import type { ListFilters } from "./tasks/repository";
import type { OplogEntry } from "./oplog/types";
import type { ContextSections } from "./format/text";
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  appendNote,
  setNotes,
  deleteTask,
} from "./tasks/repository";
import { writeOp } from "./oplog/writer";
import { isOverdue, isDueSoon } from "./format/text";
import { nextOccurrence } from "./recurrence/next";
import { spawnId } from "./recurrence/spawn-id";

function serializeOpValue(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export class TaskService {
  constructor(
    private db: Kysely<DB>,
    private deviceId: string,
  ) {}

  async add(input: CreateTaskInput): Promise<Task> {
    return this.db.transaction().execute(async (trx) => {
      const now = new Date().toISOString();
      const normalized = { ...input, owner: input.owner || null };
      const task = await createTask(trx, normalized, now);
      await writeOp(
        trx,
        {
          task_id: task.id,
          device_id: this.deviceId,
          op_type: "create",
          field: null,
          value: JSON.stringify({
            title: task.title,
            status: task.status,
            priority: task.priority,
            owner: task.owner,
            due_at: task.due_at,
            recurrence: task.recurrence,
            blocked_by: task.blocked_by,
            labels: task.labels,
            notes: task.notes,
            metadata: task.metadata,
          }),
        },
        now,
      );
      return task;
    });
  }

  private async _maybeSpawn(trx: Kysely<DB>, task: Task, now: string): Promise<Task | null> {
    if (task.status !== "done" || !task.recurrence) {
      return null;
    }

    const childId = spawnId(task.id);

    // Idempotency: check if child already exists
    const existing = await getTask(trx, childId);
    if (existing) {
      return null;
    }

    // Parse RRULE and compute next due date
    let rrule = task.recurrence;
    const isAfter = rrule.startsWith("after:");
    if (isAfter) {
      rrule = rrule.slice(6);
    }

    let anchor: Date;
    if (isAfter) {
      anchor = new Date(now);
    } else if (task.due_at) {
      anchor = new Date(task.due_at);
    } else {
      anchor = new Date(now);
    }

    const nextDue = nextOccurrence(rrule, anchor);
    const dueAt = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}-${String(nextDue.getDate()).padStart(2, "0")}T${String(nextDue.getHours()).padStart(2, "0")}:${String(nextDue.getMinutes()).padStart(2, "0")}:${String(nextDue.getSeconds()).padStart(2, "0")}`;

    const childInput: CreateTaskInput = {
      id: childId,
      title: task.title,
      priority: task.priority,
      owner: task.owner,
      due_at: dueAt,
      recurrence: task.recurrence,
      labels: [...task.labels],
      metadata: { ...task.metadata },
    };

    const child = await createTask(trx, childInput, now);
    await writeOp(
      trx,
      {
        task_id: child.id,
        device_id: this.deviceId,
        op_type: "create",
        field: null,
        value: JSON.stringify({
          title: child.title,
          status: child.status,
          priority: child.priority,
          owner: child.owner,
          due_at: child.due_at,
          recurrence: child.recurrence,
          blocked_by: child.blocked_by,
          labels: child.labels,
          notes: child.notes,
          metadata: child.metadata,
        }),
      },
      now,
    );

    return child;
  }

  async getSpawnedTask(parentId: string): Promise<Task | null> {
    const childId = spawnId(parentId);
    return getTask(this.db, childId);
  }

  async validateBlockedBy(
    rawTaskId: string | null,
    blockerIds: string[],
  ): Promise<{ valid: true } | { valid: false; error: string }> {
    let resolvedTaskId: string | null = null;
    if (rawTaskId !== null) {
      const self = await getTask(this.db, rawTaskId);
      if (!self) {
        return { valid: false, error: `Task "${rawTaskId}" not found.` };
      }
      resolvedTaskId = self.id;
    }

    const resolvedBlockerIds: string[] = [];
    for (const bid of blockerIds) {
      const blocker = await getTask(this.db, bid);
      if (!blocker) {
        return { valid: false, error: `Task "${bid}" not found.` };
      }
      if (resolvedTaskId !== null && blocker.id === resolvedTaskId) {
        return { valid: false, error: "A task cannot block itself." };
      }
      resolvedBlockerIds.push(blocker.id);
    }

    if (resolvedTaskId !== null && resolvedBlockerIds.length > 0) {
      const allTasks = await listTasks(this.db);
      const byId = new Map(allTasks.map((t) => [t.id, t]));

      for (const rid of resolvedBlockerIds) {
        const queue: string[] = [rid];
        const seen = new Set<string>();
        while (queue.length > 0) {
          const curr = queue.shift()!;
          if (curr === resolvedTaskId) {
            return {
              valid: false,
              error: `Setting blocked_by to "${rid}" would create a circular dependency.`,
            };
          }
          if (seen.has(curr)) {
            continue;
          }
          seen.add(curr);
          const t = byId.get(curr);
          if (t) {
            for (const b of t.blocked_by) {
              if (!seen.has(b)) {
                queue.push(b);
              }
            }
          }
        }
      }
    }

    return { valid: true };
  }

  async list(filters?: ListFilters): Promise<Task[]> {
    return listTasks(this.db, filters);
  }

  async get(id: string): Promise<Task | null> {
    return getTask(this.db, id);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    return this.db.transaction().execute(async (trx) => {
      const now = new Date().toISOString();
      const task = await updateTask(trx, id, input, now);
      if (!task) {
        return null;
      }

      for (const [field, value] of Object.entries(input)) {
        if (field === "note" || value === undefined) {
          continue;
        }
        await writeOp(
          trx,
          {
            task_id: task.id,
            device_id: this.deviceId,
            op_type: "update",
            field,
            value: serializeOpValue(value),
          },
          now,
        );
      }

      await this._maybeSpawn(trx, task, now);
      return task;
    });
  }

  async addNote(id: string, note: string): Promise<Task | null> {
    return this.db.transaction().execute(async (trx) => {
      const now = new Date().toISOString();
      const existing = await getTask(trx, id);
      if (!existing) {
        return null;
      }

      const trimmed = note.trim();
      if (trimmed.length === 0 || existing.notes.some((n) => n.trim() === trimmed)) {
        return existing;
      }

      const task = await appendNote(trx, existing.id, trimmed, now);

      await writeOp(
        trx,
        {
          task_id: existing.id,
          device_id: this.deviceId,
          op_type: "update",
          field: "notes",
          value: trimmed,
        },
        now,
      );
      return task;
    });
  }

  async updateWithNote(id: string, input: UpdateTaskInput, note: string): Promise<Task | null> {
    return this.db.transaction().execute(async (trx) => {
      const now = new Date().toISOString();
      let task = await updateTask(trx, id, input, now);
      if (!task) {
        return null;
      }

      const resolvedId = task.id;
      for (const [field, value] of Object.entries(input)) {
        if (field === "note" || value === undefined) {
          continue;
        }
        await writeOp(
          trx,
          {
            task_id: resolvedId,
            device_id: this.deviceId,
            op_type: "update",
            field,
            value: serializeOpValue(value),
          },
          now,
        );
      }

      const trimmed = note.trim();
      if (trimmed.length > 0 && !task.notes.some((n) => n.trim() === trimmed)) {
        task = await appendNote(trx, resolvedId, trimmed, now);

        await writeOp(
          trx,
          {
            task_id: resolvedId,
            device_id: this.deviceId,
            op_type: "update",
            field: "notes",
            value: trimmed,
          },
          now,
        );
      }

      await this._maybeSpawn(trx, task!, now);
      return task;
    });
  }

  async clearNotes(id: string): Promise<Task | null> {
    return this.db.transaction().execute(async (trx) => {
      const now = new Date().toISOString();
      const task = await setNotes(trx, id, [], now);
      if (!task) {
        return null;
      }

      await writeOp(
        trx,
        {
          task_id: task.id,
          device_id: this.deviceId,
          op_type: "update",
          field: "notes_clear",
          value: "",
        },
        now,
      );
      return task;
    });
  }

  async clearNotesAndUpdate(
    id: string,
    updates: UpdateTaskInput,
    note?: string,
  ): Promise<Task | null> {
    return this.db.transaction().execute(async (trx) => {
      const now = new Date().toISOString();

      // 1. Clear notes
      let task = await setNotes(trx, id, [], now);
      if (!task) {
        return null;
      }

      const resolvedId = task.id;

      await writeOp(
        trx,
        {
          task_id: resolvedId,
          device_id: this.deviceId,
          op_type: "update",
          field: "notes_clear",
          value: "",
        },
        now,
      );

      // 2. Add note if provided
      if (note) {
        const trimmed = note.trim();
        if (trimmed.length > 0) {
          task = await appendNote(trx, resolvedId, trimmed, now);

          await writeOp(
            trx,
            {
              task_id: resolvedId,
              device_id: this.deviceId,
              op_type: "update",
              field: "notes",
              value: trimmed,
            },
            now,
          );
        }
      }

      // 3. Apply field updates if any
      const hasFields = Object.keys(updates).length > 0;
      if (hasFields) {
        task = await updateTask(trx, resolvedId, updates, now);

        for (const [field, value] of Object.entries(updates)) {
          if (field === "note" || value === undefined) {
            continue;
          }
          await writeOp(
            trx,
            {
              task_id: resolvedId,
              device_id: this.deviceId,
              op_type: "update",
              field,
              value: serializeOpValue(value),
            },
            now,
          );
        }
      }

      await this._maybeSpawn(trx, task!, now);
      return task;
    });
  }

  async replaceNotes(id: string, notes: string[]): Promise<Task | null> {
    return this.db.transaction().execute(async (trx) => {
      const now = new Date().toISOString();
      const task = await setNotes(trx, id, notes, now);
      if (!task) {
        return null;
      }

      const resolvedId = task.id;

      await writeOp(
        trx,
        {
          task_id: resolvedId,
          device_id: this.deviceId,
          op_type: "update",
          field: "notes_clear",
          value: "",
        },
        now,
      );

      for (const note of notes) {
        await writeOp(
          trx,
          {
            task_id: resolvedId,
            device_id: this.deviceId,
            op_type: "update",
            field: "notes",
            value: note,
          },
          now,
        );
      }

      return task;
    });
  }

  async listLabels(): Promise<string[]> {
    const tasks = await listTasks(this.db);
    const labels = new Set<string>();
    for (const task of tasks) {
      for (const label of task.labels) {
        labels.add(label);
      }
    }
    return [...labels].sort();
  }

  async getContext(opts?: { owner?: string; label?: string }): Promise<{
    sections: ContextSections;
    summary: Record<string, number>;
  }> {
    const now = new Date();
    const tasks = await this.list({
      sort: "priority",
      owner: opts?.owner,
      label: opts?.label,
    });

    const doneTasks = await this.list({
      status: "done",
      sort: "priority",
      owner: opts?.owner,
      label: opts?.label,
    });

    const sections: ContextSections = {
      overdue: [],
      due_soon: [],
      in_progress: [],
      actionable: [],
      blocked: [],
      recently_completed: [],
    };

    const nonDoneIds = new Set(tasks.filter((t) => t.status !== "done").map((t) => t.id));
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    for (const t of doneTasks) {
      if (t.updated_at >= oneDayAgo) {
        sections.recently_completed.push(t);
      }
    }

    for (const t of tasks) {
      if (t.status === "done") {
        continue;
      }

      if (t.due_at && isOverdue(t.due_at, now)) {
        sections.overdue.push(t);
        continue;
      }

      if (t.due_at && isDueSoon(t.due_at, now)) {
        sections.due_soon.push(t);
        continue;
      }

      if (t.status === "in_progress" || t.status === "in_review") {
        sections.in_progress.push(t);
        continue;
      }

      const hasIncompleteBlocker = t.blocked_by.some((id) => nonDoneIds.has(id));
      if (hasIncompleteBlocker) {
        sections.blocked.push(t);
        continue;
      }

      if (t.status === "todo") {
        sections.actionable.push(t);
        continue;
      }
    }

    const blockerTitles = new Map<string, string>();
    for (const t of [...tasks, ...doneTasks]) {
      blockerTitles.set(t.id, t.title);
    }
    sections.blockerTitles = blockerTitles;

    const summary = {
      overdue: sections.overdue.length,
      due_soon: sections.due_soon.length,
      in_progress: sections.in_progress.length,
      actionable: sections.actionable.length,
      blocked: sections.blocked.length,
      recently_completed: sections.recently_completed.length,
    };

    return { sections, summary };
  }

  async log(id: string): Promise<OplogEntry[] | null> {
    const task = await getTask(this.db, id);
    if (!task) {
      return null;
    }
    const rows = await this.db
      .selectFrom("oplog")
      .selectAll()
      .where("task_id", "=", task.id)
      .orderBy("timestamp", "asc")
      .orderBy(sql`rowid`, "asc")
      .execute();
    return rows as OplogEntry[];
  }

  async delete(id: string): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const now = new Date().toISOString();
      const task = await getTask(trx, id);
      if (!task) {
        return false;
      }

      const result = await deleteTask(trx, task.id, now);
      if (result) {
        await writeOp(
          trx,
          {
            task_id: task.id,
            device_id: this.deviceId,
            op_type: "delete",
            field: null,
            value: null,
          },
          now,
        );
      }
      return result;
    });
  }
}
