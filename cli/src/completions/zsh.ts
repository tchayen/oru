import { STATUSES, PRIORITIES } from "../tasks/types.js";

export function generateZshCompletions(): string {
  return `#compdef ao
# ao shell completions for zsh
# Install:
#   mkdir -p ~/.zsh/completions
#   ao completions zsh > ~/.zsh/completions/_ao
#   # Add to .zshrc before compinit: fpath=(~/.zsh/completions $fpath)

_ao() {
  local -a commands
  commands=(
    'add:Add a new task'
    'list:List tasks'
    'labels:List all labels in use'
    'get:Get a task by ID'
    'update:Update a task'
    'delete:Delete one or more tasks'
    'done:Mark one or more tasks as done'
    'start:Start one or more tasks'
    'sync:Sync with a filesystem remote'
    'config:Manage configuration'
    'server:Manage the HTTP server'
    'completions:Generate shell completions'
  )

  local -a status_values
  status_values=(${STATUSES.join(" ")})

  local -a priority_values
  priority_values=(${PRIORITIES.join(" ")})

  _arguments -C \\
    '1:command:->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe -t commands 'ao command' commands
      ;;
    args)
      case $words[1] in
        add)
          _arguments \\
            '--id[Task ID]:id:' \\
            '(-s --status)'{-s,--status}'[Initial status]:status:('"$status_values"')' \\
            '(-p --priority)'{-p,--priority}'[Priority level]:priority:('"$priority_values"')' \\
            '(-d --due)'{-d,--due}'[Due date]:date:' \\
            '*'{-l,--label}'[Add labels]:label:->labels' \\
            '(-n --note)'{-n,--note}'[Add a note]:note:' \\
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
            '--search[Search by title]:query:' \\
            '(-a --all)'{-a,--all}'[Include done tasks]' \\
            '--limit[Maximum number of tasks to return]:number:' \\
            '--offset[Number of tasks to skip]:number:' \\
            '--json[Output as JSON]' \\
            '--plaintext[Output as plain text]'
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
            '*'{-l,--label}'[Add labels]:label:->labels' \\
            '*--unlabel[Remove labels]:label:->labels' \\
            '(-n --note)'{-n,--note}'[Append a note]:note:' \\
            '--meta[Metadata key=value]:meta:' \\
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
        server)
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
          ;;
        completions)
          local -a shells
          shells=(bash zsh fish)
          _describe -t shells 'shell' shells
          ;;
      esac

      case $state in
        tasks)
          local -a task_ids
          task_ids=(\${(f)"$(ao _complete tasks "$words[CURRENT]" 2>/dev/null)"})
          if (( \${#task_ids} )); then
            local -a descriptions
            for entry in $task_ids; do
              local id=\${entry%%\$'\\t'*}
              local title=\${entry#*\$'\\t'}
              descriptions+=("\${id}:\${title}")
            done
            _describe -t tasks 'task' descriptions
          fi
          ;;
        labels)
          local -a label_list
          label_list=(\${(f)"$(ao _complete labels "$words[CURRENT]" 2>/dev/null)"})
          compadd -a label_list
          ;;
      esac
      ;;
  esac
}

_ao "$@"
`;
}
