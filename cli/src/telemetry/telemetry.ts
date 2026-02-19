import type { Config } from "../config/config";
import { setConfigValue } from "../config/config";
import { SHOW_SERVER } from "../flags";

import { VERSION } from "../version";

export interface TelemetryEvent {
  cli_version: string;
  command: string;
  flags: string[];
  os: string;
  arch: string;
  node_version: string;
  is_ci: boolean;
  duration_ms: number;
  exit_code: number;
}

const TELEMETRY_URL = "https://telemetry.oru.sh/v1/events";
const REQUEST_TIMEOUT_MS = 3000;

export function isTelemetryEnabled(config: Config): boolean {
  if (process.env.DO_NOT_TRACK === "1") {
    return false;
  }
  if (process.env.ORU_TELEMETRY_DISABLED === "1") {
    return false;
  }
  if (config.telemetry === false) {
    return false;
  }
  return true;
}

export function getTelemetryDisabledReason(config: Config): string | null {
  if (process.env.DO_NOT_TRACK === "1") {
    return "disabled (via DO_NOT_TRACK)";
  }
  if (process.env.ORU_TELEMETRY_DISABLED === "1") {
    return "disabled (via ORU_TELEMETRY_DISABLED)";
  }
  if (config.telemetry === false) {
    return "disabled (via config)";
  }
  return null;
}

const CI_ENV_VARS = [
  "CI",
  "GITHUB_ACTIONS",
  "GITLAB_CI",
  "CIRCLECI",
  "TRAVIS",
  "JENKINS_URL",
  "BUILDKITE",
  "TF_BUILD",
];

export function detectCI(): boolean {
  return CI_ENV_VARS.some((v) => process.env[v]);
}

export function extractCommandAndFlags(argv: string[]): { command: string; flags: string[] } {
  // argv = [node, script, ...args]
  const args = argv.slice(2);
  const flags: string[] = [];
  let command = "";
  let foundCommand = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("-")) {
      // Extract flag name, strip value
      const flag = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
      flags.push(flag);
      // If next arg doesn't start with -, it's a value - skip it
      if (!arg.includes("=") && i + 1 < args.length && !args[i + 1].startsWith("-")) {
        i++;
      }
    } else if (!foundCommand) {
      command = arg;
      foundCommand = true;
    } else if (foundCommand && !command.includes(" ") && isSubcommand(command, arg)) {
      // Handle subcommands like "telemetry status", "config init"
      command = `${command} ${arg}`;
    }
  }

  return { command: command || "(unknown)", flags };
}

function isSubcommand(parent: string, arg: string): boolean {
  const subcommands: Record<string, string[]> = {
    config: ["init", "path"],
    completions: ["bash", "zsh", "fish"],
    telemetry: ["status", "enable", "disable"],
    ...(SHOW_SERVER ? { server: ["start"] } : {}),
  };
  return subcommands[parent]?.includes(arg) ?? false;
}

export function sendEvent(event: TelemetryEvent): void {
  const url = process.env.ORU_TELEMETRY_URL ?? TELEMETRY_URL;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: controller.signal,
    })
      .catch((err) => {
        if (process.env.ORU_DEBUG === "1") {
          console.error("Telemetry send failed:", err);
        }
      })
      .finally(() => clearTimeout(timer));
  } catch (err) {
    if (process.env.ORU_DEBUG === "1") {
      console.error("Telemetry send failed:", err);
    }
  }
}

export function showFirstRunNotice(config: Config): void {
  try {
    if (config.telemetry_notice_shown) {
      return;
    }
    if (process.stderr.isTTY) {
      process.stderr.write(
        "\noru collects anonymous usage data to improve the tool.\nTo disable: oru telemetry disable (or set DO_NOT_TRACK=1)\n\n",
      );
    }
    setConfigValue("telemetry_notice_shown", "true");
  } catch (err) {
    if (process.env.ORU_DEBUG === "1") {
      console.error("Telemetry notice failed:", err);
    }
  }
}

export function buildEvent(
  command: string,
  flags: string[],
  durationMs: number,
  exitCode: number,
): TelemetryEvent {
  return {
    cli_version: VERSION,
    command,
    flags,
    os: process.platform,
    arch: process.arch,
    node_version: process.version,
    is_ci: detectCI(),
    duration_ms: durationMs,
    exit_code: exitCode,
  };
}
