const DAY_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

interface RRule {
  freq: string;
  interval: number;
  byDay: string[] | null;
  byMonthDay: number | null;
}

function parseRRule(rrule: string): RRule {
  const parts = rrule.split(";");
  let freq = "";
  let interval = 1;
  let byDay: string[] | null = null;
  let byMonthDay: number | null = null;

  for (const part of parts) {
    const [key, val] = part.split("=");
    switch (key) {
      case "FREQ":
        freq = val;
        break;
      case "INTERVAL":
        interval = Number(val);
        break;
      case "BYDAY":
        byDay = val.split(",");
        break;
      case "BYMONTHDAY":
        byMonthDay = Number(val);
        break;
    }
  }

  return { freq, interval, byDay, byMonthDay };
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // Clamp to end of month if the day overflows (e.g., Jan 31 + 1 month = Feb 28)
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0); // back to last day of previous month
  }
  return result;
}

/** Compute the next occurrence date from an anchor date and RRULE (without `after:` prefix). */
export function nextOccurrence(rrule: string, anchor: Date): Date {
  const rule = parseRRule(rrule);

  switch (rule.freq) {
    case "DAILY":
      return addDays(anchor, rule.interval);

    case "WEEKLY": {
      if (rule.byDay && rule.byDay.length > 0) {
        // Find the next matching weekday
        const targetDays = rule.byDay.map((d) => DAY_INDEX[d]).sort((a, b) => a - b);
        const currentDay = anchor.getDay();

        // Look for the next matching day in the current week first
        for (const target of targetDays) {
          if (target > currentDay) {
            return addDays(anchor, target - currentDay);
          }
        }

        // Wrap to next interval-week, pick the first matching day
        const daysUntilWeekStart = 7 - currentDay + targetDays[0];
        const extraWeeks = (rule.interval - 1) * 7;
        return addDays(anchor, daysUntilWeekStart + extraWeeks);
      }
      return addDays(anchor, rule.interval * 7);
    }

    case "MONTHLY": {
      if (rule.byMonthDay !== null) {
        const targetDay = rule.byMonthDay;
        let result = new Date(anchor);

        // If anchor day is before the target day in the same month, use this month
        // Otherwise, advance to next month
        if (anchor.getDate() < targetDay) {
          result.setDate(targetDay);
          // Clamp if month doesn't have that many days
          if (result.getMonth() !== anchor.getMonth()) {
            result = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
          }
          // If the clamped result is still not after anchor (e.g. BYMONTHDAY=31 on Feb 28
          // clamps back to Feb 28 = anchor), fall through to the next-interval branch.
          if (result.getTime() <= anchor.getTime()) {
            result = addMonths(anchor, rule.interval);
            const newMonth = result.getMonth();
            result.setDate(targetDay);
            if (result.getMonth() !== newMonth) {
              result = new Date(result.getFullYear(), newMonth + 1, 0);
            }
          }
        } else {
          // Advance interval months
          result = addMonths(anchor, rule.interval);
          const newMonth = result.getMonth();
          result.setDate(targetDay);
          if (result.getMonth() !== newMonth) {
            result = new Date(result.getFullYear(), newMonth + 1, 0);
          }
        }
        return result;
      }
      return addMonths(anchor, rule.interval);
    }

    case "YEARLY": {
      const result = new Date(anchor);
      result.setFullYear(result.getFullYear() + rule.interval);
      // Handle Feb 29 → Feb 28 in non-leap years
      if (result.getMonth() !== anchor.getMonth()) {
        result.setDate(0);
      }
      return result;
    }

    default:
      throw new Error(`Unsupported FREQ: ${rule.freq}`);
  }
}
