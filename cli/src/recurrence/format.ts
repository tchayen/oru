const DAY_NAMES: Record<string, string> = {
  MO: "monday",
  TU: "tuesday",
  WE: "wednesday",
  TH: "thursday",
  FR: "friday",
  SA: "saturday",
  SU: "sunday",
};

/** Format an RRULE (with optional `after:` prefix) as a human-readable string. */
export function formatRecurrence(recurrence: string): string {
  let rrule = recurrence;
  let suffix = "";
  if (rrule.startsWith("after:")) {
    rrule = rrule.slice(6);
    suffix = " (after completion)";
  }

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

  // "every mon,wed,fri" or "every monday"
  if (byDay && byDay.length > 0) {
    const weekdays = ["MO", "TU", "WE", "TH", "FR"];
    const isWeekdays = byDay.length === 5 && weekdays.every((d) => byDay!.includes(d));
    if (isWeekdays) {
      return `weekdays${suffix}`;
    }
    const names = byDay.map((d) => DAY_NAMES[d] ?? d.toLowerCase());
    const prefix = interval > 1 ? `every ${interval} weeks on ` : "every ";
    return `${prefix}${names.join(", ")}${suffix}`;
  }

  if (byMonthDay !== null) {
    const ordinal = formatOrdinal(byMonthDay);
    const prefix = interval > 1 ? `every ${interval} months on the ` : "every ";
    return `${prefix}${ordinal}${suffix}`;
  }

  const unit =
    freq === "DAILY" ? "day" : freq === "WEEKLY" ? "week" : freq === "MONTHLY" ? "month" : "year";

  if (interval === 1) {
    switch (freq) {
      case "DAILY":
        return `daily${suffix}`;
      case "WEEKLY":
        return `weekly${suffix}`;
      case "MONTHLY":
        return `monthly${suffix}`;
      case "YEARLY":
        return `yearly${suffix}`;
    }
  }

  return `every ${interval} ${unit}s${suffix}`;
}

function formatOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
