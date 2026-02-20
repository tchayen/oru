export {
  STATUSES,
  type Status,
  VALID_STATUSES,
  PRIORITIES,
  type Priority,
  VALID_PRIORITIES,
  TASK_FIELDS,
  type TaskField,
  VALID_TASK_FIELDS,
  type Task,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "@oru/types";

import type { Status, Priority } from "@oru/types";

export const DEFAULT_STATUS: Status = "todo";
export const DEFAULT_PRIORITY: Priority = "medium";
