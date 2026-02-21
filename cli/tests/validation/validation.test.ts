import { describe, it, expect } from "vitest";
import {
  sanitizeTitle,
  validateTitle,
  validateNote,
  validateLabels,
  isValidTimezone,
  MAX_TITLE_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_LABEL_LENGTH,
} from "../../src/validation";

describe("sanitizeTitle", () => {
  it("replaces newline with space", () => {
    expect(sanitizeTitle("Hello\nWorld")).toBe("Hello World");
  });

  it("replaces CRLF with space", () => {
    expect(sanitizeTitle("Hello\r\nWorld")).toBe("Hello World");
  });

  it("replaces multiple newlines with single space", () => {
    expect(sanitizeTitle("Hello\n\n\nWorld")).toBe("Hello World");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeTitle("  Hello  ")).toBe("Hello");
  });

  it("handles combined newlines and whitespace", () => {
    expect(sanitizeTitle("  Hello\nWorld  ")).toBe("Hello World");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizeTitle("   ")).toBe("");
  });

  it("returns empty string for newline-only input", () => {
    expect(sanitizeTitle("\n\r\n")).toBe("");
  });

  it("passes through normal strings unchanged", () => {
    expect(sanitizeTitle("Normal title")).toBe("Normal title");
  });
});

describe("validateTitle", () => {
  it("rejects empty string", () => {
    const result = validateTitle("");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toBe("Title cannot be empty.");
    }
  });

  it("rejects empty string with required option", () => {
    const result = validateTitle("", { required: true });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toBe("Title is required.");
    }
  });

  it("accepts title at exactly MAX_TITLE_LENGTH", () => {
    const result = validateTitle("a".repeat(MAX_TITLE_LENGTH));
    expect(result.valid).toBe(true);
  });

  it("rejects title at MAX_TITLE_LENGTH + 1", () => {
    const result = validateTitle("a".repeat(MAX_TITLE_LENGTH + 1));
    expect(result.valid).toBe(false);
  });

  it("accepts normal title", () => {
    expect(validateTitle("Buy groceries").valid).toBe(true);
  });

  it("accepts single character title", () => {
    expect(validateTitle("x").valid).toBe(true);
  });
});

describe("validateNote", () => {
  it("accepts empty note", () => {
    expect(validateNote("").valid).toBe(true);
  });

  it("accepts note at exactly MAX_NOTE_LENGTH", () => {
    expect(validateNote("n".repeat(MAX_NOTE_LENGTH)).valid).toBe(true);
  });

  it("rejects note at MAX_NOTE_LENGTH + 1", () => {
    const result = validateNote("n".repeat(MAX_NOTE_LENGTH + 1));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain("exceeds maximum length");
    }
  });

  it("accepts normal note", () => {
    expect(validateNote("This is a note").valid).toBe(true);
  });
});

describe("validateLabels", () => {
  it("accepts empty array", () => {
    expect(validateLabels([]).valid).toBe(true);
  });

  it("accepts single valid label", () => {
    expect(validateLabels(["bug"]).valid).toBe(true);
  });

  it("accepts label at exactly MAX_LABEL_LENGTH", () => {
    expect(validateLabels(["l".repeat(MAX_LABEL_LENGTH)]).valid).toBe(true);
  });

  it("rejects label at MAX_LABEL_LENGTH + 1", () => {
    const result = validateLabels(["l".repeat(MAX_LABEL_LENGTH + 1)]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain("exceeds maximum length");
    }
  });

  it("accepts multiple valid labels", () => {
    expect(validateLabels(["bug", "frontend", "urgent"]).valid).toBe(true);
  });

  it("rejects when any label exceeds max length", () => {
    const result = validateLabels(["ok", "l".repeat(MAX_LABEL_LENGTH + 1), "fine"]);
    expect(result.valid).toBe(false);
  });

  it("rejects empty string label", () => {
    const result = validateLabels([""]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.message).toContain("cannot be empty");
    }
  });

  it("rejects array containing empty string among valid labels", () => {
    const result = validateLabels(["bug", "", "feature"]);
    expect(result.valid).toBe(false);
  });
});

describe("isValidTimezone", () => {
  it("accepts common IANA timezones", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("Europe/London")).toBe(true);
    expect(isValidTimezone("Asia/Tokyo")).toBe(true);
    expect(isValidTimezone("Pacific/Auckland")).toBe(true);
  });

  it("rejects invalid timezones", () => {
    expect(isValidTimezone("Not/A_Timezone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone("EST")).toBe(false);
    expect(isValidTimezone("GMT+5")).toBe(false);
  });
});
