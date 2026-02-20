import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskService } from "../main";
import type { Task, CreateTaskInput, UpdateTaskInput } from "../tasks/types";
import { excludeDone } from "../tasks/repository";
import type { ListFilters } from "../tasks/repository";
import { stripInternal } from "../format/json";
import {
  StatusEnum,
  PriorityEnum,
  titleCreateSchema,
  titleUpdateSchema,
  labelsSchema,
  notesSchema,
  noteSchema,
  blockedBySchema,
  metadataSchema,
} from "../validation";

import { VERSION } from "../version";

function isSqliteError(err: unknown): err is Error & { code: string } {
  return (
    err instanceof Error &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string" &&
    (err as { code: string }).code.startsWith("SQLITE_")
  );
}

export function sanitizeError(err: unknown): string {
  if (isSqliteError(err)) {
    return "An internal error occurred. Please try again.";
  }
  // better-sqlite3 throws TypeErrors for connection-level errors (e.g. closed DB)
  // without a SQLITE_ code - these are also internal errors.
  if (err instanceof TypeError) {
    return "An internal error occurred. Please try again.";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "An internal error occurred. Please try again.";
}

export function createMcpServer(service: TaskService): McpServer {
  const version = VERSION;
  const server = new McpServer({ name: "oru", version }, { capabilities: { logging: {} } });

  server.registerTool(
    "add_task",
    {
      title: "Add task",
      description:
        "Create a new task. Returns the created task. Defaults to status 'todo' and priority 'medium' if not specified. Pass an 'id' field to enable idempotent creates - if a task with that ID already exists, the existing task is returned instead of creating a duplicate.",
      inputSchema: z.object({
        title: titleCreateSchema.describe("Task title, e.g. 'Fix login bug'"),
        id: z
          .string()
          .optional()
          .describe(
            "Custom task ID for idempotent creates. If a task with this ID already exists, the existing task is returned. Must be a 11-character base62 string (alphabet: 0-9, A-Z, a-z).",
          ),
        status: StatusEnum.optional().describe(
          "Initial status. Valid values: todo, in_progress, in_review, done. Defaults to 'todo'.",
        ),
        priority: PriorityEnum.optional().describe(
          "Priority level. Valid values: low, medium, high, urgent. Defaults to 'medium'.",
        ),
        owner: z.string().optional().describe("Assign to owner, e.g. 'alice'"),
        due_at: z
          .string()
          .optional()
          .describe("Due date as ISO 8601 datetime string, e.g. '2026-03-01T00:00:00.000Z'"),
        blocked_by: blockedBySchema
          .optional()
          .describe(
            "Array of task IDs that must be completed before this task, e.g. ['0196b8e0-...']",
          ),
        labels: labelsSchema
          .optional()
          .describe("Array of string labels to attach, e.g. ['bug', 'frontend']"),
        notes: notesSchema
          .optional()
          .describe("Initial notes to add to the task, e.g. ['Started migration']"),
        recurrence: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Recurrence rule in RRULE format, e.g. 'FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=MO,WE,FR'. Prefix with 'after:' for completion-based recurrence (next due computed from completion time instead of current due date), e.g. 'after:FREQ=WEEKLY'. Set to null to remove recurrence.",
          ),
        metadata: metadataSchema
          .optional()
          .describe("Arbitrary JSON object for storing custom key-value data, e.g. {pr: 42}"),
      }),
    },
    async (input) => {
      try {
        const task = await service.add(input as CreateTaskInput);
        return { content: [{ type: "text", text: JSON.stringify(stripInternal(task), null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (input.id && msg.includes("UNIQUE constraint")) {
          const existing = await service.get(input.id);
          if (existing) {
            return {
              content: [{ type: "text", text: JSON.stringify(stripInternal(existing), null, 2) }],
            };
          }
        }
        return { content: [{ type: "text", text: sanitizeError(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description:
        "Update fields on an existing task. Only send the fields you want to change - omitted fields are left unchanged. Notes are append-only: use the 'note' field to add a new note without affecting existing ones. Returns the updated task.",
      inputSchema: z.object({
        id: z.string().describe("Task ID or unique ID prefix, e.g. '0196b8e0' or full UUID"),
        title: titleUpdateSchema.optional().describe("New title"),
        status: StatusEnum.optional().describe(
          "New status. Valid values: todo, in_progress, in_review, done.",
        ),
        priority: PriorityEnum.optional().describe(
          "New priority. Valid values: low, medium, high, urgent.",
        ),
        owner: z.string().nullable().optional().describe("New owner. Set to null to unassign."),
        due_at: z
          .string()
          .nullable()
          .optional()
          .describe(
            "New due date as ISO 8601 datetime string, e.g. '2026-03-01T00:00:00.000Z'. Set to null to clear.",
          ),
        blocked_by: blockedBySchema
          .optional()
          .describe("Array of task IDs that block this task. Replaces the existing list."),
        labels: labelsSchema
          .optional()
          .describe(
            "Array of string labels. Replaces the existing list, e.g. ['bug', 'frontend'].",
          ),
        recurrence: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Recurrence rule in RRULE format, e.g. 'FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=MO,WE,FR'. Prefix with 'after:' for completion-based (next due from completion time). Set to null to remove recurrence.",
          ),
        metadata: metadataSchema
          .optional()
          .describe("Arbitrary JSON object. Merged with existing metadata."),
        note: noteSchema
          .optional()
          .describe("A note to append to the task. Append-only - existing notes are not affected."),
      }),
    },
    async (input) => {
      try {
        const { id, note, ...fields } = input;
        if (fields.metadata !== undefined) {
          const existing = await service.get(id);
          fields.metadata = { ...(existing?.metadata ?? {}), ...fields.metadata };
        }
        const task = note
          ? await service.updateWithNote(id, fields as UpdateTaskInput, note)
          : await service.update(id, fields as UpdateTaskInput);
        if (!task) {
          return { content: [{ type: "text", text: `Task not found: ${id}.` }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(stripInternal(task), null, 2) }] };
      } catch (err: unknown) {
        return { content: [{ type: "text", text: sanitizeError(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description:
        "Soft-delete a task by ID. The task is marked as deleted and excluded from listings but retained in the oplog for sync purposes.",
      inputSchema: z.object({
        id: z.string().describe("Task ID or unique ID prefix, e.g. '0196b8e0' or full UUID"),
      }),
    },
    async ({ id }) => {
      try {
        const ok = await service.delete(id);
        if (!ok) {
          return { content: [{ type: "text", text: `Task not found: ${id}.` }], isError: true };
        }
        return { content: [{ type: "text", text: `Deleted ${id}.` }] };
      } catch (err: unknown) {
        return { content: [{ type: "text", text: sanitizeError(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "List tasks with optional filters. Returns a JSON array of tasks. Done tasks are excluded by default - pass all: true to include them, or status='done' to see only completed tasks. Use 'actionable' filter to get only tasks that are not blocked and not done. The 'search' filter performs a case-insensitive substring match on task titles.",
      inputSchema: z.object({
        status: StatusEnum.optional().describe(
          "Filter by status. Valid values: todo, in_progress, in_review, done. Pass 'done' to see completed tasks.",
        ),
        priority: PriorityEnum.optional().describe(
          "Filter by priority. Valid values: low, medium, high, urgent.",
        ),
        owner: z.string().optional().describe("Filter by owner, e.g. 'alice'"),
        label: z.string().optional().describe("Filter by label, e.g. 'bug'"),
        search: z
          .string()
          .optional()
          .describe("Substring search across task titles (case-insensitive), e.g. 'login'"),
        sort: z
          .enum(["priority", "due", "title", "created"])
          .optional()
          .describe("Sort order. Valid values: priority, due, title, created."),
        actionable: z
          .boolean()
          .optional()
          .describe(
            "When true, returns only actionable tasks - those with status 'todo' that are not blocked by other incomplete tasks.",
          ),
        all: z
          .boolean()
          .optional()
          .describe("Include done tasks (ignored when status filter is set)"),
        limit: z.number().optional().describe("Maximum number of results to return"),
        offset: z.number().optional().describe("Number of results to skip (for pagination)"),
      }),
    },
    async (input) => {
      try {
        const { all, ...filters } = input;
        let tasks = await service.list(filters as ListFilters);
        tasks = excludeDone(tasks, { all, status: filters.status });
        return {
          content: [{ type: "text", text: JSON.stringify(tasks.map(stripInternal), null, 2) }],
        };
      } catch (err: unknown) {
        return { content: [{ type: "text", text: sanitizeError(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description:
        "Get a single task by its full ID or a unique ID prefix. Supports prefix matching - e.g. passing '0196b8' will match if only one task ID starts with that prefix.",
      inputSchema: z.object({
        id: z.string().describe("Task ID or unique ID prefix, e.g. '0196b8e0' or full UUID"),
      }),
    },
    async ({ id }) => {
      try {
        const task = await service.get(id);
        if (!task) {
          return { content: [{ type: "text", text: `Task not found: ${id}.` }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(stripInternal(task), null, 2) }] };
      } catch (err: unknown) {
        return { content: [{ type: "text", text: sanitizeError(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    "get_context",
    {
      title: "Get context",
      description:
        "Get a quick status overview of what needs attention. Returns counts and full task lists for: overdue, due soon (within 48h), in progress, actionable (todo + not blocked), blocked, and recently completed (last 24h). Use this for a high-level summary before deciding what to work on next.",
      inputSchema: z.object({
        owner: z.string().optional().describe("Scope to a specific owner, e.g. 'alice'"),
        label: z.string().optional().describe("Filter by label, e.g. 'backend'"),
      }),
    },
    async (opts) => {
      try {
        const { sections, summary } = await service.getContext({
          owner: opts.owner,
          label: opts.label,
        });

        const stripped: Record<string, unknown> = { summary };
        for (const [key, value] of Object.entries(sections)) {
          if (key === "blockerTitles") {
            stripped[key] = value;
          } else {
            stripped[key] = (value as Task[]).map(stripInternal);
          }
        }
        return { content: [{ type: "text", text: JSON.stringify(stripped, null, 2) }] };
      } catch (err: unknown) {
        return { content: [{ type: "text", text: sanitizeError(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    "add_note",
    {
      title: "Add note",
      description:
        "Append a note to an existing task. Notes are append-only and deduplicated - adding the same note text twice has no effect. Returns the updated task.",
      inputSchema: z.object({
        id: z.string().describe("Task ID or unique ID prefix, e.g. '0196b8e0' or full UUID"),
        note: noteSchema.describe("Note text to append, e.g. 'Blocked on API review'"),
      }),
    },
    async ({ id, note }) => {
      try {
        const task = await service.addNote(id, note);
        if (!task) {
          return { content: [{ type: "text", text: `Task not found: ${id}.` }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(stripInternal(task), null, 2) }] };
      } catch (err: unknown) {
        return { content: [{ type: "text", text: sanitizeError(err) }], isError: true };
      }
    },
  );

  server.registerTool(
    "list_labels",
    {
      title: "List labels",
      description:
        "List all labels currently in use across all tasks. Returns a flat JSON array of label strings. Useful for discovering available labels before filtering with list_tasks.",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        const labels = await service.listLabels();
        return { content: [{ type: "text", text: JSON.stringify(labels) }] };
      } catch (err: unknown) {
        return { content: [{ type: "text", text: sanitizeError(err) }], isError: true };
      }
    },
  );

  return server;
}
