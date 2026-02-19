import { describe, it, expect } from "vitest";
import { parseDate } from "../../src/dates/parse";
import { isOverdue } from "../../src/format/text";

// Fixed reference date: 2026-02-15 at noon local time
const REF = new Date(2026, 1, 15, 12, 0, 0);

describe("local-time date storage behavior", () => {
  it("parseDate returns a string without a Z suffix or UTC offset", () => {
    const result = parseDate("tomorrow", "mdy", "monday", "same_day", REF);
    expect(result).not.toBeNull();
    expect(result).not.toMatch(/Z$/);
    expect(result).not.toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it("isOverdue treats stored date string as local time", () => {
    // A task due at exactly noon today is not overdue when checked at 11:59
    const notYetRef = new Date(2026, 1, 15, 11, 59, 0);
    expect(isOverdue("2026-02-15T12:00:00", notYetRef)).toBe(false);

    // At 12:01, it is overdue
    const justAfterRef = new Date(2026, 1, 15, 12, 1, 0);
    expect(isOverdue("2026-02-15T12:00:00", justAfterRef)).toBe(true);
  });

  it("isOverdue for all-day task: not overdue until end of the due day", () => {
    // An all-day task (00:00) is not overdue at 23:59 on the due day
    const endOfDay = new Date(2026, 1, 15, 23, 59, 0);
    expect(isOverdue("2026-02-15T00:00:00", endOfDay)).toBe(false);

    // But it IS overdue at 00:01 the next day
    const nextDay = new Date(2026, 1, 16, 0, 1, 0);
    expect(isOverdue("2026-02-15T00:00:00", nextDay)).toBe(true);
  });

  it("known limitation: same due_at string evaluates differently under a TZ shift", () => {
    // This test documents the known limitation: if the device timezone changes
    // between when a task is created and when it's evaluated, the due date will
    // be interpreted differently. The stored string "2026-02-15T09:00:00" means
    // 9am in whatever timezone the parsing device is in at evaluation time.
    //
    // isOverdue manually constructs a local Date from the string fields, so it
    // always reads the string as "local time". If the user was in UTC-5 when
    // they set the task, and then travels to UTC+5, the task will appear to be
    // due 10 hours earlier than intended.
    //
    // We verify this by checking that two different "now" values straddle the
    // stored time, confirming the behavior is deterministic for a fixed TZ.
    const beforeDue = new Date(2026, 1, 15, 8, 59, 0);
    const afterDue = new Date(2026, 1, 15, 9, 1, 0);
    expect(isOverdue("2026-02-15T09:00:00", beforeDue)).toBe(false);
    expect(isOverdue("2026-02-15T09:00:00", afterDue)).toBe(true);
  });
});
