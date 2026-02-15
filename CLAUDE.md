# oru

Agent-friendly todo CLI with offline-first sync via oplog.

## Monorepo structure

- `cli/` — CLI package (TypeScript, Node 22+, ESM)
- `app/` — Mobile app (Expo, React Native)

## Stack (CLI)

- TypeScript, Node 22+, ESM
- `pnpm` workspaces for monorepo
- `better-sqlite3` for storage (sync API)
- `commander` for CLI
- `uuid` v7 for IDs
- `vitest` for tests, `tsup` for build
- `oxlint` + `oxfmt` for linting/formatting

## Architecture

- **Tasks table** is a materialized view. **Oplog is the source of truth** for sync.
- Service layer (`cli/src/main.ts`) wraps repo + oplog writes in single transactions.
- Conflict resolution: last-write-wins per field, updates beat deletes, notes append-only with dedup.
- Sync uses sequence-based cursoring (not timestamps) to avoid same-millisecond bugs.

## Key directories

- `cli/src/db/` — connection, schema, migrations
- `cli/src/tasks/` — CRUD repository, types
- `cli/src/oplog/` — writer, reader, replay (conflict resolution)
- `cli/src/sync/` — engine, remote interface, filesystem remote backend
- `cli/src/format/` — text and JSON output formatters
- `cli/src/server/` — HTTP server (Hono) for mobile clients
- `cli/src/cli.ts` — Commander setup, `cli/src/main.ts` — service layer
- `cli/tests/` — mirrors src structure, all integration tests using real SQLite (in-memory)

## Stack (App)

- Expo 55, React Native 0.83, React 19
- `expo-router` for navigation (Stack with form sheets)
- `@expo/ui` for native SwiftUI controls (`Picker`, `ContextMenu`, `Button`)
- `expo-image` for SF Symbols and images
- `expo-camera` for QR code scanning
- `tsgo` (native TypeScript checker) for type checking

## App conventions

- All `@expo/ui` SwiftUI components (`Picker`, `ContextMenu`, etc.) must be wrapped in `<Host matchContents>` — they crash without it
- Use `PlatformColor()` for all colors (supports dark/light mode). Never hardcode colors like `#000` or `#F2F2F7`
- `expo-image` `tintColor` prop requires `PlatformColor(...) as unknown as string` cast (types don't match but works at runtime)
- `AbortSignal.timeout()` is not available in Hermes — use `AbortController` + `setTimeout` instead
- `NSAllowsLocalNetworking` is enabled in `app.json` for local HTTP server connections

## Commands

```bash
pnpm test          # run all tests (delegates to cli workspace)
pnpm lint          # oxlint
pnpm fmt           # oxfmt (fix)
pnpm fmt:check     # oxfmt (check only)
pnpm build         # tsup → cli/dist/cli.js
cd app && pnpm tsgo  # type check the app
```

## DB location

Defaults to `~/.oru/oru.db`. Override with `ORU_DB_PATH` env var.

## Checklists

### Adding a new CLI command

1. `cli/src/cli.ts` — add `.command()` block (before `return program`)
2. `cli/src/completions/bash.ts` — add to `commands` string, add case in switch
3. `cli/src/completions/zsh.ts` — add to `commands` array, add case with `_arguments`
4. `cli/src/completions/fish.ts` — add `complete -c oru` lines for command + flags
5. `cli/tests/cli/parse.test.ts` — add tests for the new command
6. `cli/tests/completions/scripts.test.ts` — add assertions that scripts contain the command

### Adding a new task field

1. `cli/src/tasks/types.ts` — add to `Task`, `CreateTaskInput`, `UpdateTaskInput`
2. `cli/src/db/schema.ts` — add migration to `appMigrations` (increment version)
3. `cli/src/tasks/repository.ts` — update `rowToTask()`, INSERT/UPDATE SQL, `ListFilters` if filterable
4. `cli/src/main.ts` — update `add()` oplog value serialization, `update()` handles it via field loop automatically
5. `cli/src/oplog/replay.ts` — add case in `rebuildTask()` switch, set initial state from create op
6. `cli/src/server/routes.ts` — add to POST/PATCH validation and field extraction
7. `cli/src/cli.ts` — add flag to relevant commands (`add`, `update`, `edit`)
8. `cli/src/format/text.ts` — update `formatTaskText()` and `formatTasksText()` if visible
9. `cli/src/edit.ts` — update `serializeTask()` and `parseDocument()` for `oru edit`
10. `cli/src/completions/bash.ts`, `zsh.ts`, `fish.ts` — add flag completions if enum-like
11. `app/utils/api.ts` — sync `Task`, `CreateTaskInput`, `UpdateTaskInput` types
12. Add tests in `cli/tests/` mirroring each layer changed

### Adding a new status or priority value

1. `cli/src/tasks/types.ts` — add to `STATUSES` / `PRIORITIES` array (all CLI consumers import from here)
2. `cli/src/format/text.ts` — add case in `colorPriority()` / `colorStatus()` / `colorCheck()` switches
3. `app/utils/api.ts` — `Status` / `Priority` types (mobile app has its own copy)

### Adding a new config option

1. `cli/src/config/config.ts` — add type, add to `Config` interface, add to `DEFAULTS`, add `VALID_*` set if enum, add parsing in `loadConfig()`, add to `DEFAULT_CONFIG_TOML`
2. `cli/src/cli.ts` — use the new config value where needed
3. `cli/tests/config/` — add tests for parsing and validation

## Git & PR conventions

- Create PRs with `gh pr create`
- **PR title must have a scope prefix**: `cli:`, `app:`, or `infra:` (for CI, docs, repo config)
  - Examples: `cli: Add shell completions`, `app: Add due date picker`, `infra: Add bundle size CI`
- PR description uses the template in `.github/pull_request_template.md` — fill in Why/How/Test plan and check all applicable checklist items
- Delete checklist sections that don't apply (e.g. remove "If adding a new CLI command" for an app-only PR)
- Keep commit messages concise — focus on the "why", not the "what"
- Do not add `Co-Authored-By` lines to commits
- Do not add "Generated with Claude Code" to PR descriptions
- Run `pnpm check` before pushing
