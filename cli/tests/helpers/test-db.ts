import Database from "better-sqlite3";
import type { Kysely } from "kysely";
import { initSchema } from "../../src/db/schema";
import { createKysely } from "../../src/db/kysely";
import type { DB } from "../../src/db/kysely";

export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

export function createTestKysely(db: Database.Database): Kysely<DB> {
  return createKysely(db);
}
