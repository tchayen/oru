import { STATUSES, PRIORITIES } from "../tasks/types";
import { SORT_FIELDS } from "../tasks/repository";
import { SHOW_SERVER } from "../flags";

export function generateZshCompletions(): string {
  return `#compdef oru
# oru shell completions for zsh
# Install: oru completions zsh
# Print:   oru completions zsh --print

_oru() {
  local -a commands
  commands=(
    'add:Add a new task'
    'list:List tasks'
    'labels:List all labels in use'
    'get:Get a task by ID'
    'update:Update a task'
    'edit:Open task in $EDITOR for complex edits'
    'delete:Delete one or more tasks'
    'done:Mark one or more tasks as done'
    'start:Start one or more tasks'
    'review:Mark one or more tasks as in_review'
    'context:Show a summary of what needs your attention'
    'log:Show change history of a task'
    'sync:Sync with a filesystem remote'
    'config:Manage configuration'
    'filter:Manage saved list filters'${SHOW_SERVER ? "\n    'server:Manage the HTTP server'" : ""}
    'completions:Generate shell completions'
    'backup:Create a database backup snapshot'
    'self-update:Update oru to the latest version'
    'telemetry:Manage anonymous usage telemetry'
  )

  local -a status_values
  status_values=(${STATUSES.join(" ")})

  local -a priority_values
  priority_values=(${PRIORITIES.join(" ")})

  local -a sort_values
  sort_values=(${SORT_FIELDS.join(" ")})

  _arguments -C \\
    '1:command:->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe -t commands 'oru command' commands
      ;;
    args)
      case $words[1] in
        add)
          _arguments \\
            '--id[Task ID]:id:' \\
            '(-s --status)'{-s,--status}'[Initial status]:status:('"$status_values"')' \\
            '(-p --priority)'{-p,--priority}'[Priority level]:priority:('"$priority_values"')' \\
            '(-d --due)'{-d,--due}'[Due date]:date:' \\
            '--assign[Assign to owner]:owner:' \\
            '*'{-l,--label}'[Add labels]:label:->labels' \\
            '(-b --blocked-by)'{-b,--blocked-by}'[Blocked by task ID]:task:' \\
            '(-n --note)'{-n,--note}'[Add a note]:note:' \\
            '(-r --repeat)'{-r,--repeat}'[Recurrence rule]:rule:' \\
            '--tz[IANA timezone for due date]:timezone:' \\
            '--meta[Metadata key=value]:meta:' \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]' \\
            '1:title:'
          ;;
        list)
          _arguments \\
            '(-s --status)'{-s,--status}'[Filter by status]:status:('"$status_values"')' \\
            '(-p --priority)'{-p,--priority}'[Filter by priority]:priority:('"$priority_values"')' \\
            '(-l --label)'{-l,--label}'[Filter by label]:label:->labels' \\
            '--owner[Filter by owner]:owner:' \\
            '--due[Filter by due date]:date:' \\
            '--overdue[Show only overdue tasks]' \\
            '--sort[Sort order]:sort:('"$sort_values"')' \\
            '--search[Search by title]:query:' \\
            '(-a --all)'{-a,--all}'[Include done tasks]' \\
            '--actionable[Show only actionable tasks]' \\
            '--limit[Maximum number of tasks to return]:number:' \\
            '--offset[Number of tasks to skip]:number:' \\
            '--filter[Apply a saved filter]:name:' \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]'
          ;;
        filter)
          local -a filter_commands
          filter_commands=(
            'list:List all saved filters'
            'show:Show a filter definition'
            'add:Save a new named filter'
            'remove:Delete a saved filter'
          )
          _describe -t commands 'filter command' filter_commands
          ;;
        labels)
          _arguments \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]'
          ;;
        get)
          _arguments \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]' \\
            '1:task:->tasks'
          ;;
        update)
          _arguments \\
            '(-t --title)'{-t,--title}'[New title]:title:' \\
            '(-s --status)'{-s,--status}'[New status]:status:('"$status_values"')' \\
            '(-p --priority)'{-p,--priority}'[New priority]:priority:('"$priority_values"')' \\
            '(-d --due)'{-d,--due}'[Due date]:date:' \\
            '--assign[Assign to owner]:owner:' \\
            '*'{-l,--label}'[Add labels]:label:->labels' \\
            '*--unlabel[Remove labels]:label:->labels' \\
            '(-b --blocked-by)'{-b,--blocked-by}'[Blocked by task ID]:task:' \\
            '*--unblock[Remove blocker task IDs]:task:' \\
            '(-n --note)'{-n,--note}'[Append a note]:note:' \\
            '--clear-notes[Remove all notes]' \\
            '(-r --repeat)'{-r,--repeat}'[Recurrence rule]:rule:' \\
            '--tz[IANA timezone for due date]:timezone:' \\
            '--meta[Metadata key=value]:meta:' \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]' \\
            '1:task:->tasks'
          ;;
        edit)
          _arguments \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]' \\
            '1:task:->tasks'
          ;;
        delete)
          _arguments \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]' \\
            '*:task:->tasks'
          ;;
        done)
          _arguments \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]' \\
            '*:task:->tasks'
          ;;
        start)
          _arguments \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]' \\
            '*:task:->tasks'
          ;;
        review)
          _arguments \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]' \\
            '*:task:->tasks'
          ;;
        context)
          _arguments \\
            '--owner[Scope to a specific owner]:owner:' \\
            '(-l --label)'{-l,--label}'[Filter by labels]:label:' \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]'
          ;;
        log)
          _arguments \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]' \\
            '1:task:->tasks'
          ;;
        sync)
          _arguments \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]' \\
            '1:remote path:_files'
          ;;
        config)
          local -a config_commands
          config_commands=(
            'init:Create a default config file'
            'path:Print the config file path'
          )
          _describe -t commands 'config command' config_commands
          ;;
${
  SHOW_SERVER
    ? `        server)
          local -a server_commands
          server_commands=(
            'start:Start the server'
          )
          _arguments -C \\
            '1:command:->server_command' \\
            '*::arg:->server_args'
          case $state in
            server_command)
              _describe -t commands 'server command' server_commands
              ;;
            server_args)
              case $words[1] in
                start)
                  _arguments \\
                    '--port[Port to listen on]:port:' \\
                    '--tunnel[Create a public tunnel]'
                  ;;
              esac
              ;;
          esac
          ;;`
    : ""
}        completions)
          _arguments \\
            '--print[Print completion script to stdout]' \\
            '1:shell:(bash zsh fish)'
          ;;
        backup)
          _arguments \\
            '1:backup directory:_directories'
          ;;
        self-update)
          _arguments \\
            '--check[Only check if an update is available]'
          ;;
        telemetry)
          local -a telemetry_commands
          telemetry_commands=(
            'status:Show whether telemetry is enabled or disabled'
            'enable:Enable anonymous usage telemetry'
            'disable:Disable anonymous usage telemetry'
          )
          _describe -t commands 'telemetry command' telemetry_commands
          ;;
      esac

      case $state in
        tasks)
          local -a task_ids
          task_ids=(\${(f)"$(oru _complete tasks "$words[CURRENT]" 2>/dev/null)"})
          if (( \${#task_ids} )); then
            local -a descriptions
            for entry in $task_ids; do
              local id=\${entry%%$'\\t'*}
              local title=\${entry#*$'\\t'}
              descriptions+=("\${id}:\${title}")
            done
            _describe -t tasks 'task' descriptions
          fi
          ;;
        labels)
          local -a label_list
          label_list=(\${(f)"$(oru _complete labels "$words[CURRENT]" 2>/dev/null)"})
          compadd -a label_list
          ;;
      esac
      ;;
  esac
}

_oru "$@"
`;
}
