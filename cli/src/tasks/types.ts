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
} from "../../../types/index";

import type { Status, Priority } from "../../../types/index";

export const DEFAULT_STATUS: Status = "todo";
export const DEFAULT_PRIORITY: Priority = "medium";
