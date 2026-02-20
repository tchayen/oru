import { describe, it, expect } from "vitest";
import { generateBashCompletions } from "../../src/completions/bash";
import { generateZshCompletions } from "../../src/completions/zsh";
import { generateFishCompletions } from "../../src/completions/fish";

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
    expect(script).toContain("completions");
  });

  it("hides server command when SHOW_SERVER is false", () => {
    expect(script).not.toContain("server");
  });

  it("contains log command", () => {
    expect(script).toContain("log");
  });

  it("contains self-update command", () => {
    expect(script).toContain("self-update");
  });

  it("contains edit command", () => {
    expect(script).toContain("edit");
  });

  it("contains --unlabel completion", () => {
    expect(script).toContain("--unlabel");
  });

  it("contains --unblock completion", () => {
    expect(script).toContain("--unblock");
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

  it("contains context command", () => {
    expect(script).toContain("context");
  });

  it("contains --label flag for context command", () => {
    expect(script).toContain("--label");
  });

  it("calls oru _complete for dynamic values", () => {
    expect(script).toContain("oru _complete tasks");
    expect(script).toContain("oru _complete labels");
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

  it("contains telemetry command", () => {
    expect(script).toContain("telemetry");
    expect(script).toContain("telemetry_subcommands");
  });

  it("contains backup command", () => {
    expect(script).toContain("backup");
  });

  it("registers the completion function", () => {
    expect(script).toContain("complete -F");
  });

  it("contains filter command", () => {
    expect(script).toContain("filter");
  });

  it("contains --filter flag for list", () => {
    expect(script).toContain("--filter");
  });

  it("edit and update are separate completion cases (not merged)", () => {
    expect(script).not.toContain("update|edit)");
  });

  it("edit case does not offer --status flag", () => {
    // Split on 'edit)' to isolate the edit case block
    const editBlock = script.split("edit)")[1]?.split(";;")[0] ?? "";
    expect(editBlock).not.toContain("--status");
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

  it("contains self-update command", () => {
    expect(script).toContain("self-update");
  });

  it("contains --unlabel completion", () => {
    expect(script).toContain("--unlabel");
  });

  it("contains --unblock completion", () => {
    expect(script).toContain("--unblock");
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

  it("contains context command", () => {
    expect(script).toContain("context:Show a summary of what needs your attention");
  });

  it("contains --label flag for context command", () => {
    expect(script).toContain("--label");
  });

  it("calls oru _complete for dynamic values", () => {
    expect(script).toContain("oru _complete tasks");
    expect(script).toContain("oru _complete labels");
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

  it("contains telemetry command", () => {
    expect(script).toContain("telemetry:Manage anonymous usage telemetry");
  });

  it("contains backup command", () => {
    expect(script).toContain("backup:Create a database backup snapshot");
  });

  it("contains edit command", () => {
    expect(script).toContain("edit");
  });

  it("contains --due and --overdue for list", () => {
    expect(script).toContain("--due");
    expect(script).toContain("--overdue");
  });

  it("contains --blocked-by for add and update", () => {
    expect(script).toContain("--blocked-by");
  });

  it("contains filter command", () => {
    expect(script).toContain("filter:Manage saved list filters");
  });

  it("contains --filter flag for list", () => {
    expect(script).toContain("--filter");
  });

  it("edit block does not include --status or --priority", () => {
    const editBlock = script.split("edit)")[1]?.split(";;")[0] ?? "";
    expect(editBlock).not.toContain("--status");
    expect(editBlock).not.toContain("--priority");
  });
});

describe("fish completions script", () => {
  const script = generateFishCompletions();

  it("uses complete -c oru", () => {
    expect(script).toContain("complete -c oru");
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
    expect(script).toContain("completions");
  });

  it("hides server command when SHOW_SERVER is false", () => {
    expect(script).not.toContain("server");
  });

  it("contains log command", () => {
    expect(script).toContain("log");
  });

  it("contains self-update command", () => {
    expect(script).toContain("self-update");
  });

  it("contains --unlabel completion", () => {
    expect(script).toContain("unlabel");
  });

  it("contains --unblock completion", () => {
    expect(script).toContain("unblock");
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

  it("contains context command", () => {
    expect(script).toContain("context");
  });

  it("contains label flag for context command", () => {
    expect(script).toContain("label");
  });

  it("defines helper functions for dynamic completions", () => {
    expect(script).toContain("__oru_task_ids");
    expect(script).toContain("__oru_labels");
    expect(script).toContain("oru _complete tasks");
    expect(script).toContain("oru _complete labels");
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

  it("contains telemetry command with subcommands", () => {
    expect(script).toContain("telemetry");
    expect(script).toContain("'__oru_using_command telemetry'");
  });

  it("contains backup command", () => {
    expect(script).toContain("backup");
  });

  it("contains edit command", () => {
    expect(script).toContain("edit");
  });

  it("contains --due and --overdue for list", () => {
    expect(script).toContain("-l due");
    expect(script).toContain("-l overdue");
  });

  it("contains --blocked-by for add and update", () => {
    expect(script).toContain("blocked-by");
  });

  it("contains filter command", () => {
    expect(script).toContain("filter");
  });

  it("contains --filter flag for list", () => {
    expect(script).toContain("-l filter");
  });

  it("does not add status completion for edit command", () => {
    expect(script).not.toContain("'__oru_using_command edit' -s s -l status");
  });

  it("does not add priority completion for edit command", () => {
    expect(script).not.toContain("'__oru_using_command edit' -s p -l priority");
  });

  it("does not add label or unlabel completion for edit command", () => {
    expect(script).not.toContain("'__oru_using_command edit' -s l -l label");
    expect(script).not.toContain("'__oru_using_command edit' -l unlabel");
  });
});
