import { describe, it, expect } from "vitest";
import { sanitizeError } from "../../src/mcp/server";

describe("sanitizeError", () => {
  it("passes through AmbiguousPrefixError message", () => {
    const err = new Error("Prefix 'abc' is ambiguous, matches: abcdef, abcxyz");
    err.name = "AmbiguousPrefixError";
    expect(sanitizeError(err)).toBe("Prefix 'abc' is ambiguous, matches: abcdef, abcxyz");
  });

  it("sanitizes errors with SQLITE_CONSTRAINT_PRIMARYKEY code", () => {
    const err = Object.assign(new Error("UNIQUE constraint failed: tasks.id"), {
      code: "SQLITE_CONSTRAINT_PRIMARYKEY",
    });
    expect(sanitizeError(err)).toBe("An internal error occurred. Please try again.");
  });

  it("sanitizes errors with SQLITE_CANTOPEN code", () => {
    const err = Object.assign(new Error("unable to open database file"), {
      code: "SQLITE_CANTOPEN",
    });
    expect(sanitizeError(err)).toBe("An internal error occurred. Please try again.");
  });

  it("passes through plain Error with non-SQLite message", () => {
    const err = new Error("Invalid recurrence rule: FREQ=BADVALUE");
    expect(sanitizeError(err)).toBe("Invalid recurrence rule: FREQ=BADVALUE");
  });

  it("sanitizes non-Error values to generic message", () => {
    expect(sanitizeError("some string error")).toBe(
      "An internal error occurred. Please try again.",
    );
    expect(sanitizeError(42)).toBe("An internal error occurred. Please try again.");
    expect(sanitizeError(null)).toBe("An internal error occurred. Please try again.");
  });
});
