import { v4 as uuidv4, v7 as uuidv7 } from "uuid";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_SET = new Set(BASE62);

/** Encode 16 bytes to a 22-character base62 string. */
export function base62Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b);
  }
  const chars: string[] = [];
  for (let i = 0; i < 22; i++) {
    chars.push(BASE62[Number(n % 62n)]);
    n /= 62n;
  }
  return chars.reverse().join("");
}

/** Validate that a string is a 22-character base62 ID. */
export function isValidId(s: string): boolean {
  if (s.length !== 22) {
    return false;
  }
  for (const c of s) {
    if (!BASE62_SET.has(c)) {
      return false;
    }
  }
  return true;
}

/** Random base62-encoded UUID v4 ID for tasks and devices. */
export function generateId(): string {
  const buf = new Uint8Array(16);
  uuidv4({}, buf);
  return base62Encode(buf);
}

/** Time-sortable ID for oplog entries (sync cursoring relies on ordering). */
export function generateSortableId(): string {
  return uuidv7();
}
