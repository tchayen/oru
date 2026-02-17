import type { Priority, Status } from "./api";

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const STATUSES: Status[] = ["todo", "in_progress", "in_review", "done"];

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
