import { createHash } from "crypto";
import { base62Encode } from "../id.js";

const NAMESPACE = "oru-recurrence";

/** Generate a deterministic 11-character base62 child task ID from a parent task ID. */
export function spawnId(parentId: string): string {
  const hash = createHash("sha256")
    .update(NAMESPACE + ":" + parentId)
    .digest();
  return base62Encode(hash.subarray(0, 8), 11);
}
