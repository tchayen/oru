import Database from "better-sqlite3";
import { initSchema } from "../../src/db/schema.js";

export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}
