import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const SERVER_PATH = path.resolve(__dirname, "../../dist/server/index.js");

const E2E_TOKEN = "e2e-test-token";

let tmpDir: string;
let dbPath: string;

function cli(args: string[], env?: Record<string, string>): string {
  const CLI_PATH = path.resolve(__dirname, "../../dist/cli.js");
  const result = execFileSync("node", [CLI_PATH, ...args], {
    env: { ...process.env, DO_NOT_TRACK: "1", ORU_DB_PATH: dbPath, ...env },
    encoding: "utf-8",
    timeout: 5000,
  });
  return result.trim();
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${E2E_TOKEN}`, ...extra };
}

async function waitForServer(port: number, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/tasks`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise<void>((r) => {
      setTimeout(r, 100);
    });
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-server-e2e-"));
  dbPath = path.join(tmpDir, "oru.db");
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("server process e2e", () => {
  it("starts, serves requests, and stops", async () => {
    const port = 9871 + Math.floor(Math.random() * 100);

    // Start server directly (not via CLI, to have more control)
    const serverProc = spawn("node", [SERVER_PATH], {
      env: {
        ...process.env,
        ORU_DB_PATH: dbPath,
        ORU_PORT: String(port),
        ORU_AUTH_TOKEN: E2E_TOKEN,
      },
      stdio: "pipe",
    });

    try {
      await waitForServer(port);

      // Create a task
      const createRes = await fetch(`http://localhost:${port}/tasks`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title: "E2E task", priority: "high" }),
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.title).toBe("E2E task");
      expect(created.priority).toBe("high");
      expect(created.id).toBeDefined();

      // List tasks
      const listRes = await fetch(`http://localhost:${port}/tasks`, {
        headers: authHeaders(),
      });
      expect(listRes.status).toBe(200);
      const tasks = await listRes.json();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(created.id);

      // Get task
      const getRes = await fetch(`http://localhost:${port}/tasks/${created.id}`, {
        headers: authHeaders(),
      });
      expect(getRes.status).toBe(200);
      const got = await getRes.json();
      expect(got.title).toBe("E2E task");

      // Update task
      const patchRes = await fetch(`http://localhost:${port}/tasks/${created.id}`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status: "done", note: "Finished" }),
      });
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.status).toBe("done");
      expect(patched.notes).toContain("Finished");

      // Delete task
      const delRes = await fetch(`http://localhost:${port}/tasks/${created.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      expect(delRes.status).toBe(200);
      const deleted = await delRes.json();
      expect(deleted.deleted).toBe(true);

      // Verify 404
      const notFoundRes = await fetch(`http://localhost:${port}/tasks/${created.id}`, {
        headers: authHeaders(),
      });
      expect(notFoundRes.status).toBe(404);

      // Verify unauthenticated request returns 401
      const noAuthRes = await fetch(`http://localhost:${port}/tasks`);
      expect(noAuthRes.status).toBe(401);
    } finally {
      serverProc.kill("SIGTERM");
      await new Promise<void>((r) => {
        serverProc.on("close", () => r());
      });
    }
  });

  it("shares data between CLI and server (concurrent access)", async () => {
    const port = 9871 + Math.floor(Math.random() * 100);

    // Create a task via CLI first
    const cliOutput = cli(["add", "CLI task", "--json"]);
    const cliTask = JSON.parse(cliOutput);
    expect(cliTask.title).toBe("CLI task");

    // Start server pointing at same DB
    const serverProc = spawn("node", [SERVER_PATH], {
      env: {
        ...process.env,
        ORU_DB_PATH: dbPath,
        ORU_PORT: String(port),
        ORU_AUTH_TOKEN: E2E_TOKEN,
      },
      stdio: "pipe",
    });

    try {
      await waitForServer(port);

      // Server should see the CLI-created task
      const listRes = await fetch(`http://localhost:${port}/tasks`, {
        headers: authHeaders(),
      });
      const tasks = await listRes.json();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("CLI task");

      // Create via server
      const createRes = await fetch(`http://localhost:${port}/tasks`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title: "Server task" }),
      });
      expect(createRes.status).toBe(201);

      // CLI should see both tasks
      const cliList = cli(["list", "--json"]);
      const allTasks = JSON.parse(cliList);
      expect(allTasks).toHaveLength(2);
      const titles = allTasks.map((t: { title: string }) => t.title);
      expect(titles).toContain("CLI task");
      expect(titles).toContain("Server task");
    } finally {
      serverProc.kill("SIGTERM");
      await new Promise<void>((r) => {
        serverProc.on("close", () => r());
      });
    }
  });
});
