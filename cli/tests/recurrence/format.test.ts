import { describe, it, expect } from "vitest";
import { formatRecurrence } from "../../src/recurrence/format";

describe("formatRecurrence", () => {
  it.each([
    ["FREQ=DAILY", "daily"],
    ["FREQ=WEEKLY", "weekly"],
    ["FREQ=MONTHLY", "monthly"],
    ["FREQ=YEARLY", "yearly"],
    ["FREQ=DAILY;INTERVAL=3", "every 3 days"],
    ["FREQ=WEEKLY;INTERVAL=2", "every 2 weeks"],
    ["FREQ=MONTHLY;INTERVAL=6", "every 6 months"],
    ["FREQ=YEARLY;INTERVAL=5", "every 5 years"],
    ["FREQ=WEEKLY;BYDAY=MO", "every monday"],
    ["FREQ=WEEKLY;BYDAY=MO,WE,FR", "every monday, wednesday, friday"],
    ["FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "weekdays"],
    ["FREQ=MONTHLY;BYMONTHDAY=1", "every 1st"],
    ["FREQ=MONTHLY;BYMONTHDAY=2", "every 2nd"],
    ["FREQ=MONTHLY;BYMONTHDAY=3", "every 3rd"],
    ["FREQ=MONTHLY;BYMONTHDAY=15", "every 15th"],
    ["FREQ=MONTHLY;BYMONTHDAY=21", "every 21st"],
    ["FREQ=MONTHLY;BYMONTHDAY=22", "every 22nd"],
    ["FREQ=MONTHLY;BYMONTHDAY=23", "every 23rd"],
  ])("formats '%s' → '%s'", (input, expected) => {
    expect(formatRecurrence(input)).toBe(expected);
  });

  describe("after: prefix", () => {
    it.each([
      ["after:FREQ=DAILY", "daily (after completion)"],
      ["after:FREQ=WEEKLY", "weekly (after completion)"],
      ["after:FREQ=WEEKLY;BYDAY=MO", "every monday (after completion)"],
      ["after:FREQ=DAILY;INTERVAL=3", "every 3 days (after completion)"],
    ])("formats '%s' → '%s'", (input, expected) => {
      expect(formatRecurrence(input)).toBe(expected);
    });
  });
});
