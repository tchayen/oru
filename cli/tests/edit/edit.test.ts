import { describe, it, expect } from "vitest";
import { serializeTask, parseDocument } from "../../src/edit.js";
import type { Task } from "../../src/tasks/types.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "test-id-123",
    title: "Buy groceries",
    status: "todo",
    priority: "medium",
    due_at: null,
    blocked_by: [],
    labels: [],
    notes: [],
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("serializeTask", () => {
  it("serializes a basic task", () => {
    const task = makeTask();
    const doc = serializeTask(task);
    expect(doc).toContain("+++");
    expect(doc).toContain('title = "Buy groceries"');
    expect(doc).toContain('status = "todo"');
    expect(doc).toContain('priority = "medium"');
    expect(doc).toContain("# Notes");
  });

  it("includes due date when set", () => {
    const task = makeTask({ due_at: "2026-03-15T00:00:00" });
    const doc = serializeTask(task);
    expect(doc).toContain('due = "2026-03-15T00:00:00"');
  });

  it("omits due field when null", () => {
    const task = makeTask({ due_at: null });
    const doc = serializeTask(task);
    expect(doc).not.toContain("due");
  });

  it("includes labels", () => {
    const task = makeTask({ labels: ["shopping", "errands"] });
    const doc = serializeTask(task);
    expect(doc).toContain("shopping");
    expect(doc).toContain("errands");
  });

  it("includes notes as list items", () => {
    const task = makeTask({ notes: ["Pick up milk", "Check for sales"] });
    const doc = serializeTask(task);
    expect(doc).toContain("- Pick up milk");
    expect(doc).toContain("- Check for sales");
  });

  it("includes metadata section", () => {
    const task = makeTask({ metadata: { store: "Whole Foods" } });
    const doc = serializeTask(task);
    expect(doc).toContain("[metadata]");
    expect(doc).toContain('store = "Whole Foods"');
  });

  it("omits metadata section when empty", () => {
    const task = makeTask({ metadata: {} });
    const doc = serializeTask(task);
    expect(doc).not.toContain("[metadata]");
  });
});

describe("parseDocument", () => {
  it("roundtrip produces no changes", () => {
    const task = makeTask({ labels: ["work"], notes: ["existing note"] });
    const doc = serializeTask(task);
    const { fields, newNotes } = parseDocument(doc, task);
    expect(Object.keys(fields)).toHaveLength(0);
    expect(newNotes).toHaveLength(0);
  });

  it("roundtrip with due date produces no changes", () => {
    const task = makeTask({ due_at: "2026-03-15T00:00:00", labels: ["a"] });
    const doc = serializeTask(task);
    const { fields, newNotes } = parseDocument(doc, task);
    expect(Object.keys(fields)).toHaveLength(0);
    expect(newNotes).toHaveLength(0);
  });

  it("roundtrip with metadata produces no changes", () => {
    const task = makeTask({ metadata: { sprint: "5" } });
    const doc = serializeTask(task);
    const { fields, newNotes } = parseDocument(doc, task);
    expect(Object.keys(fields)).toHaveLength(0);
    expect(newNotes).toHaveLength(0);
  });

  it("detects title change", () => {
    const task = makeTask();
    const doc = serializeTask(task).replace('title = "Buy groceries"', 'title = "Buy vegetables"');
    const { fields } = parseDocument(doc, task);
    expect(fields.title).toBe("Buy vegetables");
  });

  it("detects status change", () => {
    const task = makeTask();
    const doc = serializeTask(task).replace('status = "todo"', 'status = "in_progress"');
    const { fields } = parseDocument(doc, task);
    expect(fields.status).toBe("in_progress");
  });

  it("detects priority change", () => {
    const task = makeTask();
    const doc = serializeTask(task).replace('priority = "medium"', 'priority = "high"');
    const { fields } = parseDocument(doc, task);
    expect(fields.priority).toBe("high");
  });

  it("rejects invalid status", () => {
    const task = makeTask();
    const doc = serializeTask(task).replace('status = "todo"', 'status = "invalid"');
    expect(() => parseDocument(doc, task)).toThrow("Invalid status");
  });

  it("rejects invalid priority", () => {
    const task = makeTask();
    const doc = serializeTask(task).replace('priority = "medium"', 'priority = "critical"');
    expect(() => parseDocument(doc, task)).toThrow("Invalid priority");
  });

  it("detects new note", () => {
    const task = makeTask();
    const doc = serializeTask(task) + "- A new note\n";
    const { newNotes } = parseDocument(doc, task);
    expect(newNotes).toEqual(["A new note"]);
  });

  it("does not re-add existing notes", () => {
    const task = makeTask({ notes: ["existing note"] });
    const doc = serializeTask(task);
    const { newNotes } = parseDocument(doc, task);
    expect(newNotes).toHaveLength(0);
  });

  it("detects multiple new notes while preserving existing", () => {
    const task = makeTask({ notes: ["old note"] });
    const doc = serializeTask(task) + "- new note 1\n- new note 2\n";
    const { newNotes } = parseDocument(doc, task);
    expect(newNotes).toEqual(["new note 1", "new note 2"]);
  });

  it("detects label change", () => {
    const task = makeTask({ labels: ["shopping"] });
    const doc = serializeTask(task).replace(
      'labels = [ "shopping" ]',
      'labels = [ "errands", "home" ]',
    );
    const { fields } = parseDocument(doc, task);
    expect(fields.labels).toEqual(["errands", "home"]);
  });

  it("detects clearing all labels", () => {
    const task = makeTask({ labels: ["shopping"] });
    const doc = serializeTask(task).replace('labels = [ "shopping" ]', "labels = []");
    const { fields } = parseDocument(doc, task);
    expect(fields.labels).toEqual([]);
  });

  it("detects due date removal (clears to null)", () => {
    const task = makeTask({ due_at: "2026-03-15T00:00:00" });
    const doc = serializeTask(task).replace('due = "2026-03-15T00:00:00"\n', "");
    const { fields } = parseDocument(doc, task);
    expect(fields.due_at).toBeNull();
  });

  it("detects due date change", () => {
    const task = makeTask({ due_at: "2026-03-15T00:00:00" });
    const doc = serializeTask(task).replace("2026-03-15T00:00:00", "2026-04-01T00:00:00");
    const { fields } = parseDocument(doc, task);
    expect(fields.due_at).toBe("2026-04-01T00:00:00");
  });

  it("detects metadata change", () => {
    const task = makeTask({ metadata: { store: "Whole Foods" } });
    const doc = serializeTask(task).replace("Whole Foods", "Trader Joes");
    const { fields } = parseDocument(doc, task);
    expect(fields.metadata).toEqual({ store: "Trader Joes" });
  });

  it("detects metadata removal", () => {
    const task = makeTask({ metadata: { store: "Whole Foods" } });
    const doc = serializeTask(task)
      .replace("[metadata]\n", "")
      .replace('store = "Whole Foods"\n', "");
    const { fields } = parseDocument(doc, task);
    expect(fields.metadata).toEqual({});
  });

  it("empty notes section produces no new notes", () => {
    const task = makeTask();
    const doc = serializeTask(task);
    const { newNotes, removedNotes } = parseDocument(doc, task);
    expect(newNotes).toHaveLength(0);
    expect(removedNotes).toBe(false);
  });

  it("detects removed notes when a note line is deleted", () => {
    const task = makeTask({ notes: ["Note A", "Note B"] });
    const doc = serializeTask(task).replace("- Note A\n", "");
    const { newNotes, removedNotes } = parseDocument(doc, task);
    expect(removedNotes).toBe(true);
    expect(newNotes).toHaveLength(0);
  });

  it("detects all notes removed", () => {
    const task = makeTask({ notes: ["Note A", "Note B"] });
    const doc = serializeTask(task).replace("- Note A\n", "").replace("- Note B\n", "");
    const { newNotes, removedNotes } = parseDocument(doc, task);
    expect(removedNotes).toBe(true);
    expect(newNotes).toHaveLength(0);
  });

  it("removedNotes is false when notes unchanged", () => {
    const task = makeTask({ notes: ["existing note"] });
    const doc = serializeTask(task);
    const { removedNotes } = parseDocument(doc, task);
    expect(removedNotes).toBe(false);
  });

  it("throws on invalid document format", () => {
    const task = makeTask();
    expect(() => parseDocument("no delimiters here", task)).toThrow("missing +++ delimiters");
  });

  it("roundtrip with blocked_by produces no changes", () => {
    const task = makeTask({ blocked_by: ["dep-1", "dep-2"] });
    const doc = serializeTask(task);
    const { fields, newNotes } = parseDocument(doc, task);
    expect(Object.keys(fields)).toHaveLength(0);
    expect(newNotes).toHaveLength(0);
  });

  it("detects blocked_by change", () => {
    const task = makeTask({ blocked_by: ["dep-1"] });
    const doc = serializeTask(task).replace(
      'blocked_by = [ "dep-1" ]',
      'blocked_by = [ "dep-2", "dep-3" ]',
    );
    const { fields } = parseDocument(doc, task);
    expect(fields.blocked_by).toEqual(["dep-2", "dep-3"]);
  });

  it("detects clearing blocked_by", () => {
    const task = makeTask({ blocked_by: ["dep-1"] });
    const doc = serializeTask(task).replace('blocked_by = [ "dep-1" ]', "blocked_by = []");
    const { fields } = parseDocument(doc, task);
    expect(fields.blocked_by).toEqual([]);
  });

  it("handles multiple field changes at once", () => {
    const task = makeTask();
    let doc = serializeTask(task);
    doc = doc.replace('title = "Buy groceries"', 'title = "Buy vegetables"');
    doc = doc.replace('status = "todo"', 'status = "done"');
    doc = doc.replace('priority = "medium"', 'priority = "high"');
    const { fields } = parseDocument(doc, task);
    expect(fields.title).toBe("Buy vegetables");
    expect(fields.status).toBe("done");
    expect(fields.priority).toBe("high");
  });
});
