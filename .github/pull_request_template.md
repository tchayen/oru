# Why

<!-- Describe why we are adding this — context and reasoning only -->

# How

<!-- Describe how the change was made -->

# Test plan

<!-- What gives us confidence it works? How do we verify? What automated tests were added? -->

# Checklist

## Always
- [ ] `pnpm check` passes (lint, format, typecheck, tests)
- [ ] PR title has scope prefix (`cli:`, `app:`, or `infra:`)

## If adding a new CLI command
- [ ] Shell completions updated (bash, zsh, fish)
- [ ] Tests added in `cli/tests/cli/parse.test.ts`
- [ ] Completion script tests updated in `cli/tests/completions/scripts.test.ts`

## If adding/changing a task field
- [ ] Schema migration added (version incremented)
- [ ] Oplog replay handles new field in `rebuildTask()` switch
- [ ] Server routes validate new field
- [ ] `app/utils/api.ts` types synced
- [ ] `cli/src/edit.ts` serialize/parse updated

## If adding a new status or priority value
- [ ] All sync points updated (see "Adding a new status or priority value" in CLAUDE.md)

## If changing app UI
- [ ] No hardcoded colors (use `PlatformColor()`)
- [ ] SwiftUI components wrapped in `<Host matchContents>`
