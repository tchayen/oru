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
  telemetry: boolean;
  telemetry_notice_shown: boolean;
  backup_path: string | null;
  backup_interval: number;
}

const DEFAULTS: Config = {
  date_format: "mdy",
  first_day_of_week: "monday",
  output_format: "text",
  next_month: "same_day",
  auto_update_check: true,
  telemetry: true,
  telemetry_notice_shown: false,
  backup_path: null,
  backup_interval: 60,
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
  if (process.env.ORU_CONFIG_DIR) {
    return path.join(process.env.ORU_CONFIG_DIR, "config.toml");
  }
  return path.join(os.homedir(), ".oru", "config.toml");
}

export const DEFAULT_CONFIG_TOML = `# oru configuration
# Docs: https://github.com/tchayen/oru#configuration

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

# Send anonymous usage data to improve oru
# Set to false to disable (or set DO_NOT_TRACK=1)
telemetry = true

# Auto-backup: copy the database to this directory on each CLI run
# (at most once per backup_interval minutes). Disabled by default.
# backup_path = "~/Dropbox/oru-backup"

# Minimum minutes between auto-backups (default: 60)
# backup_interval = 60
`;

export function loadConfig(configPath?: string): Config {
  const resolved = configPath ?? getConfigPath();

  if (!fs.existsSync(resolved)) {
    return { ...DEFAULTS };
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  let parsed;
  try {
    parsed = parse(raw);
  } catch (err) {
    process.stderr.write(
      `Warning: Could not parse config file at ${resolved}: ${err instanceof Error ? err.message : String(err)}. Using defaults.\n`,
    );
    return { ...DEFAULTS };
  }
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

  if (typeof parsed.telemetry === "boolean") {
    config.telemetry = parsed.telemetry;
  }

  if (typeof parsed.telemetry_notice_shown === "boolean") {
    config.telemetry_notice_shown = parsed.telemetry_notice_shown;
  }

  if (typeof parsed.backup_path === "string" && parsed.backup_path.length > 0) {
    config.backup_path = parsed.backup_path;
  }

  if (typeof parsed.backup_interval === "number" && parsed.backup_interval > 0) {
    config.backup_interval = parsed.backup_interval;
  }

  return config;
}

export function setConfigValue(key: string, value: string): void {
  const configPath = getConfigPath();
  let content = "";
  if (fs.existsSync(configPath)) {
    content = fs.readFileSync(configPath, "utf-8");
  }
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escapedKey}\\s*=\\s*.*`, "m");
  if (pattern.test(content)) {
    content = content.replace(pattern, `${key} = ${value}`);
  } else {
    content = `${content.trimEnd()}\n${key} = ${value}\n`;
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, content);
}
