import { STATUSES, PRIORITIES } from "../tasks/types.js";
import { SORT_FIELDS } from "../tasks/repository.js";
import { SHOW_SERVER } from "../flags.js";

export function generateBashCompletions(): string {
  const commands = [
    "add",
    "list",
    "labels",
    "get",
    "update",
    "edit",
    "delete",
    "done",
    "start",
    "review",
    "context",
    "log",
    "sync",
    "config",
    ...(SHOW_SERVER ? ["server"] : []),
    "backup",
    "completions",
    "self-update",
    "telemetry",
  ].join(" ");
  const casePatterns = [
    "add",
    "list",
    "labels",
    "get",
    "update",
    "edit",
    "delete",
    "done",
    "start",
    "review",
    "context",
    "log",
    "sync",
    "config",
    ...(SHOW_SERVER ? ["server"] : []),
    "backup",
    "completions",
    "self-update",
    "telemetry",
  ].join("|");

  const serverBlock = SHOW_SERVER
    ? `    server)
      if [[ "$prev" == "start" ]] && [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--port --tunnel" -- "$cur"))
      else
        COMPREPLY=($(compgen -W "$server_subcommands" -- "$cur"))
      fi
      ;;`
    : "";

  return `# oru shell completions for bash
# Install: oru completions bash
# Print:   oru completions bash --print

_oru_completions() {
  local cur prev words cword
  _init_completion || return

  local commands="${commands}"
  local config_subcommands="init path"${SHOW_SERVER ? '\n  local server_subcommands="start"' : ""}
  local telemetry_subcommands="status enable disable"
  local completion_shells="bash zsh fish"
  local status_values="${STATUSES.join(" ")}"
  local priority_values="${PRIORITIES.join(" ")}"
  local sort_values="${SORT_FIELDS.join(" ")}"

  # Determine the subcommand
  local subcmd=""
  local i
  for ((i = 1; i < cword; i++)); do
    case "\${words[i]}" in
      ${casePatterns})
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
      labels=$(oru _complete labels "$cur" 2>/dev/null)
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
${serverBlock}
    completions)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--print" -- "$cur"))
      else
        COMPREPLY=($(compgen -W "$completion_shells" -- "$cur"))
      fi
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
        COMPREPLY=($(compgen -W "--id -s --status -p --priority -d --due --assign -l --label -b --blocked-by -n --note -r --repeat --meta --json --plaintext" -- "$cur"))
      fi
      ;;
    update|edit)
      if [[ "$cur" != -* ]]; then
        local tasks
        tasks=$(oru _complete tasks "$cur" 2>/dev/null | cut -f1)
        COMPREPLY=($(compgen -W "$tasks" -- "$cur"))
      else
        COMPREPLY=($(compgen -W "-t --title -s --status -p --priority -d --due --assign -l --label --unlabel -b --blocked-by -n --note --clear-notes -r --repeat --meta --json --plaintext" -- "$cur"))
      fi
      ;;
    context)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--owner -l --label --json --plaintext" -- "$cur"))
      fi
      ;;
    get|delete|done|start|review|log)
      if [[ "$cur" != -* ]]; then
        local tasks
        tasks=$(oru _complete tasks "$cur" 2>/dev/null | cut -f1)
        COMPREPLY=($(compgen -W "$tasks" -- "$cur"))
      fi
      ;;
    self-update)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--check" -- "$cur"))
      fi
      ;;
    telemetry)
      COMPREPLY=($(compgen -W "$telemetry_subcommands" -- "$cur"))
      ;;
    sync)
      _filedir
      ;;
    backup)
      _filedir -d
      ;;
  esac
}

complete -F _oru_completions oru
`;
}
