import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { stringify, parse } from "smol-toml";
import {
  STATUSES,
  PRIORITIES,
  type Task,
  type UpdateTaskInput,
  type Status,
  type Priority,
} from "./tasks/types.js";

const VALID_STATUSES = new Set<string>(STATUSES);
const VALID_PRIORITIES = new Set<string>(PRIORITIES);

export function serializeTask(task: Task): string {
  const frontmatter: Record<string, unknown> = {
    title: task.title,
    status: task.status,
    priority: task.priority,
  };

  if (task.due_at) {
    frontmatter.due = task.due_at;
  }

  frontmatter.blocked_by = task.blocked_by;
  frontmatter.labels = task.labels;

  if (Object.keys(task.metadata).length > 0) {
    frontmatter.metadata = task.metadata;
  }

  let doc = "+++\n";
  doc += stringify(frontmatter);
  doc += "\n+++\n";
  doc += "\n# Notes\n";
  doc += "# Add new notes below. Delete lines to remove notes.\n";

  if (task.notes.length > 0) {
    doc += "\n";
    for (const note of task.notes) {
      doc += `- ${note}\n`;
    }
  }

  return doc;
}

export function parseDocument(
  content: string,
  existing: Task,
): { fields: UpdateTaskInput; newNotes: string[]; removedNotes: boolean } {
  const match = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+/);
  if (!match) {
    throw new Error("Invalid document format: missing +++ delimiters");
  }

  const tomlBlock = match[1];
  const parsed = parse(tomlBlock);

  const fields: UpdateTaskInput = {};

  // Title
  if (typeof parsed.title === "string" && parsed.title !== existing.title) {
    fields.title = parsed.title;
  }

  // Status
  if (typeof parsed.status === "string" && parsed.status !== existing.status) {
    if (!VALID_STATUSES.has(parsed.status)) {
      throw new Error(`Invalid status: ${parsed.status}`);
    }
    fields.status = parsed.status as Status;
  }

  // Priority
  if (typeof parsed.priority === "string" && parsed.priority !== existing.priority) {
    if (!VALID_PRIORITIES.has(parsed.priority)) {
      throw new Error(`Invalid priority: ${parsed.priority}`);
    }
    fields.priority = parsed.priority as Priority;
  }

  // Due date
  const parsedDue = parsed.due;
  if (parsedDue === undefined || parsedDue === "") {
    // Due line removed or emptied — clear it if it was previously set
    if (existing.due_at !== null) {
      fields.due_at = null;
    }
  } else if (typeof parsedDue === "string" && parsedDue !== existing.due_at) {
    fields.due_at = parsedDue;
  }

  // Blocked by
  if (Array.isArray(parsed.blocked_by)) {
    const newBlockedBy = parsed.blocked_by.filter((b): b is string => typeof b === "string");
    const changed =
      newBlockedBy.length !== existing.blocked_by.length ||
      newBlockedBy.some((b, i) => b !== existing.blocked_by[i]);
    if (changed) {
      fields.blocked_by = newBlockedBy;
    }
  }

  // Labels
  if (Array.isArray(parsed.labels)) {
    const newLabels = parsed.labels.filter((l): l is string => typeof l === "string");
    const changed =
      newLabels.length !== existing.labels.length ||
      newLabels.some((l, i) => l !== existing.labels[i]);
    if (changed) {
      fields.labels = newLabels;
    }
  }

  // Metadata
  if (parsed.metadata && typeof parsed.metadata === "object" && !Array.isArray(parsed.metadata)) {
    const newMeta = parsed.metadata as Record<string, unknown>;
    const existingMeta = existing.metadata;
    const metaChanged = JSON.stringify(newMeta) !== JSON.stringify(existingMeta);
    if (metaChanged) {
      fields.metadata = newMeta;
    }
  } else if (!parsed.metadata && Object.keys(existing.metadata).length > 0) {
    fields.metadata = {};
  }

  // Notes — find lines after the +++ block that start with "- "
  const afterFrontmatter = content.slice(match[0].length);
  const noteLines = afterFrontmatter
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));

  const existingSet = new Set(existing.notes);
  const newNotes = noteLines.filter((note) => !existingSet.has(note));

  const noteLineSet = new Set(noteLines);
  const removedNotes = existing.notes.some((note) => !noteLineSet.has(note));

  return { fields, newNotes, removedNotes };
}

export async function openInEditor(content: string): Promise<string> {
  const tmpFile = path.join(os.tmpdir(), `ao-edit-${Date.now()}.toml`);
  fs.writeFileSync(tmpFile, content);

  const editor = process.env.EDITOR || "vi";
  const args = editor.split(/\s+/);
  const bin = args.shift()!;
  args.push(tmpFile);

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(bin, args, { stdio: "inherit" });
      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Editor exited with code ${code}`));
        }
      });
      child.on("error", reject);
    });
    return fs.readFileSync(tmpFile, "utf-8");
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore cleanup errors
    }
  }
}
