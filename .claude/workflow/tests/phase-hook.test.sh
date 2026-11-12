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

# Entering Finalize is not completion: failures/cancellation retain its badge.
expect "finalize entry retains tracking" s1 finalize '{"session_id":"s1","tool_input":{"skill":"workflow-finalize"}}'
expect "cancelled or failed finalize stays active" s1 finalize '{"session_id":"s1","prompt":"that failed"}'
if bash "$HOOK" end ../s1 2>/dev/null; then echo 'FAIL unsafe end accepted'; fails=$((fails + 1)); fi
expect "invalid end preserves active state" s1 finalize '{"session_id":"s1","prompt":"wait"}'
expect "another session starts" s2 plan '{"session_id":"s2","prompt":"/work other"}'
bash "$HOOK" end s1 || fails=$((fails + 1))
expect "successful completion clears badge and deactivates tracking" s1 none '{"session_id":"s1","tool_input":{"skill":"workflow-build"}}'
expect "other session remains active" s2 plan '{"session_id":"s2","prompt":"wait"}'
bash "$HOOK" end s2 || fails=$((fails + 1))
expect "explicit exit clears badge" s2 none '{"session_id":"s2","prompt":"continue ordinary chat"}'
expect "new work after exit starts Plan" s1 plan '{"session_id":"s1","prompt":"/work next"}'
mkdir "$T/workflow-state/failure"
if bash "$HOOK" end failure 2>/dev/null; then echo 'FAIL end hid removal failure'; fails=$((fails + 1)); fi
[ -d "$T/workflow-state/failure" ] || { echo 'FAIL end removed unexpected directory'; fails=$((fails + 1)); }

[ "$fails" -eq 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
