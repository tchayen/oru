# Changelog

## 0.1.0

First public release.

### CLI

- Task management: add, list, get, update, delete with prefix-matched IDs
- Status shortcuts: `done`, `start`, `review`
- Priorities: low, medium, high, urgent
- Due dates with natural language parsing (today, tomorrow, next friday, march 20, in 3 days)
- Labels, notes, blockers, owner assignment, key-value metadata
- `context` command: shows overdue, due soon, in progress, actionable, blocked, recently completed
- `edit` command: opens task in $EDITOR with TOML frontmatter
- Interactive `log` command: view oplog history for a task
- Shell completions for bash, zsh, and fish
- JSON output on all commands (`--json` flag or `output_format = "json"` in config)
- Configuration via `~/.oru/config.toml`
- Auto-backup support
- Self-update mechanism
- Anonymous telemetry with easy opt-out (`oru telemetry disable` or `DO_NOT_TRACK=1`)

### Sync

- Offline-first sync via oplog with last-write-wins conflict resolution
- Filesystem remote backend for syncing across devices (e.g. via Dropbox, iCloud Drive)
- Sequence-based cursoring to avoid same-millisecond bugs

### MCP

- MCP server (`oru-mcp`) for AI agent integration
- 8 tools: add_task, update_task, delete_task, list_tasks, get_task, get_context, add_note, list_labels
