import { describe, it, expect } from "vitest";
import {
  resolveToUtcMs,
  getTimezoneAbbr,
  wallClockToUtcDate,
  utcDateToWallClock,
  todayInTz,
} from "../../src/dates/timezone";

describe("resolveToUtcMs", () => {
  it("EST (UTC-5): 15:00 in America/New_York → 20:00 UTC", () => {
    // January 20 is firmly in EST (UTC-5), so 15:00 ET = 20:00 UTC
    const result = resolveToUtcMs("2026-01-20T15:00:00", "America/New_York");
    const expected = Date.UTC(2026, 0, 20, 20, 0, 0);
    expect(result).toBe(expected);
  });

  it("EDT (UTC-4): 15:00 in America/New_York in June → 19:00 UTC", () => {
    const result = resolveToUtcMs("2026-06-20T15:00:00", "America/New_York");
    const expected = Date.UTC(2026, 5, 20, 19, 0, 0);
    expect(result).toBe(expected);
  });

  it("DST spring-forward gap: 2:30 AM on March 8, 2026 in America/New_York", () => {
    // 2:00 AM EST springs forward to 3:00 AM EDT, so 2:30 AM does not exist.
    // The function should still produce a reasonable result (not throw or return NaN).
    const result = resolveToUtcMs("2026-03-08T02:30:00", "America/New_York");
    expect(result).not.toBeNaN();
    expect(typeof result).toBe("number");
  });

  it("all-day task (no time component) resolves at midnight in the timezone", () => {
    const result = resolveToUtcMs("2026-03-20", "America/New_York");
    // March 20 is in EDT (UTC-4), midnight ET = 04:00 UTC
    const expected = Date.UTC(2026, 2, 20, 4, 0, 0);
    expect(result).toBe(expected);
  });
});

describe("getTimezoneAbbr", () => {
  it("returns EST for America/New_York in winter", () => {
    const winterUtcMs = Date.UTC(2026, 0, 15, 12, 0, 0); // Jan 15
    const abbr = getTimezoneAbbr(winterUtcMs, "America/New_York");
    expect(abbr).toBe("EST");
  });

  it("returns EDT for America/New_York in summer", () => {
    const summerUtcMs = Date.UTC(2026, 6, 15, 12, 0, 0); // Jul 15
    const abbr = getTimezoneAbbr(summerUtcMs, "America/New_York");
    expect(abbr).toBe("EDT");
  });
});

describe("wallClockToUtcDate / utcDateToWallClock roundtrip", () => {
  it("roundtrips a datetime string through wallClockToUtcDate and back", () => {
    const input = "2026-03-20T15:30:45";
    const date = wallClockToUtcDate(input);

    expect(date.getUTCHours()).toBe(15);
    expect(date.getUTCMinutes()).toBe(30);
    expect(date.getUTCSeconds()).toBe(45);
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(2); // March = 2
    expect(date.getUTCDate()).toBe(20);

    const output = utcDateToWallClock(date);
    expect(output).toBe(input);
  });
});

describe("todayInTz", () => {
  it("UTC midnight Jan 1 is still Dec 31 in America/New_York", () => {
    const ref = new Date(Date.UTC(2026, 0, 1, 0, 0, 0)); // UTC midnight Jan 1
    const result = todayInTz("America/New_York", ref);
    expect(result).toBe("2025-12-31");
  });

  it("UTC noon Jan 1 is Jan 1 in America/New_York", () => {
    const ref = new Date(Date.UTC(2026, 0, 1, 12, 0, 0)); // UTC noon Jan 1
    const result = todayInTz("America/New_York", ref);
    expect(result).toBe("2026-01-01");
  });
});
