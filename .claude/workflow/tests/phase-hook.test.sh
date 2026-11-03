#!/usr/bin/env bash
# Tests for ../phase-hook.sh with CLAUDE_CONFIG_DIR in a mktemp -d dir, removed on exit.
#
#   bash .claude/workflow/tests/phase-hook.test.sh
set -uo pipefail
HOOK=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)/phase-hook.sh
T=$(mktemp -d) || { echo "mktemp failed" >&2; exit 1; }
trap 'rm -rf -- "$T"' EXIT
export CLAUDE_CONFIG_DIR="$T"

fails=0
# expect <name> <session> <phase or "none"> <hook input json>
expect() {
  local got
  bash "$HOOK" <<<"$4" || { printf 'FAIL %s (nonzero exit)\n' "$1"; fails=$((fails + 1)); return; }
  got=$(cat "$T/workflow-state/$2" 2>/dev/null || echo none)
  if [ "$got" = "$3" ]; then printf 'ok   %s\n' "$1"; else printf 'FAIL %s (got %s)\n' "$1" "$got"; fails=$((fails + 1)); fi
}

expect "phase outside /work stays auto" s1 none '{"session_id":"s1","tool_input":{"skill":"workflow-build"}}'
expect "other prompt stays auto" s1 none '{"session_id":"s1","prompt":"/workflow-plan x"}'
expect "typed /work starts plan" s1 plan '{"session_id":"s1","prompt":"/work fix the badge"}'
expect "later phase tracked" s1 build '{"session_id":"s1","tool_input":{"subagent_type":"wf-builder"}}'
expect "plain prompt keeps phase" s1 build '{"session_id":"s1","prompt":"looks good"}'
expect "bare /work restarts plan" s1 plan '{"session_id":"s1","prompt":"/work"}'
expect "bad session id ignored" ../x none '{"session_id":"../x","prompt":"/work"}'

[ "$fails" -eq 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
