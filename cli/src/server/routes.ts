import { Hono } from "hono";
import type { TaskService } from "../main.js";
import type { Status, Priority } from "../tasks/types.js";

const validStatuses = new Set(["todo", "in_progress", "done"]);
const validPriorities = new Set(["low", "medium", "high", "urgent"]);

export function createApp(service: TaskService): Hono {
  const app = new Hono();

  app.get("/tasks", async (c) => {
    const status = c.req.query("status") as Status | undefined;
    const priority = c.req.query("priority") as Priority | undefined;
    const label = c.req.query("label");
    const search = c.req.query("search");
    const all = c.req.query("all");

    if (status && !validStatuses.has(status)) {
      return c.json({ error: "validation", message: `Invalid status: ${status}` }, 400);
    }
    if (priority && !validPriorities.has(priority)) {
      return c.json({ error: "validation", message: `Invalid priority: ${priority}` }, 400);
    }

    let tasks = await service.list({ status, priority, label, search });
    if (!all && !status) {
      tasks = tasks.filter((t) => t.status !== "done");
    }
    return c.json(tasks);
  });

  app.get("/tasks/:id", async (c) => {
    const task = await service.get(c.req.param("id"));
    if (!task) {
      return c.json({ error: "not_found", id: c.req.param("id") }, 404);
    }
    return c.json(task);
  });

  app.post("/tasks", async (c) => {
    const body = await c.req.json();
    const { title, status, priority, labels, notes, metadata, id } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return c.json({ error: "validation", message: "Title is required" }, 400);
    }
    if (title.length > 1000) {
      return c.json(
        { error: "validation", message: "Title exceeds maximum length of 1000 characters" },
        400,
      );
    }
    if (status && !validStatuses.has(status)) {
      return c.json({ error: "validation", message: `Invalid status: ${status}` }, 400);
    }
    if (priority && !validPriorities.has(priority)) {
      return c.json({ error: "validation", message: `Invalid priority: ${priority}` }, 400);
    }

    const task = await service.add({
      id,
      title,
      status,
      priority,
      labels,
      notes,
      metadata,
    });
    return c.json(task, 201);
  });

  app.patch("/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { title, status, priority, labels, note, metadata } = body;

    if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
      return c.json({ error: "validation", message: "Title cannot be empty" }, 400);
    }
    if (title && title.length > 1000) {
      return c.json(
        { error: "validation", message: "Title exceeds maximum length of 1000 characters" },
        400,
      );
    }
    if (status && !validStatuses.has(status)) {
      return c.json({ error: "validation", message: `Invalid status: ${status}` }, 400);
    }
    if (priority && !validPriorities.has(priority)) {
      return c.json({ error: "validation", message: `Invalid priority: ${priority}` }, 400);
    }

    const updateFields: Record<string, unknown> = {};
    if (title) {
      updateFields.title = title;
    }
    if (status) {
      updateFields.status = status;
    }
    if (priority) {
      updateFields.priority = priority;
    }
    if (labels) {
      updateFields.labels = labels;
    }
    if (metadata) {
      updateFields.metadata = metadata;
    }

    const hasFields = Object.keys(updateFields).length > 0;
    let task;

    if (note && hasFields) {
      task = await service.updateWithNote(id, updateFields, note);
    } else if (note) {
      task = await service.addNote(id, note);
    } else if (hasFields) {
      task = await service.update(id, updateFields);
    } else {
      task = await service.get(id);
    }

    if (!task) {
      return c.json({ error: "not_found", id }, 404);
    }
    return c.json(task);
  });

  app.delete("/tasks/:id", async (c) => {
    const id = c.req.param("id");
    const result = await service.delete(id);
    if (!result) {
      return c.json({ error: "not_found", id }, 404);
    }
    return c.json({ id, deleted: true });
  });

  return app;
}
