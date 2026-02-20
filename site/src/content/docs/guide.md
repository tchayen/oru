---
title: Usage guide
description: Comprehensive guide to all oru commands and features.
---

# Usage Guide

Comprehensive guide to all oru commands and features.

## Task lifecycle

Every task moves through four statuses:

1. `todo` – not started (default)
2. `in_progress` – actively being worked on
3. `in_review` – waiting for review or feedback
4. `done` – completed

Use `oru start`, `oru review`, and `oru done` as shortcuts, or set the status explicitly with `oru update $ID -s $STATUS`.

## Adding tasks

```bash
oru add "Fix login bug"
oru add "Fix login bug" -p high -d friday
oru add "Write docs" -l docs -n "Include API section"
oru add "Deploy v2" -s todo -d 2026-03-01 --assign alice
```

Options:

| Flag                     | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `-s, --status`           | Initial status (default: `todo`)                                |
| `-p, --priority`         | Priority: `low`, `medium`, `high`, `urgent` (default: `medium`) |
| `-d, --due`              | Due date (natural language or ISO date)                         |
| `--assign`               | Assign to an owner                                              |
| `-l, --label`            | Add one or more labels                                          |
| `-b, --blocked-by`       | IDs of blocking tasks                                           |
| `-n, --note`             | Add an initial note                                             |
| `-r, --repeat`           | Recurrence rule (e.g. `daily`, `every monday`)                  |
| `--meta`                 | Metadata key=value pairs                                        |
| `--id`                   | Provide a task ID (for idempotent creates)                      |
| `--json` / `--plaintext` | Override output format                                          |

## Listing tasks

```bash
oru list
oru list -s in_progress -p high
oru list -l backend --sort due --actionable
oru list --search "login" --all
```

By default, `list` hides tasks with status `done`. Add `--all` to include them.

### Filtering

| Flag             | Description                                       |
| ---------------- | ------------------------------------------------- |
| `-s, --status`   | Filter by status (comma-separated for multiple)   |
| `-p, --priority` | Filter by priority (comma-separated for multiple) |
| `-l, --label`    | Filter by label                                   |
| `--owner`        | Filter by owner                                   |
| `--due`          | Filter by due date: `today` or `this-week`        |
| `--overdue`      | Show only overdue tasks                           |
| `--search`       | Search by title text                              |
| `--actionable`   | Show only tasks with no incomplete blockers       |

### Sorting

Use `--sort` to change the order. Default is `priority`. Available fields: `priority`, `due`, `title`, `created`.

### Pagination

Use `--limit` and `--offset` for paginated results.

## Getting a single task

```bash
oru get hJ7kMp3nQrs
oru get hJ7kMp3nQrs --json
```

You can use a full ID or a unique prefix. If the prefix is ambiguous (matches multiple tasks), oru will tell you and list the matches.

## Updating tasks

```bash
oru update hJ7kMp3nQrs -s in_progress
oru update hJ7kMp3nQrs -l urgent -d tomorrow
oru update hJ7kMp3nQrs -n "Blocked on API review"
oru update hJ7kMp3nQrs -t "New title" -p high
```

Labels are additive by default. Use `--unlabel` to remove a label:

```bash copy
oru update hJ7kMp3nQrs --unlabel wontfix
```

Clear the due date or owner by passing `none`:

```bash
oru update hJ7kMp3nQrs -d none
oru update hJ7kMp3nQrs --assign none
```

## Editing in $EDITOR

For complex edits, open a task in your editor:

```bash
oru edit hJ7kMp3nQrs
EDITOR=nano oru edit hJ7kMp3nQrs
```

The file is a TOML block delimited by `+++`, followed by a notes section:

```toml
+++
title = "Fix login bug"
status = "todo"
priority = "high"
blocked_by = []
labels = []
+++

# Notes
# Add new notes below. Delete lines to remove notes.

- Reproduced on staging
```

## Status shortcuts

Quick commands to change task status. Accept one or more IDs:

```bash
oru start hJ7kMp3nQrs       # -> in_progress
oru review hJ7kMp3nQrs      # -> in_review
oru done hJ7kMp3nQrs wX2y   # -> done (multiple)
```

## Labels

Labels are freeform strings. Add them when creating or updating tasks:

```bash
oru add "Fix bug" -l bug frontend
oru list -l bug
oru labels
```

The `labels` command lists all labels currently in use across your tasks.

## Notes

Notes are append-only comments on a task. Add a note with `-n` on `add` or `update`:

```bash copy
oru update hJ7kMp3nQrs -n "Discussed in standup, moving to next sprint"
```

Clear all notes with `--clear-notes`. You can combine `--clear-notes` with `-n` to replace all notes with a single new one.

## Due dates

oru supports natural language date parsing. Input is case-insensitive.

```bash
oru add "Ship feature" -d tomorrow
oru add "Sprint review" -d Friday
oru add "Quarterly report" -d 2026-03-01
oru add "Standup" -d "tod 10a"
oru add "Call" -d "in 3 days"
oru add "Deadline" -d "end of month"
```

| Format      | Examples                                                 | Notes                              |
| ----------- | -------------------------------------------------------- | ---------------------------------- |
| Shortcuts   | `today`, `tod`, `tomorrow`, `tom`, `tonight`             | `tonight` sets time to 18:00       |
| Day names   | `monday`, `mon`, `Friday`, `next tue`                    | Always advances to next occurrence |
| Week/month  | `next week`, `end of week`, `next month`, `end of month` | Calendar-relative                  |
| Relative    | `in 3 days`, `in 2 weeks`, `in 1 month`                  | N days/weeks/months from today     |
| Month + day | `march 15`, `mar 15`, `15th march`                       | Rolls to next year if past         |
| ISO date    | `2026-03-01`, `2026-03-01T14:30`                         | Date or date+time                  |
| Slash date  | `03/15`, `03/15/2026`                                    | MM/DD or DD/MM based on config     |
| Time suffix | `tod 10a`, `Monday 2pm`, `fri 9:30am`                    | Append time to any date            |

## Recurring tasks

Create tasks that auto-spawn the next occurrence when completed:

```bash
oru add "Water plants" -r "every 3 days" -d today
oru add "Weekly review" -r "every monday" -d "next monday"
oru add "Monthly report" -r "every month" -d "end of month"
```

Supported patterns:

| Pattern     | Examples                                   |
| ----------- | ------------------------------------------ |
| Daily       | `daily`, `every day`, `every 2 days`       |
| Weekly      | `weekly`, `every week`, `every 2 weeks`    |
| Day of week | `every monday`, `every mon,wed,fri`        |
| Monthly     | `monthly`, `every month`, `every 2 months` |

When you mark a recurring task as `done`, oru automatically creates the next occurrence with the same title, priority, labels, and recurrence rule.

### Removing recurrence

Use `--repeat none` on `update` to stop a task from recurring. The current task remains; it just won't spawn a new occurrence when completed.

```bash copy
oru update 019414a3 -r none
```

## Blocked-by dependencies

Tasks can be blocked by other tasks:

```bash
oru add "Deploy" -b abc123 def456
oru update xyz789 -b abc123
oru update xyz789 --unblock abc123
```

Use `--actionable` to filter to tasks with no incomplete blockers:

```bash
oru list --actionable
```

## Context

Get a summary of what needs your attention:

```bash
oru context
oru context --json
```

Returns:

- Overdue tasks
- Tasks due today
- Tasks due this week
- Tasks currently in progress
- Actionable tasks (not blocked)

## Change history

View the change history of a task:

```bash copy
oru log hJ7kMp3nQrs
```

```bash
oru log hJ7kMp3nQrs --json
```

## Deleting tasks

```bash
oru delete hJ7kMp3nQrs
oru delete hJ7kMp3nQrs wX2yBv5uTzA  # multiple
```

Deleted tasks are removed from the database but the operation is logged in the oplog for sync purposes.

## Sync

Sync between machines via a shared filesystem (Dropbox, iCloud Drive, NAS):

```bash
oru sync ~/Dropbox/oru-sync
```

Conflict resolution is automatic: last-write-wins per field, updates beat deletes, notes append with dedup.

## Backup

Create manual backups:

```bash
oru backup              # to default location
```

```bash copy
oru backup ~/backups/
```

Or configure automatic backups in `~/.oru/config.toml`:

```toml
backup_path = "~/Dropbox/oru-backups"
backup_interval = 60  # minutes between auto-backups
```

## Self-update

Update oru to the latest version:

```bash
oru self-update
```
