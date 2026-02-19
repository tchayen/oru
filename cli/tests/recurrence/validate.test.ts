import { describe, it, expect } from "vitest";
import { isValidRecurrence } from "../../src/recurrence/validate";

describe("isValidRecurrence", () => {
  describe("valid inputs", () => {
    it.each([
      "FREQ=DAILY",
      "FREQ=WEEKLY",
      "FREQ=MONTHLY",
      "FREQ=YEARLY",
      "FREQ=DAILY;INTERVAL=3",
      "FREQ=WEEKLY;BYDAY=MO",
      "FREQ=WEEKLY;BYDAY=MO,WE,FR",
      "FREQ=MONTHLY;BYMONTHDAY=15",
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
      "after:FREQ=DAILY",
      "after:FREQ=WEEKLY;BYDAY=MO",
      "after:FREQ=DAILY;INTERVAL=5",
    ])("accepts '%s'", (input) => {
      expect(isValidRecurrence(input)).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it.each([
      "",
      "  ",
      "daily",
      "FREQ=HOURLY",
      "FREQ=DAILY;UNKNOWN=1",
      "FREQ=WEEKLY;BYDAY=XX",
      "FREQ=MONTHLY;BYMONTHDAY=0",
      "FREQ=MONTHLY;BYMONTHDAY=32",
      "FREQ=DAILY;INTERVAL=0",
      "FREQ=DAILY;INTERVAL=-1",
      "INTERVAL=3",
      "BYDAY=MO",
    ])("rejects '%s'", (input) => {
      expect(isValidRecurrence(input)).toBe(false);
    });
  });
});
