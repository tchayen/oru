import Database from "better-sqlite3";
import type { OplogEntry } from "../oplog/types.js";
import type { RemoteBackend, PullResult } from "./remote.js";

export class FsRemote implements RemoteBackend {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oplog (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT UNIQUE NOT NULL,
        task_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        op_type TEXT NOT NULL,
        field TEXT,
        value TEXT,
        timestamp TEXT NOT NULL
      );
    `);
  }

  async push(entries: OplogEntry[]): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT OR IGNORE INTO oplog (id, task_id, device_id, op_type, field, value, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertAll = this.db.transaction((entries: OplogEntry[]) => {
      for (const e of entries) {
        stmt.run(e.id, e.task_id, e.device_id, e.op_type, e.field, e.value, e.timestamp);
      }
    });
    insertAll(entries);
  }

  async pull(cursor: string | null): Promise<PullResult> {
    const parsed = cursor ? parseInt(cursor, 10) : 0;
    const seq = Number.isNaN(parsed) ? 0 : parsed;
    const rows = this.db
      .prepare(
        "SELECT seq, id, task_id, device_id, op_type, field, value, timestamp FROM oplog WHERE seq > ? ORDER BY seq ASC",
      )
      .all(seq) as (OplogEntry & { seq: number })[];

    if (rows.length === 0) {
      return { entries: [], cursor };
    }

    const lastSeq = rows[rows.length - 1].seq;
    const entries: OplogEntry[] = rows.map(({ seq: _seq, ...rest }) => rest);

    return { entries, cursor: String(lastSeq) };
  }

  close(): void {
    this.db.close();
  }
}
