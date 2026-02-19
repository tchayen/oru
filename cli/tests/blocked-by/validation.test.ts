import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { Kysely } from "kysely";
import type { DB } from "../../src/db/kysely.js";
import { createTestDb, createTestKysely } from "../helpers/test-db.js";
import { TaskService } from "../../src/main.js";

describe("validateBlockedBy", () => {
  let db: Database.Database;
  let ky: Kysely<DB>;
  let service: TaskService;

  beforeEach(() => {
    db = createTestDb();
    ky = createTestKysely(db);
    service = new TaskService(ky, "test-device");
  });

  it("returns error when blocker does not exist", async () => {
    const result = await service.validateBlockedBy(null, ["nonexistent123"]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/not found/i);
    }
  });

  it("returns error when task would block itself", async () => {
    const task = await service.add({ title: "Task A" });
    const result = await service.validateBlockedBy(task.id, [task.id]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/cannot block itself/i);
    }
  });

  it("returns error for a direct cycle (A blocked_by B, then B blocked_by A)", async () => {
    const a = await service.add({ title: "Task A" });
    const b = await service.add({ title: "Task B" });

    // Set A blocked_by B
    await service.update(a.id, { blocked_by: [b.id] });

    // Now try to set B blocked_by A — should detect cycle
    const result = await service.validateBlockedBy(b.id, [a.id]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/circular dependency/i);
    }
  });

  it("returns error for a transitive cycle (A→B→C, then C blocked_by A)", async () => {
    const a = await service.add({ title: "Task A" });
    const b = await service.add({ title: "Task B" });
    const c = await service.add({ title: "Task C" });

    await service.update(a.id, { blocked_by: [b.id] });
    await service.update(b.id, { blocked_by: [c.id] });

    // C→A would create A→B→C→A cycle
    const result = await service.validateBlockedBy(c.id, [a.id]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/circular dependency/i);
    }
  });

  it("returns valid when no cycle exists", async () => {
    const a = await service.add({ title: "Task A" });
    const b = await service.add({ title: "Task B" });

    // A blocked_by B is fine with no chain from B back to A
    const result = await service.validateBlockedBy(a.id, [b.id]);
    expect(result.valid).toBe(true);
  });

  it("returns error for non-existent blocker on add (null taskId)", async () => {
    const result = await service.validateBlockedBy(null, ["doesnotexist"]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toMatch(/not found/i);
    }
  });

  it("returns valid on add when all blockers exist", async () => {
    const blocker = await service.add({ title: "Blocker" });
    const result = await service.validateBlockedBy(null, [blocker.id]);
    expect(result.valid).toBe(true);
  });
});
