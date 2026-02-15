import { describe, it, expect } from "vitest";
import { generateBashCompletions } from "../../src/completions/bash.js";
import { generateZshCompletions } from "../../src/completions/zsh.js";
import { generateFishCompletions } from "../../src/completions/fish.js";

describe("bash completions script", () => {
  const script = generateBashCompletions();

  it("contains command names", () => {
    expect(script).toContain("add");
    expect(script).toContain("list");
    expect(script).toContain("labels");
    expect(script).toContain("get");
    expect(script).toContain("update");
    expect(script).toContain("delete");
    expect(script).toContain("sync");
    expect(script).toContain("config");
    expect(script).toContain("server");
    expect(script).toContain("completions");
  });

  it("contains log command", () => {
    expect(script).toContain("log");
  });

  it("contains --unlabel completion", () => {
    expect(script).toContain("--unlabel");
  });

  it("contains --limit and --offset for list", () => {
    expect(script).toContain("--limit");
    expect(script).toContain("--offset");
  });

  it("contains status values", () => {
    expect(script).toContain("todo");
    expect(script).toContain("in_progress");
    expect(script).toContain("in_review");
    expect(script).toContain("done");
  });

  it("contains priority values", () => {
    expect(script).toContain("low");
    expect(script).toContain("medium");
    expect(script).toContain("high");
    expect(script).toContain("urgent");
  });

  it("contains review command", () => {
    expect(script).toContain("review");
  });

  it("calls ao _complete for dynamic values", () => {
    expect(script).toContain("ao _complete tasks");
    expect(script).toContain("ao _complete labels");
  });

  it("contains --assign completion for add and update", () => {
    expect(script).toContain("--assign");
  });

  it("contains --owner completion for list", () => {
    expect(script).toContain("--owner");
  });

  it("contains --sort completion with values", () => {
    expect(script).toContain("--sort");
    expect(script).toContain("sort_values");
  });

  it("contains --actionable for list", () => {
    expect(script).toContain("--actionable");
  });

  it("registers the completion function", () => {
    expect(script).toContain("complete -F");
  });
});

describe("zsh completions script", () => {
  const script = generateZshCompletions();

  it("contains compdef directive", () => {
    expect(script).toContain("compdef");
  });

  it("contains command names with descriptions", () => {
    expect(script).toContain("add:Add a new task");
    expect(script).toContain("list:List tasks");
    expect(script).toContain("labels:List all labels in use");
    expect(script).toContain("get:Get a task by ID");
  });

  it("contains log command with description", () => {
    expect(script).toContain("log:Show change history of a task");
  });

  it("contains --unlabel completion", () => {
    expect(script).toContain("--unlabel");
  });

  it("contains --clear-notes completion", () => {
    expect(script).toContain("--clear-notes");
  });

  it("contains --limit and --offset for list", () => {
    expect(script).toContain("--limit");
    expect(script).toContain("--offset");
  });

  it("contains status and priority values", () => {
    expect(script).toContain("todo");
    expect(script).toContain("in_progress");
    expect(script).toContain("in_review");
    expect(script).toContain("low");
    expect(script).toContain("urgent");
  });

  it("contains review command", () => {
    expect(script).toContain("review");
  });

  it("calls ao _complete for dynamic values", () => {
    expect(script).toContain("ao _complete tasks");
    expect(script).toContain("ao _complete labels");
  });

  it("uses _describe for task completions", () => {
    expect(script).toContain("_describe");
  });

  it("uses _files for sync path completion", () => {
    expect(script).toContain("_files");
  });

  it("contains --assign completion", () => {
    expect(script).toContain("--assign");
  });

  it("contains --owner completion for list", () => {
    expect(script).toContain("--owner");
  });

  it("contains --sort completion with values", () => {
    expect(script).toContain("--sort");
    expect(script).toContain("sort_values");
  });

  it("contains --actionable for list", () => {
    expect(script).toContain("--actionable");
  });
});

describe("fish completions script", () => {
  const script = generateFishCompletions();

  it("uses complete -c ao", () => {
    expect(script).toContain("complete -c ao");
  });

  it("contains command names", () => {
    expect(script).toContain("add");
    expect(script).toContain("list");
    expect(script).toContain("labels");
    expect(script).toContain("get");
    expect(script).toContain("update");
    expect(script).toContain("delete");
    expect(script).toContain("sync");
    expect(script).toContain("config");
    expect(script).toContain("server");
    expect(script).toContain("completions");
  });

  it("contains log command", () => {
    expect(script).toContain("log");
  });

  it("contains --unlabel completion", () => {
    expect(script).toContain("unlabel");
  });

  it("contains --clear-notes completion", () => {
    expect(script).toContain("clear-notes");
  });

  it("contains --limit and --offset for list", () => {
    expect(script).toContain("limit");
    expect(script).toContain("offset");
  });

  it("contains status and priority values", () => {
    expect(script).toContain("todo in_progress in_review done");
    expect(script).toContain("low medium high urgent");
  });

  it("contains review command", () => {
    expect(script).toContain("review");
  });

  it("defines helper functions for dynamic completions", () => {
    expect(script).toContain("__ao_task_ids");
    expect(script).toContain("__ao_labels");
    expect(script).toContain("ao _complete tasks");
    expect(script).toContain("ao _complete labels");
  });

  it("uses -F for sync file completion", () => {
    expect(script).toContain("-F");
  });

  it("contains --assign completion", () => {
    expect(script).toContain("assign");
  });

  it("contains --owner completion for list", () => {
    expect(script).toContain("owner");
  });

  it("contains --sort completion with values", () => {
    expect(script).toContain("-l sort");
    expect(script).toContain("priority due title created");
  });

  it("contains --actionable for list", () => {
    expect(script).toContain("actionable");
  });
});
