import type { OplogEntry } from "../oplog/types.js";

export interface PullResult {
  entries: OplogEntry[];
  cursor: string | null;
}

export interface RemoteBackend {
  push(entries: OplogEntry[]): Promise<void>;
  pull(cursor: string | null): Promise<PullResult>;
}
