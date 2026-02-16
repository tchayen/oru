import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTestDb } from "../helpers/test-db.js";
import { createKysely } from "../../src/db/kysely.js";
import { TaskService } from "../../src/main.js";
import { createMcpServer, sanitizeError } from "../../src/mcp/server.js";
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

    // Now call through MCP — the same kind of error hits service.add(),
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
});

describe("sanitizeError", () => {
  it("sanitizes SQLITE_ errors", () => {
    const err = new Error("SQLITE_CONSTRAINT: UNIQUE constraint failed: tasks.id");
    expect(sanitizeError(err)).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes constraint errors", () => {
    const err = new Error("UNIQUE constraint failed: tasks.id");
    expect(sanitizeError(err)).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes database errors", () => {
    const err = new Error("database is locked");
    expect(sanitizeError(err)).toBe("An internal error occurred. Please try again.");
  });

  it("passes through application-level errors unchanged", () => {
    const err = new Error("Task not found: abc123");
    expect(sanitizeError(err)).toBe("Task not found: abc123");
  });

  it("passes through generic errors unchanged", () => {
    const err = new Error("Title cannot be empty");
    expect(sanitizeError(err)).toBe("Title cannot be empty");
  });

  it("handles non-Error values", () => {
    expect(sanitizeError("some string error")).toBe("some string error");
    expect(sanitizeError("SQLITE_ERROR: something")).toBe(
      "An internal error occurred. Please try again.",
    );
  });
});
