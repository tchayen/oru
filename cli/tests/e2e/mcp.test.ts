import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const CLI_PATH = path.resolve(__dirname, "../../dist/cli.js");
const cliBuilt = fs.existsSync(CLI_PATH);

let tmpDir: string;
let dbPath: string;

function makeTransport(): StdioClientTransport {
  return new StdioClientTransport({
    command: process.execPath,
    args: [CLI_PATH, "mcp"],
    env: { ...process.env, ORU_DB_PATH: dbPath, DO_NOT_TRACK: "1" },
  });
}

async function makeClient(): Promise<Client> {
  const client = new Client({ name: "e2e-test-client", version: "1.0.0" });
  await client.connect(makeTransport());
  return client;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-mcp-e2e-"));
  dbPath = path.join(tmpDir, "oru.db");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe.skipIf(!cliBuilt)("oru mcp e2e", () => {
  it("responds to initialize and lists tools", async () => {
    const client = await makeClient();

    try {
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
    } finally {
      await client.close();
    }
  });

  it("creates and retrieves a task over stdio", async () => {
    const client = await makeClient();

    try {
      const addResult = await client.callTool({
        name: "add_task",
        arguments: { title: "E2E task", priority: "high" },
      });
      const task = JSON.parse((addResult.content as Array<{ text: string }>)[0].text);
      expect(task.title).toBe("E2E task");
      expect(task.priority).toBe("high");
      expect(task.id).toBeTruthy();

      const getResult = await client.callTool({
        name: "get_task",
        arguments: { id: task.id },
      });
      const fetched = JSON.parse((getResult.content as Array<{ text: string }>)[0].text);
      expect(fetched.title).toBe("E2E task");
      expect(fetched.id).toBe(task.id);
    } finally {
      await client.close();
    }
  });

  it("persists data to the database file", async () => {
    // First client: create a task
    const client1 = await makeClient();
    let taskId: string;
    try {
      const result = await client1.callTool({
        name: "add_task",
        arguments: { title: "Persisted task" },
      });
      taskId = JSON.parse((result.content as Array<{ text: string }>)[0].text).id;
    } finally {
      await client1.close();
    }

    // Second client: task should still be there
    const client2 = await makeClient();
    try {
      const result = await client2.callTool({
        name: "list_tasks",
        arguments: {},
      });
      const tasks = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(taskId);
      expect(tasks[0].title).toBe("Persisted task");
    } finally {
      await client2.close();
    }
  });
});
