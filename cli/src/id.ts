import { randomBytes } from "crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_SET = new Set(BASE62);
const ID_LENGTH = 11;

/** Encode bytes to a base62 string of fixed length. */
export function base62Encode(bytes: Uint8Array, length: number): string {
  let n = 0n;
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b);
  }
  const chars: string[] = [];
  for (let i = 0; i < length; i++) {
    chars.push(BASE62[Number(n % 62n)]);
    n /= 62n;
  }
  return chars.reverse().join("");
}

/** Validate that a string is a valid task ID (11-character base62). */
export function isValidId(s: string): boolean {
  if (s.length !== ID_LENGTH) {
    return false;
  }
  for (const c of s) {
    if (!BASE62_SET.has(c)) {
      return false;
    }
  }
  return true;
}

/** Random 11-character base62 ID for tasks and devices (64 bits of entropy). */
export function generateId(): string {
  return base62Encode(randomBytes(8), ID_LENGTH);
}
