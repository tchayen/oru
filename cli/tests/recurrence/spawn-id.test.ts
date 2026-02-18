import { describe, it, expect } from "vitest";
import { spawnId } from "../../src/recurrence/spawn-id.js";

describe("spawnId", () => {
  it("returns a deterministic ID for the same parent", () => {
    const id1 = spawnId("ABCDEFGHJKa");
    const id2 = spawnId("ABCDEFGHJKa");
    expect(id1).toBe(id2);
  });

  it("returns different IDs for different parents", () => {
    const id1 = spawnId("ABCDEFGHJKa");
    const id2 = spawnId("ABCDEFGHJKb");
    expect(id1).not.toBe(id2);
  });

  it("produces a valid 11-char base62 format", () => {
    const id = spawnId("ABCDEFGHJKa");
    expect(id).toMatch(/^[0-9A-Za-z]{11}$/);
  });

  it("chains deterministically: A → B → C", () => {
    const a = "ABCDEFGHJKa";
    const b = spawnId(a);
    const c = spawnId(b);
    expect(b).not.toBe(a);
    expect(c).not.toBe(b);
    expect(spawnId(a)).toBe(b);
    expect(spawnId(b)).toBe(c);
  });
});
