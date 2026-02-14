import type Database from "better-sqlite3";

export interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

function getCurrentVersion(db: Database.Database): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  return row ? parseInt(row.value, 10) : 0;
}

export function runMigrations(db: Database.Database, migrations: Migration[]): number {
  const currentVersion = getCurrentVersion(db);
  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) return 0;

  const run = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db);
      db.prepare("UPDATE meta SET value = ? WHERE key = 'schema_version'").run(
        String(migration.version)
      );
    }
    return pending.length;
  });

  return run();
}
