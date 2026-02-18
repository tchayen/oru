# AGENTS.md – Guide for AI Agents

oru is an agent-friendly task management CLI. It stores tasks in a local SQLite
database, works offline, and exposes every command as JSON. It also ships an MCP
server so agents can manage tasks through tool calls without shelling out.

## MCP setup

Add this to your MCP configuration (Claude Code, Claude Desktop, or any
MCP-compatible agent):

```json
{
  "mcpServers": {
    "oru": {
      "command": "npx",
      "args": ["-p", "@tchayen/oru@latest", "oru-mcp"]
    }
  }
}
```

If oru is installed globally (`npm install -g @tchayen/oru`), use
`"command": "oru-mcp"` instead.

## Available MCP tools

| Tool          | Description                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `add_task`    | Create a new task. Supports custom ID for idempotent creates.                                             |
| `update_task` | Update fields on an existing task. Can also append a note.                                                |
| `delete_task` | Delete a task by ID.                                                                                      |
| `list_tasks`  | List tasks with filters (status, priority, owner, label, search). Done tasks excluded by default.         |
| `get_task`    | Get a single task by ID or ID prefix.                                                                     |
| `get_context` | Summary of what needs attention: overdue, due soon, in progress, actionable, blocked, recently completed. |
| `add_note`    | Append a note to a task.                                                                                  |
| `list_labels` | List all labels currently in use.                                                                         |

## Task model

Each task has the following fields:

- **id** – UUIDv7, or supply your own for idempotent creates
- **title** – Short description of the work
- **status** – `todo`, `in_progress`, `in_review`, `done`
- **priority** – `low`, `medium`, `high`, `urgent`
- **owner** – Optional assignee
- **due_at** – Optional ISO 8601 due date
- **recurrence** – Optional RRULE string (e.g. `FREQ=DAILY`, `FREQ=WEEKLY;BYDAY=MO`). Prefix with `after:` for completion-based recurrence (next due computed from completion time). When a recurring task is marked done, the next occurrence is automatically spawned.
- **blocked_by** – Array of task IDs this task depends on
- **labels** – Array of string labels (e.g. `bug`, `feature`, `refactor`)
- **notes** – Append-only array of text notes
- **metadata** – Key-value object for machine-readable data

## Recommended workflows

### Starting a coding session

1. Call `get_context` to see overdue tasks, tasks due soon, and what is in
   progress or blocked.
2. Pick the highest-priority actionable task to work on.

### While working

- Call `update_task` to set status to `in_progress` when you start on a task.
- Use `add_note` to record decisions, findings, or blockers as you go.
- Call `add_task` for any new work discovered during implementation. Use
  `blocked_by` to link it to the current task if appropriate.

### Completing work

1. Call `update_task` to set status to `done`.
2. Use `add_note` to leave a brief summary of what was done.
3. Check `get_context` again – completing a task may unblock others.
4. If the task had `recurrence`, the next occurrence was automatically created
   with a new due date. Check the response or call `list_tasks` to see it.

### Task decomposition

- Break large tasks into subtasks linked with `blocked_by`.
- Use labels for categorization (`bug`, `feature`, `refactor`, `docs`).
- Store machine-readable context in `metadata` (PR numbers, file paths,
  relevant URLs).

## CLI fallback

When MCP is not available, use the CLI directly with `--json` for structured
output:

```bash
oru context --json                           # what needs attention
oru list --json                              # all active tasks
oru add "Fix bug" -p high -d tomorrow --json
oru update <id> -s done --json
oru done <id>                                # shorthand for marking done
oru add "Standup" -r weekly -d monday --json # recurring task
oru update <id> --repeat none --json         # remove recurrence
```

Set `ORU_FORMAT=json` or `output_format = "json"` in
`~/.config/oru/config.toml` to default to JSON output.

## Tips

- **Prefix matching**: IDs support prefix matching. The first 4-8 characters
  are usually enough to uniquely identify a task.
- **Idempotent creates**: Pass a custom `id` to `add_task` to safely retry
  without creating duplicates.
- **Metadata**: The `metadata` field is for agent-specific data. Store PR
  numbers, file paths, commit hashes, or any structured context you need.
- **Notes are safe to repeat**: Notes are append-only and deduplicated, so
  adding the same note twice is harmless.
- **Filtering**: `list_tasks` supports `actionable: true` to get only tasks
  that are not blocked and not done – useful for finding the next thing to do.
- **Dependencies**: Use `blocked_by` to model task dependencies. A task whose
  blockers are all done becomes actionable.
- **Done tasks are hidden**: `list_tasks` and `list` exclude done tasks by
  default. Pass `status: "done"` or `-s done` to see them.
- **Recurring tasks**: Set `recurrence` to an RRULE string (e.g.
  `FREQ=DAILY`, `FREQ=WEEKLY;BYDAY=MO,WE,FR`). Prefix with `after:` for
  completion-based recurrence. When the task is marked done, the next
  occurrence is spawned automatically with a deterministic ID.
