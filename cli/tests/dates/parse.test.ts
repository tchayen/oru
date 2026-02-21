import { describe, it, expect } from "vitest";
import { parseDate } from "../../src/dates/parse";

// Fixed reference date: Sunday, 2026-02-15 at noon
const REF = new Date(2026, 1, 15, 12, 0, 0);

function p(
  input: string,
  opts?: { fmt?: "dmy" | "mdy"; dow?: string; nm?: string },
): string | null {
  return parseDate(
    input,
    (opts?.fmt ?? "mdy") as "dmy" | "mdy",
    (opts?.dow ?? "monday") as any,
    (opts?.nm ?? "same_day") as any,
    REF,
  );
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function timeOnly(iso: string): string {
  return iso.slice(11, 16);
}

describe("parseDate", () => {
  describe("returns null for invalid input", () => {
    it("empty string", () => {
      expect(p("")).toBeNull();
    });

    it("garbage", () => {
      expect(p("not a date")).toBeNull();
    });

    it("invalid date", () => {
      expect(p("2026-13-01")).toBeNull();
    });

    it("Feb 30", () => {
      expect(p("2026-02-30")).toBeNull();
    });
  });

  describe("ISO format (YYYY-MM-DD)", () => {
    it("parses basic ISO date", () => {
      expect(dateOnly(p("2026-03-20")!)).toBe("2026-03-20");
    });

    it("parses ISO with time via T separator", () => {
      const result = p("2026-03-20T14:30")!;
      expect(dateOnly(result)).toBe("2026-03-20");
      expect(timeOnly(result)).toBe("14:30");
    });

    it("parses ISO date with space time", () => {
      const result = p("2026-03-20 9am")!;
      expect(dateOnly(result)).toBe("2026-03-20");
      expect(timeOnly(result)).toBe("09:00");
    });
  });

  describe("slash dates with year", () => {
    it("MM/DD/YYYY with mdy config", () => {
      expect(dateOnly(p("03/20/2026")!)).toBe("2026-03-20");
    });

    it("DD/MM/YYYY with dmy config", () => {
      expect(dateOnly(p("20/03/2026", { fmt: "dmy" })!)).toBe("2026-03-20");
    });

    it("unambiguous: 30/01/2026 must be DD/MM even with mdy config", () => {
      expect(dateOnly(p("30/01/2026")!)).toBe("2026-01-30");
    });

    it("unambiguous: 02/15/2026 must be MM/DD even with dmy config", () => {
      expect(dateOnly(p("02/15/2026", { fmt: "dmy" })!)).toBe("2026-02-15");
    });

    it("ambiguous: 03/04/2026 uses config preference (mdy = March 4)", () => {
      expect(dateOnly(p("03/04/2026")!)).toBe("2026-03-04");
    });

    it("ambiguous: 03/04/2026 uses config preference (dmy = April 3)", () => {
      expect(dateOnly(p("03/04/2026", { fmt: "dmy" })!)).toBe("2026-04-03");
    });
  });

  describe("slash dates without year", () => {
    it("MM/DD with mdy config", () => {
      expect(dateOnly(p("03/20")!)).toBe("2026-03-20");
    });

    it("DD/MM with dmy config", () => {
      expect(dateOnly(p("20/03", { fmt: "dmy" })!)).toBe("2026-03-20");
    });

    it("unambiguous: 25/12 must be DD/MM even with mdy config", () => {
      expect(dateOnly(p("25/12")!)).toBe("2026-12-25");
    });
  });

  describe("relative dates", () => {
    it("today", () => {
      expect(dateOnly(p("today")!)).toBe("2026-02-15");
    });

    it("Today (case insensitive)", () => {
      expect(dateOnly(p("Today")!)).toBe("2026-02-15");
    });

    it("tod", () => {
      expect(dateOnly(p("tod")!)).toBe("2026-02-15");
    });

    it("tomorrow", () => {
      expect(dateOnly(p("tomorrow")!)).toBe("2026-02-16");
    });

    it("Tomorrow", () => {
      expect(dateOnly(p("Tomorrow")!)).toBe("2026-02-16");
    });

    it("tom", () => {
      expect(dateOnly(p("tom")!)).toBe("2026-02-16");
    });

    it("next week defaults to monday", () => {
      // REF is Sun Feb 15. Sun=0, Mon=1. daysAhead = 1-0 = 1. Feb 15+1 = Feb 16.
      expect(dateOnly(p("next week")!)).toBe("2026-02-16");
    });

    it("next week respects first_day_of_week = sunday", () => {
      // Sun=0, Sun=0. daysAhead = 0-0 = 0, +7 = 7. Feb 15+7 = Feb 22.
      expect(dateOnly(p("next week", { dow: "sunday" })!)).toBe("2026-02-22");
    });

    it("next week respects first_day_of_week = saturday", () => {
      // Sun=0, Sat=6. daysAhead = 6-0 = 6. Feb 15+6 = Feb 21.
      expect(dateOnly(p("next week", { dow: "saturday" })!)).toBe("2026-02-21");
    });
  });

  describe("tonight", () => {
    it("tonight is today at 18:00", () => {
      const result = p("tonight")!;
      expect(dateOnly(result)).toBe("2026-02-15");
      expect(timeOnly(result)).toBe("18:00");
    });

    it("tonight with explicit time overrides 18:00", () => {
      const result = p("tonight 9pm")!;
      expect(dateOnly(result)).toBe("2026-02-15");
      expect(timeOnly(result)).toBe("21:00");
    });
  });

  describe("day names", () => {
    // REF is Sunday Feb 15, 2026
    it("monday → next monday (1 day)", () => {
      expect(dateOnly(p("monday")!)).toBe("2026-02-16");
    });

    it("mon → same as monday", () => {
      expect(dateOnly(p("mon")!)).toBe("2026-02-16");
    });

    it("friday → next friday (5 days)", () => {
      expect(dateOnly(p("friday")!)).toBe("2026-02-20");
    });

    it("fri → same as friday", () => {
      expect(dateOnly(p("fri")!)).toBe("2026-02-20");
    });

    it("sunday → next sunday (7 days)", () => {
      // Same day as REF, so it wraps to next week
      expect(dateOnly(p("sunday")!)).toBe("2026-02-22");
    });

    it("next monday", () => {
      expect(dateOnly(p("next monday")!)).toBe("2026-02-16");
    });

    it("next fri", () => {
      expect(dateOnly(p("next fri")!)).toBe("2026-02-20");
    });

    it("Wednesday (case insensitive)", () => {
      expect(dateOnly(p("Wednesday")!)).toBe("2026-02-18");
    });

    it("day name with time", () => {
      const result = p("friday 3pm")!;
      expect(dateOnly(result)).toBe("2026-02-20");
      expect(timeOnly(result)).toBe("15:00");
    });

    it("next day name with time", () => {
      const result = p("next wed 10am")!;
      expect(dateOnly(result)).toBe("2026-02-18");
      expect(timeOnly(result)).toBe("10:00");
    });
  });

  describe("ordinal day-of-month", () => {
    // REF is Sunday Feb 15, 2026

    it("11th → March 11 (past this month)", () => {
      expect(dateOnly(p("11th")!)).toBe("2026-03-11");
    });

    it("20th → Feb 20 (still ahead this month)", () => {
      expect(dateOnly(p("20th")!)).toBe("2026-02-20");
    });

    it("15th → Feb 15 (today)", () => {
      expect(dateOnly(p("15th")!)).toBe("2026-02-15");
    });

    it("2nd → March 2 (past this month)", () => {
      expect(dateOnly(p("2nd")!)).toBe("2026-03-02");
    });

    it("1st → March 1 (past this month)", () => {
      expect(dateOnly(p("1st")!)).toBe("2026-03-01");
    });

    it("31st → March 31 (Feb doesn't have 31 days)", () => {
      expect(dateOnly(p("31st")!)).toBe("2026-03-31");
    });

    it("28th → Feb 28 (still ahead this month)", () => {
      expect(dateOnly(p("28th")!)).toBe("2026-02-28");
    });

    it("3rd with time", () => {
      const result = p("3rd 9am")!;
      expect(dateOnly(result)).toBe("2026-03-03");
      expect(timeOnly(result)).toBe("09:00");
    });

    it("0th → null (invalid)", () => {
      expect(p("0th")).toBeNull();
    });

    it("32nd → null (invalid)", () => {
      expect(p("32nd")).toBeNull();
    });
  });

  describe("relative durations", () => {
    it("in 3 days", () => {
      expect(dateOnly(p("in 3 days")!)).toBe("2026-02-18");
    });

    it("in 1 day", () => {
      expect(dateOnly(p("in 1 day")!)).toBe("2026-02-16");
    });

    it("in 2 weeks", () => {
      expect(dateOnly(p("in 2 weeks")!)).toBe("2026-03-01");
    });

    it("in 1 week", () => {
      expect(dateOnly(p("in 1 week")!)).toBe("2026-02-22");
    });

    it("in 1 month", () => {
      expect(dateOnly(p("in 1 month")!)).toBe("2026-03-15");
    });

    it("in 3 months", () => {
      expect(dateOnly(p("in 3 months")!)).toBe("2026-05-15");
    });

    it("in 1 month clamps day (Jan 31 → Feb 28)", () => {
      const jan31 = new Date(2026, 0, 31, 12, 0, 0);
      const result = parseDate("in 1 month", "mdy", "monday", "same_day", jan31)!;
      expect(dateOnly(result)).toBe("2026-02-28");
    });

    it("in 3 days with time", () => {
      const result = p("in 3 days 2pm")!;
      expect(dateOnly(result)).toBe("2026-02-18");
      expect(timeOnly(result)).toBe("14:00");
    });
  });

  describe("month + day", () => {
    it("march 20", () => {
      expect(dateOnly(p("march 20")!)).toBe("2026-03-20");
    });

    it("mar 20", () => {
      expect(dateOnly(p("mar 20")!)).toBe("2026-03-20");
    });

    it("march 3rd", () => {
      expect(dateOnly(p("march 3rd")!)).toBe("2026-03-03");
    });

    it("january 1st", () => {
      // Jan 1 is in the past relative to Feb 15, so should be next year
      expect(dateOnly(p("january 1st")!)).toBe("2027-01-01");
    });

    it("feb 15 is today → uses this year", () => {
      expect(dateOnly(p("feb 15")!)).toBe("2026-02-15");
    });

    it("feb 14 is yesterday → uses next year", () => {
      expect(dateOnly(p("feb 14")!)).toBe("2027-02-14");
    });

    it("20th march (day first)", () => {
      expect(dateOnly(p("20th march")!)).toBe("2026-03-20");
    });

    it("3rd mar (day first abbreviated)", () => {
      expect(dateOnly(p("3rd mar")!)).toBe("2026-03-03");
    });

    it("1st january (past date rolls to next year)", () => {
      expect(dateOnly(p("1st january")!)).toBe("2027-01-01");
    });

    it("sept 15", () => {
      expect(dateOnly(p("sept 15")!)).toBe("2026-09-15");
    });

    it("december 25", () => {
      expect(dateOnly(p("december 25")!)).toBe("2026-12-25");
    });

    it("month + day with time", () => {
      const result = p("march 20 3pm")!;
      expect(dateOnly(result)).toBe("2026-03-20");
      expect(timeOnly(result)).toBe("15:00");
    });

    it("invalid month + day returns null", () => {
      expect(p("february 30")).toBeNull();
    });
  });

  describe("next month", () => {
    it("same_day: Feb 15 → Mar 15", () => {
      expect(dateOnly(p("next month")!)).toBe("2026-03-15");
    });

    it("first: Feb 15 → Mar 1", () => {
      expect(dateOnly(p("next month", { nm: "first" })!)).toBe("2026-03-01");
    });

    it("same_day clamps: Jan 31 → Feb 28", () => {
      const jan31 = new Date(2026, 0, 31, 12, 0, 0);
      const result = parseDate("next month", "mdy", "monday", "same_day", jan31)!;
      expect(dateOnly(result)).toBe("2026-02-28");
    });

    it("same_day: Dec 15 → Jan 15 next year", () => {
      const dec15 = new Date(2026, 11, 15, 12, 0, 0);
      const result = parseDate("next month", "mdy", "monday", "same_day", dec15)!;
      expect(dateOnly(result)).toBe("2027-01-15");
    });

    it("first: Dec 15 → Jan 1 next year", () => {
      const dec15 = new Date(2026, 11, 15, 12, 0, 0);
      const result = parseDate("next month", "mdy", "monday", "first", dec15)!;
      expect(dateOnly(result)).toBe("2027-01-01");
    });

    it("next month with time", () => {
      const result = p("next month 9am")!;
      expect(dateOnly(result)).toBe("2026-03-15");
      expect(timeOnly(result)).toBe("09:00");
    });
  });

  describe("end of month", () => {
    it("end of month in February (non-leap)", () => {
      expect(dateOnly(p("end of month")!)).toBe("2026-02-28");
    });

    it("end of month from Jan 15", () => {
      const jan15 = new Date(2026, 0, 15, 12, 0, 0);
      const result = parseDate("end of month", "mdy", "monday", "same_day", jan15)!;
      expect(dateOnly(result)).toBe("2026-01-31");
    });

    it("end of month with time", () => {
      const result = p("end of month 5pm")!;
      expect(dateOnly(result)).toBe("2026-02-28");
      expect(timeOnly(result)).toBe("17:00");
    });
  });

  describe("end of week", () => {
    // REF is Sunday Feb 15. first_day_of_week = monday → end = sunday.
    it("end of week (monday start) on Sunday → today", () => {
      // End of week is Sunday. REF is Sunday. daysAhead = 0 → return today.
      expect(dateOnly(p("end of week")!)).toBe("2026-02-15");
    });

    it("end of week (sunday start) → Saturday", () => {
      // End = (0+6)%7 = 6 (Saturday). Sun=0, daysAhead = (6-0+7)%7 = 6. Feb 15+6 = Feb 21.
      expect(dateOnly(p("end of week", { dow: "sunday" })!)).toBe("2026-02-21");
    });

    it("end of week from Wednesday", () => {
      // first_day_of_week = monday → end = sunday (0).
      // Wed = 3, daysAhead = (0-3+7)%7 = 4. Feb 18+4 = Feb 22.
      const wed = new Date(2026, 1, 18, 12, 0, 0);
      const result = parseDate("end of week", "mdy", "monday", "same_day", wed)!;
      expect(dateOnly(result)).toBe("2026-02-22");
    });

    it("end of week with time", () => {
      const result = p("end of week 6pm")!;
      expect(dateOnly(result)).toBe("2026-02-15");
      expect(timeOnly(result)).toBe("18:00");
    });
  });

  describe("with time", () => {
    it("today 10am", () => {
      const result = p("today 10am")!;
      expect(dateOnly(result)).toBe("2026-02-15");
      expect(timeOnly(result)).toBe("10:00");
    });

    it("tod 10a", () => {
      const result = p("tod 10a")!;
      expect(dateOnly(result)).toBe("2026-02-15");
      expect(timeOnly(result)).toBe("10:00");
    });

    it("tomorrow 3pm", () => {
      const result = p("tomorrow 3pm")!;
      expect(dateOnly(result)).toBe("2026-02-16");
      expect(timeOnly(result)).toBe("15:00");
    });

    it("tom 3p", () => {
      const result = p("tom 3p")!;
      expect(dateOnly(result)).toBe("2026-02-16");
      expect(timeOnly(result)).toBe("15:00");
    });

    it("tomorrow 14:30", () => {
      const result = p("tomorrow 14:30")!;
      expect(dateOnly(result)).toBe("2026-02-16");
      expect(timeOnly(result)).toBe("14:30");
    });

    it("12am is midnight", () => {
      expect(timeOnly(p("today 12am")!)).toBe("00:00");
    });

    it("12pm is noon", () => {
      expect(timeOnly(p("today 12pm")!)).toBe("12:00");
    });

    it("next week 9am", () => {
      const result = p("next week 9am")!;
      expect(dateOnly(result)).toBe("2026-02-16");
      expect(timeOnly(result)).toBe("09:00");
    });

    it("slash date with time", () => {
      const result = p("03/20/2026 2pm")!;
      expect(dateOnly(result)).toBe("2026-03-20");
      expect(timeOnly(result)).toBe("14:00");
    });

    it("9:30am", () => {
      expect(timeOnly(p("today 9:30am")!)).toBe("09:30");
    });

    it("invalid time returns null", () => {
      expect(p("today 25:00")).toBeNull();
    });
  });
});
