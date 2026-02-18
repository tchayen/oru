import { isValidRecurrence } from "./validate.js";

const DAY_MAP: Record<string, string> = {
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
  sunday: "SU",
  mon: "MO",
  tue: "TU",
  wed: "WE",
  thu: "TH",
  fri: "FR",
  sat: "SA",
  sun: "SU",
};

/** Parse a human-friendly recurrence string into RRULE format. */
export function parseRecurrence(input: string): string {
  const raw = input.trim();
  if (raw.length === 0) {
    throw new Error("Empty recurrence value.");
  }

  // Detect and preserve `after:` prefix
  let prefix = "";
  let body = raw;
  if (raw.toLowerCase().startsWith("after:")) {
    prefix = "after:";
    body = raw.slice(6).trim();
  }

  // Passthrough raw RRULE
  if (body.startsWith("FREQ=")) {
    const result = prefix + body;
    if (!isValidRecurrence(result)) {
      throw new Error(`Invalid RRULE: ${body}`);
    }
    return result;
  }

  const lower = body.toLowerCase();

  // Simple aliases
  switch (lower) {
    case "daily":
      return prefix + "FREQ=DAILY";
    case "weekly":
      return prefix + "FREQ=WEEKLY";
    case "monthly":
      return prefix + "FREQ=MONTHLY";
    case "yearly":
      return prefix + "FREQ=YEARLY";
    case "weekdays":
      return prefix + "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  }

  // "every N days/weeks/months/years"
  const intervalMatch = lower.match(/^every\s+(\d+)\s+(day|week|month|year)s?$/);
  if (intervalMatch) {
    const n = Number(intervalMatch[1]);
    const unit = intervalMatch[2].toUpperCase();
    const freq =
      unit === "DAY"
        ? "DAILY"
        : unit === "WEEK"
          ? "WEEKLY"
          : unit === "MONTH"
            ? "MONTHLY"
            : "YEARLY";
    return prefix + `FREQ=${freq};INTERVAL=${n}`;
  }

  // "every monday", "every mon,wed,fri"
  const dayMatch = lower.match(/^every\s+([a-z,]+)$/);
  if (dayMatch) {
    const dayParts = dayMatch[1].split(",").map((d) => d.trim());
    const rrDays: string[] = [];
    for (const d of dayParts) {
      const mapped = DAY_MAP[d];
      if (!mapped) {
        throw new Error(`Unknown day: ${d}. Use: monday, tuesday, ..., or mon, tue, ...`);
      }
      rrDays.push(mapped);
    }
    return prefix + `FREQ=WEEKLY;BYDAY=${rrDays.join(",")}`;
  }

  // "every 15th"
  const monthdayMatch = lower.match(/^every\s+(\d+)(?:st|nd|rd|th)$/);
  if (monthdayMatch) {
    const d = Number(monthdayMatch[1]);
    if (d < 1 || d > 31) {
      throw new Error(`Invalid month day: ${d}. Must be 1-31.`);
    }
    return prefix + `FREQ=MONTHLY;BYMONTHDAY=${d}`;
  }

  throw new Error(
    `Could not parse recurrence: "${raw}". Try: daily, weekly, monthly, every 3 days, every monday, every mon,wed,fri, every 15th, or raw RRULE like FREQ=DAILY.`,
  );
}
