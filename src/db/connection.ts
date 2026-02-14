import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";

export function getDbPath(): string {
  if (process.env.AO_DB_PATH) {
    return process.env.AO_DB_PATH;
  }
  return path.join(os.homedir(), ".ao", "ao.db");
}

export function openDb(dbPath?: string): Database.Database {
  const resolvedPath = dbPath ?? getDbPath();
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
