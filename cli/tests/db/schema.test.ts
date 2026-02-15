import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../../src/db/schema.js";

function freshDb(): Database.Database {
  return new Database(":memory:");
}

describe("schema", () => {
  it("creates tasks table", () => {
    const db = freshDb();
    initSchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
      .all();
    expect(tables).toHaveLength(1);
    db.close();
  });

  it("creates oplog table", () => {
    const db = freshDb();
    initSchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='oplog'")
      .all();
    expect(tables).toHaveLength(1);
    db.close();
  });

  it("creates meta table with schema_version after migrations", () => {
    const db = freshDb();
    initSchema(db);
    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
      | { value: string }
      | undefined;
    expect(row).toBeDefined();
    // Version 5 after all migrations run
    expect(row!.value).toBe("5");
    db.close();
  });

  it("is idempotent — calling twice does not error", () => {
    const db = freshDb();
    initSchema(db);
    expect(() => initSchema(db)).not.toThrow();
    db.close();
  });

  it("creates idx_oplog_task_timestamp index", () => {
    const db = freshDb();
    initSchema(db);
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_oplog_task_timestamp'",
      )
      .all();
    expect(indexes).toHaveLength(1);
    db.close();
  });
});
