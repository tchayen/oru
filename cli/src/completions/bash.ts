import { STATUSES, PRIORITIES } from "../tasks/types.js";
import { SORT_FIELDS } from "../tasks/repository.js";

export function generateBashCompletions(): string {
  return `# ao shell completions for bash
# Install: ao completions bash >> ~/.bashrc

_ao_completions() {
  local cur prev words cword
  _init_completion || return

  local commands="add list labels get update delete done start review context log sync config server completions"
  local config_subcommands="init path"
  local server_subcommands="start"
  local completion_shells="bash zsh fish"
  local status_values="${STATUSES.join(" ")}"
  local priority_values="${PRIORITIES.join(" ")}"
  local sort_values="${SORT_FIELDS.join(" ")}"

  # Determine the subcommand
  local subcmd=""
  local i
  for ((i = 1; i < cword; i++)); do
    case "\${words[i]}" in
      add|list|labels|get|update|delete|done|start|review|context|log|sync|config|server|completions)
        subcmd="\${words[i]}"
        break
        ;;
    esac
  done

  # Handle flag values
  case "$prev" in
    -s|--status)
      COMPREPLY=($(compgen -W "$status_values" -- "$cur"))
      return
      ;;
    -p|--priority)
      COMPREPLY=($(compgen -W "$priority_values" -- "$cur"))
      return
      ;;
    -l|--label|--unlabel)
      local labels
      labels=$(ao _complete labels "$cur" 2>/dev/null)
      COMPREPLY=($(compgen -W "$labels" -- "$cur"))
      return
      ;;
    --sort)
      COMPREPLY=($(compgen -W "$sort_values" -- "$cur"))
      return
      ;;
  esac

  case "$subcmd" in
    "")
      COMPREPLY=($(compgen -W "$commands" -- "$cur"))
      ;;
    config)
      COMPREPLY=($(compgen -W "$config_subcommands" -- "$cur"))
      ;;
    server)
      if [[ "$prev" == "start" ]] && [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--port --tunnel" -- "$cur"))
      else
        COMPREPLY=($(compgen -W "$server_subcommands" -- "$cur"))
      fi
      ;;
    completions)
      COMPREPLY=($(compgen -W "$completion_shells" -- "$cur"))
      ;;
    list)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "-s --status -p --priority -l --label --owner --due --overdue --sort --search -a --all --actionable --limit --offset --json --plaintext" -- "$cur"))
      fi
      ;;
    labels)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--json --plaintext" -- "$cur"))
      fi
      ;;
    add)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--id -s --status -p --priority -d --due --assign -l --label -b --blocked-by -n --note --meta --json --plaintext" -- "$cur"))
      fi
      ;;
    update)
      if [[ "$cur" != -* ]]; then
        local tasks
        tasks=$(ao _complete tasks "$cur" 2>/dev/null | cut -f1)
        COMPREPLY=($(compgen -W "$tasks" -- "$cur"))
      else
        COMPREPLY=($(compgen -W "-t --title -s --status -p --priority -d --due --assign -l --label --unlabel -b --blocked-by -n --note --clear-notes --meta --json --plaintext" -- "$cur"))
      fi
      ;;
    context)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--owner --json --plaintext" -- "$cur"))
      fi
      ;;
    get|delete|done|start|review|log)
      if [[ "$cur" != -* ]]; then
        local tasks
        tasks=$(ao _complete tasks "$cur" 2>/dev/null | cut -f1)
        COMPREPLY=($(compgen -W "$tasks" -- "$cur"))
      fi
      ;;
    sync)
      _filedir
      ;;
  esac
}

complete -F _ao_completions ao
`;
}
