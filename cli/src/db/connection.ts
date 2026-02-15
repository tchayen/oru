import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

export function getDbPath(): string {
  if (process.env.ORU_DB_PATH) {
    return process.env.ORU_DB_PATH;
  }
  return path.join(os.homedir(), ".oru", "oru.db");
}

export function openDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? getDbPath();
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Restrict DB file permissions to owner-only
  try {
    fs.chmodSync(resolvedPath, 0o600);
  } catch {
    // May fail on some platforms; best-effort
  }

  return db;
}
