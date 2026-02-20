# Changelog

## 0.0.1

Initial release.

- Task management with priorities, due dates, labels, owners, blocking dependencies, notes, and metadata
- Recurring tasks with RRULE support (auto-spawn next occurrence on completion)
- Named filters for saved list queries
- Offline-first sync via oplog over shared filesystems (Dropbox, iCloud Drive, etc.)
- MCP server for AI agent integration
- Shell completions for bash, zsh, and fish
- `--json` flag on all commands for machine-readable output
- Idempotent task creation with `--id` for agents
- SQLite storage, no accounts, no cloud
