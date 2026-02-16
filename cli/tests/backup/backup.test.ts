import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { performBackup, shouldAutoBackup } from "../../src/backup.js";

describe("performBackup", () => {
  let tmpDir: string;
  let dbPath: string;
  let backupDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-backup-test-"));
    dbPath = path.join(tmpDir, "oru.db");
    backupDir = path.join(tmpDir, "backups");
    fs.writeFileSync(dbPath, "sqlite-data");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("copies the database to the backup directory", () => {
    const dest = performBackup(dbPath, backupDir);
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, "utf-8")).toBe("sqlite-data");
  });

  it("creates the backup directory if it does not exist", () => {
    expect(fs.existsSync(backupDir)).toBe(false);
    performBackup(dbPath, backupDir);
    expect(fs.existsSync(backupDir)).toBe(true);
  });

  it("uses a timestamped filename", () => {
    const dest = performBackup(dbPath, backupDir);
    const filename = path.basename(dest);
    expect(filename).toMatch(/^oru-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}-\d+\.db$/);
  });

  it("creates unique filenames on successive calls", () => {
    const dest1 = performBackup(dbPath, backupDir);
    const dest2 = performBackup(dbPath, backupDir);
    expect(dest1).not.toBe(dest2);
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
    // File was just created so mtime is now — well within 60 minutes
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
