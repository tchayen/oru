import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { FsRemote } from "../../src/sync/fs-remote";
import type { OplogEntry } from "../../src/oplog/types";

describe("FsRemote", () => {
  let tmpDir: string;
  let remote: FsRemote;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oru-sync-test-"));
    remote = new FsRemote(path.join(tmpDir, "remote-oplog.db"));
  });

  afterEach(() => {
    remote.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const makeEntry = (
    overrides: Partial<OplogEntry> & { id: string; task_id: string },
  ): OplogEntry => ({
    device_id: "device-a",
    op_type: "create",
    field: null,
    value: "{}",
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  it("push writes entries to remote", async () => {
    const entry = makeEntry({ id: "op-1", task_id: "t1" });
    await remote.push([entry]);
    const { entries } = await remote.pull(null);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("op-1");
  });

  it("pull reads entries from remote", async () => {
    await remote.push([
      makeEntry({ id: "op-1", task_id: "t1", timestamp: "2024-01-01T00:00:00.000Z" }),
      makeEntry({ id: "op-2", task_id: "t2", timestamp: "2024-01-01T00:01:00.000Z" }),
    ]);
    const { entries } = await remote.pull(null);
    expect(entries).toHaveLength(2);
  });

  it("pull respects cursor", async () => {
    await remote.push([
      makeEntry({ id: "op-1", task_id: "t1", timestamp: "2024-01-01T00:00:00.000Z" }),
    ]);
    const { cursor } = await remote.pull(null);

    await remote.push([
      makeEntry({ id: "op-2", task_id: "t2", timestamp: "2024-01-01T00:01:00.000Z" }),
    ]);
    const { entries } = await remote.pull(cursor);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("op-2");
  });

  it("returns cursor for pagination", async () => {
    await remote.push([makeEntry({ id: "op-1", task_id: "t1" })]);
    const result = await remote.pull(null);
    expect(result.cursor).toBeTruthy();
  });

  it("push is append-only (duplicate ids ignored)", async () => {
    const entry = makeEntry({ id: "op-1", task_id: "t1" });
    await remote.push([entry]);
    await remote.push([entry]);
    const { entries } = await remote.pull(null);
    expect(entries).toHaveLength(1);
  });
});
