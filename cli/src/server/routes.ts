import { Hono } from "hono";
import { z } from "zod";
import type { TaskService } from "../main.js";
import {
  STATUSES,
  PRIORITIES,
  VALID_STATUSES,
  VALID_PRIORITIES,
  type Status,
  type Priority,
} from "../tasks/types.js";
import { AmbiguousPrefixError } from "../tasks/repository.js";
import {
  MAX_TITLE_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_LABEL_LENGTH,
  MAX_LABELS,
  MAX_BLOCKED_BY,
  MAX_NOTES,
  MAX_METADATA_KEYS,
  MAX_METADATA_KEY_LENGTH,
  MAX_METADATA_VALUE_LENGTH,
  sanitizeTitle,
} from "../validation.js";

const StatusEnum = z.enum(STATUSES as unknown as [string, ...string[]]);
const PriorityEnum = z.enum(PRIORITIES as unknown as [string, ...string[]]);

const metadataSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (val) => Object.keys(val).length <= MAX_METADATA_KEYS,
    `Metadata exceeds maximum of ${MAX_METADATA_KEYS} keys.`,
  )
  .refine(
    (val) => Object.keys(val).every((k) => k.length <= MAX_METADATA_KEY_LENGTH),
    `Metadata key exceeds maximum length of ${MAX_METADATA_KEY_LENGTH} characters.`,
  )
  .refine(
    (val) =>
      Object.values(val).every(
        (v) => typeof v !== "string" || v.length <= MAX_METADATA_VALUE_LENGTH,
      ),
    `Metadata value exceeds maximum length of ${MAX_METADATA_VALUE_LENGTH} characters.`,
  );

const createTaskSchema = z.object({
  id: z.string().optional(),
  title: z
    .string()
    .min(1, "Title is required.")
    .max(MAX_TITLE_LENGTH, `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters.`),
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  owner: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  blocked_by: z
    .array(z.string())
    .max(MAX_BLOCKED_BY, `blocked_by exceeds maximum of ${MAX_BLOCKED_BY} items.`)
    .optional(),
  labels: z
    .array(
      z
        .string()
        .max(MAX_LABEL_LENGTH, `Label exceeds maximum length of ${MAX_LABEL_LENGTH} characters.`),
    )
    .max(MAX_LABELS, `labels exceeds maximum of ${MAX_LABELS} items.`)
    .optional(),
  notes: z
    .array(
      z
        .string()
        .max(MAX_NOTE_LENGTH, `Note exceeds maximum length of ${MAX_NOTE_LENGTH} characters.`),
    )
    .max(MAX_NOTES, `notes exceeds maximum of ${MAX_NOTES} items.`)
    .optional(),
  metadata: metadataSchema.optional(),
});

const updateTaskSchema = z.object({
  title: z
    .string()
    .max(MAX_TITLE_LENGTH, `Title exceeds maximum length of ${MAX_TITLE_LENGTH} characters.`)
    .optional(),
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  owner: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  blocked_by: z
    .array(z.string())
    .max(MAX_BLOCKED_BY, `blocked_by exceeds maximum of ${MAX_BLOCKED_BY} items.`)
    .optional(),
  labels: z
    .array(
      z
        .string()
        .max(MAX_LABEL_LENGTH, `Label exceeds maximum length of ${MAX_LABEL_LENGTH} characters.`),
    )
    .max(MAX_LABELS, `labels exceeds maximum of ${MAX_LABELS} items.`)
    .optional(),
  note: z
    .string()
    .max(MAX_NOTE_LENGTH, `Note exceeds maximum length of ${MAX_NOTE_LENGTH} characters.`)
    .optional(),
  clear_notes: z.boolean().optional(),
  metadata: metadataSchema.optional(),
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

export function createApp(service: TaskService, token: string, pairingCode: string): Hono {
  const app = new Hono();
  let activePairingCode: string | null = pairingCode;

  app.use("*", async (c, next) => {
    if (c.req.path === "/pair") {
      return next();
    }
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ") || auth.slice(7) !== token) {
      return c.json(
        { error: "unauthorized", message: "Missing or invalid authentication token." },
        401,
      );
    }
    await next();
  });

  app.post("/pair", (c) => {
    const code = c.req.query("code");
    if (!activePairingCode || code !== activePairingCode) {
      return c.json({ error: "invalid_code", message: "Invalid or expired pairing code." }, 403);
    }
    activePairingCode = null;
    return c.json({ token });
  });

  app.get("/tasks", async (c) => {
    const statusRaw = c.req.query("status");
    const priorityRaw = c.req.query("priority");
    const label = c.req.query("label");
    const search = c.req.query("search");
    const all = c.req.query("all");
    const owner = c.req.query("owner");
    const actionable = c.req.query("actionable");
    const limitRaw = c.req.query("limit");
    const offsetRaw = c.req.query("offset");

    let status: Status | Status[] | undefined;
    if (statusRaw) {
      const parts = statusRaw.split(",");
      for (const s of parts) {
        if (!VALID_STATUSES.has(s)) {
          return c.json({ error: "validation", message: `Invalid status: ${s}` }, 400);
        }
      }
      status = parts.length === 1 ? (parts[0] as Status) : (parts as Status[]);
    }

    let priority: Priority | Priority[] | undefined;
    if (priorityRaw) {
      const parts = priorityRaw.split(",");
      for (const p of parts) {
        if (!VALID_PRIORITIES.has(p)) {
          return c.json({ error: "validation", message: `Invalid priority: ${p}` }, 400);
        }
      }
      priority = parts.length === 1 ? (parts[0] as Priority) : (parts as Priority[]);
    }

    const limit = limitRaw ? Number(limitRaw) : undefined;
    const offset = offsetRaw ? Number(offsetRaw) : undefined;

    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
      return c.json({ error: "validation", message: "limit must be a non-negative integer." }, 400);
    }
    if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
      return c.json(
        { error: "validation", message: "offset must be a non-negative integer." },
        400,
      );
    }

    let tasks = await service.list({
      status,
      priority,
      owner,
      label,
      search,
      actionable: !!actionable,
      limit,
      offset,
    });
    if (!all && !status) {
      tasks = tasks.filter((t) => t.status !== "done");
    }
    return c.json(tasks);
  });

  app.get("/tasks/:id", async (c) => {
    try {
      const task = await service.get(c.req.param("id"));
      if (!task) {
        return c.json({ error: "not_found", id: c.req.param("id") }, 404);
      }
      return c.json(task);
    } catch (err) {
      if (err instanceof AmbiguousPrefixError) {
        return c.json({ error: "ambiguous_prefix", id: err.prefix, matches: err.matches }, 409);
      }
      throw err;
    }
  });

  app.post("/tasks", async (c) => {
    let raw;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ error: "validation", message: "Invalid JSON body." }, 400);
    }
    // Sanitize title before validation
    if (typeof raw.title === "string") {
      raw.title = sanitizeTitle(raw.title);
    }
    const result = createTaskSchema.safeParse(raw);
    if (!result.success) {
      return c.json({ error: "validation", message: formatZodError(result.error) }, 400);
    }
    const { title, status, priority, owner, due_at, blocked_by, labels, notes, metadata, id } =
      result.data;

    const task = await service.add({
      id,
      title,
      status: status as Status | undefined,
      priority: priority as Priority | undefined,
      owner,
      due_at,
      blocked_by,
      labels,
      notes,
      metadata,
    });
    return c.json(task, 201);
  });

  app.patch("/tasks/:id", async (c) => {
    const id = c.req.param("id");
    let raw;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ error: "validation", message: "Invalid JSON body." }, 400);
    }
    // Sanitize title before validation
    if (typeof raw.title === "string") {
      raw.title = sanitizeTitle(raw.title);
    }
    const result = updateTaskSchema.safeParse(raw);
    if (!result.success) {
      return c.json({ error: "validation", message: formatZodError(result.error) }, 400);
    }
    const {
      title,
      status,
      priority,
      owner,
      due_at,
      blocked_by,
      labels,
      note,
      clear_notes,
      metadata,
    } = result.data;

    if (title !== undefined && title.length === 0) {
      return c.json({ error: "validation", message: "Title cannot be empty." }, 400);
    }

    try {
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
      if (blocked_by) {
        updateFields.blocked_by = blocked_by;
      }
      if (labels) {
        updateFields.labels = labels;
      }
      if (owner !== undefined) {
        updateFields.owner = owner;
      }
      if (due_at !== undefined) {
        updateFields.due_at = due_at;
      }
      if (metadata) {
        updateFields.metadata = metadata;
      }

      const hasFields = Object.keys(updateFields).length > 0;
      let task;

      if (clear_notes) {
        task = await service.clearNotes(id);
        if (!task) {
          return c.json({ error: "not_found", id }, 404);
        }
        if (note) {
          task = await service.addNote(id, note);
        }
        if (hasFields) {
          task = await service.update(id, updateFields);
        }
      } else if (note && hasFields) {
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
    } catch (err) {
      if (err instanceof AmbiguousPrefixError) {
        return c.json({ error: "ambiguous_prefix", id: err.prefix, matches: err.matches }, 409);
      }
      throw err;
    }
  });

  app.delete("/tasks/:id", async (c) => {
    const id = c.req.param("id");
    try {
      const result = await service.delete(id);
      if (!result) {
        return c.json({ error: "not_found", id }, 404);
      }
      return c.json({ id, deleted: true });
    } catch (err) {
      if (err instanceof AmbiguousPrefixError) {
        return c.json({ error: "ambiguous_prefix", id: err.prefix, matches: err.matches }, 409);
      }
      throw err;
    }
  });

  return app;
}
