# Changelog

## 0.0.1

Initial release.

### CLI

- Task fields: title, status (`todo`/`in_progress`/`in_review`/`done`), priority (`low`/`medium`/`high`/`urgent`), owner, due date, labels, blocking dependencies, notes, metadata
- Natural language due dates (`tomorrow`, `friday`, `in 3 days`, `end of week`)
- Recurring tasks with RRULE support (`-r "every monday"`, `-r "every 3 days"`)
- List filtering by status, priority, label, owner, due date, overdue, actionable
- Saved named filters (`oru filter add`)
- `--json` flag on all commands
- Idempotent task creation with `--id`
- Task editing in `$EDITOR` (`oru edit`)
- Change history per task (`oru log`)
- Shell completions for bash, zsh, fish
- Config file (`~/.oru/config.toml`) for date format, output format, backup settings
- Database backup snapshots (`oru backup`)
- Self-update (`oru self-update`)

### MCP server

Started via `oru mcp` subcommand (stdio transport). Exposes 8 tools: `add_task`, `update_task`, `delete_task`, `list_tasks`, `get_task`, `get_context`, `add_note`, `list_labels`.
