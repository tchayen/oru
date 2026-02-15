# Tasks

- [ ] Write a skill for using the playwright to inspect page.
- [ ] Figure out a skill to see the app in iOS simulator (Radon?).
- [~] Set up landing page with CloudFlare.
- [~] Maybe consider a rename so that we can find both a domain and npm package that are available?
- [ ] Find domain for the landing page (what TLD or combination of words with `ao` will do the trick).
- [ ] Ask agent for security review: let's do threat modelling exercise.
- [~] Use tailwind on the landing page.
- [ ] Use text balanced CSS instruction more on the landing page.
- [ ] Update command formatting and colors on the landing page - check real command output.
- [ ] Formatting of text like JSON is broken in terminals.
- [ ] QR code example in terminal does not look good.
- [ ] Add shipped JS bundle and HTML size (maybe?) of the landing page to the performance github comment.
- [ ] Explore converting code in `site/` to TS.
- [ ] Figure out installation. I guess npm package and an install script like bun/claude code. We want auto update.
- [ ] Verify claims from the homepage:

  > Requires Node 22+. That is the only dependency.

  uhm not sure lol?

- [ ] Phone on the homepage needs to be replaced with proper iPhone frame and proper app screenshot.
- [x] Add colors to CLI help output. (PR #26)
- [ ] Make orange theme color in the CLI - like the website one.
- [ ] Completions is not entirely useful - doesn't explain how to use/install the script.
- [ ] 'Sync that actually works offline.' got some vertical drift.

# Bugs

- [x] Newlines accepted in titles — ao add $'Title with\nnewline' creates a task whose title breaks the list table formatting. Titles should reject or strip newlines. (PR #46)
- [x] Stack traces on edit validation errors — edit with invalid status/priority shows raw Error: Invalid status: ... with a full stack trace instead of a clean user-facing message like the CLI flags give. (PR #44)
- [x] Ambiguous prefix ID gives "not found" — When a prefix matches multiple tasks (e.g. AB matching AB123 and `AB456`), the error is "Task AB not found" instead of something like "Prefix 'AB' is ambiguous, matches: AB123, AB456". (PR #48)
- [x] Duplicate notes not deduplicated — Adding the same note text twice results in duplicates. CLAUDE.md claims "notes append-only with dedup" but dedup doesn't work at the CLI/service layer (may only apply during oplog replay?). (PR #47)
- [x] Table misalignment with long IDs — custom-id-123 (13 chars) pushes columns out of alignment since the ID column width is fixed at 8 chars. The table should dynamically size columns. (PR #45)
- [x] Metadata invisible in text output — --meta key=value pairs are stored correctly but only visible in --json output. The get text view and list view don't show metadata at all. (PR #58)
- [x] No way to delete metadata keys — --meta key= sets value to empty string. There's no way to actually remove a key (e.g. --meta key without = is silently ignored). (PR #54)
- [x] `--meta` without `=` silently ignored — --meta broken (no equals sign) succeeds silently without any warning. Should either warn or error. (PR #51)
- [x] `config init` ignores env vars — AO_CONFIG_DIR didn't change where the config file was created (it always went to `~/.ao/config.toml`). Could be by design, but worth noting. (PR #52)
- [x] No sorting options on `list` — Cannot sort by due date, creation date, or title. The default sort (priority desc, then creation order) is reasonable but users might want --sort due or --sort title. (PR #59)
- [x] No `--limit`/`--offset` on `list` — For large task lists, there's no pagination. Fine for now but could matter at scale. (PR #56)
- [x] No way to clear/remove notes — Notes are append-only, with no way to remove an incorrect note even via edit (the edit view says "Existing notes are append-only"). (PR #57)

# Features — agent & collaboration improvements

- [ ] Multi-value filters on `list` — Allow comma-separated values like `ao list -s todo,in_progress` or `ao list -p high,urgent` to reduce round trips. Every extra command is latency and tokens for agents.
- [ ] `ao list --actionable` — Show tasks that are not blocked, not done, sorted by priority. The "what should I work on next?" query in a single flag. Builds on the `blocked_by` feature from PR #39.
- [ ] Oplog viewer — `ao log <id>` to show the change history of a task. Useful for understanding context when picking up a task someone else worked on ("why was this reopened? what was tried before?").
- [ ] Owner/assignee field — `ao update <id> --assign agent` / `--assign human`. Foundation for `ao list --mine`, "what did the agent do while I was away", and dividing work between human and agent.
- [ ] Handoff signal — A way to signal task transitions between human and agent. Could be a new status like `in_review`, or a dedicated `ao review <id>` command. Supports the ping-pong workflow where agent marks work done and human reviews.
- [ ] `ao context` — Agent briefing command. Prints a structured summary: actionable tasks by priority, recently completed tasks, overdue items, blocked chains. One command for full situational awareness. Different from `ao list` — opinionated and curated, not a raw listing. The standup meeting for your agent.
- [ ] Auto-backup via config — Add `backup_path` option to `ao config` (e.g. `backup_path = "~/Dropbox/ao-backup"`). On every CLI invocation, if >N minutes since last backup, copy the DB file to the backup path with a timestamp. Zero-effort safety net. Also add an explicit `ao backup [path]` command for manual one-off snapshots.
