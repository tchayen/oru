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
}

const DEFAULTS: Config = {
  date_format: "mdy",
  first_day_of_week: "monday",
  output_format: "text",
  next_month: "same_day",
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
  if (process.env.AO_CONFIG_PATH) {
    return process.env.AO_CONFIG_PATH;
  }
  return path.join(os.homedir(), ".ao", "config.toml");
}

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

  return config;
}
