import fs from "fs";
import path from "path";
import os from "node:os";
import type Database from "better-sqlite3";

/**
 * Generate a timestamped backup filename.
 */
function backupFilename(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, "-").replace("Z", "");
  return `oru-${ts}.db`;
}

/**
 * Create a consistent backup of the database using VACUUM INTO.
 * This is safe for WAL-mode databases – unlike fs.copyFileSync, it
 * produces a self-contained copy that includes any in-flight WAL data.
 * Returns the full path of the backup file.
 */
export function performBackup(db: Database.Database, backupDir: string): string {
  const resolved = backupDir.startsWith("~")
    ? path.join(os.homedir(), backupDir.slice(1))
    : backupDir;
  fs.mkdirSync(resolved, { recursive: true });
  const base = backupFilename();
  const stem = base.slice(0, -".db".length);
  let dest = path.join(resolved, base);
  let i = 1;
  while (fs.existsSync(dest)) {
    dest = path.join(resolved, `${stem}-${i}.db`);
    i++;
  }
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  return dest;
}

/**
 * Check whether enough time has elapsed since the most recent backup.
 */
export function shouldAutoBackup(backupDir: string, intervalMinutes: number): boolean {
  const resolved = backupDir.startsWith("~")
    ? path.join(os.homedir(), backupDir.slice(1))
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
export function autoBackup(
  db: Database.Database,
  backupPath: string,
  intervalMinutes: number,
): void {
  try {
    if (shouldAutoBackup(backupPath, intervalMinutes)) {
      performBackup(db, backupPath);
    }
  } catch (err) {
    if (process.env.ORU_DEBUG === "1") {
      console.error("Auto-backup failed:", err);
    }
  }
}
