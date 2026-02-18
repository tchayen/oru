import { describe, it, expect } from "vitest";
import { spawnId } from "../../src/recurrence/spawn-id.js";

describe("spawnId", () => {
  it("returns a deterministic ID for the same parent", () => {
    const parentId = "01961234-5678-7abc-def0-123456789abc";
    const id1 = spawnId(parentId);
    const id2 = spawnId(parentId);
    expect(id1).toBe(id2);
  });

  it("returns different IDs for different parents", () => {
    const id1 = spawnId("01961234-5678-7abc-def0-111111111111");
    const id2 = spawnId("01961234-5678-7abc-def0-222222222222");
    expect(id1).not.toBe(id2);
  });

  it("produces a valid UUID format", () => {
    const id = spawnId("01961234-5678-7abc-def0-123456789abc");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("chains deterministically: A → B → C", () => {
    const a = "01961234-5678-7abc-def0-aaaaaaaaaaaa";
    const b = spawnId(a);
    const c = spawnId(b);
    expect(b).not.toBe(a);
    expect(c).not.toBe(b);
    // Re-compute: same chain produces same results
    expect(spawnId(a)).toBe(b);
    expect(spawnId(b)).toBe(c);
  });
});
