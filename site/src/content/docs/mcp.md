---
title: MCP server
description: Use oru as a Model Context Protocol server so AI agents can manage your tasks directly.
---

# MCP Server

Use oru as a Model Context Protocol server so AI agents can manage your tasks directly.

oru includes a built-in [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. Connect it to any MCP-compatible AI client and your agent can create, update, and query tasks without leaving the conversation.

## Starting the server

Run `oru mcp` to start the server over stdio. MCP clients launch it as a subprocess automatically – you don't run it manually.

```bash copy
oru mcp
```

## Available tools

| Tool          | Description                                                                            |
| ------------- | -------------------------------------------------------------------------------------- |
| `add_task`    | Create a task. Pass `id` for idempotent creates.                                       |
| `update_task` | Update fields on an existing task. Only changed fields need to be sent.                |
| `delete_task` | Soft-delete a task by ID or prefix.                                                    |
| `list_tasks`  | List tasks with optional status, priority, label, and search filters.                  |
| `get_task`    | Fetch a single task by ID or unique prefix.                                            |
| `get_context` | Dashboard summary: overdue, due soon, in progress, actionable, blocked, recently done. |
| `add_note`    | Append a note to a task (append-only, deduplicated).                                   |
| `list_labels` | Return all labels currently in use.                                                    |

## Installation by client

All clients use a JSON config file to declare MCP servers. The format is nearly identical across clients: a `mcpServers` object where each key is a server name and the value specifies how to launch it.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or `%APPDATA%\Claude\claude_desktop_config.json` on Windows:

```json
{
  "mcpServers": {
    "oru": {
      "command": "oru",
      "args": ["mcp"]
    }
  }
}
```

Restart Claude Desktop after saving.

### Claude Code

Add the server with the `claude mcp add` command:

```bash copy
claude mcp add oru -- oru mcp
```

This writes to `~/.claude.json` by default. Add `--scope project` to instead write to `.mcp.json` in the project root, which can be checked into version control to share with your team.

### Cursor

Global config: `~/.cursor/mcp.json`
Project config: `.cursor/mcp.json` in the project root

```json
{
  "mcpServers": {
    "oru": {
      "command": "oru",
      "args": ["mcp"]
    }
  }
}
```

### VS Code (GitHub Copilot)

Create or edit `.vscode/mcp.json` in your workspace. VS Code uses a `servers` key (not `mcpServers`) and requires a `type` field:

```json
{
  "servers": {
    "oru": {
      "type": "stdio",
      "command": "oru",
      "args": ["mcp"]
    }
  }
}
```

You can commit `.vscode/mcp.json` to share the config with your team. Enable MCP in VS Code via **Settings → Chat → MCP → Enabled**.

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "oru": {
      "command": "oru",
      "args": ["mcp"]
    }
  }
}
```

### Zed

Open **Zed → Settings** (`cmd+,`) and add to `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "oru": {
      "command": "oru",
      "args": ["mcp"]
    }
  }
}
```

## Using a full path

If `oru` is not on the `PATH` inside your AI client's process (common on macOS when apps don't inherit shell config), use the full binary path instead:

```bash copy
which oru
```

Then replace `"command": "oru"` with the full path, e.g. `"command": "/usr/local/bin/oru"`.

## Custom database path

Pass `ORU_DB_PATH` in the `env` block if you want the MCP server to use a different database than the default `~/.oru/oru.db`:

```json
{
  "mcpServers": {
    "oru": {
      "command": "oru",
      "args": ["mcp"],
      "env": {
        "ORU_DB_PATH": "/path/to/my.db"
      }
    }
  }
}
```

## AGENTS.md

Drop an `AGENTS.md` (or `CLAUDE.md`) file in your project root to tell AI agents how to use oru for task tracking in that project. This works alongside the MCP server – the file gives agents high-level guidance while the MCP tools give them direct access to your task list.

See the [repository](https://github.com/tchayen/oru) for an example.
