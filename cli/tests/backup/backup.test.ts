import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";
import { performBackup, shouldAutoBackup } from "../../src/backup";

describe("performBackup", () => {
  let tmpDir: string;
  let db: Database.Database;
  let backupDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-backup-test-"));
    const dbPath = path.join(tmpDir, "oru.db");
    backupDir = path.join(tmpDir, "backups");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)");
    db.exec("INSERT INTO test (value) VALUES ('hello')");
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("creates a valid SQLite backup via VACUUM INTO", () => {
    const dest = performBackup(db, backupDir);
    expect(fs.existsSync(dest)).toBe(true);
    // Open the backup and verify it contains the data
    const backupDb = new Database(dest, { readonly: true });
    const row = backupDb.prepare("SELECT value FROM test").get() as { value: string };
    expect(row.value).toBe("hello");
    backupDb.close();
  });

  it("creates the backup directory if it does not exist", () => {
    expect(fs.existsSync(backupDir)).toBe(false);
    performBackup(db, backupDir);
    expect(fs.existsSync(backupDir)).toBe(true);
  });

  it("uses a timestamped filename", () => {
    const dest = performBackup(db, backupDir);
    const filename = path.basename(dest);
    expect(filename).toMatch(/^oru-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}\.db$/);
  });

  it("creates unique filenames on successive calls", () => {
    const dest1 = performBackup(db, backupDir);
    const dest2 = performBackup(db, backupDir);
    expect(dest1).not.toBe(dest2);
  });

  it("captures uncommitted WAL data in the backup", () => {
    // Insert more data (WAL may not be checkpointed yet)
    db.exec("INSERT INTO test (value) VALUES ('world')");
    const dest = performBackup(db, backupDir);
    const backupDb = new Database(dest, { readonly: true });
    const rows = backupDb.prepare("SELECT value FROM test ORDER BY id").all() as {
      value: string;
    }[];
    expect(rows).toHaveLength(2);
    expect(rows[0].value).toBe("hello");
    expect(rows[1].value).toBe("world");
    backupDb.close();
  });
});

describe("shouldAutoBackup", () => {
  let tmpDir: string;
  let backupDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-backup-test-"));
    backupDir = path.join(tmpDir, "backups");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns true when backup directory does not exist", () => {
    expect(shouldAutoBackup(backupDir, 60)).toBe(true);
  });

  it("returns true when backup directory is empty", () => {
    fs.mkdirSync(backupDir, { recursive: true });
    expect(shouldAutoBackup(backupDir, 60)).toBe(true);
  });

  it("returns false when a recent backup exists", () => {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, "oru-2026-01-01T00-00-00-000.db"), "data");
    // File was just created so mtime is now - well within 60 minutes
    expect(shouldAutoBackup(backupDir, 60)).toBe(false);
  });

  it("returns true when interval has elapsed", () => {
    fs.mkdirSync(backupDir, { recursive: true });
    const oldFile = path.join(backupDir, "oru-2020-01-01T00-00-00-000.db");
    fs.writeFileSync(oldFile, "data");
    // Set mtime to 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(oldFile, twoHoursAgo, twoHoursAgo);
    expect(shouldAutoBackup(backupDir, 60)).toBe(true);
  });

  it("ignores non-oru files", () => {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, "other-file.txt"), "data");
    expect(shouldAutoBackup(backupDir, 60)).toBe(true);
  });
});
