import { describe, it, expect } from "vitest";
import { generateId, isValidId } from "../src/id.js";

describe("generateId", () => {
  it("produces a 22-character string", () => {
    const id = generateId();
    expect(id).toHaveLength(22);
  });

  it("produces base62 characters only", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9A-Za-z]{22}$/);
  });

  it("produces unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("isValidId", () => {
  it("accepts a valid 22-char base62 ID", () => {
    // 22 chars, all base62
    expect(isValidId("01ABCDEFGHJKLMNPQRSTVa")).toBe(true);
  });

  it("accepts generated IDs", () => {
    expect(isValidId(generateId())).toBe(true);
  });

  it("rejects IDs that are too short", () => {
    // 21 chars
    expect(isValidId("01ABCDEFGHJKLMNPQRSTa")).toBe(false);
  });

  it("rejects IDs that are too long", () => {
    // 23 chars
    expect(isValidId("01ABCDEFGHJKLMNPQRSTVaX")).toBe(false);
  });

  it("rejects IDs with invalid characters (dashes)", () => {
    expect(isValidId("01963e00-0000-7000-8000-0")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidId("")).toBe(false);
  });

  it("rejects IDs with spaces", () => {
    // 22 chars with a space
    expect(isValidId("01ABCDEFGHJKLMNPQRSTa ")).toBe(false);
  });
});
