import { describe, it, expect } from "vitest";
import { nextOccurrence } from "../../src/recurrence/next";

/** Helper: create a Date at midnight UTC-like local for consistent tests. */
function d(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe("nextOccurrence", () => {
  describe("DAILY", () => {
    it("adds 1 day by default", () => {
      const result = nextOccurrence("FREQ=DAILY", d(2026, 3, 10));
      expect(result).toEqual(d(2026, 3, 11));
    });

    it("adds N days with INTERVAL", () => {
      const result = nextOccurrence("FREQ=DAILY;INTERVAL=3", d(2026, 3, 10));
      expect(result).toEqual(d(2026, 3, 13));
    });

    it("crosses month boundary", () => {
      const result = nextOccurrence("FREQ=DAILY", d(2026, 1, 31));
      expect(result).toEqual(d(2026, 2, 1));
    });
  });

  describe("WEEKLY", () => {
    it("adds 7 days with no BYDAY", () => {
      const result = nextOccurrence("FREQ=WEEKLY", d(2026, 3, 10)); // Tuesday
      expect(result).toEqual(d(2026, 3, 17));
    });

    it("adds N*7 days with INTERVAL", () => {
      const result = nextOccurrence("FREQ=WEEKLY;INTERVAL=2", d(2026, 3, 10));
      expect(result).toEqual(d(2026, 3, 24));
    });

    describe("BYDAY", () => {
      it("picks next day in same week", () => {
        // March 10, 2026 is a Tuesday
        const result = nextOccurrence("FREQ=WEEKLY;BYDAY=TH", d(2026, 3, 10));
        expect(result).toEqual(d(2026, 3, 12)); // Thursday
      });

      it("wraps to next week when past all days", () => {
        // March 13, 2026 is a Friday
        const result = nextOccurrence("FREQ=WEEKLY;BYDAY=MO", d(2026, 3, 13));
        expect(result).toEqual(d(2026, 3, 16)); // Monday
      });

      it("picks earliest matching day from multiple", () => {
        // March 10, 2026 is a Tuesday - next MO,WE,FR = Wednesday
        const result = nextOccurrence("FREQ=WEEKLY;BYDAY=MO,WE,FR", d(2026, 3, 10));
        expect(result).toEqual(d(2026, 3, 11)); // Wednesday
      });

      it("wraps with interval > 1", () => {
        // March 13, 2026 is a Friday - next MO with interval=2
        const result = nextOccurrence("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO", d(2026, 3, 13));
        expect(result).toEqual(d(2026, 3, 23)); // skip 1 week, then Monday
      });
    });
  });

  describe("MONTHLY", () => {
    it("adds 1 month by default", () => {
      const result = nextOccurrence("FREQ=MONTHLY", d(2026, 3, 15));
      expect(result).toEqual(d(2026, 4, 15));
    });

    it("clamps to end of month (Jan 31 + 1 month)", () => {
      const result = nextOccurrence("FREQ=MONTHLY", d(2026, 1, 31));
      expect(result).toEqual(d(2026, 2, 28));
    });

    describe("BYMONTHDAY", () => {
      it("picks same month if anchor is before the day", () => {
        const result = nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=20", d(2026, 3, 10));
        expect(result).toEqual(d(2026, 3, 20));
      });

      it("advances to next month if anchor is on/after the day", () => {
        const result = nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=10", d(2026, 3, 10));
        expect(result).toEqual(d(2026, 4, 10));
      });

      it("clamps if target month lacks the day", () => {
        // Anchor Feb 1, BYMONTHDAY=31 → Feb 28 (2026 is not a leap year)
        const result = nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", d(2026, 2, 1));
        expect(result).toEqual(d(2026, 2, 28));
      });

      it("does not get stuck when anchor equals clamped result (BYMONTHDAY=31 on Feb 28)", () => {
        // Feb 28 + BYMONTHDAY=31: clamps to Feb 28 = anchor → must advance to March 31
        const result = nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", d(2026, 2, 28));
        expect(result).toEqual(d(2026, 3, 31));
      });

      it("does not get stuck on last day of Feb in leap year (BYMONTHDAY=31 on Feb 29)", () => {
        // 2024 is a leap year; Feb 29 + BYMONTHDAY=31 → clamps to Feb 29 = anchor → advance
        const result = nextOccurrence("FREQ=MONTHLY;BYMONTHDAY=31", d(2024, 2, 29));
        expect(result).toEqual(d(2024, 3, 31));
      });
    });
  });

  describe("YEARLY", () => {
    it("adds 1 year by default", () => {
      const result = nextOccurrence("FREQ=YEARLY", d(2026, 6, 15));
      expect(result).toEqual(d(2027, 6, 15));
    });

    it("handles Feb 29 in leap year → Feb 28 in non-leap", () => {
      // 2024 is a leap year, 2025 is not
      const result = nextOccurrence("FREQ=YEARLY", d(2024, 2, 29));
      expect(result).toEqual(d(2025, 2, 28));
    });

    it("adds N years with INTERVAL", () => {
      const result = nextOccurrence("FREQ=YEARLY;INTERVAL=2", d(2026, 1, 1));
      expect(result).toEqual(d(2028, 1, 1));
    });
  });

  it("throws on unsupported FREQ", () => {
    expect(() => nextOccurrence("FREQ=HOURLY", new Date())).toThrow("Unsupported FREQ");
  });
});
