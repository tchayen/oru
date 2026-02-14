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
    // initSchema runs appMigrations up to version 2, so start from 3
    const order: number[] = [];

    const migrations: Migration[] = [
      {
        version: 3,
        up: (d) => {
          order.push(3);
          d.exec("ALTER TABLE tasks ADD COLUMN foo TEXT");
        },
      },
      {
        version: 4,
        up: (d) => {
          order.push(4);
          d.exec("ALTER TABLE tasks ADD COLUMN bar TEXT");
        },
      },
    ];

    runMigrations(db, migrations);
    expect(order).toEqual([3, 4]);

    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
      value: string;
    };
    expect(row.value).toBe("4");
    db.close();
  });

  it("skips already-applied migrations", () => {
    const db = freshDb();
    const calls: number[] = [];

    const migrations: Migration[] = [
      {
        version: 3,
        up: (d) => {
          calls.push(3);
          d.exec("ALTER TABLE tasks ADD COLUMN foo TEXT");
        },
      },
      {
        version: 4,
        up: (d) => {
          calls.push(4);
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
    // After initSchema, version is 2

    const migrations: Migration[] = [
      {
        version: 3,
        up: (d) => {
          d.exec("ALTER TABLE tasks ADD COLUMN foo TEXT");
        },
      },
      {
        version: 4,
        up: () => {
          throw new Error("migration failed");
        },
      },
    ];

    expect(() => runMigrations(db, migrations)).toThrow("migration failed");

    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
      value: string;
    };
    expect(row.value).toBe("2");

    // foo column should not exist because rollback undid everything
    const cols = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    const colNames = cols.map((c) => c.name);
    expect(colNames).not.toContain("foo");
    db.close();
  });

  it("runs only migrations above current version", () => {
    const db = freshDb();
    // initSchema already set version to 2; set to 3 manually
    db.prepare("UPDATE meta SET value = '3' WHERE key = 'schema_version'").run();

    const calls: number[] = [];
    const migrations: Migration[] = [
      {
        version: 3,
        up: () => {
          calls.push(3);
        },
      },
      {
        version: 4,
        up: (d) => {
          calls.push(4);
          d.exec("ALTER TABLE tasks ADD COLUMN baz TEXT");
        },
      },
    ];

    runMigrations(db, migrations);
    expect(calls).toEqual([4]);
    db.close();
  });
});
