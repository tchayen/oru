import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { openDb, getDbPath } from "../../src/db/connection";

describe("connection", () => {
  const tmpFiles: string[] = [];

  function tmpDbPath(): string {
    const p = path.join(
      os.tmpdir(),
      `oru-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
    tmpFiles.push(p);
    return p;
  }

  afterEach(() => {
    for (const f of tmpFiles) {
      try {
        fs.unlinkSync(f);
      } catch {}
      try {
        fs.unlinkSync(`${f}-wal`);
      } catch {}
      try {
        fs.unlinkSync(`${f}-shm`);
      } catch {}
    }
    tmpFiles.length = 0;
    delete process.env.ORU_DB_PATH;
  });

  it("creates a new database file", () => {
    const dbPath = tmpDbPath();
    const db = openDb(dbPath);
    expect(fs.existsSync(dbPath)).toBe(true);
    db.close();
  });

  it("reopens an existing database", () => {
    const dbPath = tmpDbPath();
    const db1 = openDb(dbPath);
    db1.exec("CREATE TABLE test (id TEXT)");
    db1.close();

    const db2 = openDb(dbPath);
    const tables = db2
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test'")
      .all();
    expect(tables).toHaveLength(1);
    db2.close();
  });

  it("respects ORU_DB_PATH env var", () => {
    const dbPath = tmpDbPath();
    process.env.ORU_DB_PATH = dbPath;
    expect(getDbPath()).toBe(dbPath);
  });

  it("defaults path to ~/.oru/oru.db", () => {
    delete process.env.ORU_DB_PATH;
    const expected = path.join(os.homedir(), ".oru", "oru.db");
    expect(getDbPath()).toBe(expected);
  });

  it("enables WAL mode", () => {
    const dbPath = tmpDbPath();
    const db = openDb(dbPath);
    const result = db.pragma("journal_mode") as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe("wal");
    db.close();
  });
});
