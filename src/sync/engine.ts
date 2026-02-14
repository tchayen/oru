import type Database from "better-sqlite3";
import type { RemoteBackend } from "./remote.js";
import type { OplogEntry } from "../oplog/types.js";
import { replayOps } from "../oplog/replay.js";

export class SyncEngine {
  constructor(
    private db: Database.Database,
    private remote: RemoteBackend,
    private deviceId: string,
  ) {}

  async push(): Promise<number> {
    // Get the last pushed rowid for this device
    const hwmRow = this.db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(`push_rowid_${this.deviceId}`) as { value: string } | undefined;
    const lastRowid = hwmRow ? parseInt(hwmRow.value, 10) : 0;

    // Get local ops from this device since the last pushed rowid
    const ops = this.db
      .prepare("SELECT rowid, * FROM oplog WHERE device_id = ? AND rowid > ? ORDER BY rowid ASC")
      .all(this.deviceId, lastRowid) as (OplogEntry & { rowid: number })[];

    if (ops.length === 0) return 0;

    const maxRowid = ops[ops.length - 1].rowid;
    const entries: OplogEntry[] = ops.map(({ rowid: _r, ...rest }) => rest);

    await this.remote.push(entries);

    // Update push high-water mark
    this.db
      .prepare(
        `INSERT INTO meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(`push_rowid_${this.deviceId}`, String(maxRowid));

    return entries.length;
  }

  async pull(): Promise<number> {
    // Get the pull cursor (stored locally)
    const cursorRow = this.db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(`pull_cursor_${this.deviceId}`) as { value: string } | undefined;
    const cursor = cursorRow?.value ?? null;

    // Pull remote ops since the cursor
    const result = await this.remote.pull(cursor);

    if (result.entries.length === 0) return 0;

    // Replay ALL ops (including our own) — replayOps is idempotent and
    // rebuilds tasks from the full oplog, ensuring the tasks table is
    // consistent even if local writeOp didn't update it directly.
    replayOps(this.db, result.entries);

    // Update pull cursor
    if (result.cursor) {
      this.db
        .prepare(
          `INSERT INTO meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run(`pull_cursor_${this.deviceId}`, result.cursor);
    }

    const newOps = result.entries.filter((op) => op.device_id !== this.deviceId);
    return newOps.length;
  }

  async sync(): Promise<{ pushed: number; pulled: number }> {
    const pushed = await this.push();
    const pulled = await this.pull();
    return { pushed, pulled };
  }
}
