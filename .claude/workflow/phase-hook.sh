#!/usr/bin/env bash
# PreToolUse hook (matcher Skill|Agent): records the workflow phase per session for statusline.sh.
# Never blocks a tool: always exits 0.
input=$(cat)
read -r session name < <(jq -r '[.session_id // "", .tool_input.skill // .tool_input.subagent_type // ""] | @tsv' <<<"$input" 2>/dev/null)
case "$name" in
  work|workflow-plan) phase=plan ;;
  workflow-build|wf-builder) phase=build ;;
  workflow-review|wf-reviewer) phase=review ;;
  workflow-ui) phase=ui ;;
  workflow-finalize) phase=finalize ;;
  *) exit 0 ;;
esac
# session_id comes from Claude Code; refuse anything that could escape the state dir
[[ "$session" =~ ^[A-Za-z0-9_-]+$ ]] || exit 0
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/workflow-state"
mkdir -p "$dir" && printf '%s\n' "$phase" > "$dir/$session"
exit 0
