import { describe, it, expect } from "vitest";
import { formatTasksText, formatTaskText } from "../../src/format/text.js";
import { formatTasksJson, formatTaskJson } from "../../src/format/json.js";
import type { Task } from "../../src/tasks/types.js";

const sampleTask: Task = {
  id: "abc12345",
  title: "Buy milk",
  status: "todo",
  priority: "medium",
  labels: ["groceries"],
  notes: ["Get organic"],
  metadata: {},
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  deleted_at: null,
};

describe("text formatter", () => {
  it("formats a single task", () => {
    const output = formatTaskText(sampleTask);
    expect(output).toContain("abc12345");
    expect(output).toContain("Buy milk");
    expect(output).toContain("todo");
    expect(output).toContain("medium");
  });

  it("formats a list of tasks with header", () => {
    const output = formatTasksText([
      sampleTask,
      { ...sampleTask, id: "def45678", title: "Buy eggs" },
    ]);
    const lines = output.split("\n");
    expect(lines[0]).toContain("ID");
    expect(lines[0]).toContain("TITLE");
    expect(output).toContain("Buy milk");
    expect(output).toContain("Buy eggs");
  });

  it("shows checkbox [ ] for incomplete tasks", () => {
    const output = formatTasksText([sampleTask]);
    expect(output).toContain("[ ]");
  });

  it("shows checkbox [~] for in_progress tasks", () => {
    const output = formatTasksText([{ ...sampleTask, status: "in_progress" }]);
    expect(output).toContain("[~]");
  });

  it("shows checkbox [x] for done tasks", () => {
    const output = formatTasksText([{ ...sampleTask, status: "done" }]);
    expect(output).toContain("[x]");
  });

  it("shows labels in list output", () => {
    const output = formatTasksText([sampleTask]);
    expect(output).toContain("groceries");
  });

  it("shows empty state message for no tasks", () => {
    const output = formatTasksText([]);
    expect(output).toContain("No tasks");
  });

  it("shows labels when present", () => {
    const output = formatTaskText(sampleTask);
    expect(output).toContain("groceries");
  });

  it("shows notes when present", () => {
    const output = formatTaskText(sampleTask);
    expect(output).toContain("Get organic");
  });
});

describe("json formatter", () => {
  it("formats a single task as valid JSON", () => {
    const output = formatTaskJson(sampleTask);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe("abc12345");
    expect(parsed.title).toBe("Buy milk");
  });

  it("formats a list of tasks as valid JSON array", () => {
    const output = formatTasksJson([sampleTask]);
    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
  });

  it("formats empty list as empty JSON array", () => {
    const output = formatTasksJson([]);
    expect(JSON.parse(output)).toEqual([]);
  });
});
