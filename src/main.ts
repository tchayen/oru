import type Database from "better-sqlite3";
import type { Task, CreateTaskInput, UpdateTaskInput } from "./tasks/types.js";
import type { ListFilters } from "./tasks/repository.js";
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  appendNote,
  deleteTask,
} from "./tasks/repository.js";
import { writeOp } from "./oplog/writer.js";
import { getDeviceId } from "./device.js";

export class TaskService {
  private deviceId: string;

  constructor(private db: Database.Database) {
    this.deviceId = getDeviceId(db);
  }

  add(input: CreateTaskInput): Task {
    const task = this.db.transaction(() => {
      const now = new Date().toISOString();
      const task = createTask(this.db, input, now);
      writeOp(
        this.db,
        {
          task_id: task.id,
          device_id: this.deviceId,
          op_type: "create",
          field: null,
          value: JSON.stringify({
            title: task.title,
            status: task.status,
            priority: task.priority,
            labels: task.labels,
            notes: task.notes,
            metadata: task.metadata,
          }),
        },
        now,
      );
      return task;
    })();
    return task;
  }

  list(filters?: ListFilters): Task[] {
    return listTasks(this.db, filters);
  }

  get(id: string): Task | null {
    return getTask(this.db, id);
  }

  update(id: string, input: UpdateTaskInput): Task | null {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const task = updateTask(this.db, id, input, now);
      if (!task) {
        return null;
      }

      for (const [field, value] of Object.entries(input)) {
        if (value !== undefined) {
          writeOp(
            this.db,
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
    })();
  }

  addNote(id: string, note: string): Task | null {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const task = appendNote(this.db, id, note, now);
      if (!task) {
        return null;
      }

      writeOp(
        this.db,
        {
          task_id: task.id,
          device_id: this.deviceId,
          op_type: "update",
          field: "notes",
          value: note,
        },
        now,
      );
      return task;
    })();
  }

  updateWithNote(id: string, input: UpdateTaskInput, note: string): Task | null {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      // Apply field updates
      let task = updateTask(this.db, id, input, now);
      if (!task) {
        return null;
      }

      const resolvedId = task.id;
      for (const [field, value] of Object.entries(input)) {
        if (value !== undefined) {
          writeOp(
            this.db,
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

      // Append the note
      task = appendNote(this.db, resolvedId, note, now);

      writeOp(
        this.db,
        {
          task_id: resolvedId,
          device_id: this.deviceId,
          op_type: "update",
          field: "notes",
          value: note,
        },
        now,
      );

      return task;
    })();
  }

  delete(id: string): boolean {
    return this.db.transaction(() => {
      const now = new Date().toISOString();
      const task = getTask(this.db, id);
      if (!task) {
        return false;
      }

      const result = deleteTask(this.db, task.id, now);
      if (result) {
        writeOp(
          this.db,
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
    })();
  }
}
