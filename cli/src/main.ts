import type { Kysely } from "kysely";
import type { DB } from "./db/kysely.js";
import type { Task, CreateTaskInput, UpdateTaskInput } from "./tasks/types.js";
import type { ListFilters } from "./tasks/repository.js";
import type { OplogEntry } from "./oplog/types.js";
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  appendNote,
  setNotes,
  deleteTask,
} from "./tasks/repository.js";
import { writeOp } from "./oplog/writer.js";

export class TaskService {
  constructor(
    private db: Kysely<DB>,
    private deviceId: string,
  ) {}

  async add(input: CreateTaskInput): Promise<Task> {
    return this.db.transaction().execute(async (trx) => {
      const now = new Date().toISOString();
      const task = await createTask(trx, input, now);
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
        if (value !== undefined) {
          await writeOp(
            trx,
            {
              task_id: task.id,
              device_id: this.deviceId,
              op_type: "update",
              field,
              value: typeof value === "string" ? value : JSON.stringify(value),
            },
            now,
          );
        }
      }
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

      const task = await appendNote(trx, existing.id, note, now);

      await writeOp(
        trx,
        {
          task_id: existing.id,
          device_id: this.deviceId,
          op_type: "update",
          field: "notes",
          value: note,
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
        if (value !== undefined) {
          await writeOp(
            trx,
            {
              task_id: resolvedId,
              device_id: this.deviceId,
              op_type: "update",
              field,
              value: typeof value === "string" ? value : JSON.stringify(value),
            },
            now,
          );
        }
      }

      const trimmed = note.trim();
      if (trimmed.length > 0 && !task.notes.some((n) => n.trim() === trimmed)) {
        task = await appendNote(trx, resolvedId, note, now);

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
      .orderBy("id", "asc")
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
