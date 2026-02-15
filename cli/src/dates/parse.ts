import type { DateFormat, Weekday } from "../config/config.js";

const WEEKDAY_NUMBERS: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Parse a friendly date string into an ISO 8601 datetime string.
 *
 * Supports:
 * - ISO: YYYY-MM-DD, YYYY-MM-DDTHH:MM
 * - Slash dates: DD/MM/YYYY or MM/DD/YYYY (based on dateFormat config, with smart fallback)
 * - Slash dates without year: DD/MM or MM/DD
 * - Relative: "today", "tod", "tomorrow", "tom", "next week"
 * - With time: "today 10am", "tom 3p", "tomorrow 14:30", "2026-02-15 9a"
 *
 * Returns null if the string can't be parsed.
 */
export function parseDate(
  input: string,
  dateFormat: DateFormat = "mdy",
  firstDayOfWeek: Weekday = "monday",
  now?: Date,
): string | null {
  const ref = now ?? new Date();
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Split into date part and optional time part
  const { datePart, timePart } = splitDateAndTime(trimmed);

  const date = parseDatePart(datePart, dateFormat, firstDayOfWeek, ref);
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
    // Could be just a date, or just a time-like thing
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

  // "next week" is two words, no time
  return { datePart: input, timePart: null };
}

function looksLikeTime(s: string): boolean {
  return /^\d{1,2}(:\d{2})?\s*(am?|pm?)?$/i.test(s);
}

function parseDatePart(
  input: string,
  dateFormat: DateFormat,
  firstDayOfWeek: Weekday,
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
  if (lower === "next week") {
    return nextWeekday(ref, firstDayOfWeek);
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

  // Plain 24h: "14", "9"
  const plainMatch = trimmed.match(/^(\d{1,2})$/);
  if (plainMatch) {
    const hours = Number(plainMatch[1]);
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

function nextWeekday(ref: Date, targetDay: Weekday): Date {
  const target = WEEKDAY_NUMBERS[targetDay];
  const d = startOfDay(ref);
  const currentDay = d.getDay();
  let daysAhead = target - currentDay;
  if (daysAhead <= 0) {
    daysAhead += 7;
  }
  d.setDate(d.getDate() + daysAhead);
  return d;
}
