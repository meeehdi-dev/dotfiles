#!/usr/bin/env bash
# Static prompt contracts and installer settings in a disposable config dir; no installation into HOME.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
T=$(mktemp -d)
trap 'rm -rf -- "$T"' EXIT
check() { local name=$1; shift; "$@" || { echo "FAIL $name" >&2; exit 1; }; echo "ok $name"; }
if grep -En 'EnterWorktree|ExitWorktree|task.sh (init|info|cleanup|verify-merge)|git (commit|push|merge|clean)|gh pr create|## Preparation' \
  "$ROOT"/skills/*/SKILL.md "$ROOT"/agents/wf-*.md "$ROOT/workflow/rules.md" "$ROOT/CLAUDE.md" "$ROOT/rules/agents.md"; then
  echo 'FAIL stale workflow authority' >&2; exit 1
fi
for agent in builder reviewer orchestrator; do
  check "$agent latest-state context" grep -q 'latest authoritative progress/review state' "$ROOT/agents/wf-$agent.md"
done
check 'follow-up coverage expansion' grep -q 'Expand to whole-plan review when shared contracts change' "$ROOT/workflow/rules.md"
check 'incomplete checkpoint evidence' grep -q 'Mark it incomplete, never clean' "$ROOT/workflow/rules.md"
check 'finalize verifies before deletion' grep -q 'Failure → delete nothing' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'finalize ends badge only on success' grep -q 'On success run.*phase-hook.sh end' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'only user can invoke work' grep -qx 'disable-model-invocation: true' "$ROOT/skills/work/SKILL.md"
check 'session substitution passed at entry' grep -q '\${CLAUDE_SESSION_ID}' "$ROOT/skills/work/SKILL.md"
for entry in orchestrator:sonnet:medium builder:sonnet:high reviewer:opus:high; do
  IFS=: read -r agent model effort <<<"$entry"
  check "$agent model unchanged" grep -qx "model: $model" "$ROOT/agents/wf-$agent.md"
  check "$agent effort unchanged" grep -qx "effort: $effort" "$ROOT/agents/wf-$agent.md"
done
mkdir "$T/config" "$T/fresh"
printf '%s\n' '{"worktree":{"baseRef":"custom"},"unrelated":true}' > "$T/config/settings.json"
# link.sh only writes links/settings/band marker inside the explicitly supplied fixture dirs.
bash "$ROOT/link.sh" "$T/config" "$T/fresh" > "$T/install-output"
check 'existing worktree preference preserved without conflict' jq -e '.worktree.baseRef == "custom" and .unrelated == true' "$T/config/settings.json"
check 'fresh settings do not inject worktree preference' jq -e 'has("worktree") | not' "$T/fresh/settings.json"
cp "$T/config/settings.json" "$T/before"
bash "$ROOT/link.sh" "$T/config" > "$T/repeat-output"
check 'installer remains idempotent' cmp "$T/before" "$T/config/settings.json"
echo 'all workflow contracts passed'
