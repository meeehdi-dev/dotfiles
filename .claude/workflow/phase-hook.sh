#!/usr/bin/env bash
# PreToolUse (matcher Skill|Agent) and UserPromptSubmit hook: records the workflow phase per session
# for statusline.sh. A typed /work is expanded as a slash command, never a Skill call, so its prompt starts tracking.
# Hook invocation never blocks a tool. Explicit `end <session-id>` reports failures.
if [ "$#" -gt 0 ]; then
  [ "$#" -eq 2 ] && [ "$1" = end ] && [[ "$2" =~ ^[A-Za-z0-9_-]+$ ]] || { echo 'usage: phase-hook.sh end <session-id>' >&2; exit 2; }
  rm -f -- "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/workflow-state/$2"
  exit $?
fi
input=$(cat)
read -r session name < <(jq -r '[.session_id // "", .tool_input.skill // .tool_input.subagent_type // (if (.prompt // "") | test("^/work(\\s|$)") then "work" else "" end)] | @tsv' <<<"$input" 2>/dev/null)
case "$name" in
  work|workflow-plan) phase=plan ;;
  workflow-build|wf-orchestrator|wf-builder) phase=build ;;
  workflow-review|wf-reviewer) phase=review ;;
  workflow-ui) phase=ui ;;
  workflow-finalize) phase=finalize ;;
  *) exit 0 ;;
esac
# session_id comes from Claude Code; refuse anything that could escape the state dir
[[ "$session" =~ ^[A-Za-z0-9_-]+$ ]] || exit 0
dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/workflow-state"
# only /work starts tracking a session; other phases outside /work leave the badge on auto
[ "$name" = work ] || [ -f "$dir/$session" ] || exit 0
mkdir -p "$dir" && printf '%s\n' "$phase" > "$dir/$session"
exit 0
