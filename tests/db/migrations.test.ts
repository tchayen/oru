import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../../src/db/schema.js";
import { runMigrations, type Migration } from "../../src/db/migrations.js";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  initSchema(db);
  return db;
}

describe("migrations", () => {
  it("runs pending migrations in order", () => {
    const db = freshDb();
    const order: number[] = [];

    const migrations: Migration[] = [
      { version: 2, up: (d) => { order.push(2); d.exec("ALTER TABLE tasks ADD COLUMN foo TEXT"); } },
      { version: 3, up: (d) => { order.push(3); d.exec("ALTER TABLE tasks ADD COLUMN bar TEXT"); } },
    ];

    runMigrations(db, migrations);
    expect(order).toEqual([2, 3]);

    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string };
    expect(row.value).toBe("3");
    db.close();
  });

  it("skips already-applied migrations", () => {
    const db = freshDb();
    const calls: number[] = [];

    const migrations: Migration[] = [
      { version: 2, up: (d) => { calls.push(2); d.exec("ALTER TABLE tasks ADD COLUMN foo TEXT"); } },
      { version: 3, up: (d) => { calls.push(3); d.exec("ALTER TABLE tasks ADD COLUMN bar TEXT"); } },
    ];

    runMigrations(db, migrations);
    calls.length = 0;
    runMigrations(db, migrations);

    expect(calls).toEqual([]);
    db.close();
  });

  it("no-ops when already at latest version", () => {
    const db = freshDb();
    const result = runMigrations(db, []);
    expect(result).toBe(0);
    db.close();
  });

  it("rolls back on failure and preserves previous version", () => {
    const db = freshDb();

    const migrations: Migration[] = [
      { version: 2, up: (d) => { d.exec("ALTER TABLE tasks ADD COLUMN foo TEXT"); } },
      { version: 3, up: () => { throw new Error("migration failed"); } },
    ];

    expect(() => runMigrations(db, migrations)).toThrow("migration failed");

    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value: string };
    expect(row.value).toBe("1");

    // foo column should not exist because rollback undid everything
    const cols = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    const colNames = cols.map((c) => c.name);
    expect(colNames).not.toContain("foo");
    db.close();
  });

  it("runs only migrations above current version", () => {
    const db = freshDb();
    // Manually set version to 2
    db.prepare("UPDATE meta SET value = '2' WHERE key = 'schema_version'").run();

    const calls: number[] = [];
    const migrations: Migration[] = [
      { version: 2, up: () => { calls.push(2); } },
      { version: 3, up: (d) => { calls.push(3); d.exec("ALTER TABLE tasks ADD COLUMN baz TEXT"); } },
    ];

    runMigrations(db, migrations);
    expect(calls).toEqual([3]);
    db.close();
  });
});
