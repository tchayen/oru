import fs from "fs";
import path from "path";
import os from "os";
import { parse } from "smol-toml";

export type DateFormat = "dmy" | "mdy";
export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
export type OutputFormat = "text" | "json";
export type NextMonthBehavior = "same_day" | "first";

export interface Config {
  date_format: DateFormat;
  first_day_of_week: Weekday;
  output_format: OutputFormat;
  next_month: NextMonthBehavior;
  auto_update_check: boolean;
}

const DEFAULTS: Config = {
  date_format: "mdy",
  first_day_of_week: "monday",
  output_format: "text",
  next_month: "same_day",
  auto_update_check: true,
};

const VALID_DATE_FORMATS = new Set<string>(["dmy", "mdy"]);
const VALID_WEEKDAYS = new Set<string>([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
const VALID_OUTPUT_FORMATS = new Set<string>(["text", "json"]);
const VALID_NEXT_MONTH = new Set<string>(["same_day", "first"]);

export function getConfigPath(): string {
  if (process.env.ORU_CONFIG_PATH) {
    return process.env.ORU_CONFIG_PATH;
  }
  if (process.env.ORU_CONFIG_DIR) {
    return path.join(process.env.ORU_CONFIG_DIR, "config.toml");
  }
  return path.join(os.homedir(), ".oru", "config.toml");
}

export const DEFAULT_CONFIG_TOML = `# oru configuration
# Docs: https://github.com/tchayen/oru

# Date input format for slash dates (e.g. 03/04/2026)
# "mdy" = MM/DD/YYYY (US)
# "dmy" = DD/MM/YYYY (EU/international)
date_format = "mdy"

# First day of the week, used by "next week" and "end of week"
# Options: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
first_day_of_week = "monday"

# Default output format for CLI commands
# "text" = human-readable (default)
# "json" = machine-readable (overridable per-command with --json / --plaintext)
output_format = "text"

# What "next month" means for due dates
# "same_day" = same day number next month (Feb 15 -> Mar 15, Jan 31 -> Feb 28)
# "first"    = first day of next month (Feb 15 -> Mar 1)
next_month = "same_day"

# Check for new versions on startup (once per 24h)
# Set to false to disable
auto_update_check = true
`;

export function loadConfig(configPath?: string): Config {
  const resolved = configPath ?? getConfigPath();

  if (!fs.existsSync(resolved)) {
    return { ...DEFAULTS };
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  const parsed = parse(raw);
  const config = { ...DEFAULTS };

  if (typeof parsed.date_format === "string" && VALID_DATE_FORMATS.has(parsed.date_format)) {
    config.date_format = parsed.date_format as DateFormat;
  }

  if (
    typeof parsed.first_day_of_week === "string" &&
    VALID_WEEKDAYS.has(parsed.first_day_of_week.toLowerCase())
  ) {
    config.first_day_of_week = parsed.first_day_of_week.toLowerCase() as Weekday;
  }

  if (typeof parsed.output_format === "string" && VALID_OUTPUT_FORMATS.has(parsed.output_format)) {
    config.output_format = parsed.output_format as OutputFormat;
  }

  if (typeof parsed.next_month === "string" && VALID_NEXT_MONTH.has(parsed.next_month)) {
    config.next_month = parsed.next_month as NextMonthBehavior;
  }

  if (typeof parsed.auto_update_check === "boolean") {
    config.auto_update_check = parsed.auto_update_check;
  }

  return config;
}
