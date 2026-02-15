# ao (agentodo)

Agent-friendly todo CLI with offline-first sync via oplog.

## Monorepo structure

- `cli/` — CLI package (TypeScript, Node 22+, ESM)
- `app/` — Mobile app (Expo, React Native)

## Stack (CLI)

- TypeScript, Node 22+, ESM
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

## Commands

```bash
npm test          # run all tests (delegates to cli workspace)
npm run lint      # oxlint
npm run fmt       # oxfmt (fix)
npm run fmt:check # oxfmt (check only)
npm run build     # tsup → cli/dist/cli.js
```

## DB location

Defaults to `~/.ao/ao.db`. Override with `AO_DB_PATH` env var.

## Git & PR conventions

- Create PRs with `gh pr create`
- PR description format:

```
# Why

<describe why we are adding this, only the context and reasoning>

# How

<describe how the change was made>

# Test plan

<what gives us confidence it works? how do we verify? what automated tests did we add?>
```

- Keep commit messages concise — focus on the "why", not the "what"
- Do not add `Co-Authored-By` lines to commits
- Run `npm run lint && npm run fmt:check && npm test` before pushing
