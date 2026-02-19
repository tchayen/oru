import type Database from "better-sqlite3";
import type { RemoteBackend } from "./remote";
import type { OplogEntry } from "../oplog/types";
import { replayOps } from "../oplog/replay";

export const MAX_PULL_ITERATIONS = 1000;

export class SyncEngine {
  constructor(
    private db: Database.Database,
    private remote: RemoteBackend,
    private deviceId: string,
    private maxPullIterations = MAX_PULL_ITERATIONS,
  ) {}

  async push(): Promise<number> {
    // Get the last pushed rowid for this device (rowid is SQLite's built-in
    // monotonically increasing integer, no sortable ID format needed)
    const hwmRow = this.db
      .prepare("SELECT value FROM meta WHERE key = ?")
      .get(`push_hwm_${this.deviceId}`) as { value: string } | undefined;
    const lastRowId = hwmRow ? parseInt(hwmRow.value, 10) || 0 : 0;

    // Get local ops from this device since the last pushed rowid
    const ops = this.db
      .prepare("SELECT rowid, * FROM oplog WHERE device_id = ? AND rowid > ? ORDER BY rowid ASC")
      .all(this.deviceId, lastRowId) as (OplogEntry & { rowid: number })[];

    if (ops.length === 0) {
      return 0;
    }

    await this.remote.push(ops);

    // Update push high-water mark with the last pushed rowid
    const lastRowid = ops[ops.length - 1].rowid;
    this.db
      .prepare(
        `INSERT INTO meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(`push_hwm_${this.deviceId}`, String(lastRowid));

    return ops.length;
  }

  async pull(): Promise<number> {
    let totalNew = 0;
    let iterations = 0;

    // Loop until caught up (remote may return bounded pages)
    for (;;) {
      if (++iterations > this.maxPullIterations) {
        throw new Error(
          `Sync pull loop exceeded ${this.maxPullIterations} iterations - aborting to prevent infinite loop. This likely indicates a bug in the remote backend.`,
        );
      }

      // Get the pull cursor (stored locally)
      const cursorRow = this.db
        .prepare("SELECT value FROM meta WHERE key = ?")
        .get(`pull_cursor_${this.deviceId}`) as { value: string } | undefined;
      const cursor = cursorRow?.value ?? null;

      // Pull remote ops since the cursor
      const result = await this.remote.pull(cursor);

      if (result.entries.length === 0) {
        break;
      }

      // Replay ALL ops (including our own) - replayOps is idempotent and
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
      totalNew += newOps.length;

      // If cursor didn't advance, we're done
      if (result.cursor === cursor) {
        break;
      }
    }

    return totalNew;
  }

  async sync(): Promise<{ pushed: number; pulled: number }> {
    const pushed = await this.push();
    const pulled = await this.pull();
    return { pushed, pulled };
  }
}
