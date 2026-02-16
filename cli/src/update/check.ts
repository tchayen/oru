import fs from "fs";
import path from "path";
import os from "os";
import type { Config } from "../config/config.js";

declare const __VERSION__: string;

interface UpdateState {
  lastChecked: number;
  latestVersion: string;
}

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REQUEST_TIMEOUT_MS = 3000;

function getStatePath(): string {
  const oruDir = process.env.ORU_INSTALL_DIR ?? path.join(os.homedir(), ".oru");
  return path.join(oruDir, ".update-state.json");
}

function readState(): UpdateState | null {
  try {
    const raw = fs.readFileSync(getStatePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeState(state: UpdateState): void {
  const statePath = getStatePath();
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state));
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) {
      return va - vb;
    }
  }
  return 0;
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch("https://registry.npmjs.org/oru-cli/latest", {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export async function checkForUpdate(config: Config): Promise<string | null> {
  if (!config.auto_update_check) {
    return null;
  }
  if (process.env.ORU_NO_UPDATE_CHECK === "1") {
    return null;
  }
  if (!process.stderr.isTTY) {
    return null;
  }

  const state = readState();
  const now = Date.now();

  if (state && now - state.lastChecked < CHECK_INTERVAL_MS) {
    // Use cached result
    if (compareVersions(state.latestVersion, __VERSION__) > 0) {
      return state.latestVersion;
    }
    return null;
  }

  const latest = await fetchLatestVersion();
  if (!latest) {
    return null;
  }

  writeState({ lastChecked: now, latestVersion: latest });

  if (compareVersions(latest, __VERSION__) > 0) {
    return latest;
  }
  return null;
}

export function printUpdateNotice(latestVersion: string): void {
  process.stderr.write(
    `\nUpdate available: ${__VERSION__} → ${latestVersion}\nRun \`oru self-update\` to upgrade.\n`,
  );
}
