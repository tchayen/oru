# Tasks

- [ ] Write a skill for using the playwright to inspect page.
- [ ] Figure out a skill to see the app in iOS simulator (Radon?).
- [ ] Set up landing page with CloudFlare.
- [ ] Maybe consider a rename so that we can find both a domain and npm package that are available?
- [ ] Find domain for the landing page (what TLD or combination of words with `ao` will do the trick).
- [ ] Ask agent for security review: let's do threat modelling exercise.
- [ ] Use tailwind on the landing page.
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
- [ ] Add colors to CLI help output.
- [ ] Make orange theme color in the CLI - like the website one.
- [ ] Completions is not entirely useful - doesn't explain how to use/install the script.
- [ ] 'Sync that actually works offline.' got some vertical drift.

# Bugs

- [ ] Newlines accepted in titles — ao add $'Title with\nnewline' creates a task whose title breaks the list table formatting. Titles should reject or strip newlines.
- [ ] Stack traces on edit validation errors — edit with invalid status/priority shows raw Error: Invalid status: ... with a full stack trace instead of a clean user-facing message like the CLI flags give.
- [ ] Ambiguous prefix ID gives "not found" — When a prefix matches multiple tasks (e.g. AB matching AB123 and `AB456`), the error is "Task AB not found" instead of something like "Prefix 'AB' is ambiguous, matches: AB123, AB456".
- [ ] Duplicate notes not deduplicated — Adding the same note text twice results in duplicates. CLAUDE.md claims "notes append-only with dedup" but dedup doesn't work at the CLI/service layer (may only apply during oplog replay?).
- [ ] Table misalignment with long IDs — custom-id-123 (13 chars) pushes columns out of alignment since the ID column width is fixed at 8 chars. The table should dynamically size columns.
- [ ] Metadata invisible in text output — --meta key=value pairs are stored correctly but only visible in --json output. The get text view and list view don't show metadata at all.
- [ ] No way to delete metadata keys — --meta key= sets value to empty string. There's no way to actually remove a key (e.g. --meta key without = is silently ignored).
- [ ] `--meta` without `=` silently ignored — --meta broken (no equals sign) succeeds silently without any warning. Should either warn or error.
- [ ] `config init` ignores env vars — AO_CONFIG_DIR didn't change where the config file was created (it always went to `~/.ao/config.toml`). Could be by design, but worth noting.
- [ ] No sorting options on `list` — Cannot sort by due date, creation date, or title. The default sort (priority desc, then creation order) is reasonable but users might want --sort due or --sort title.
- [ ] No `--limit`/`--offset` on `list` — For large task lists, there's no pagination. Fine for now but could matter at scale.
- [ ] No way to clear/remove notes — Notes are append-only, with no way to remove an incorrect note even via edit (the edit view says "Existing notes are append-only").
