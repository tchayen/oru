import type { OplogEntry } from "../oplog/types";

export type PullResult = {
  entries: OplogEntry[];
  cursor: string | null;
};

export type RemoteBackend = {
  push(entries: OplogEntry[]): Promise<void>;
  pull(cursor: string | null): Promise<PullResult>;
};
