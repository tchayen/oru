import { STATUSES, PRIORITIES } from "../tasks/types.js";
import { SORT_FIELDS } from "../tasks/repository.js";

export function generateFishCompletions(): string {
  return `# ao shell completions for fish
# Install: ao completions fish > ~/.config/fish/completions/ao.fish

function __ao_task_ids
  ao _complete tasks (commandline -ct) 2>/dev/null | while read -l line
    set -l parts (string split \\t $line)
    echo $parts[1]\\t$parts[2]
  end
end

function __ao_labels
  ao _complete labels (commandline -ct) 2>/dev/null
end

function __ao_needs_command
  set -l cmd (commandline -opc)
  test (count $cmd) -eq 1
end

function __ao_using_command
  set -l cmd (commandline -opc)
  test (count $cmd) -ge 2; and test "$cmd[2]" = "$argv[1]"
end

function __ao_using_subcommand
  set -l cmd (commandline -opc)
  test (count $cmd) -ge 3; and test "$cmd[2]" = "$argv[1]"; and test "$cmd[3]" = "$argv[2]"
end

# Disable file completions by default
complete -c ao -f

# Top-level commands
complete -c ao -n __ao_needs_command -a add -d 'Add a new task'
complete -c ao -n __ao_needs_command -a list -d 'List tasks'
complete -c ao -n __ao_needs_command -a labels -d 'List all labels in use'
complete -c ao -n __ao_needs_command -a get -d 'Get a task by ID'
complete -c ao -n __ao_needs_command -a update -d 'Update a task'
complete -c ao -n __ao_needs_command -a delete -d 'Delete one or more tasks'
complete -c ao -n __ao_needs_command -a done -d 'Mark one or more tasks as done'
complete -c ao -n __ao_needs_command -a start -d 'Start one or more tasks'
complete -c ao -n __ao_needs_command -a review -d 'Mark one or more tasks as in_review'
complete -c ao -n __ao_needs_command -a log -d 'Show change history of a task'
complete -c ao -n __ao_needs_command -a sync -d 'Sync with a filesystem remote'
complete -c ao -n __ao_needs_command -a config -d 'Manage configuration'
complete -c ao -n __ao_needs_command -a server -d 'Manage the HTTP server'
complete -c ao -n __ao_needs_command -a completions -d 'Generate shell completions'

# config subcommands
complete -c ao -n '__ao_using_command config' -a init -d 'Create a default config file'
complete -c ao -n '__ao_using_command config' -a path -d 'Print the config file path'

# server subcommands
complete -c ao -n '__ao_using_command server' -a start -d 'Start the server'
complete -c ao -n '__ao_using_subcommand server start' -l port -d 'Port to listen on' -r
complete -c ao -n '__ao_using_subcommand server start' -l tunnel -d 'Create a public tunnel'

# completions subcommands
complete -c ao -n '__ao_using_command completions' -a 'bash zsh fish'

# Task ID completions for get, update, delete, done, start
complete -c ao -n '__ao_using_command get' -a '(__ao_task_ids)'
complete -c ao -n '__ao_using_command update' -a '(__ao_task_ids)'
complete -c ao -n '__ao_using_command delete' -a '(__ao_task_ids)'
complete -c ao -n '__ao_using_command done' -a '(__ao_task_ids)'
complete -c ao -n '__ao_using_command start' -a '(__ao_task_ids)'
complete -c ao -n '__ao_using_command review' -a '(__ao_task_ids)'
complete -c ao -n '__ao_using_command log' -a '(__ao_task_ids)'

# sync gets file completions
complete -c ao -n '__ao_using_command sync' -F

# Status flag for add, list, update
complete -c ao -n '__ao_using_command add' -s s -l status -a '${STATUSES.join(" ")}' -d 'Status' -r
complete -c ao -n '__ao_using_command list' -s s -l status -a '${STATUSES.join(" ")}' -d 'Status' -r
complete -c ao -n '__ao_using_command update' -s s -l status -a '${STATUSES.join(" ")}' -d 'Status' -r

# Priority flag for add, list, update
complete -c ao -n '__ao_using_command add' -s p -l priority -a '${PRIORITIES.join(" ")}' -d 'Priority' -r
complete -c ao -n '__ao_using_command list' -s p -l priority -a '${PRIORITIES.join(" ")}' -d 'Priority' -r
complete -c ao -n '__ao_using_command update' -s p -l priority -a '${PRIORITIES.join(" ")}' -d 'Priority' -r

# Label flag
complete -c ao -n '__ao_using_command add' -s l -l label -a '(__ao_labels)' -d 'Label' -r
complete -c ao -n '__ao_using_command list' -s l -l label -a '(__ao_labels)' -d 'Label' -r
complete -c ao -n '__ao_using_command update' -s l -l label -a '(__ao_labels)' -d 'Label' -r
complete -c ao -n '__ao_using_command update' -l unlabel -a '(__ao_labels)' -d 'Remove label' -r

# Common flags
complete -c ao -n '__ao_using_command labels' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command labels' -l plaintext -d 'Output as plain text'
complete -c ao -n '__ao_using_command add' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command add' -l plaintext -d 'Output as plain text'
complete -c ao -n '__ao_using_command add' -s d -l due -d 'Due date' -r
complete -c ao -n '__ao_using_command add' -s n -l note -d 'Add a note' -r
complete -c ao -n '__ao_using_command add' -l id -d 'Task ID' -r
complete -c ao -n '__ao_using_command add' -l assign -d 'Assign to owner' -r
complete -c ao -n '__ao_using_command add' -l meta -d 'Metadata key=value' -r
complete -c ao -n '__ao_using_command list' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command list' -l plaintext -d 'Output as plain text'
complete -c ao -n '__ao_using_command list' -l search -d 'Search by title' -r
complete -c ao -n '__ao_using_command list' -l owner -d 'Filter by owner' -r
complete -c ao -n '__ao_using_command list' -l sort -a '${SORT_FIELDS.join(" ")}' -d 'Sort order' -r
complete -c ao -n '__ao_using_command list' -s a -l all -d 'Include done tasks'
complete -c ao -n '__ao_using_command list' -l actionable -d 'Show only actionable tasks'
complete -c ao -n '__ao_using_command list' -l limit -d 'Maximum number of tasks' -r
complete -c ao -n '__ao_using_command list' -l offset -d 'Number of tasks to skip' -r
complete -c ao -n '__ao_using_command get' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command get' -l plaintext -d 'Output as plain text'
complete -c ao -n '__ao_using_command update' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command update' -l plaintext -d 'Output as plain text'
complete -c ao -n '__ao_using_command update' -s t -l title -d 'New title' -r
complete -c ao -n '__ao_using_command update' -s d -l due -d 'Due date' -r
complete -c ao -n '__ao_using_command update' -s n -l note -d 'Append a note' -r
complete -c ao -n '__ao_using_command update' -l assign -d 'Assign to owner' -r
complete -c ao -n '__ao_using_command update' -l clear-notes -d 'Remove all notes'
complete -c ao -n '__ao_using_command update' -l meta -d 'Metadata key=value' -r
complete -c ao -n '__ao_using_command delete' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command delete' -l plaintext -d 'Output as plain text'
complete -c ao -n '__ao_using_command done' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command done' -l plaintext -d 'Output as plain text'
complete -c ao -n '__ao_using_command start' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command start' -l plaintext -d 'Output as plain text'
complete -c ao -n '__ao_using_command review' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command review' -l plaintext -d 'Output as plain text'
complete -c ao -n '__ao_using_command log' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command log' -l plaintext -d 'Output as plain text'
complete -c ao -n '__ao_using_command sync' -l json -d 'Output as JSON'
complete -c ao -n '__ao_using_command sync' -l plaintext -d 'Output as plain text'
`;
}
