const VALID_FREQ = new Set(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
const VALID_DAYS = new Set(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

/** Validate an RRULE string (with optional `after:` prefix). */
export function isValidRecurrence(value: string): boolean {
  if (!value || value.trim().length === 0) {
    return false;
  }

  let rrule = value;
  if (rrule.startsWith("after:")) {
    rrule = rrule.slice(6);
  }

  if (!rrule.startsWith("FREQ=")) {
    return false;
  }

  const parts = rrule.split(";");
  let hasFreq = false;

  for (const part of parts) {
    const [key, val] = part.split("=");
    if (!key || val === undefined) {
      return false;
    }

    switch (key) {
      case "FREQ":
        if (!VALID_FREQ.has(val)) {
          return false;
        }
        hasFreq = true;
        break;
      case "INTERVAL": {
        const n = Number(val);
        if (!Number.isInteger(n) || n < 1) {
          return false;
        }
        break;
      }
      case "BYDAY":
        for (const day of val.split(",")) {
          if (!VALID_DAYS.has(day)) {
            return false;
          }
        }
        break;
      case "BYMONTHDAY": {
        const d = Number(val);
        if (!Number.isInteger(d) || d < 1 || d > 31) {
          return false;
        }
        break;
      }
      default:
        return false;
    }
  }

  return hasFreq;
}
