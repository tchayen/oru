/**
 * Timezone utilities for resolving wall-clock times in IANA timezones.
 *
 * `due_at` stores wall-clock time (e.g. "2026-03-20T15:00:00").
 * `due_tz` says which timezone that wall-clock belongs to.
 * These helpers convert between wall-clock + tz and UTC instants.
 */

/**
 * Extract the UTC offset (in minutes) for a given UTC instant in a given timezone.
 * Uses Intl.DateTimeFormat to derive the offset without any external dependencies.
 */
function getUtcOffsetMinutes(utcMs: number, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date(utcMs));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)!.value);

  const y = get("year");
  const m = get("month") - 1;
  const d = get("day");
  const h = get("hour") === 24 ? 0 : get("hour");
  const min = get("minute");
  const sec = get("second");

  // Reconstruct what UTC instant would correspond to this wall-clock
  const wallAsUtcMs = Date.UTC(y, m, d, h, min, sec);
  return (wallAsUtcMs - utcMs) / 60_000;
}

/**
 * Resolve a wall-clock datetime string + IANA timezone to a UTC epoch millisecond value.
 *
 * Two-pass approach: compute a first-guess offset, then verify. Handles DST boundaries
 * where the offset at the guessed UTC instant may differ from the offset at the real one.
 */
export function resolveToUtcMs(dueAt: string, tz: string): number {
  const y = Number(dueAt.slice(0, 4));
  const m = Number(dueAt.slice(5, 7)) - 1;
  const d = Number(dueAt.slice(8, 10));
  const h = Number(dueAt.slice(11, 13)) || 0;
  const min = Number(dueAt.slice(14, 16)) || 0;
  const sec = Number(dueAt.slice(17, 19)) || 0;

  const wallAsUtcMs = Date.UTC(y, m, d, h, min, sec);

  // First pass: guess offset using the wall-clock interpreted as UTC
  const offset1 = getUtcOffsetMinutes(wallAsUtcMs, tz);
  const guess1 = wallAsUtcMs - offset1 * 60_000;

  // Second pass: verify offset at the guessed instant
  const offset2 = getUtcOffsetMinutes(guess1, tz);
  return wallAsUtcMs - offset2 * 60_000;
}

/**
 * Get the short timezone abbreviation (e.g. "EST", "PDT") for a UTC instant in a given timezone.
 */
export function getTimezoneAbbr(utcMs: number, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  });
  const parts = fmt.formatToParts(new Date(utcMs));
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/**
 * Parse a naive wall-clock string into a Date with components placed in UTC fields.
 * This allows timezone-independent arithmetic using getUTC*() / setUTC*() methods.
 *
 * "2026-03-20T15:00:00" → Date where getUTCHours() = 15, getUTCDate() = 20, etc.
 */
export function wallClockToUtcDate(dueAt: string): Date {
  const y = Number(dueAt.slice(0, 4));
  const m = Number(dueAt.slice(5, 7)) - 1;
  const d = Number(dueAt.slice(8, 10));
  const h = Number(dueAt.slice(11, 13)) || 0;
  const min = Number(dueAt.slice(14, 16)) || 0;
  const sec = Number(dueAt.slice(17, 19)) || 0;
  return new Date(Date.UTC(y, m, d, h, min, sec));
}

/**
 * Format a UTC-encoded Date back to a naive wall-clock string "YYYY-MM-DDTHH:MM:SS".
 */
export function utcDateToWallClock(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const min = String(date.getUTCMinutes()).padStart(2, "0");
  const sec = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}:${sec}`;
}

/**
 * Get "today" as YYYY-MM-DD in a given IANA timezone.
 */
export function todayInTz(tz: string, ref?: Date): string {
  const now = ref ?? new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now);
}
