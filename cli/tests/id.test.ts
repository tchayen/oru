import { describe, it, expect } from "vitest";
import { generateId, isValidId } from "../src/id.js";

describe("generateId", () => {
  it("produces an 11-character string", () => {
    const id = generateId();
    expect(id).toHaveLength(11);
  });

  it("produces base62 characters only", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9A-Za-z]{11}$/);
  });

  it("produces unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("isValidId", () => {
  it("accepts a valid 11-char base62 ID", () => {
    expect(isValidId("ABCDEFGHJKa")).toBe(true);
  });

  it("accepts generated IDs", () => {
    expect(isValidId(generateId())).toBe(true);
  });

  it("rejects IDs that are too short", () => {
    expect(isValidId("ABCDEFGHJa")).toBe(false);
  });

  it("rejects IDs that are too long", () => {
    expect(isValidId("ABCDEFGHJKaX")).toBe(false);
  });

  it("rejects IDs with invalid characters (dashes)", () => {
    expect(isValidId("ABCDE-FGHJa")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidId("")).toBe(false);
  });

  it("rejects IDs with spaces", () => {
    expect(isValidId("ABCDEFGHJa ")).toBe(false);
  });
});
