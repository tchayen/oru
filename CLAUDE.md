# oru

Agent-friendly todo CLI with offline-first sync via oplog.

## Monorepo structure

- `cli/` - CLI package (TypeScript, Node 22+, ESM)
- `app/` - Mobile app (Expo, React Native)
- `site/` - Landing page (Astro)
- `types/` - Shared type definitions

## Stack (CLI)

- TypeScript, Node 22+, ESM
- `pnpm` workspaces for monorepo
- `better-sqlite3` for storage (sync API)
- `commander` for CLI
- `uuid` v7 for IDs
- `vitest` for tests, `tsup` for build
- `oxlint` + `oxfmt` for linting/formatting

## Architecture

- **Oplog is the source of truth** for sync. Tasks table is written to directly but rebuilt from oplog during conflict resolution.
- Service layer (`cli/src/main.ts`) wraps repo + oplog writes in single transactions.
- Conflict resolution: last-write-wins per field, updates beat deletes, notes append-only with dedup.
- Sync uses sequence-based cursoring (not timestamps) to avoid same-millisecond bugs.
- Recurring tasks spawn next occurrence via deterministic child IDs (`uuid.v5(parentId, namespace)`), ensuring offline devices that complete the same task produce identical children.

## App conventions

- All `@expo/ui` SwiftUI components (`Picker`, `ContextMenu`, etc.) must be wrapped in `<Host matchContents>` - they crash without it
- Use `PlatformColor()` for all colors (supports dark/light mode). Never hardcode colors like `#000` or `#F2F2F7`
- `expo-image` `tintColor` prop requires `PlatformColor(...) as unknown as string` cast (types don't match but works at runtime)
- `AbortSignal.timeout()` is not available in Hermes - use `AbortController` + `setTimeout` instead

## Commands

```bash
pnpm test            # run all tests (delegates to cli workspace)
pnpm lint            # oxlint
pnpm fmt             # oxfmt (fix)
pnpm fmt:check       # oxfmt (check only)
pnpm build           # tsup → cli/dist/cli.js
cd app && pnpm tsgo  # type check the app
```

## DB location

Defaults to `~/.oru/oru.db`. Override with `ORU_DB_PATH` env var.

## Checklists

### Adding a new CLI command

1. `cli/src/cli.ts` - add command definition
2. `cli/src/completions/bash.ts`, `zsh.ts`, `fish.ts` - add completions
3. `cli/tests/cli/parse.test.ts` - add parse tests
4. `cli/tests/completions/scripts.test.ts` - add completion assertions

### Adding a new task field

1. `cli/src/tasks/types.ts` - add to types
2. `cli/src/db/schema.ts` - add migration (increment version)
3. `cli/src/tasks/repository.ts` - update row mapping and SQL
4. `cli/src/main.ts` - update oplog serialization
5. `cli/src/oplog/replay.ts` - add case in rebuild switch
6. `cli/src/server/routes.ts` - add validation
7. `cli/src/cli.ts` - add flag to relevant commands
8. `cli/src/format/text.ts` - update formatters if visible
9. `cli/src/edit.ts` - update serialization/parsing
10. `cli/src/completions/` - add flag completions if enum-like
11. `app/utils/api.ts` - sync types
12. Add tests mirroring each layer changed

### Adding a new status or priority value

1. `cli/src/tasks/types.ts` - add to arrays
2. `cli/src/format/text.ts` - add formatting cases
3. `app/utils/api.ts` - sync types

### Adding a new config option

1. `cli/src/config/config.ts` - add type, default, parsing, validation
2. `cli/src/cli.ts` - use the new config value
3. `cli/tests/config/` - add tests

## Git & PR conventions

- Use git worktrees for branch work - do not switch branches on the main worktree. Create worktrees in `~/oru-worktrees/` (e.g. `git worktree add ~/oru-worktrees/my-branch -b my-branch`)
- Create PRs with `gh pr create`. Follow `.github/pull_request_template.md` for title format and description sections
- In the test plan, explicitly state what was tested and how - no checkboxes, no vague claims
- Keep commit messages concise - focus on the "why", not the "what"
- Do not add `Co-Authored-By` lines to commits
- Do not add "Generated with Claude Code" to PR descriptions
- Run `pnpm check` before pushing
