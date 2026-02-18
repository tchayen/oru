import { describe, it, expect } from "vitest";
import { spawnId } from "../../src/recurrence/spawn-id.js";

describe("spawnId", () => {
  it("returns a deterministic ID for the same parent", () => {
    const parentId = "01JMV3K4B5C6D7E8F9G0H1J2K3";
    const id1 = spawnId(parentId);
    const id2 = spawnId(parentId);
    expect(id1).toBe(id2);
  });

  it("returns different IDs for different parents", () => {
    const id1 = spawnId("01JMV3K4B5C6D7E8F9G0H1J2K3");
    const id2 = spawnId("01JMV3K4B5C6D7E8F9G0H1J2K4");
    expect(id1).not.toBe(id2);
  });

  it("produces a valid base62 format", () => {
    const id = spawnId("01JMV3K4B5C6D7E8F9G0H1J2K3");
    expect(id).toMatch(/^[0-9A-Za-z]{22}$/);
  });

  it("chains deterministically: A → B → C", () => {
    const a = "01JMV3K4B5C6D7E8F9G0H1J2K3";
    const b = spawnId(a);
    const c = spawnId(b);
    expect(b).not.toBe(a);
    expect(c).not.toBe(b);
    // Re-compute: same chain produces same results
    expect(spawnId(a)).toBe(b);
    expect(spawnId(b)).toBe(c);
  });
});
