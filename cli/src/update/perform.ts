import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { compareVersions } from "./check";

declare const __VERSION__: string;

const REQUEST_TIMEOUT_MS = 10000;

interface InstallMeta {
  install_method: string;
  version: string;
  platform: string;
  installed_at: string;
}

function getInstallMetaPath(): string {
  const oruDir = process.env.ORU_INSTALL_DIR ?? path.join(os.homedir(), ".oru");
  return path.join(oruDir, ".install-meta");
}

function readInstallMeta(): InstallMeta | null {
  try {
    const raw = fs.readFileSync(getInstallMetaPath(), "utf-8");
    const meta: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const eqIdx = line.indexOf("=");
      if (eqIdx !== -1) {
        meta[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
      }
    }
    return meta as unknown as InstallMeta;
  } catch {
    return null;
  }
}

function detectInstallMethod(): "script" | "npm" {
  const meta = readInstallMeta();
  if (meta?.install_method === "script") {
    return "script";
  }
  return "npm";
}

async function fetchLatestVersion(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const res = await fetch("https://registry.npmjs.org/@tchayen/oru/latest", {
    signal: controller.signal,
  });
  clearTimeout(timer);
  if (!res.ok) {
    throw new Error(`Failed to fetch latest version: ${res.status}`);
  }
  const data = (await res.json()) as { version: string };
  return data.version;
}

function getPlatform(): string {
  const platform = process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return `${platform}-${arch}`;
}

async function updateViaNpm(): Promise<void> {
  process.stderr.write("Updating via npm...\n");
  execSync("npm install -g @tchayen/oru@latest", { stdio: "inherit" });
}

async function updateViaScript(version: string): Promise<void> {
  const oruDir = process.env.ORU_INSTALL_DIR ?? path.join(os.homedir(), ".oru");
  const binDir = path.join(oruDir, "bin");
  const platform = getPlatform();
  const url = `https://github.com/tchayen/oru/releases/download/v${version}/oru-v${version}-${platform}.tar.gz`;

  process.stderr.write(`Downloading oru v${version}...\n`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timer);

  if (!res.ok) {
    throw new Error(`Failed to download: ${res.status} from ${url}`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-update-"));
  const tarPath = path.join(tmpDir, "oru.tar.gz");

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tarPath, buffer);

  // Remove old bin directory (but not data files)
  if (fs.existsSync(binDir)) {
    fs.rmSync(binDir, { recursive: true });
  }
  fs.mkdirSync(binDir, { recursive: true });

  execSync(`tar -xzf "${tarPath}" -C "${binDir}"`, { stdio: "pipe" });
  fs.rmSync(tmpDir, { recursive: true });

  // Update install metadata
  const metaContent = `install_method=script\nversion=${version}\nplatform=${platform}\ninstalled_at=${new Date().toISOString()}\n`;
  fs.writeFileSync(getInstallMetaPath(), metaContent);

  process.stderr.write(`Updated to oru v${version}\n`);
}

export async function performUpdate(checkOnly: boolean): Promise<void> {
  const latest = await fetchLatestVersion();
  const current = __VERSION__;

  if (compareVersions(latest, current) <= 0) {
    process.stderr.write(`Already up to date (v${current})\n`);
    return;
  }

  process.stderr.write(`New version available: v${current} → v${latest}\n`);

  if (checkOnly) {
    return;
  }

  const method = detectInstallMethod();
  if (method === "script") {
    await updateViaScript(latest);
  } else {
    await updateViaNpm();
  }
}
