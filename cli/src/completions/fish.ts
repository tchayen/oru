import { STATUSES, PRIORITIES } from "../tasks/types";
import { SORT_FIELDS } from "../tasks/repository";
import { SHOW_SERVER } from "../flags";

export function generateFishCompletions(): string {
  return `# oru shell completions for fish
# Install: oru completions fish
# Print:   oru completions fish --print

function __oru_task_ids
  oru _complete tasks (commandline -ct) 2>/dev/null | while read -l line
    set -l parts (string split \\t $line)
    echo $parts[1]\\t$parts[2]
  end
end

function __oru_labels
  oru _complete labels (commandline -ct) 2>/dev/null
end

function __oru_needs_command
  set -l cmd (commandline -opc)
  test (count $cmd) -eq 1
end

function __oru_using_command
  set -l cmd (commandline -opc)
  test (count $cmd) -ge 2; and test "$cmd[2]" = "$argv[1]"
end

function __oru_using_subcommand
  set -l cmd (commandline -opc)
  test (count $cmd) -ge 3; and test "$cmd[2]" = "$argv[1]"; and test "$cmd[3]" = "$argv[2]"
end

# Disable file completions by default
complete -c oru -f

# Top-level commands
complete -c oru -n __oru_needs_command -a add -d 'Add a new task'
complete -c oru -n __oru_needs_command -a list -d 'List tasks'
complete -c oru -n __oru_needs_command -a labels -d 'List all labels in use'
complete -c oru -n __oru_needs_command -a get -d 'Get a task by ID'
complete -c oru -n __oru_needs_command -a update -d 'Update a task'
complete -c oru -n __oru_needs_command -a edit -d 'Open task in \\$EDITOR for complex edits'
complete -c oru -n __oru_needs_command -a delete -d 'Delete one or more tasks'
complete -c oru -n __oru_needs_command -a done -d 'Mark one or more tasks as done'
complete -c oru -n __oru_needs_command -a start -d 'Start one or more tasks'
complete -c oru -n __oru_needs_command -a review -d 'Mark one or more tasks as in_review'
complete -c oru -n __oru_needs_command -a context -d 'Show a summary of what needs your attention'
complete -c oru -n __oru_needs_command -a log -d 'Show change history of a task'
complete -c oru -n __oru_needs_command -a sync -d 'Sync with a filesystem remote'
complete -c oru -n __oru_needs_command -a backup -d 'Create a database backup snapshot'
complete -c oru -n __oru_needs_command -a config -d 'Manage configuration'
complete -c oru -n __oru_needs_command -a filter -d 'Manage saved list filters'
${SHOW_SERVER ? "complete -c oru -n __oru_needs_command -a server -d 'Manage the HTTP server'" : ""}
complete -c oru -n __oru_needs_command -a completions -d 'Generate shell completions'
complete -c oru -n __oru_needs_command -a self-update -d 'Update oru to the latest version'
complete -c oru -n __oru_needs_command -a telemetry -d 'Manage anonymous usage telemetry'

# config subcommands
complete -c oru -n '__oru_using_command config' -a init -d 'Create a default config file'
complete -c oru -n '__oru_using_command config' -a path -d 'Print the config file path'

# filter subcommands
complete -c oru -n '__oru_using_command filter' -a list -d 'List all saved filters'
complete -c oru -n '__oru_using_command filter' -a show -d 'Show a filter definition'
complete -c oru -n '__oru_using_command filter' -a add -d 'Save a new named filter'
complete -c oru -n '__oru_using_command filter' -a remove -d 'Delete a saved filter'
complete -c oru -n '__oru_using_subcommand filter add' -s s -l status -a '${STATUSES.join(" ")}' -d 'Status' -r
complete -c oru -n '__oru_using_subcommand filter add' -s p -l priority -a '${PRIORITIES.join(" ")}' -d 'Priority' -r
complete -c oru -n '__oru_using_subcommand filter add' -s l -l label -a '(__oru_labels)' -d 'Label' -r
complete -c oru -n '__oru_using_subcommand filter add' -l owner -d 'Filter by owner' -r
complete -c oru -n '__oru_using_subcommand filter add' -l due -d 'Filter by due date' -r
complete -c oru -n '__oru_using_subcommand filter add' -l overdue -d 'Show only overdue tasks'
complete -c oru -n '__oru_using_subcommand filter add' -l sort -a '${SORT_FIELDS.join(" ")}' -d 'Sort order' -r
complete -c oru -n '__oru_using_subcommand filter add' -l search -d 'Search by title' -r
complete -c oru -n '__oru_using_subcommand filter add' -s a -l all -d 'Include done tasks'
complete -c oru -n '__oru_using_subcommand filter add' -l actionable -d 'Show only actionable tasks'
complete -c oru -n '__oru_using_subcommand filter add' -l limit -d 'Maximum number of tasks' -r
complete -c oru -n '__oru_using_subcommand filter add' -l offset -d 'Number of tasks to skip' -r
complete -c oru -n '__oru_using_subcommand filter add' -l sql -d 'Raw SQL WHERE condition' -r

${
  SHOW_SERVER
    ? `# server subcommands
complete -c oru -n '__oru_using_command server' -a start -d 'Start the server'
complete -c oru -n '__oru_using_subcommand server start' -l port -d 'Port to listen on' -r
complete -c oru -n '__oru_using_subcommand server start' -l tunnel -d 'Create a public tunnel'
`
    : ""
}# completions subcommands
complete -c oru -n '__oru_using_command completions' -a 'bash zsh fish'
complete -c oru -n '__oru_using_command completions' -l print -d 'Print completion script to stdout'

# telemetry subcommands
complete -c oru -n '__oru_using_command telemetry' -a status -d 'Show telemetry status'
complete -c oru -n '__oru_using_command telemetry' -a enable -d 'Enable telemetry'
complete -c oru -n '__oru_using_command telemetry' -a disable -d 'Disable telemetry'

# Task ID completions for get, update, edit, delete, done, start
complete -c oru -n '__oru_using_command get' -a '(__oru_task_ids)'
complete -c oru -n '__oru_using_command update' -a '(__oru_task_ids)'
complete -c oru -n '__oru_using_command edit' -a '(__oru_task_ids)'
complete -c oru -n '__oru_using_command delete' -a '(__oru_task_ids)'
complete -c oru -n '__oru_using_command done' -a '(__oru_task_ids)'
complete -c oru -n '__oru_using_command start' -a '(__oru_task_ids)'
complete -c oru -n '__oru_using_command review' -a '(__oru_task_ids)'
complete -c oru -n '__oru_using_command log' -a '(__oru_task_ids)'

# backup gets directory completions
complete -c oru -n '__oru_using_command backup' -a '(__fish_complete_directories)'

# sync gets file completions
complete -c oru -n '__oru_using_command sync' -F

# Status flag for add, list, update, edit
complete -c oru -n '__oru_using_command add' -s s -l status -a '${STATUSES.join(" ")}' -d 'Status' -r
complete -c oru -n '__oru_using_command list' -s s -l status -a '${STATUSES.join(" ")}' -d 'Status' -r
complete -c oru -n '__oru_using_command update' -s s -l status -a '${STATUSES.join(" ")}' -d 'Status' -r

# Priority flag for add, list, update, edit
complete -c oru -n '__oru_using_command add' -s p -l priority -a '${PRIORITIES.join(" ")}' -d 'Priority' -r
complete -c oru -n '__oru_using_command list' -s p -l priority -a '${PRIORITIES.join(" ")}' -d 'Priority' -r
complete -c oru -n '__oru_using_command update' -s p -l priority -a '${PRIORITIES.join(" ")}' -d 'Priority' -r

# Label flag
complete -c oru -n '__oru_using_command add' -s l -l label -a '(__oru_labels)' -d 'Label' -r
complete -c oru -n '__oru_using_command list' -s l -l label -a '(__oru_labels)' -d 'Label' -r
complete -c oru -n '__oru_using_command update' -s l -l label -a '(__oru_labels)' -d 'Label' -r
complete -c oru -n '__oru_using_command update' -l unlabel -a '(__oru_labels)' -d 'Remove label' -r

# Common flags
complete -c oru -n '__oru_using_command labels' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command labels' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command add' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command add' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command add' -s d -l due -d 'Due date' -r
complete -c oru -n '__oru_using_command add' -s n -l note -d 'Add a note' -r
complete -c oru -n '__oru_using_command add' -l id -d 'Task ID' -r
complete -c oru -n '__oru_using_command add' -l assign -d 'Assign to owner' -r
complete -c oru -n '__oru_using_command add' -s b -l blocked-by -d 'Blocked by task ID' -r
complete -c oru -n '__oru_using_command add' -l meta -d 'Metadata key=value' -r
complete -c oru -n '__oru_using_command add' -s r -l repeat -d 'Recurrence rule' -r
complete -c oru -n '__oru_using_command add' -l tz -d 'IANA timezone for due date' -r
complete -c oru -n '__oru_using_command list' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command list' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command list' -l search -d 'Search by title' -r
complete -c oru -n '__oru_using_command list' -l owner -d 'Filter by owner' -r
complete -c oru -n '__oru_using_command list' -l due -d 'Filter by due date' -r
complete -c oru -n '__oru_using_command list' -l overdue -d 'Show only overdue tasks'
complete -c oru -n '__oru_using_command list' -l sort -a '${SORT_FIELDS.join(" ")}' -d 'Sort order' -r
complete -c oru -n '__oru_using_command list' -s a -l all -d 'Include done tasks'
complete -c oru -n '__oru_using_command list' -l actionable -d 'Show only actionable tasks'
complete -c oru -n '__oru_using_command list' -l limit -d 'Maximum number of tasks' -r
complete -c oru -n '__oru_using_command list' -l offset -d 'Number of tasks to skip' -r
complete -c oru -n '__oru_using_command list' -l filter -d 'Apply a saved filter' -r
complete -c oru -n '__oru_using_command get' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command get' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command update' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command update' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command update' -s t -l title -d 'New title' -r
complete -c oru -n '__oru_using_command update' -s d -l due -d 'Due date' -r
complete -c oru -n '__oru_using_command update' -s n -l note -d 'Append a note' -r
complete -c oru -n '__oru_using_command update' -l assign -d 'Assign to owner' -r
complete -c oru -n '__oru_using_command update' -l clear-notes -d 'Remove all notes'
complete -c oru -n '__oru_using_command update' -s b -l blocked-by -d 'Blocked by task ID' -r
complete -c oru -n '__oru_using_command update' -l unblock -d 'Remove blocker task ID' -r
complete -c oru -n '__oru_using_command update' -l meta -d 'Metadata key=value' -r
complete -c oru -n '__oru_using_command update' -s r -l repeat -d 'Recurrence rule' -r
complete -c oru -n '__oru_using_command update' -l tz -d 'IANA timezone for due date' -r
complete -c oru -n '__oru_using_command edit' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command edit' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command delete' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command delete' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command done' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command done' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command start' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command start' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command review' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command review' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command context' -l owner -d 'Scope to a specific owner' -r
complete -c oru -n '__oru_using_command context' -s l -l label -d 'Filter by labels' -r
complete -c oru -n '__oru_using_command context' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command context' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command log' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command log' -l plaintext -d 'Output as plain text'
complete -c oru -n '__oru_using_command sync' -l json -d 'Output as JSON'
complete -c oru -n '__oru_using_command sync' -l plaintext -d 'Output as plain text'

# self-update flags
complete -c oru -n '__oru_using_command self-update' -l check -d 'Only check if an update is available'
`;
}
