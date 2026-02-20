---
title: Getting started
description: Install oru and manage your first tasks in under a minute.
---

# Getting Started

Install oru and manage your first tasks in under a minute.

## System requirements

- **Node.js 22** or later
- macOS, Linux, or Windows (WSL)

## Installation

### Install script (recommended)

The install script auto-detects your platform, downloads the right binary, and adds oru to your `PATH`:

```bash copy
curl -fsSL https://oru.sh/install.sh | bash
```

### npm

```bash copy
npm install -g @tchayen/oru
```

Or with your preferred package manager:

```bash
pnpm add -g @tchayen/oru
yarn global add @tchayen/oru
```

### Platform tarballs

Download pre-built binaries from the [GitHub Releases](https://github.com/tchayen/oru/releases) page. Extract and add to your `PATH`.

### Verify installation

```bash copy
oru --version
```

## Quick start

oru stores everything in a local SQLite database. No accounts, no cloud – just run commands.

```bash
oru add "Read the oru docs"
oru add "Build something great" -p high -d friday
oru list
oru start <id>
oru done <id>
```

Replace `<id>` with the task ID shown in the list output. You only need to type enough characters for a unique prefix – `oru done 019` works if no other ID starts with `019`.

## Shell completions

Tab completion makes oru much faster to use. Install for your shell:

```bash copy
oru completions
```

This auto-detects your shell from `$SHELL` and prompts before making any changes. You can also target a specific shell directly:

```bash
oru completions bash
oru completions zsh
oru completions fish
```

### What it does

The command writes a completion script and, for bash and zsh, appends a `source` line to your RC file. Running it again is safe – the source line is only added once.

| Shell | Script written to                     | RC file updated        |
| ----- | ------------------------------------- | ---------------------- |
| bash  | `~/.oru/completions.bash`             | `~/.bashrc`            |
| zsh   | `~/.oru/completions.zsh`              | `~/.zshrc`             |
| fish  | `~/.config/fish/completions/oru.fish` | none (fish auto-loads) |

### Applying completions

For bash and zsh, reload your shell after installing:

```bash
source ~/.bashrc  # bash
source ~/.zshrc   # zsh
```

Fish completions take effect automatically the next time you open a shell.

### Dynamic completions

Task IDs and label names are completed dynamically at runtime – the completion scripts call `oru _complete` to fetch live values from your database. This means completions always reflect your current task list.

## Configuration

Create a config file with documented defaults:

```bash copy
oru config init
```

This creates `~/.oru/config.toml`. Print the resolved path at any time:

```bash copy
oru config path
```

Key options:

| Option              | Default      | Description                                                                         |
| ------------------- | ------------ | ----------------------------------------------------------------------------------- |
| `output_format`     | `"text"`     | Default output format (`text` or `json`)                                            |
| `date_format`       | `"mdy"`      | Slash date order: `mdy` (MM/DD/YYYY) or `dmy` (DD/MM/YYYY)                          |
| `first_day_of_week` | `"monday"`   | First day of the week (affects "next week", "end of week")                          |
| `next_month`        | `"same_day"` | What "next month" means: `same_day` (Mar 15 -> Apr 15) or `first` (Mar 15 -> Apr 1) |
| `auto_update_check` | `true`       | Check for new versions on startup (at most once per 24h)                            |
| `backup_path`       | –            | Directory for automatic backups on every command                                    |
| `backup_interval`   | `60`         | Minimum minutes between auto-backups                                                |
| `telemetry`         | `true`       | Anonymous usage telemetry (see also: `oru telemetry`)                               |

You can also set `output_format` per-command with `--json` or `--plaintext`, or globally via the `ORU_FORMAT` environment variable.

## Environment variables

| Variable         | Description                                            |
| ---------------- | ------------------------------------------------------ |
| `ORU_DB_PATH`    | Override database file path (default: `~/.oru/oru.db`) |
| `ORU_CONFIG_DIR` | Override config directory (default: `~/.oru`)          |
| `ORU_FORMAT`     | Set default output format (`json` or `text`)           |
| `ORU_DEBUG=1`    | Enable verbose error output                            |
| `DO_NOT_TRACK=1` | Disable telemetry                                      |

---

Ready to dive deeper? The [usage guide](/docs/guide) covers every command and feature in detail.
