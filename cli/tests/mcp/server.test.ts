import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestDb } from "../helpers/test-db";
import { createKysely } from "../../src/db/kysely";
import { TaskService } from "../../src/main";
import { createMcpServer, sanitizeError } from "../../src/mcp/server";
import type Database from "better-sqlite3";

describe("MCP server", () => {
  let db: Database.Database;
  let client: Client;

  beforeEach(async () => {
    db = createTestDb();
    const kysely = createKysely(db);
    const service = new TaskService(kysely, "test-device");
    const server = createMcpServer(service);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(() => {
    db.close();
  });

  it("lists available tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("add_task");
    expect(names).toContain("update_task");
    expect(names).toContain("delete_task");
    expect(names).toContain("list_tasks");
    expect(names).toContain("get_task");
    expect(names).toContain("get_context");
    expect(names).toContain("add_note");
    expect(names).toContain("list_labels");
  });

  it("get_context description mentions 48h for due-soon threshold, not 24h", async () => {
    const { tools } = await client.listTools();
    const ctxTool = tools.find((t) => t.name === "get_context");
    expect(ctxTool?.description).toContain("48h");
    expect(ctxTool?.description).not.toMatch(/due soon \(within 24h\)/);
  });

  it("adds a task", async () => {
    const result = await client.callTool({
      name: "add_task",
      arguments: { title: "Buy milk" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe("Buy milk");
    expect(task.status).toBe("todo");
    expect(task.priority).toBe("medium");
    expect(task.id).toBeTruthy();
  });

  it("excludes deleted_at from all task responses", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Check deleted_at" },
    });
    const addedTask = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);
    expect(addedTask).not.toHaveProperty("deleted_at");

    const getResult = await client.callTool({
      name: "get_task",
      arguments: { id: addedTask.id },
    });
    const gotTask = JSON.parse((getResult.content as Array<{ text: string }>)[0].text);
    expect(gotTask).not.toHaveProperty("deleted_at");

    const updateResult = await client.callTool({
      name: "update_task",
      arguments: { id: addedTask.id, priority: "high" },
    });
    const updatedTask = JSON.parse((updateResult.content as Array<{ text: string }>)[0].text);
    expect(updatedTask).not.toHaveProperty("deleted_at");

    const listResult = await client.callTool({
      name: "list_tasks",
      arguments: {},
    });
    const tasks = JSON.parse((listResult.content as Array<{ text: string }>)[0].text);
    for (const t of tasks) {
      expect(t).not.toHaveProperty("deleted_at");
    }

    const noteResult = await client.callTool({
      name: "add_note",
      arguments: { id: addedTask.id, note: "A note" },
    });
    const notedTask = JSON.parse((noteResult.content as Array<{ text: string }>)[0].text);
    expect(notedTask).not.toHaveProperty("deleted_at");
  });

  it("adds a task with all fields", async () => {
    const result = await client.callTool({
      name: "add_task",
      arguments: {
        title: "Deploy v2",
        priority: "urgent",
        status: "in_progress",
        owner: "alice",
        labels: ["backend", "infra"],
        notes: ["Started migration"],
        metadata: { pr: 42 },
      },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe("Deploy v2");
    expect(task.priority).toBe("urgent");
    expect(task.status).toBe("in_progress");
    expect(task.owner).toBe("alice");
    expect(task.labels).toEqual(["backend", "infra"]);
    expect(task.notes).toEqual(["Started migration"]);
    expect(task.metadata).toEqual({ pr: 42 });
  });

  it("lists tasks", async () => {
    await client.callTool({ name: "add_task", arguments: { title: "Task A" } });
    await client.callTool({ name: "add_task", arguments: { title: "Task B" } });

    const result = await client.callTool({
      name: "list_tasks",
      arguments: {},
    });
    const tasks = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(tasks).toHaveLength(2);
  });

  it("lists tasks with filters", async () => {
    await client.callTool({
      name: "add_task",
      arguments: { title: "High pri", priority: "high" },
    });
    await client.callTool({
      name: "add_task",
      arguments: { title: "Low pri", priority: "low" },
    });

    const result = await client.callTool({
      name: "list_tasks",
      arguments: { priority: "high" },
    });
    const tasks = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("High pri");
  });

  it("gets a task by ID", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Find me" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const result = await client.callTool({
      name: "get_task",
      arguments: { id: created.id },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe("Find me");
  });

  it("returns error for missing task", async () => {
    const result = await client.callTool({
      name: "get_task",
      arguments: { id: "nonexistent" },
    });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0].text).toContain("not found");
  });

  it("updates a task", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Original" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const result = await client.callTool({
      name: "update_task",
      arguments: { id: created.id, title: "Updated", priority: "high" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe("Updated");
    expect(task.priority).toBe("high");
  });

  it("updates a task with a note", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "With note" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const result = await client.callTool({
      name: "update_task",
      arguments: { id: created.id, status: "in_progress", note: "Started working on this" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.status).toBe("in_progress");
    expect(task.notes).toContain("Started working on this");
  });

  it("deletes a task", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Delete me" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const deleteResult = await client.callTool({
      name: "delete_task",
      arguments: { id: created.id },
    });
    expect(deleteResult.isError).toBeFalsy();

    const getResult = await client.callTool({
      name: "get_task",
      arguments: { id: created.id },
    });
    expect(getResult.isError).toBe(true);
  });

  it("adds a note", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Note target" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const result = await client.callTool({
      name: "add_note",
      arguments: { id: created.id, note: "This is important" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.notes).toContain("This is important");
  });

  it("lists labels", async () => {
    await client.callTool({
      name: "add_task",
      arguments: { title: "Labeled", labels: ["backend", "urgent"] },
    });

    const result = await client.callTool({
      name: "list_labels",
      arguments: {},
    });
    const labels = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(labels).toEqual(["backend", "urgent"]);
  });

  it("gets context summary", async () => {
    await client.callTool({
      name: "add_task",
      arguments: { title: "Actionable task" },
    });
    await client.callTool({
      name: "add_task",
      arguments: { title: "In progress", status: "in_progress" },
    });

    const result = await client.callTool({
      name: "get_context",
      arguments: {},
    });
    const context = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(context.summary).toBeDefined();
    expect(context.summary.actionable).toBe(1);
    expect(context.summary.in_progress).toBe(1);
    expect(context.actionable).toHaveLength(1);
    expect(context.in_progress).toHaveLength(1);
  });

  it("does not leak raw SQLite errors to MCP clients", async () => {
    // Closing the DB triggers a real SQLite error when the service tries to write.
    // First, prove the raw error contains internal details:
    db.close();
    let rawError: string | undefined;
    try {
      db.prepare("SELECT 1").get();
    } catch (e) {
      rawError = (e as Error).message;
    }
    expect(rawError).toContain("database");

    // Now call through MCP - the same kind of error hits service.add(),
    // but sanitizeError should replace it before it reaches the client.
    const result = await client.callTool({
      name: "add_task",
      arguments: { title: "Should fail" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toBe("An internal error occurred. Please try again.");
    expect(text).not.toContain("database");
  });

  it("does not leak raw SQLite errors from update_task", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Will update" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    db.close();

    const result = await client.callTool({
      name: "update_task",
      arguments: { id: created.id, title: "New title" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toBe("An internal error occurred. Please try again.");
    expect(text).not.toContain("database");
  });

  it("does not leak raw SQLite errors from delete_task", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Will delete" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    db.close();

    const result = await client.callTool({
      name: "delete_task",
      arguments: { id: created.id },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toBe("An internal error occurred. Please try again.");
    expect(text).not.toContain("database");
  });

  it("does not leak raw SQLite errors from list_tasks", async () => {
    db.close();

    const result = await client.callTool({
      name: "list_tasks",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toBe("An internal error occurred. Please try again.");
    expect(text).not.toContain("database");
  });

  it("does not leak raw SQLite errors from get_task", async () => {
    db.close();

    const result = await client.callTool({
      name: "get_task",
      arguments: { id: "some-id" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toBe("An internal error occurred. Please try again.");
    expect(text).not.toContain("database");
  });

  it("does not leak raw SQLite errors from get_context", async () => {
    db.close();

    const result = await client.callTool({
      name: "get_context",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toBe("An internal error occurred. Please try again.");
    expect(text).not.toContain("database");
  });

  it("does not leak raw SQLite errors from add_note", async () => {
    db.close();

    const result = await client.callTool({
      name: "add_note",
      arguments: { id: "some-id", note: "A note" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toBe("An internal error occurred. Please try again.");
    expect(text).not.toContain("database");
  });

  it("does not leak raw SQLite errors from list_labels", async () => {
    db.close();

    const result = await client.callTool({
      name: "list_labels",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ text: string }>)[0].text;
    expect(text).toBe("An internal error occurred. Please try again.");
    expect(text).not.toContain("database");
  });

  it("supports idempotent creates with --id", async () => {
    const customId = "0196b8e0-0000-7000-8000-000000000001";
    await client.callTool({
      name: "add_task",
      arguments: { title: "First", id: customId },
    });

    // Second create with same ID should succeed (upsert behavior)
    const result = await client.callTool({
      name: "add_task",
      arguments: { title: "First", id: customId },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.id).toBe(customId);

    // Should still be just one task
    const listResult = await client.callTool({
      name: "list_tasks",
      arguments: {},
    });
    const tasks = JSON.parse((listResult.content as Array<{ text: string }>)[0].text);
    expect(tasks).toHaveLength(1);
  });

  it("excludes done tasks by default", async () => {
    await client.callTool({ name: "add_task", arguments: { title: "Active task" } });
    await client.callTool({
      name: "add_task",
      arguments: { title: "Completed task", status: "done" },
    });

    const result = await client.callTool({
      name: "list_tasks",
      arguments: {},
    });
    const tasks = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Active task");
  });

  it("includes done tasks when all is true", async () => {
    await client.callTool({ name: "add_task", arguments: { title: "Active task" } });
    await client.callTool({
      name: "add_task",
      arguments: { title: "Completed task", status: "done" },
    });

    const result = await client.callTool({
      name: "list_tasks",
      arguments: { all: true },
    });
    const tasks = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(tasks).toHaveLength(2);
    const titles = tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain("Active task");
    expect(titles).toContain("Completed task");
  });

  it("explicit status filter overrides all parameter", async () => {
    await client.callTool({ name: "add_task", arguments: { title: "Active task" } });
    await client.callTool({
      name: "add_task",
      arguments: { title: "Completed task", status: "done" },
    });

    // Even with all: false, explicit status: "done" should return done tasks
    const result = await client.callTool({
      name: "list_tasks",
      arguments: { status: "done", all: false },
    });
    const tasks = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Completed task");
  });

  describe("add_task validation edge cases", () => {
    it("accepts empty title", async () => {
      const result = await client.callTool({
        name: "add_task",
        arguments: { title: "" },
      });
      expect(result.isError).toBeFalsy();
      const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(task.title).toBe("");
    });

    it("accepts very long title (over 1000 chars)", async () => {
      const longTitle = "a".repeat(1500);
      const result = await client.callTool({
        name: "add_task",
        arguments: { title: longTitle },
      });
      expect(result.isError).toBeFalsy();
      const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(task.title).toBe(longTitle);
    });

    it("accepts empty notes array", async () => {
      const result = await client.callTool({
        name: "add_task",
        arguments: { title: "Task with empty notes", notes: [] },
      });
      expect(result.isError).toBeFalsy();
      const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(task.notes).toEqual([]);
    });

    it("rejects invalid status value", async () => {
      const result = await client.callTool({
        name: "add_task",
        arguments: { title: "Test", status: "invalid" },
      });
      expect(result.isError).toBe(true);
    });

    it("rejects invalid priority value", async () => {
      const result = await client.callTool({
        name: "add_task",
        arguments: { title: "Test", priority: "critical" },
      });
      expect(result.isError).toBe(true);
    });

    it("rejects null title", async () => {
      const result = await client.callTool({
        name: "add_task",
        arguments: { title: null },
      });
      expect(result.isError).toBe(true);
    });

    it("rejects undefined title", async () => {
      const result = await client.callTool({
        name: "add_task",
        arguments: {},
      });
      expect(result.isError).toBe(true);
    });
  });

  describe("update_task validation edge cases", () => {
    it("rejects invalid status on update", async () => {
      const addResult = await client.callTool({
        name: "add_task",
        arguments: { title: "Task to update" },
      });
      const task = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

      const result = await client.callTool({
        name: "update_task",
        arguments: { id: task.id, status: "invalid" },
      });
      expect(result.isError).toBe(true);
    });

    it("rejects invalid priority on update", async () => {
      const addResult = await client.callTool({
        name: "add_task",
        arguments: { title: "Task to update" },
      });
      const task = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

      const result = await client.callTool({
        name: "update_task",
        arguments: { id: task.id, priority: "critical" },
      });
      expect(result.isError).toBe(true);
    });

    it("accepts setting owner to empty string", async () => {
      const addResult = await client.callTool({
        name: "add_task",
        arguments: { title: "Task", owner: "alice" },
      });
      const task = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

      const result = await client.callTool({
        name: "update_task",
        arguments: { id: task.id, owner: "" },
      });
      expect(result.isError).toBeFalsy();
      const updated = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(updated.owner).toBe("");
    });

    it("accepts setting owner to null", async () => {
      const addResult = await client.callTool({
        name: "add_task",
        arguments: { title: "Task", owner: "alice" },
      });
      const task = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

      const result = await client.callTool({
        name: "update_task",
        arguments: { id: task.id, owner: null },
      });
      expect(result.isError).toBeFalsy();
      const updated = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(updated.owner).toBeNull();
    });

    it("update with no fields (just id) is a no-op", async () => {
      const addResult = await client.callTool({
        name: "add_task",
        arguments: { title: "Original", priority: "high" },
      });
      const task = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

      const result = await client.callTool({
        name: "update_task",
        arguments: { id: task.id },
      });
      expect(result.isError).toBeFalsy();
      const updated = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(updated.title).toBe("Original");
      expect(updated.priority).toBe("high");
    });
  });

  describe("list_tasks validation edge cases", () => {
    it("rejects invalid status filter", async () => {
      const result = await client.callTool({
        name: "list_tasks",
        arguments: { status: "invalid" },
      });
      expect(result.isError).toBe(true);
    });

    it("rejects invalid priority filter", async () => {
      const result = await client.callTool({
        name: "list_tasks",
        arguments: { priority: "critical" },
      });
      expect(result.isError).toBe(true);
    });

    it("rejects invalid sort value", async () => {
      const result = await client.callTool({
        name: "list_tasks",
        arguments: { sort: "invalid" },
      });
      expect(result.isError).toBe(true);
    });

    it("accepts negative limit", async () => {
      await client.callTool({ name: "add_task", arguments: { title: "Task 1" } });
      await client.callTool({ name: "add_task", arguments: { title: "Task 2" } });

      const result = await client.callTool({
        name: "list_tasks",
        arguments: { limit: -1 },
      });
      expect(result.isError).toBeFalsy();
      const tasks = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      // Negative limit behavior depends on repository implementation
      // If no validation, may return empty or all tasks
      expect(Array.isArray(tasks)).toBe(true);
    });

    it("accepts negative offset", async () => {
      await client.callTool({ name: "add_task", arguments: { title: "Task 1" } });
      await client.callTool({ name: "add_task", arguments: { title: "Task 2" } });

      const result = await client.callTool({
        name: "list_tasks",
        arguments: { offset: -1 },
      });
      expect(result.isError).toBeFalsy();
      const tasks = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      // Negative offset behavior depends on repository implementation
      expect(Array.isArray(tasks)).toBe(true);
    });
  });

  describe("add_note validation edge cases", () => {
    it("handles empty note gracefully (no-op)", async () => {
      const addResult = await client.callTool({
        name: "add_task",
        arguments: { title: "Task", notes: ["Existing note"] },
      });
      const task = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

      const result = await client.callTool({
        name: "add_note",
        arguments: { id: task.id, note: "" },
      });
      expect(result.isError).toBeFalsy();
      const updated = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(updated.notes).toEqual(["Existing note"]);
    });

    it("handles whitespace-only note gracefully (no-op)", async () => {
      const addResult = await client.callTool({
        name: "add_task",
        arguments: { title: "Task", notes: ["Existing note"] },
      });
      const task = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

      const result = await client.callTool({
        name: "add_note",
        arguments: { id: task.id, note: "   \t\n  " },
      });
      expect(result.isError).toBeFalsy();
      const updated = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(updated.notes).toEqual(["Existing note"]);
    });

    it("accepts very long note", async () => {
      const addResult = await client.callTool({
        name: "add_task",
        arguments: { title: "Task" },
      });
      const task = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

      const longNote = "a".repeat(5000);
      const result = await client.callTool({
        name: "add_note",
        arguments: { id: task.id, note: longNote },
      });
      expect(result.isError).toBeFalsy();
      const updated = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(updated.notes).toContain(longNote);
    });
  });

  // Special characters tests
  it("add_task with double quotes in title", async () => {
    const result = await client.callTool({
      name: "add_task",
      arguments: { title: 'Task with "quotes"' },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe('Task with "quotes"');
  });

  it("add_task with single quotes in title", async () => {
    const result = await client.callTool({
      name: "add_task",
      arguments: { title: "Task with 'quotes'" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe("Task with 'quotes'");
  });

  it("add_task with backslashes in title", async () => {
    const result = await client.callTool({
      name: "add_task",
      arguments: { title: "Path\\to\\file" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe("Path\\to\\file");
  });

  it("add_task with SQL injection attempt in title", async () => {
    const result = await client.callTool({
      name: "add_task",
      arguments: { title: "'; DROP TABLE tasks; --" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe("'; DROP TABLE tasks; --");

    // Verify tasks table still works
    const listResult = await client.callTool({
      name: "list_tasks",
      arguments: {},
    });
    const tasks = JSON.parse((listResult.content as Array<{ text: string }>)[0].text);
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks[0].title).toBe("'; DROP TABLE tasks; --");
  });

  it("add_task with special characters in notes array", async () => {
    const result = await client.callTool({
      name: "add_task",
      arguments: {
        title: "Task",
        notes: ['Note with "quotes"', "Note with 'apostrophes'", "Note with <html>"],
      },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.notes).toEqual([
      'Note with "quotes"',
      "Note with 'apostrophes'",
      "Note with <html>",
    ]);
  });

  it("add_task with unicode in title", async () => {
    const result = await client.callTool({
      name: "add_task",
      arguments: { title: "Task with emoji 🚀 and 中文" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe("Task with emoji 🚀 and 中文");
  });

  it("add_task with labels containing special characters", async () => {
    const result = await client.callTool({
      name: "add_task",
      arguments: { title: "Task", labels: ["key=value", "key,value", "key[0]"] },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.labels).toEqual(["key=value", "key,value", "key[0]"]);
  });

  it("add_task with metadata containing special characters", async () => {
    const result = await client.callTool({
      name: "add_task",
      arguments: {
        title: "Task",
        metadata: {
          url: "http://example.com?a=1&b=2",
          path: "C:\\Users\\file.txt",
        },
      },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.metadata.url).toBe("http://example.com?a=1&b=2");
    expect(task.metadata.path).toBe("C:\\Users\\file.txt");
  });

  it("update_task with special characters in note field", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Task" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const result = await client.callTool({
      name: "update_task",
      arguments: { id: created.id, note: "Note with \"quotes\" & 'apostrophes'" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.notes).toContain("Note with \"quotes\" & 'apostrophes'");
  });

  it("update_task with unicode in note", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Task" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const result = await client.callTool({
      name: "update_task",
      arguments: { id: created.id, note: "Unicode: 🎉 日本語 العربية" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.notes).toContain("Unicode: 🎉 日本語 العربية");
  });

  it("add_note with special characters", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Task" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const result = await client.callTool({
      name: "add_note",
      arguments: { id: created.id, note: 'Special: <html> & "quotes"' },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.notes).toContain('Special: <html> & "quotes"');
  });

  it("add_note with newlines", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Task" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const result = await client.callTool({
      name: "add_note",
      arguments: { id: created.id, note: "Line 1\nLine 2\nLine 3" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.notes).toContain("Line 1\nLine 2\nLine 3");
  });

  it("update_task with special characters in title", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Original" },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const result = await client.callTool({
      name: "update_task",
      arguments: { id: created.id, title: "Updated with \"quotes\" & 'apostrophes'" },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe("Updated with \"quotes\" & 'apostrophes'");
  });

  it("get_task retrieves special characters correctly", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: {
        title: 'Task with "quotes"',
        notes: ["Note with special chars: <>&"],
      },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const result = await client.callTool({
      name: "get_task",
      arguments: { id: created.id },
    });
    const task = JSON.parse((result.content as Array<{ text: string }>)[0].text);
    expect(task.title).toBe('Task with "quotes"');
    expect(task.notes).toEqual(["Note with special chars: <>&"]);
  });
});

describe("sanitizeError", () => {
  it("sanitizes errors with SQLITE_ code", () => {
    const err = Object.assign(new Error("UNIQUE constraint failed: tasks.id"), {
      code: "SQLITE_CONSTRAINT_PRIMARYKEY",
    });
    expect(sanitizeError(err)).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes errors with any SQLITE_ prefixed code", () => {
    const err = Object.assign(new Error("unable to open database file"), {
      code: "SQLITE_CANTOPEN",
    });
    expect(sanitizeError(err)).toBe("An internal error occurred. Please try again.");
  });

  it("passes through plain Error without SQLITE code unchanged", () => {
    const err = new Error("database is locked");
    expect(sanitizeError(err)).toBe("database is locked");
  });

  it("passes through application-level errors unchanged", () => {
    const err = new Error("Task not found: abc123");
    expect(sanitizeError(err)).toBe("Task not found: abc123");
  });

  it("passes through generic errors unchanged", () => {
    const err = new Error("Title cannot be empty.");
    expect(sanitizeError(err)).toBe("Title cannot be empty.");
  });

  it("sanitizes non-Error values to generic message", () => {
    expect(sanitizeError("some string error")).toBe(
      "An internal error occurred. Please try again.",
    );
    expect(sanitizeError(42)).toBe("An internal error occurred. Please try again.");
  });
});

describe("update_task metadata merge", () => {
  let db: ReturnType<typeof createTestDb>;
  let client: Client;

  beforeEach(async () => {
    db = createTestDb();
    const kysely = createKysely(db);
    const service = new TaskService(kysely, "test-device");
    const server = createMcpServer(service);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterEach(() => {
    db.close();
  });

  it("merges new metadata keys into existing metadata instead of replacing", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Task", metadata: { pr: 42 } },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const updateResult = await client.callTool({
      name: "update_task",
      arguments: { id: created.id, metadata: { sprint: "5" } },
    });
    const updated = JSON.parse((updateResult.content as Array<{ text: string }>)[0].text);

    // Both original and new keys should be present
    expect(updated.metadata).toEqual({ pr: 42, sprint: "5" });
  });

  it("overwrites a specific key without removing other keys", async () => {
    const addResult = await client.callTool({
      name: "add_task",
      arguments: { title: "Task", metadata: { pr: 42, sprint: "4" } },
    });
    const created = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);

    const updateResult = await client.callTool({
      name: "update_task",
      arguments: { id: created.id, metadata: { sprint: "5" } },
    });
    const updated = JSON.parse((updateResult.content as Array<{ text: string }>)[0].text);

    expect(updated.metadata).toEqual({ pr: 42, sprint: "5" });
  });
});
