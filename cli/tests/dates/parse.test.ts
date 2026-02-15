import { describe, it, expect } from "vitest";
import { parseDate } from "../../src/dates/parse.js";

// Fixed reference date: Sunday, 2026-02-15 at noon
const REF = new Date(2026, 1, 15, 12, 0, 0);

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function timeOnly(iso: string): string {
  // Format is "YYYY-MM-DDTHH:MM:SS" — extract HH:MM
  return iso.slice(11, 16);
}

describe("parseDate", () => {
  describe("returns null for invalid input", () => {
    it("empty string", () => {
      expect(parseDate("", "mdy", "monday", REF)).toBeNull();
    });

    it("garbage", () => {
      expect(parseDate("not a date", "mdy", "monday", REF)).toBeNull();
    });

    it("invalid date", () => {
      expect(parseDate("2026-13-01", "mdy", "monday", REF)).toBeNull();
    });

    it("Feb 30", () => {
      expect(parseDate("2026-02-30", "mdy", "monday", REF)).toBeNull();
    });
  });

  describe("ISO format (YYYY-MM-DD)", () => {
    it("parses basic ISO date", () => {
      const result = parseDate("2026-03-20", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-03-20");
    });

    it("parses ISO with time via T separator", () => {
      const result = parseDate("2026-03-20T14:30", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-03-20");
      expect(timeOnly(result)).toBe("14:30");
    });

    it("parses ISO date with space time", () => {
      const result = parseDate("2026-03-20 9am", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-03-20");
      expect(timeOnly(result)).toBe("09:00");
    });
  });

  describe("slash dates with year", () => {
    it("MM/DD/YYYY with mdy config", () => {
      const result = parseDate("03/20/2026", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-03-20");
    });

    it("DD/MM/YYYY with dmy config", () => {
      const result = parseDate("20/03/2026", "dmy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-03-20");
    });

    it("unambiguous: 30/01/2026 must be DD/MM even with mdy config", () => {
      // 30 can't be a month, so it must be DD/MM
      const result = parseDate("30/01/2026", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-01-30");
    });

    it("unambiguous: 02/15/2026 must be MM/DD even with dmy config", () => {
      // 15 can't be a month, so it must be DD=02, MM=15... which fails, so fallback to MM/DD
      const result = parseDate("02/15/2026", "dmy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-15");
    });

    it("ambiguous: 03/04/2026 uses config preference (mdy = March 4)", () => {
      const result = parseDate("03/04/2026", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-03-04");
    });

    it("ambiguous: 03/04/2026 uses config preference (dmy = April 3)", () => {
      const result = parseDate("03/04/2026", "dmy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-04-03");
    });
  });

  describe("slash dates without year", () => {
    it("MM/DD with mdy config", () => {
      const result = parseDate("03/20", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-03-20");
    });

    it("DD/MM with dmy config", () => {
      const result = parseDate("20/03", "dmy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-03-20");
    });

    it("unambiguous: 25/12 must be DD/MM even with mdy config", () => {
      const result = parseDate("25/12", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-12-25");
    });
  });

  describe("relative dates", () => {
    it("today", () => {
      const result = parseDate("today", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-15");
    });

    it("Today (case insensitive)", () => {
      const result = parseDate("Today", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-15");
    });

    it("tod", () => {
      const result = parseDate("tod", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-15");
    });

    it("tomorrow", () => {
      const result = parseDate("tomorrow", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-16");
    });

    it("Tomorrow", () => {
      const result = parseDate("Tomorrow", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-16");
    });

    it("tom", () => {
      const result = parseDate("tom", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-16");
    });

    it("next week defaults to monday", () => {
      // REF is Sun Feb 15. Sun=0, Mon=1. daysAhead = 1-0 = 1. Feb 15+1 = Feb 16.
      const result = parseDate("next week", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-16");
    });

    it("next week respects first_day_of_week = sunday", () => {
      // Sun=0, Sun=0. daysAhead = 0-0 = 0, +7 = 7. Feb 15+7 = Feb 22.
      const result = parseDate("next week", "mdy", "sunday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-22");
    });

    it("next week respects first_day_of_week = saturday", () => {
      // Sun=0, Sat=6. daysAhead = 6-0 = 6. Feb 15+6 = Feb 21.
      const result = parseDate("next week", "mdy", "saturday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-21");
    });
  });

  describe("with time", () => {
    it("today 10am", () => {
      const result = parseDate("today 10am", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-15");
      expect(timeOnly(result)).toBe("10:00");
    });

    it("tod 10a", () => {
      const result = parseDate("tod 10a", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-15");
      expect(timeOnly(result)).toBe("10:00");
    });

    it("tomorrow 3pm", () => {
      const result = parseDate("tomorrow 3pm", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-16");
      expect(timeOnly(result)).toBe("15:00");
    });

    it("tom 3p", () => {
      const result = parseDate("tom 3p", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-16");
      expect(timeOnly(result)).toBe("15:00");
    });

    it("tomorrow 14:30", () => {
      const result = parseDate("tomorrow 14:30", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-16");
      expect(timeOnly(result)).toBe("14:30");
    });

    it("12am is midnight", () => {
      const result = parseDate("today 12am", "mdy", "monday", REF)!;
      expect(timeOnly(result)).toBe("00:00");
    });

    it("12pm is noon", () => {
      const result = parseDate("today 12pm", "mdy", "monday", REF)!;
      expect(timeOnly(result)).toBe("12:00");
    });

    it("next week 9am", () => {
      const result = parseDate("next week 9am", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-02-16");
      expect(timeOnly(result)).toBe("09:00");
    });

    it("slash date with time", () => {
      const result = parseDate("03/20/2026 2pm", "mdy", "monday", REF)!;
      expect(dateOnly(result)).toBe("2026-03-20");
      expect(timeOnly(result)).toBe("14:00");
    });

    it("9:30am", () => {
      const result = parseDate("today 9:30am", "mdy", "monday", REF)!;
      expect(timeOnly(result)).toBe("09:30");
    });

    it("invalid time returns null", () => {
      expect(parseDate("today 25:00", "mdy", "monday", REF)).toBeNull();
    });
  });
});
