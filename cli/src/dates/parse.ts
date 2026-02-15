import type { DateFormat, NextMonthBehavior, Weekday } from "../config/config.js";

const WEEKDAY_NUMBERS: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTH_NAMES: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

/**
 * Parse a friendly date string into a local-time ISO 8601 datetime string.
 *
 * Supports:
 * - ISO: YYYY-MM-DD, YYYY-MM-DDTHH:MM
 * - Slash dates: DD/MM/YYYY or MM/DD/YYYY (based on dateFormat config, with smart fallback)
 * - Slash dates without year: DD/MM or MM/DD
 * - Relative: "today", "tod", "tomorrow", "tom", "tonight"
 * - Week: "next week", "end of week"
 * - Month: "next month", "end of month"
 * - Day names: "monday", "mon", "next friday", "next fri"
 * - Relative durations: "in 3 days", "in 2 weeks", "in 1 month"
 * - Month + day: "march 20", "mar 20", "20th march", "march 3rd"
 * - With time: "today 10am", "tom 3p", "tomorrow 14:30", "2026-02-15 9a"
 *
 * Returns null if the string can't be parsed.
 */
export function parseDate(
  input: string,
  dateFormat: DateFormat = "mdy",
  firstDayOfWeek: Weekday = "monday",
  nextMonth: NextMonthBehavior = "same_day",
  now?: Date,
): string | null {
  const ref = now ?? new Date();
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Split into date part and optional time part
  const { datePart, timePart } = splitDateAndTime(trimmed);

  const date = parseDatePart(datePart, dateFormat, firstDayOfWeek, nextMonth, ref);
  if (!date) {
    return null;
  }

  if (timePart) {
    const time = parseTimePart(timePart);
    if (!time) {
      return null;
    }
    date.setHours(time.hours, time.minutes, 0, 0);
  }

  return formatLocal(date);
}

function splitDateAndTime(input: string): { datePart: string; timePart: string | null } {
  // ISO with T separator: "2026-02-15T10:00"
  const isoMatch = input.match(/^(\d{4}-\d{2}-\d{2})T(\d{1,2}:\d{2})$/i);
  if (isoMatch) {
    return { datePart: isoMatch[1], timePart: isoMatch[2] };
  }

  // Split on last space to separate date from time
  // Time patterns: "10am", "10a", "3pm", "3p", "14:30", "9:00am"
  const parts = input.split(/\s+/);
  if (parts.length === 1) {
    return { datePart: parts[0], timePart: null };
  }

  // Try to parse the last part as a time
  const lastPart = parts[parts.length - 1];
  if (looksLikeTime(lastPart)) {
    return {
      datePart: parts.slice(0, -1).join(" "),
      timePart: lastPart,
    };
  }

  return { datePart: input, timePart: null };
}

function looksLikeTime(s: string): boolean {
  // Require colon (HH:MM) or am/pm suffix to distinguish from bare day numbers
  return /^\d{1,2}:\d{2}\s*(am?|pm?)?$/i.test(s) || /^\d{1,2}\s*(am?|pm?)$/i.test(s);
}

function parseDatePart(
  input: string,
  dateFormat: DateFormat,
  firstDayOfWeek: Weekday,
  nextMonth: NextMonthBehavior,
  ref: Date,
): Date | null {
  const lower = input.toLowerCase().trim();

  // Relative dates
  if (lower === "today" || lower === "tod") {
    return startOfDay(ref);
  }
  if (lower === "tomorrow" || lower === "tom") {
    const d = startOfDay(ref);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (lower === "tonight") {
    const d = startOfDay(ref);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  // Keywords
  if (lower === "next week") {
    return findNextWeekday(ref, WEEKDAY_NUMBERS[firstDayOfWeek]);
  }
  if (lower === "next month") {
    if (nextMonth === "first") {
      return new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    }
    // same_day: clamp to last day of target month if needed
    const targetMonth = (ref.getMonth() + 1) % 12;
    const d = new Date(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
    if (d.getMonth() !== targetMonth) {
      return new Date(ref.getFullYear(), ref.getMonth() + 2, 0);
    }
    return d;
  }
  if (lower === "end of month") {
    return new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  }
  if (lower === "end of week") {
    const endDayNum = (WEEKDAY_NUMBERS[firstDayOfWeek] + 6) % 7;
    const d = startOfDay(ref);
    const current = d.getDay();
    const daysAhead = (endDayNum - current + 7) % 7;
    if (daysAhead === 0) {
      return d;
    }
    d.setDate(d.getDate() + daysAhead);
    return d;
  }

  // Day names: "monday", "mon", "next monday", "next mon"
  {
    let dayInput = lower;
    if (dayInput.startsWith("next ")) {
      dayInput = dayInput.slice(5);
    }
    const dayNum = DAY_NAMES[dayInput];
    if (dayNum !== undefined) {
      return findNextWeekday(ref, dayNum);
    }
  }

  // Relative durations: "in N days/weeks/months"
  {
    const match = lower.match(/^in\s+(\d+)\s+(days?|weeks?|months?)$/);
    if (match) {
      const n = Number(match[1]);
      const unit = match[2];
      const d = startOfDay(ref);
      if (unit.startsWith("day")) {
        d.setDate(d.getDate() + n);
      } else if (unit.startsWith("week")) {
        d.setDate(d.getDate() + n * 7);
      } else if (unit.startsWith("month")) {
        const originalDay = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + n);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(originalDay, lastDay));
      }
      return d;
    }
  }

  // Month + day: "march 20", "mar 20", "march 3rd"
  {
    const monthDayMatch = lower.match(/^([a-z]+)\s+(\d+)(?:st|nd|rd|th)?$/);
    if (monthDayMatch) {
      const monthNum = MONTH_NAMES[monthDayMatch[1]];
      if (monthNum !== undefined) {
        const day = Number(monthDayMatch[2]);
        return buildDateInferYear(ref, monthNum, day);
      }
    }
  }

  // Day + month: "20th march", "3rd mar"
  {
    const dayMonthMatch = lower.match(/^(\d+)(?:st|nd|rd|th)?\s+([a-z]+)$/);
    if (dayMonthMatch) {
      const monthNum = MONTH_NAMES[dayMonthMatch[2]];
      if (monthNum !== undefined) {
        const day = Number(dayMonthMatch[1]);
        return buildDateInferYear(ref, monthNum, day);
      }
    }
  }

  // ISO format: YYYY-MM-DD
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return buildDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // Slash format with year: DD/MM/YYYY or MM/DD/YYYY
  const slashWithYear = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashWithYear) {
    const a = Number(slashWithYear[1]);
    const b = Number(slashWithYear[2]);
    const year = Number(slashWithYear[3]);
    return resolveSlashDate(a, b, year, dateFormat);
  }

  // Slash format without year: DD/MM or MM/DD
  const slashNoYear = input.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashNoYear) {
    const a = Number(slashNoYear[1]);
    const b = Number(slashNoYear[2]);
    return resolveSlashDate(a, b, ref.getFullYear(), dateFormat);
  }

  return null;
}

/**
 * Resolve ambiguous slash dates (DD/MM/YYYY vs MM/DD/YYYY).
 *
 * Strategy:
 * 1. Try the preferred format first (from config)
 * 2. If that produces an invalid date, try the other format
 * 3. If both are valid, prefer the configured format
 */
function resolveSlashDate(a: number, b: number, year: number, dateFormat: DateFormat): Date | null {
  if (dateFormat === "dmy") {
    // Try DD/MM first
    const primary = buildDate(year, b, a);
    if (primary) {
      return primary;
    }
    // Fall back to MM/DD
    return buildDate(year, a, b);
  }
  // Try MM/DD first
  const primary = buildDate(year, a, b);
  if (primary) {
    return primary;
  }
  // Fall back to DD/MM
  return buildDate(year, b, a);
}

function buildDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const d = new Date(year, month - 1, day);
  // Verify the date didn't roll over (e.g., Feb 30 → March)
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

function buildDateInferYear(ref: Date, month: number, day: number): Date | null {
  const year = ref.getFullYear();
  const d = buildDate(year, month, day);
  if (!d) {
    return null;
  }
  // If date is in the past, use next year
  if (d < startOfDay(ref)) {
    return buildDate(year + 1, month, day);
  }
  return d;
}

function parseTimePart(input: string): { hours: number; minutes: number } | null {
  const trimmed = input.trim().toLowerCase();

  // "14:30", "9:00"
  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am?|pm?)?$/);
  if (colonMatch) {
    let hours = Number(colonMatch[1]);
    const minutes = Number(colonMatch[2]);
    const ampm = colonMatch[3];
    if (ampm) {
      hours = applyAmPm(hours, ampm);
    }
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    return { hours, minutes };
  }

  // "10am", "10a", "3pm", "3p"
  const simpleMatch = trimmed.match(/^(\d{1,2})\s*(am?|pm?)$/);
  if (simpleMatch) {
    let hours = Number(simpleMatch[1]);
    hours = applyAmPm(hours, simpleMatch[2]);
    if (hours < 0 || hours > 23) {
      return null;
    }
    return { hours, minutes: 0 };
  }

  return null;
}

function applyAmPm(hours: number, ampm: string): number {
  const isPm = ampm.startsWith("p");
  if (isPm && hours < 12) {
    return hours + 12;
  }
  if (!isPm && hours === 12) {
    return 0;
  }
  return hours;
}

function formatLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function findNextWeekday(ref: Date, target: number): Date {
  const d = startOfDay(ref);
  const currentDay = d.getDay();
  let daysAhead = target - currentDay;
  if (daysAhead <= 0) {
    daysAhead += 7;
  }
  d.setDate(d.getDate() + daysAhead);
  return d;
}
