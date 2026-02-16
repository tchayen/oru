import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, createTestKysely } from "../helpers/test-db.js";
import { TaskService } from "../../src/main.js";
import { getDeviceId } from "../../src/device.js";
import { createApp } from "../../src/server/routes.js";
import type { Hono } from "hono";

const token = "test-token";
const pairingCode = "test-pairing-code";
let app: Hono;
let service: TaskService;

beforeEach(() => {
  const db = createTestDb();
  const ky = createTestKysely(db);
  const deviceId = getDeviceId(db);
  service = new TaskService(ky, deviceId);
  app = createApp(service, token, pairingCode);
});

function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = {
    method,
    headers: { Authorization: `Bearer ${token}` },
  };
  if (body) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  return app.request(path, init);
}

describe("POST /pair", () => {
  it("returns token for valid pairing code", async () => {
    const res = await app.request(`/pair?code=${pairingCode}`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe(token);
  });

  it("burns the pairing code after first use", async () => {
    const res1 = await app.request(`/pair?code=${pairingCode}`, { method: "POST" });
    expect(res1.status).toBe(200);

    const res2 = await app.request(`/pair?code=${pairingCode}`, { method: "POST" });
    expect(res2.status).toBe(403);
    const body = await res2.json();
    expect(body.error).toBe("invalid_code");
  });

  it("returns 403 for wrong pairing code", async () => {
    const res = await app.request("/pair?code=wrong-code", { method: "POST" });
    expect(res.status).toBe(403);
  });

  it("returns 403 for missing code", async () => {
    const res = await app.request("/pair", { method: "POST" });
    expect(res.status).toBe(403);
  });
});

describe("authentication", () => {
  it("returns 401 for missing Authorization header", async () => {
    const res = await app.request("/tasks", { method: "GET" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 for wrong token", async () => {
    const res = await app.request("/tasks", {
      method: "GET",
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for malformed Authorization header", async () => {
    const res = await app.request("/tasks", {
      method: "GET",
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /tasks", () => {
  it("creates a task and returns 201", async () => {
    const res = await req("POST", "/tasks", { title: "Buy milk" });
    expect(res.status).toBe(201);
    const task = await res.json();
    expect(task.title).toBe("Buy milk");
    expect(task.status).toBe("todo");
    expect(task.priority).toBe("medium");
  });

  it("returns 400 for missing title", async () => {
    const res = await req("POST", "/tasks", {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation");
  });

  it("returns 400 for empty title", async () => {
    const res = await req("POST", "/tasks", { title: "  " });
    expect(res.status).toBe(400);
  });

  it("strips newlines from title", async () => {
    const res = await req("POST", "/tasks", { title: "Title with\nnewline" });
    expect(res.status).toBe(201);
    const task = await res.json();
    expect(task.title).toBe("Title with newline");
  });

  it("returns 400 for title that is only newlines", async () => {
    const res = await req("POST", "/tasks", { title: "\n\n" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid status", async () => {
    const res = await req("POST", "/tasks", { title: "Test", status: "nope" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid priority", async () => {
    const res = await req("POST", "/tasks", { title: "Test", priority: "nope" });
    expect(res.status).toBe(400);
  });

  it("accepts optional fields", async () => {
    const res = await req("POST", "/tasks", {
      title: "Test",
      status: "in_progress",
      priority: "high",
      labels: ["work"],
      notes: ["a note"],
      metadata: { key: "val" },
    });
    expect(res.status).toBe(201);
    const task = await res.json();
    expect(task.status).toBe("in_progress");
    expect(task.priority).toBe("high");
    expect(task.labels).toEqual(["work"]);
    expect(task.notes).toEqual(["a note"]);
    expect(task.metadata).toEqual({ key: "val" });
  });

  it("creates a task with owner", async () => {
    const res = await req("POST", "/tasks", { title: "Test", owner: "agent" });
    expect(res.status).toBe(201);
    const task = await res.json();
    expect(task.owner).toBe("agent");
  });

  it("returns 400 for invalid JSON body", async () => {
    const init: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{invalid json",
    };
    const res = await app.request("/tasks", init);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation");
    expect(body.message).toBe("Invalid JSON body");
  });
});

describe("GET /tasks", () => {
  it("returns empty list initially", async () => {
    const res = await req("GET", "/tasks");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns created tasks", async () => {
    await service.add({ title: "Task 1" });
    await service.add({ title: "Task 2" });
    const res = await req("GET", "/tasks");
    const tasks = await res.json();
    expect(tasks).toHaveLength(2);
  });

  it("hides done tasks by default", async () => {
    await service.add({ title: "Active" });
    await service.add({ title: "Done", status: "done" });
    const res = await req("GET", "/tasks");
    const tasks = await res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Active");
  });

  it("shows done tasks with all=true", async () => {
    await service.add({ title: "Active" });
    await service.add({ title: "Done", status: "done" });
    const res = await req("GET", "/tasks?all=true");
    const tasks = await res.json();
    expect(tasks).toHaveLength(2);
  });

  it("filters by status", async () => {
    await service.add({ title: "Todo" });
    await service.add({ title: "Done", status: "done" });
    const res = await req("GET", "/tasks?status=done");
    const tasks = await res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Done");
  });

  it("filters by priority", async () => {
    await service.add({ title: "Low", priority: "low" });
    await service.add({ title: "High", priority: "high" });
    const res = await req("GET", "/tasks?priority=high");
    const tasks = await res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("High");
  });

  it("filters by label", async () => {
    await service.add({ title: "Work", labels: ["work"] });
    await service.add({ title: "Personal", labels: ["personal"] });
    const res = await req("GET", "/tasks?label=work");
    const tasks = await res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Work");
  });

  it("filters by owner", async () => {
    await service.add({ title: "Agent task", owner: "agent" });
    await service.add({ title: "Human task", owner: "human" });
    const res = await req("GET", "/tasks?owner=agent");
    const tasks = await res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Agent task");
  });

  it("searches by title", async () => {
    await service.add({ title: "Buy groceries" });
    await service.add({ title: "Read book" });
    const res = await req("GET", "/tasks?search=groceries");
    const tasks = await res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Buy groceries");
  });

  it("returns 400 for invalid status", async () => {
    const res = await req("GET", "/tasks?status=invalid");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid priority", async () => {
    const res = await req("GET", "/tasks?priority=invalid");
    expect(res.status).toBe(400);
  });

  it("filters by comma-separated statuses", async () => {
    await service.add({ title: "Todo" });
    await service.add({ title: "In Progress", status: "in_progress" });
    await service.add({ title: "Done", status: "done" });
    const res = await req("GET", "/tasks?status=todo,in_progress");
    const tasks = await res.json();
    expect(tasks).toHaveLength(2);
    const titles = tasks.map((t: { title: string }) => t.title).sort();
    expect(titles).toEqual(["In Progress", "Todo"]);
  });

  it("filters by comma-separated priorities", async () => {
    await service.add({ title: "Low", priority: "low" });
    await service.add({ title: "High", priority: "high" });
    await service.add({ title: "Urgent", priority: "urgent" });
    const res = await req("GET", "/tasks?priority=high,urgent");
    const tasks = await res.json();
    expect(tasks).toHaveLength(2);
    const titles = tasks.map((t: { title: string }) => t.title).sort();
    expect(titles).toEqual(["High", "Urgent"]);
  });

  it("returns 400 for partially invalid comma-separated status", async () => {
    const res = await req("GET", "/tasks?status=todo,invalid");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Invalid status: invalid");
  });

  it("returns 400 for partially invalid comma-separated priority", async () => {
    const res = await req("GET", "/tasks?priority=high,nope");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Invalid priority: nope");
  });

  it("supports limit param", async () => {
    await service.add({ title: "Task 1" });
    await service.add({ title: "Task 2" });
    await service.add({ title: "Task 3" });
    const res = await req("GET", "/tasks?limit=2");
    const tasks = await res.json();
    expect(tasks).toHaveLength(2);
  });

  it("supports offset param", async () => {
    await service.add({ title: "Task 1" });
    await service.add({ title: "Task 2" });
    await service.add({ title: "Task 3" });
    const res = await req("GET", "/tasks?offset=2");
    const tasks = await res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Task 3");
  });

  it("supports limit and offset together", async () => {
    for (let i = 1; i <= 5; i++) {
      await service.add({ title: `Task ${i}` });
    }
    const res = await req("GET", "/tasks?limit=2&offset=1");
    const tasks = await res.json();
    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe("Task 2");
    expect(tasks[1].title).toBe("Task 3");
  });

  it("returns 400 for invalid limit", async () => {
    const res = await req("GET", "/tasks?limit=abc");
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative offset", async () => {
    const res = await req("GET", "/tasks?offset=-1");
    expect(res.status).toBe(400);
  });

  it("actionable filter excludes blocked and done tasks", async () => {
    const blocker = await service.add({ title: "Blocker" });
    await service.add({ title: "Blocked", blocked_by: [blocker.id] });
    await service.add({ title: "Done task", status: "done" });
    await service.add({ title: "Free task" });

    const res = await req("GET", "/tasks?actionable=1");
    const tasks = await res.json();
    const titles = tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain("Blocker");
    expect(titles).toContain("Free task");
    expect(titles).not.toContain("Blocked");
    expect(titles).not.toContain("Done task");
  });

  it("actionable with all=true still excludes done tasks", async () => {
    await service.add({ title: "Active" });
    await service.add({ title: "Completed", status: "done" });

    const res = await req("GET", "/tasks?actionable=1&all=true");
    const tasks = await res.json();
    const titles = tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain("Active");
    expect(titles).not.toContain("Completed");
  });
});

describe("GET /tasks/:id", () => {
  it("returns a task by ID", async () => {
    const task = await service.add({ title: "Test" });
    const res = await req("GET", `/tasks/${task.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(task.id);
    expect(body.title).toBe("Test");
  });

  it("returns 404 for missing task", async () => {
    const res = await req("GET", "/tasks/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
  });
});

describe("PATCH /tasks/:id", () => {
  it("updates task fields", async () => {
    const task = await service.add({ title: "Original" });
    const res = await req("PATCH", `/tasks/${task.id}`, {
      title: "Updated",
      status: "in_progress",
      priority: "high",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Updated");
    expect(body.status).toBe("in_progress");
    expect(body.priority).toBe("high");
  });

  it("updates owner", async () => {
    const task = await service.add({ title: "Test" });
    const res = await req("PATCH", `/tasks/${task.id}`, { owner: "agent" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.owner).toBe("agent");
  });

  it("clears owner with null", async () => {
    const task = await service.add({ title: "Test", owner: "agent" });
    const res = await req("PATCH", `/tasks/${task.id}`, { owner: null });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.owner).toBeNull();
  });

  it("appends a note", async () => {
    const task = await service.add({ title: "Test" });
    const res = await req("PATCH", `/tasks/${task.id}`, { note: "My note" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toContain("My note");
  });

  it("updates fields and appends note together", async () => {
    const task = await service.add({ title: "Test" });
    const res = await req("PATCH", `/tasks/${task.id}`, {
      status: "done",
      note: "Completed it",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("done");
    expect(body.notes).toContain("Completed it");
  });

  it("clears notes with clear_notes", async () => {
    const task = await service.add({ title: "Test", notes: ["Note A", "Note B"] });
    const res = await req("PATCH", `/tasks/${task.id}`, { clear_notes: true });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toEqual([]);
  });

  it("clear_notes then adds new note", async () => {
    const task = await service.add({ title: "Test", notes: ["Old note"] });
    const res = await req("PATCH", `/tasks/${task.id}`, {
      clear_notes: true,
      note: "New note",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toEqual(["New note"]);
  });

  it("returns 404 for missing task", async () => {
    const res = await req("PATCH", "/tasks/nonexistent", { title: "Nope" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for empty title", async () => {
    const task = await service.add({ title: "Test" });
    const res = await req("PATCH", `/tasks/${task.id}`, { title: "" });
    expect(res.status).toBe(400);
  });

  it("strips newlines from title", async () => {
    const task = await service.add({ title: "Original" });
    const res = await req("PATCH", `/tasks/${task.id}`, { title: "New\ntitle" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("New title");
  });

  it("returns current task when no updates provided", async () => {
    const task = await service.add({ title: "Test" });
    const res = await req("PATCH", `/tasks/${task.id}`, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Test");
  });

  it("returns 400 for invalid JSON body", async () => {
    const task = await service.add({ title: "Test" });
    const init: RequestInit = {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{invalid json",
    };
    const res = await app.request(`/tasks/${task.id}`, init);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation");
    expect(body.message).toBe("Invalid JSON body");
  });
});

describe("DELETE /tasks/:id", () => {
  it("deletes a task", async () => {
    const task = await service.add({ title: "Test" });
    const res = await req("DELETE", `/tasks/${task.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);

    // Verify it's gone
    const getRes = await req("GET", `/tasks/${task.id}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 for missing task", async () => {
    const res = await req("DELETE", "/tasks/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("authentication", () => {
  it("returns 401 for missing Authorization header", async () => {
    const res = await app.request("/tasks", { method: "GET" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 for wrong token", async () => {
    const res = await app.request("/tasks", {
      method: "GET",
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for malformed Authorization header", async () => {
    const res = await app.request("/tasks", {
      method: "GET",
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    expect(res.status).toBe(401);
  });
});

describe("input size limits", () => {
  describe("POST /tasks", () => {
    it("returns 400 for too many labels", async () => {
      const labels = Array.from({ length: 101 }, (_, i) => `label-${i}`);
      const res = await req("POST", "/tasks", { title: "Test", labels });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("labels exceeds maximum of 100 items");
    });

    it("returns 400 for too many blocked_by", async () => {
      const blocked_by = Array.from({ length: 101 }, (_, i) => `id-${i}`);
      const res = await req("POST", "/tasks", { title: "Test", blocked_by });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("blocked_by exceeds maximum of 100 items");
    });

    it("returns 400 for too many notes", async () => {
      const notes = Array.from({ length: 101 }, (_, i) => `note-${i}`);
      const res = await req("POST", "/tasks", { title: "Test", notes });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("notes exceeds maximum of 100 items");
    });

    it("returns 400 for too many metadata keys", async () => {
      const metadata: Record<string, string> = {};
      for (let i = 0; i < 51; i++) {
        metadata[`key${i}`] = `value${i}`;
      }
      const res = await req("POST", "/tasks", { title: "Test", metadata });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("Metadata exceeds maximum of 50 keys");
    });

    it("returns 400 for metadata key that is too long", async () => {
      const longKey = "k".repeat(101);
      const res = await req("POST", "/tasks", {
        title: "Test",
        metadata: { [longKey]: "val" },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("Metadata key exceeds maximum length of 100 characters");
    });

    it("returns 400 for metadata value that is too long", async () => {
      const longValue = "v".repeat(5001);
      const res = await req("POST", "/tasks", { title: "Test", metadata: { key: longValue } });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("Metadata value exceeds maximum length of 5000 characters");
    });

    it("accepts exactly 100 labels", async () => {
      const labels = Array.from({ length: 100 }, (_, i) => `label-${i}`);
      const res = await req("POST", "/tasks", { title: "Test", labels });
      expect(res.status).toBe(201);
    });

    it("accepts exactly 50 metadata keys", async () => {
      const metadata: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        metadata[`key${i}`] = `value${i}`;
      }
      const res = await req("POST", "/tasks", { title: "Test", metadata });
      expect(res.status).toBe(201);
    });
  });

  describe("PATCH /tasks/:id", () => {
    it("returns 400 for too many labels", async () => {
      const task = await service.add({ title: "Test" });
      const labels = Array.from({ length: 101 }, (_, i) => `label-${i}`);
      const res = await req("PATCH", `/tasks/${task.id}`, { labels });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("labels exceeds maximum of 100 items");
    });

    it("returns 400 for too many blocked_by", async () => {
      const task = await service.add({ title: "Test" });
      const blocked_by = Array.from({ length: 101 }, (_, i) => `id-${i}`);
      const res = await req("PATCH", `/tasks/${task.id}`, { blocked_by });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("blocked_by exceeds maximum of 100 items");
    });

    it("returns 400 for too many metadata keys", async () => {
      const task = await service.add({ title: "Test" });
      const metadata: Record<string, string> = {};
      for (let i = 0; i < 51; i++) {
        metadata[`key${i}`] = `value${i}`;
      }
      const res = await req("PATCH", `/tasks/${task.id}`, { metadata });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("Metadata exceeds maximum of 50 keys");
    });

    it("returns 400 for metadata value that is too long", async () => {
      const task = await service.add({ title: "Test" });
      const longValue = "v".repeat(5001);
      const res = await req("PATCH", `/tasks/${task.id}`, { metadata: { key: longValue } });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("Metadata value exceeds maximum length of 5000 characters");
    });

    it("returns 400 for note that is too long", async () => {
      const task = await service.add({ title: "Test" });
      const longNote = "n".repeat(10001);
      const res = await req("PATCH", `/tasks/${task.id}`, { note: longNote });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation");
      expect(body.message).toContain("Note exceeds maximum length of 10000 characters");
    });
  });
});
