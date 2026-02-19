import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "../../src/db/schema";
import { runMigrations, type Migration } from "../../src/db/migrations";

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  initSchema(db);
  return db;
}

function currentVersion(db: Database.Database): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
    value: string;
  };
  return parseInt(row.value, 10);
}

describe("migrations", () => {
  it("runs pending migrations in order", () => {
    const db = freshDb();
    const base = currentVersion(db);
    const order: number[] = [];

    const migrations: Migration[] = [
      {
        version: base + 1,
        up: (d) => {
          order.push(base + 1);
          d.exec("ALTER TABLE tasks ADD COLUMN foo TEXT");
        },
      },
      {
        version: base + 2,
        up: (d) => {
          order.push(base + 2);
          d.exec("ALTER TABLE tasks ADD COLUMN bar TEXT");
        },
      },
    ];

    runMigrations(db, migrations);
    expect(order).toEqual([base + 1, base + 2]);
    expect(currentVersion(db)).toBe(base + 2);
    db.close();
  });

  it("skips already-applied migrations", () => {
    const db = freshDb();
    const base = currentVersion(db);
    const calls: number[] = [];

    const migrations: Migration[] = [
      {
        version: base + 1,
        up: (d) => {
          calls.push(base + 1);
          d.exec("ALTER TABLE tasks ADD COLUMN foo TEXT");
        },
      },
      {
        version: base + 2,
        up: (d) => {
          calls.push(base + 2);
          d.exec("ALTER TABLE tasks ADD COLUMN bar TEXT");
        },
      },
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
    const base = currentVersion(db);

    const migrations: Migration[] = [
      {
        version: base + 1,
        up: (d) => {
          d.exec("ALTER TABLE tasks ADD COLUMN foo TEXT");
        },
      },
      {
        version: base + 2,
        up: () => {
          throw new Error("migration failed");
        },
      },
    ];

    expect(() => runMigrations(db, migrations)).toThrow("migration failed");
    expect(currentVersion(db)).toBe(base);

    // foo column should not exist because rollback undid everything
    const cols = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    const colNames = cols.map((c) => c.name);
    expect(colNames).not.toContain("foo");
    db.close();
  });

  it("runs only migrations above current version", () => {
    const db = freshDb();
    const base = currentVersion(db);
    db.prepare("UPDATE meta SET value = ? WHERE key = 'schema_version'").run(String(base + 1));

    const calls: number[] = [];
    const migrations: Migration[] = [
      {
        version: base + 1,
        up: () => {
          calls.push(base + 1);
        },
      },
      {
        version: base + 2,
        up: (d) => {
          calls.push(base + 2);
          d.exec("ALTER TABLE tasks ADD COLUMN baz TEXT");
        },
      },
    ];

    runMigrations(db, migrations);
    expect(calls).toEqual([base + 2]);
    db.close();
  });
});
