import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskService } from "../main.js";
import { STATUSES, PRIORITIES } from "../tasks/types.js";
import type { CreateTaskInput, UpdateTaskInput } from "../tasks/types.js";
import type { ListFilters } from "../tasks/repository.js";
import { isOverdue, isDueSoon, type ContextSections } from "../format/text.js";

declare const __VERSION__: string;

const StatusEnum = z.enum(STATUSES as unknown as [string, ...string[]]);
const PriorityEnum = z.enum(PRIORITIES as unknown as [string, ...string[]]);

export function createMcpServer(service: TaskService): McpServer {
  const version = typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0";
  const server = new McpServer({ name: "oru", version }, { capabilities: { logging: {} } });

  // --- Tools ---

  server.registerTool(
    "add_task",
    {
      title: "Add task",
      description: "Create a new task. Returns the created task.",
      inputSchema: z.object({
        title: z.string().describe("Task title"),
        id: z.string().optional().describe("Custom task ID (for idempotent creates)"),
        status: StatusEnum.optional().describe("Initial status"),
        priority: PriorityEnum.optional().describe("Priority level"),
        owner: z.string().optional().describe("Assign to owner"),
        due_at: z.string().optional().describe("Due date (ISO 8601)"),
        blocked_by: z.array(z.string()).optional().describe("IDs of blocking tasks"),
        labels: z.array(z.string()).optional().describe("Labels to attach"),
        notes: z.array(z.string()).optional().describe("Initial notes"),
        metadata: z.record(z.string(), z.unknown()).optional().describe("Key-value metadata"),
      }),
    },
    async (input) => {
      try {
        const task = await service.add(input as CreateTaskInput);
        return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (input.id && msg.includes("UNIQUE constraint")) {
          const existing = await service.get(input.id);
          if (existing) {
            return { content: [{ type: "text", text: JSON.stringify(existing, null, 2) }] };
          }
        }
        return { content: [{ type: "text", text: msg }], isError: true };
      }
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description: "Update fields on an existing task. Returns the updated task.",
      inputSchema: z.object({
        id: z.string().describe("Task ID or prefix"),
        title: z.string().optional().describe("New title"),
        status: StatusEnum.optional().describe("New status"),
        priority: PriorityEnum.optional().describe("New priority"),
        owner: z.string().nullable().optional().describe("New owner (null to unassign)"),
        due_at: z.string().nullable().optional().describe("New due date (null to clear)"),
        blocked_by: z.array(z.string()).optional().describe("New blocker IDs (replaces existing)"),
        labels: z.array(z.string()).optional().describe("New labels (replaces existing)"),
        metadata: z.record(z.string(), z.unknown()).optional().describe("Metadata to merge"),
        note: z.string().optional().describe("Note to append"),
      }),
    },
    async (input) => {
      const { id, note, ...fields } = input;
      const task = note
        ? await service.updateWithNote(id, fields as UpdateTaskInput, note)
        : await service.update(id, fields as UpdateTaskInput);
      if (!task) {
        return { content: [{ type: "text", text: `Task not found: ${id}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description: "Delete a task by ID.",
      inputSchema: z.object({
        id: z.string().describe("Task ID or prefix"),
      }),
    },
    async ({ id }) => {
      const ok = await service.delete(id);
      if (!ok) {
        return { content: [{ type: "text", text: `Task not found: ${id}` }], isError: true };
      }
      return { content: [{ type: "text", text: `Deleted ${id}` }] };
    },
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "List tasks with optional filters. Returns an array of tasks. Done tasks are excluded by default.",
      inputSchema: z.object({
        status: StatusEnum.optional().describe("Filter by status (single value)"),
        priority: PriorityEnum.optional().describe("Filter by priority (single value)"),
        owner: z.string().optional().describe("Filter by owner"),
        label: z.string().optional().describe("Filter by label"),
        search: z.string().optional().describe("Search title text"),
        sort: z.enum(["priority", "due", "title", "created"]).optional().describe("Sort order"),
        actionable: z
          .boolean()
          .optional()
          .describe("Only actionable tasks (not blocked, not done)"),
        limit: z.number().optional().describe("Max results"),
        offset: z.number().optional().describe("Skip N results"),
      }),
    },
    async (filters) => {
      const tasks = await service.list(filters as ListFilters);
      return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
    },
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description: "Get a single task by ID or ID prefix.",
      inputSchema: z.object({
        id: z.string().describe("Task ID or prefix"),
      }),
    },
    async ({ id }) => {
      const task = await service.get(id);
      if (!task) {
        return { content: [{ type: "text", text: `Task not found: ${id}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.registerTool(
    "get_context",
    {
      title: "Get context",
      description:
        "Get a summary of what needs attention: overdue tasks, due soon, in progress, actionable, blocked, and recently completed.",
      inputSchema: z.object({
        owner: z.string().optional().describe("Scope to a specific owner"),
        label: z.string().optional().describe("Filter by label"),
      }),
    },
    async (opts) => {
      const now = new Date();
      const tasks = await service.list({ sort: "priority", owner: opts.owner, label: opts.label });
      const doneTasks = await service.list({
        status: "done",
        sort: "priority",
        owner: opts.owner,
        label: opts.label,
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
        } else if (t.due_at && isDueSoon(t.due_at, now)) {
          sections.due_soon.push(t);
        } else if (t.status === "in_progress" || t.status === "in_review") {
          sections.in_progress.push(t);
        } else if (t.blocked_by.some((id) => nonDoneIds.has(id))) {
          sections.blocked.push(t);
        } else if (t.status === "todo") {
          sections.actionable.push(t);
        }
      }

      const summary = {
        overdue: sections.overdue.length,
        due_soon: sections.due_soon.length,
        in_progress: sections.in_progress.length,
        actionable: sections.actionable.length,
        blocked: sections.blocked.length,
        recently_completed: sections.recently_completed.length,
      };

      const result = { summary, ...sections };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "add_note",
    {
      title: "Add note",
      description: "Append a note to an existing task.",
      inputSchema: z.object({
        id: z.string().describe("Task ID or prefix"),
        note: z.string().describe("Note text to append"),
      }),
    },
    async ({ id, note }) => {
      const task = await service.addNote(id, note);
      if (!task) {
        return { content: [{ type: "text", text: `Task not found: ${id}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
    },
  );

  server.registerTool(
    "list_labels",
    {
      title: "List labels",
      description: "List all labels currently in use across tasks.",
      inputSchema: z.object({}),
    },
    async () => {
      const labels = await service.listLabels();
      return { content: [{ type: "text", text: JSON.stringify(labels) }] };
    },
  );

  return server;
}
