import { v5 as uuidv5 } from "uuid";

const ORU_RECURRENCE_NAMESPACE = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

/** Generate a deterministic child task ID from a parent task ID. */
export function spawnId(parentId: string): string {
  return uuidv5(parentId, ORU_RECURRENCE_NAMESPACE);
}
