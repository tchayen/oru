import { describe, it, expect } from "vitest";
import { formatTasksText, formatTaskText, filterByDue } from "../../src/format/text.js";
import { formatTasksJson, formatTaskJson } from "../../src/format/json.js";
import type { Task } from "../../src/tasks/types.js";

const sampleTask: Task = {
  id: "abc12345",
  title: "Buy milk",
  status: "todo",
  priority: "medium",
  blocked_by: [],
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

  it("shows checkbox [r] for in_review tasks", () => {
    const output = formatTasksText([{ ...sampleTask, status: "in_review" }]);
    expect(output).toContain("[r]");
  });

  it("shows checkbox [x] for done tasks", () => {
    const output = formatTasksText([{ ...sampleTask, status: "done" }]);
    expect(output).toContain("[x]");
  });

  it("shows labels in list output", () => {
    const output = formatTasksText([sampleTask]);
    expect(output).toContain("groceries");
  });

  it("dynamically sizes ID column for long IDs", () => {
    const longId = "custom-id-123";
    const tasks = [
      { ...sampleTask, id: longId, title: "First" },
      { ...sampleTask, id: "short", title: "Second" },
    ];
    const output = formatTasksText(tasks);
    const lines = output.split("\n");
    // Header ID column should be as wide as the longest ID
    expect(lines[0]).toContain("ID".padEnd(longId.length));
    // The short ID row should be padded to match
    expect(lines[2]).toContain("short".padEnd(longId.length));
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

  it("shows metadata in single task view", () => {
    const task: Task = { ...sampleTask, metadata: { env: "prod", region: "us-east" } };
    const output = formatTaskText(task);
    expect(output).toContain("Metadata:");
    expect(output).toContain("env:");
    expect(output).toContain("prod");
    expect(output).toContain("region:");
    expect(output).toContain("us-east");
  });

  it("hides metadata section when metadata is empty", () => {
    const output = formatTaskText(sampleTask);
    expect(output).not.toContain("Metadata:");
  });

  it("shows metadata column in list view", () => {
    const output = formatTasksText([{ ...sampleTask, metadata: { sprint: "5" } }]);
    expect(output).toContain("META");
    expect(output).toContain("sprint=5");
  });

  it("shows empty metadata column when no metadata", () => {
    const output = formatTasksText([sampleTask]);
    expect(output).toContain("META");
    expect(output).not.toContain("=");
  });
});

const sampleTaskNoDue: Task = { ...sampleTask, due_at: null };

describe("filterByDue", () => {
  // Wednesday 2026-02-18 at noon
  const now = new Date(2026, 1, 18, 12, 0, 0);

  const taskDueToday: Task = { ...sampleTaskNoDue, id: "today1", due_at: "2026-02-18T00:00:00" };
  const taskDueTomorrow: Task = {
    ...sampleTaskNoDue,
    id: "tomorrow1",
    due_at: "2026-02-19T00:00:00",
  };
  const taskOverdue: Task = { ...sampleTaskNoDue, id: "overdue1", due_at: "2026-02-15T00:00:00" };
  const taskNoDue: Task = { ...sampleTaskNoDue, id: "nodue1", due_at: null };
  const taskThisWeekFri: Task = {
    ...sampleTaskNoDue,
    id: "fri1",
    due_at: "2026-02-20T00:00:00",
  };
  const taskNextWeek: Task = {
    ...sampleTaskNoDue,
    id: "nextweek1",
    due_at: "2026-02-25T00:00:00",
  };

  const allTasks = [
    taskDueToday,
    taskDueTomorrow,
    taskOverdue,
    taskNoDue,
    taskThisWeekFri,
    taskNextWeek,
  ];

  it("filters tasks due today", () => {
    const result = filterByDue(allTasks, "today", now);
    expect(result.map((t) => t.id)).toEqual(["today1"]);
  });

  it("filters tasks due this week (Mon-Sun)", () => {
    // Week of 2026-02-16 (Mon) to 2026-02-22 (Sun)
    const result = filterByDue(allTasks, "this-week", now);
    const ids = result.map((t) => t.id);
    expect(ids).toContain("today1");
    expect(ids).toContain("tomorrow1");
    expect(ids).toContain("fri1");
    expect(ids).not.toContain("overdue1"); // 2026-02-15 is Sunday of prev week
    expect(ids).not.toContain("nodue1");
    expect(ids).not.toContain("nextweek1");
  });

  it("filters overdue tasks", () => {
    const result = filterByDue(allTasks, "overdue", now);
    expect(result.map((t) => t.id)).toEqual(["overdue1"]);
  });

  it("excludes tasks with no due date from all filters", () => {
    const noDueTasks = [taskNoDue];
    expect(filterByDue(noDueTasks, "today", now)).toEqual([]);
    expect(filterByDue(noDueTasks, "this-week", now)).toEqual([]);
    expect(filterByDue(noDueTasks, "overdue", now)).toEqual([]);
  });

  it("task due today at specific time is not overdue before that time", () => {
    const taskDueAt3pm: Task = { ...sampleTaskNoDue, id: "3pm", due_at: "2026-02-18T15:00:00" };
    const result = filterByDue([taskDueAt3pm], "overdue", now);
    expect(result).toEqual([]);
  });

  it("task due today at specific time is overdue after that time", () => {
    const taskDueAt10am: Task = { ...sampleTaskNoDue, id: "10am", due_at: "2026-02-18T10:00:00" };
    const result = filterByDue([taskDueAt10am], "overdue", now);
    expect(result.map((t) => t.id)).toEqual(["10am"]);
  });
});

describe("overdue highlighting", () => {
  it("highlights overdue due date in red in single task view", () => {
    process.env.FORCE_COLOR = "1";
    try {
      const overdue: Task = {
        ...sampleTask,
        due_at: "2020-01-01T00:00:00",
      };
      const output = formatTaskText(overdue);
      // Red ANSI: \x1b[31m
      expect(output).toContain("\x1b[31m2020-01-01\x1b[39m");
    } finally {
      delete process.env.FORCE_COLOR;
    }
  });

  it("highlights overdue due date in red in list view", () => {
    process.env.FORCE_COLOR = "1";
    try {
      const overdue: Task = {
        ...sampleTask,
        due_at: "2020-01-01T00:00:00",
      };
      const output = formatTasksText([overdue]);
      expect(output).toContain("\x1b[31m2020-01-01\x1b[39m");
    } finally {
      delete process.env.FORCE_COLOR;
    }
  });

  it("overdue date ANSI codes do not inflate column width in list view", () => {
    process.env.FORCE_COLOR = "1";
    try {
      const overdue: Task = {
        ...sampleTask,
        due_at: "2020-01-01T00:00:00", // date-only (10 chars visual)
        labels: [],
      };
      const future: Task = {
        ...sampleTask,
        id: "def45678",
        title: "Future task",
        due_at: "2099-12-31T15:30:00", // datetime (16 chars visual) — forces dueW=16
        labels: [],
      };
      const output = formatTasksText([overdue, future]);
      const lines = output.split("\n");
      // The header line has the DUE column; check that both date rows
      // are aligned identically — the overdue red ANSI should NOT add extra padding
      // Strip ANSI codes to compare raw column positions
      // eslint-disable-next-line no-control-regex
      const stripAnsi = (s: string) => s.replace(/\u001b\[\d+(;\d+)*m/g, "");
      const overdueLine = stripAnsi(lines[1]);
      const futureLine = stripAnsi(lines[2]);
      const overduePos = overdueLine.indexOf("2020-01-01");
      const futurePos = futureLine.indexOf("2099-12-31");
      expect(overduePos).toBe(futurePos);
      // Also verify the TITLE columns are aligned (padding after DUE must match)
      const overdueTitlePos = overdueLine.indexOf("Buy milk");
      const futureTitlePos = futureLine.indexOf("Future task");
      expect(overdueTitlePos).toBe(futureTitlePos);
    } finally {
      delete process.env.FORCE_COLOR;
    }
  });

  it("does not highlight future due date in red", () => {
    process.env.FORCE_COLOR = "1";
    try {
      const future: Task = {
        ...sampleTask,
        due_at: "2099-12-31T00:00:00",
      };
      const output = formatTaskText(future);
      expect(output).not.toContain("\x1b[31m2099-12-31\x1b[39m");
      expect(output).toContain("2099-12-31");
    } finally {
      delete process.env.FORCE_COLOR;
    }
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
