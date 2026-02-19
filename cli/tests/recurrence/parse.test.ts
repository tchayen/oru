import { describe, it, expect } from "vitest";
import { parseRecurrence } from "../../src/recurrence/parse";

describe("parseRecurrence", () => {
  describe("simple aliases", () => {
    it.each([
      ["daily", "FREQ=DAILY"],
      ["weekly", "FREQ=WEEKLY"],
      ["monthly", "FREQ=MONTHLY"],
      ["yearly", "FREQ=YEARLY"],
      ["weekdays", "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"],
    ])("parses '%s' → '%s'", (input, expected) => {
      expect(parseRecurrence(input)).toBe(expected);
    });
  });

  describe("interval patterns", () => {
    it.each([
      ["every 2 days", "FREQ=DAILY;INTERVAL=2"],
      ["every 3 weeks", "FREQ=WEEKLY;INTERVAL=3"],
      ["every 6 months", "FREQ=MONTHLY;INTERVAL=6"],
      ["every 2 years", "FREQ=YEARLY;INTERVAL=2"],
      ["every 1 day", "FREQ=DAILY;INTERVAL=1"],
    ])("parses '%s' → '%s'", (input, expected) => {
      expect(parseRecurrence(input)).toBe(expected);
    });
  });

  describe("day-of-week patterns", () => {
    it.each([
      ["every monday", "FREQ=WEEKLY;BYDAY=MO"],
      ["every mon", "FREQ=WEEKLY;BYDAY=MO"],
      ["every mon,wed,fri", "FREQ=WEEKLY;BYDAY=MO,WE,FR"],
      ["every tuesday", "FREQ=WEEKLY;BYDAY=TU"],
      ["every sat,sun", "FREQ=WEEKLY;BYDAY=SA,SU"],
    ])("parses '%s' → '%s'", (input, expected) => {
      expect(parseRecurrence(input)).toBe(expected);
    });
  });

  describe("month-day patterns", () => {
    it.each([
      ["every 1st", "FREQ=MONTHLY;BYMONTHDAY=1"],
      ["every 2nd", "FREQ=MONTHLY;BYMONTHDAY=2"],
      ["every 3rd", "FREQ=MONTHLY;BYMONTHDAY=3"],
      ["every 15th", "FREQ=MONTHLY;BYMONTHDAY=15"],
      ["every 31st", "FREQ=MONTHLY;BYMONTHDAY=31"],
    ])("parses '%s' → '%s'", (input, expected) => {
      expect(parseRecurrence(input)).toBe(expected);
    });
  });

  describe("raw RRULE passthrough", () => {
    it.each([
      ["FREQ=DAILY", "FREQ=DAILY"],
      ["FREQ=WEEKLY;BYDAY=MO,WE", "FREQ=WEEKLY;BYDAY=MO,WE"],
      ["FREQ=MONTHLY;BYMONTHDAY=15", "FREQ=MONTHLY;BYMONTHDAY=15"],
      ["FREQ=DAILY;INTERVAL=3", "FREQ=DAILY;INTERVAL=3"],
    ])("passes through '%s'", (input, expected) => {
      expect(parseRecurrence(input)).toBe(expected);
    });
  });

  describe("after: prefix", () => {
    it.each([
      ["after:daily", "after:FREQ=DAILY"],
      ["after:weekly", "after:FREQ=WEEKLY"],
      ["after:every 3 days", "after:FREQ=DAILY;INTERVAL=3"],
      ["after:every monday", "after:FREQ=WEEKLY;BYDAY=MO"],
      ["after:FREQ=WEEKLY", "after:FREQ=WEEKLY"],
    ])("parses '%s' → '%s'", (input, expected) => {
      expect(parseRecurrence(input)).toBe(expected);
    });
  });

  describe("error cases", () => {
    it("throws on empty input", () => {
      expect(() => parseRecurrence("")).toThrow("Empty recurrence value");
    });

    it("throws on unknown day name", () => {
      expect(() => parseRecurrence("every funday")).toThrow("Unknown day");
    });

    it("throws on invalid month day", () => {
      expect(() => parseRecurrence("every 32nd")).toThrow("Invalid month day");
    });

    it("throws on unrecognized format", () => {
      expect(() => parseRecurrence("biweekly")).toThrow("Could not parse recurrence");
    });

    it("throws on invalid raw RRULE", () => {
      expect(() => parseRecurrence("FREQ=INVALID")).toThrow("Invalid RRULE");
    });
  });

  it("trims whitespace", () => {
    expect(parseRecurrence("  daily  ")).toBe("FREQ=DAILY");
  });

  it("is case-insensitive for human input", () => {
    expect(parseRecurrence("Daily")).toBe("FREQ=DAILY");
    expect(parseRecurrence("EVERY MONDAY")).toBe("FREQ=WEEKLY;BYDAY=MO");
  });
});
