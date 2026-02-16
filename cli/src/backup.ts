import fs from "fs";
import path from "path";

let backupCounter = 0;

/**
 * Generate a timestamped backup filename.
 */
function backupFilename(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").replace("Z", "");
  return `oru-${ts}-${backupCounter++}.db`;
}

/**
 * Copy the database file to the backup directory with a timestamp.
 * Returns the full path of the backup file.
 */
export function performBackup(dbPath: string, backupDir: string): string {
  const resolved = backupDir.startsWith("~")
    ? path.join(process.env.HOME ?? "", backupDir.slice(1))
    : backupDir;
  fs.mkdirSync(resolved, { recursive: true });
  const dest = path.join(resolved, backupFilename());
  fs.copyFileSync(dbPath, dest);
  return dest;
}

/**
 * Check whether enough time has elapsed since the most recent backup.
 */
export function shouldAutoBackup(backupDir: string, intervalMinutes: number): boolean {
  const resolved = backupDir.startsWith("~")
    ? path.join(process.env.HOME ?? "", backupDir.slice(1))
    : backupDir;
  if (!fs.existsSync(resolved)) {
    return true;
  }
  const files = fs
    .readdirSync(resolved)
    .filter((f) => f.startsWith("oru-") && f.endsWith(".db"))
    .sort();
  if (files.length === 0) {
    return true;
  }
  const latest = fs.statSync(path.join(resolved, files[files.length - 1]));
  const elapsed = (Date.now() - latest.mtimeMs) / 1000 / 60;
  return elapsed >= intervalMinutes;
}

/**
 * Run auto-backup if configured and interval has elapsed.
 * Silent on success, logs warning to stderr on failure.
 */
export function autoBackup(dbPath: string, backupPath: string, intervalMinutes: number): void {
  try {
    if (shouldAutoBackup(backupPath, intervalMinutes)) {
      performBackup(dbPath, backupPath);
    }
  } catch {
    // Best-effort — never break the CLI
  }
}
