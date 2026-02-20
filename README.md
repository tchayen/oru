```
 ██████╗ ██████╗ ██╗   ██╗
██╔═══██╗██╔══██╗██║   ██║
██║   ██║██████╔╝██║   ██║
██║   ██║██╔══██╗██║   ██║
╚██████╔╝██║  ██║╚██████╔╝
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝
```

Personal task manager for the terminal. Designed to be operated by your AI agent.

SQLite database on your machine. No accounts. No cloud. Pass `--json` to any command for machine-readable output.

## Install

```bash
curl -fsSL https://oru.sh/install.sh | bash
```

Requires Node 22+.

Or install via npm:

```bash
npm install -g @tchayen/oru
```

## Quick start

```bash
oru add "Write README for release"
oru add "Fix login bug" -p high -d friday -l backend
oru add "Water plants" -r "every 3 days" -d today
oru list
oru context                  # what needs your attention right now
oru done <id>                # recurring tasks auto-spawn the next occurrence
```

## Commands

| Command              | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `add <title>`        | Add a new task                                                  |
| `list`               | List tasks (hides done by default)                              |
| `get <id>`           | Get a task by ID                                                |
| `update <id>`        | Update a task                                                   |
| `edit <id>`          | Open task in `$EDITOR`                                          |
| `done <id...>`       | Mark tasks as done                                              |
| `start <id...>`      | Mark tasks as in_progress                                       |
| `review <id...>`     | Mark tasks as in_review                                         |
| `delete <id...>`     | Delete tasks                                                    |
| `context`            | Summary of overdue, due soon, in progress, and actionable tasks |
| `labels`             | List all labels in use                                          |
| `log <id>`           | Show change history of a task                                   |
| `filter add <name>`  | Save a named filter (same flags as `list`)                      |
| `filter list`        | List saved filters                                              |
| `filter show <name>` | Show a filter's definition                                      |
| `filter remove`      | Delete a saved filter                                           |
| `sync <path>`        | Sync with a filesystem remote                                   |
| `backup [path]`      | Create a database backup snapshot                               |
| `config init`        | Create a default config file                                    |
| `completions`        | Generate shell completions (bash, zsh, fish)                    |
| `self-update`        | Update oru to the latest version                                |

## Agent usage

oru is built to be operated by AI agents. Pass `--json` to any command for structured output. Pass `--id` to `add` for idempotent task creation. Attach `--meta key=value` pairs for agent-specific data.

```bash
# Agent creates a task with a known ID (idempotent)
oru add "Refactor auth module" --id A1b2C3d4E5f \
  -p high -l backend --meta agent=claude --json

# Agent reads what needs attention
oru context --json

# Agent updates a task (prefix match on IDs)
oru update A1b -s in_progress --meta pr=142 --json

# Create a recurring task (auto-spawns next occurrence when done)
oru add "Weekly standup" -r "every monday" -d "next monday" --json
```

Set `ORU_FORMAT=json` or `output_format = "json"` in config to default to JSON output.

## MCP server

oru ships with an [MCP](https://modelcontextprotocol.io/) server so AI agents can manage tasks through the standardized protocol.

### Claude Desktop / Claude Code

Add to your MCP config:

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

Or if oru is installed globally (`npm install -g @tchayen/oru`):

```json
{
  "mcpServers": {
    "oru": {
      "command": "oru-mcp"
    }
  }
}
```

### Available tools

| Tool          | Description                       |
| ------------- | --------------------------------- |
| `add_task`    | Create a new task                 |
| `update_task` | Update fields on an existing task |
| `delete_task` | Delete a task by ID               |
| `list_tasks`  | List tasks with optional filters  |
| `get_task`    | Get a single task by ID           |
| `get_context` | Summary of what needs attention   |
| `add_note`    | Append a note to a task           |
| `list_labels` | List all labels in use            |

## Configuration

```bash
oru config init # creates ~/.oru/config.toml with documented options
```

Key options:

- `date_format` - `"mdy"` (US) or `"dmy"` (international)
- `first_day_of_week` - `"monday"` or `"sunday"`
- `output_format` - `"text"` or `"json"`
- `backup_path` - directory for automatic backups
- `backup_interval` - minutes between auto-backups (default: 60)

## Sync

oru syncs between machines via a shared filesystem (Dropbox, iCloud Drive, NAS, etc.):

```bash
oru sync ~/Dropbox/oru-sync
```

Conflict resolution is automatic: last-write-wins per field, updates beat deletes, notes append with dedup. The oplog is the source of truth.

## Data

Everything is stored locally in `~/.oru/oru.db` (SQLite). Override with `ORU_DB_PATH`.
