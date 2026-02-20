import type { Priority, Status } from "./api";
import { STATUSES } from "@oru/types";

export { STATUSES };

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const STATUS_LABELS: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const NEXT_STATUS: Record<Status, Status> = {
  todo: "in_progress",
  in_progress: "in_review",
  in_review: "done",
  done: "todo",
};
