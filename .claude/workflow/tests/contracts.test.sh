#!/usr/bin/env bash
# Agent/instruction and installer integration checks in disposable config dirs; no real-profile install.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
T=$(mktemp -d)
trap 'rm -rf -- "$T"' EXIT
check() { local name=$1; shift; "$@" || { echo "FAIL $name" >&2; exit 1; }; echo "ok $name"; }
for entry in explorer:sonnet:medium planner:opus:high builder:sonnet:high reviewer:opus:high; do
  IFS=: read -r agent model effort <<<"$entry"
  check "$agent model" grep -qx "model: $model" "$ROOT/agents/$agent.md"
  check "$agent effort" grep -qx "effort: $effort" "$ROOT/agents/$agent.md"
done
for agent in explorer planner reviewer; do
  check "$agent read-only" grep -qx 'disallowedTools: Edit, NotebookEdit, Agent' "$ROOT/agents/$agent.md"
done
check 'no auto-chaining' grep -q "don't chain plan → build → review automatically" "$ROOT/CLAUDE.md"
if grep -En '/work|wf-|workflow phase|rules\.md' "$ROOT/CLAUDE.md" "$ROOT/rules/agents.md" "$ROOT"/agents/*.md; then
  echo 'FAIL stale /work workflow references' >&2; exit 1
fi

mkdir "$T/config" "$T/fresh"
hook='{"matcher":"Skill|Agent","hooks":[{"type":"command","command":"bash ~/.claude/workflow/phase-hook.sh"}]}'
prompt_hook='{"hooks":[{"type":"command","command":"bash ~/.claude/workflow/phase-hook.sh"}]}'
custom='{"matcher":"Bash","hooks":[{"type":"command","command":"echo custom"}]}'
# A user-modified group containing our old command must not be rewritten or removed.
mixed='{"matcher":"Skill|Agent","hooks":[{"type":"command","command":"bash ~/.claude/workflow/phase-hook.sh"},{"type":"command","command":"echo custom"}]}'
jq -n --argjson h "$hook" --argjson ph "$prompt_hook" --argjson c "$custom" --argjson m "$mixed" \
  '{worktree:{baseRef:"custom"},unrelated:true,hooks:{PreToolUse:[$h,$c,$m],UserPromptSubmit:[$ph],Stop:[$c]}}' > "$T/config/settings.json"
# link.sh writes only into the explicitly supplied disposable fixture dirs.
bash "$ROOT/link.sh" "$T/config" "$T/fresh" > "$T/install-output"
check 'existing worktree preference and unrelated settings preserved' jq -e '.worktree.baseRef == "custom" and .unrelated == true' "$T/config/settings.json"
check 'only exact old hook registrations removed' jq -e --argjson c "$custom" --argjson m "$mixed" \
  '.hooks.PreToolUse == [$c,$m] and .hooks.UserPromptSubmit == [] and .hooks.Stop == [$c]' "$T/config/settings.json"
check 'fresh settings have no phase hooks or worktree preference' jq -e \
  '(has("worktree") | not) and (has("hooks") | not)' "$T/fresh/settings.json"
check 'statusline still installed' jq -e '.statusLine.command == "bash ~/.claude/workflow/statusline.sh"' "$T/fresh/settings.json"
cp "$T/config/settings.json" "$T/before"
bash "$ROOT/link.sh" "$T/config" > "$T/repeat-output"
check 'installer remains idempotent' cmp "$T/before" "$T/config/settings.json"
check 'ponytail extras turned off' jq -e '.skillOverrides["ponytail:ponytail-audit"] == "off"' "$T/fresh/settings.json"

# Skills pi reads from ~/.agents/skills are shared by link; a missing one is skipped.
mkdir -p "$T/home/.agents/skills/gh" "$T/shared"
HOME="$T/home" bash "$ROOT/link.sh" "$T/shared" > /dev/null
check 'shared skill linked' test "$(readlink "$T/shared/skills/gh")" = ../../home/.agents/skills/gh
check 'missing shared skill skipped' test ! -e "$T/shared/skills/herdr"

# Preserve fail-closed handling of settings conflicts and invalid input.
mkdir "$T/conflict" "$T/invalid"
printf '%s\n' '{"statusLine":{"type":"command","command":"my-statusline"}}' > "$T/conflict/settings.json"
printf '%s\n' 'not json' > "$T/invalid/settings.json"
cp "$T/conflict/settings.json" "$T/conflict-before"
cp "$T/invalid/settings.json" "$T/invalid-before"
if bash "$ROOT/link.sh" "$T/conflict" "$T/invalid" > "$T/conflict-output"; then echo 'FAIL invalid/conflicting settings accepted' >&2; exit 1; fi
check 'custom statusline unchanged' cmp "$T/conflict-before" "$T/conflict/settings.json"
check 'invalid settings unchanged' cmp "$T/invalid-before" "$T/invalid/settings.json"
check 'conflicting profile not linked' test ! -e "$T/conflict/workflow"
check 'invalid profile not linked' test ! -e "$T/invalid/workflow"

# Retired /work links whose source is gone are removed; unrelated links stay.
mkdir -p "$T/retired/skills" "$T/retired/agents"
ln -s "$ROOT/skills/work" "$T/retired/skills/work"
ln -s "$ROOT/agents/wf-builder.md" "$T/retired/agents/wf-builder.md"
ln -s /nonexistent/elsewhere "$T/retired/skills/other"
bash "$ROOT/link.sh" "$T/retired" > /dev/null
check 'retired skill link removed' test ! -L "$T/retired/skills/work"
check 'retired agent link removed' test ! -L "$T/retired/agents/wf-builder.md"
check 'unrelated dangling link kept' test -L "$T/retired/skills/other"
check 'new agents linked' test -e "$T/retired/agents/planner.md"
echo 'all contracts passed'
