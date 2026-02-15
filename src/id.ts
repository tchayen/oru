import { v7 as uuidv7 } from "uuid";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 8);

/** Short random ID for tasks and devices. */
export function generateId(): string {
  return nanoid();
}

/** Time-sortable ID for oplog entries (sync cursoring relies on ordering). */
export function generateSortableId(): string {
  return uuidv7();
}
