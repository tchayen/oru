import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const CLI_PATH = path.resolve(__dirname, "../../dist/cli.js");
const SERVER_PATH = path.resolve(__dirname, "../../dist/server/index.js");

let tmpDir: string;
let dbPath: string;
let pidPath: string;

function cli(args: string[], env?: Record<string, string>): string {
  const result = execFileSync("node", [CLI_PATH, ...args], {
    env: { ...process.env, AO_DB_PATH: dbPath, ...env },
    encoding: "utf-8",
    timeout: 5000,
  });
  return result.trim();
}

async function waitForServer(port: number, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/tasks`);
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

function killProcess(pid: number): void {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Already dead
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ao-server-e2e-"));
  dbPath = path.join(tmpDir, "ao.db");
  pidPath = path.join(tmpDir, "server.pid");
});

afterEach(() => {
  // Clean up any leftover server process
  if (fs.existsSync(pidPath)) {
    const pid = parseInt(fs.readFileSync(pidPath, "utf-8").trim(), 10);
    killProcess(pid);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("server process e2e", () => {
  it("starts, serves requests, and stops", async () => {
    const port = 9871 + Math.floor(Math.random() * 100);

    // Start server directly (not via CLI, to have more control)
    const serverProc = spawn("node", [SERVER_PATH], {
      env: { ...process.env, AO_DB_PATH: dbPath, AO_PORT: String(port) },
      stdio: "pipe",
    });
    // Write PID file so cleanup works
    fs.writeFileSync(pidPath, String(serverProc.pid));

    try {
      await waitForServer(port);

      // Create a task
      const createRes = await fetch(`http://localhost:${port}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "E2E task", priority: "high" }),
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.title).toBe("E2E task");
      expect(created.priority).toBe("high");
      expect(created.id).toBeDefined();

      // List tasks
      const listRes = await fetch(`http://localhost:${port}/tasks`);
      expect(listRes.status).toBe(200);
      const tasks = await listRes.json();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(created.id);

      // Get task
      const getRes = await fetch(`http://localhost:${port}/tasks/${created.id}`);
      expect(getRes.status).toBe(200);
      const got = await getRes.json();
      expect(got.title).toBe("E2E task");

      // Update task
      const patchRes = await fetch(`http://localhost:${port}/tasks/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done", note: "Finished" }),
      });
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.status).toBe("done");
      expect(patched.notes).toContain("Finished");

      // Delete task
      const delRes = await fetch(`http://localhost:${port}/tasks/${created.id}`, {
        method: "DELETE",
      });
      expect(delRes.status).toBe(200);
      const deleted = await delRes.json();
      expect(deleted.deleted).toBe(true);

      // Verify 404
      const notFoundRes = await fetch(`http://localhost:${port}/tasks/${created.id}`);
      expect(notFoundRes.status).toBe(404);
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
      env: { ...process.env, AO_DB_PATH: dbPath, AO_PORT: String(port) },
      stdio: "pipe",
    });
    fs.writeFileSync(pidPath, String(serverProc.pid));

    try {
      await waitForServer(port);

      // Server should see the CLI-created task
      const listRes = await fetch(`http://localhost:${port}/tasks`);
      const tasks = await listRes.json();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("CLI task");

      // Create via server
      const createRes = await fetch(`http://localhost:${port}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

describe("ao server start/stop/status e2e", () => {
  it("start → status → stop lifecycle", async () => {
    const port = 9871 + Math.floor(Math.random() * 100);

    // Status when not running
    const statusBefore = cli(["server", "status"]);
    expect(statusBefore).toContain("not running");

    // Start server
    const startOutput = cli(["server", "start", "--port", String(port)]);
    expect(startOutput).toContain("Server started");
    expect(startOutput).toContain(String(port));

    try {
      await waitForServer(port);

      // Status should show running
      const statusRunning = cli(["server", "status", "--json"]);
      const statusJson = JSON.parse(statusRunning);
      expect(statusJson.running).toBe(true);
      expect(statusJson.pid).toBeGreaterThan(0);

      // Verify PID file exists
      expect(fs.existsSync(pidPath)).toBe(true);

      // Stop server
      const stopOutput = cli(["server", "stop"]);
      expect(stopOutput).toContain("stopped");

      // PID file should be gone
      expect(fs.existsSync(pidPath)).toBe(false);

      // Status should show not running
      const statusAfter = cli(["server", "status"]);
      expect(statusAfter).toContain("not running");
    } finally {
      // Safety cleanup
      if (fs.existsSync(pidPath)) {
        const pid = parseInt(fs.readFileSync(pidPath, "utf-8").trim(), 10);
        killProcess(pid);
        fs.unlinkSync(pidPath);
      }
    }
  });

  it("start detects already-running server", async () => {
    const port = 9871 + Math.floor(Math.random() * 100);

    cli(["server", "start", "--port", String(port)]);
    try {
      await waitForServer(port);

      // Try starting again
      const secondStart = cli(["server", "start", "--port", String(port)]);
      expect(secondStart).toContain("already running");
    } finally {
      cli(["server", "stop"]);
    }
  });

  it("stop with no server running", () => {
    const output = cli(["server", "stop"]);
    expect(output).toContain("No server running");
  });
});
