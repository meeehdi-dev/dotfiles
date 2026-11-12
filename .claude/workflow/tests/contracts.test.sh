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
for contract in \
  'task-root ancestor chain and nested CLAUDE.md under affected paths' \
  'never sibling repositories or a whole home/config tree' \
  'honor explicitly referenced external instructions' \
  'Context reuse is within this agent, not across fresh agents' \
  'First review after feature builds: independent whole-plan review' \
  'Never narrow an explicitly requested standalone review' \
  'workflow/review-evidence.mjs' \
  'compare --root /absolute/task --evidence /prior.json' \
  'do not hash newly created workflow artifacts as source changes' \
  'implementation and relevant dependencies remain valid' \
  'same-file changes require inspecting affected behavior' \
  'Never reconstruct old diffs/patches' \
  'Verify that the new manifest matches the inspected-state capture' \
  'Concurrent changes invalidate affected conclusions' \
  'Independently run focused checks for changed behavior' \
  'relevant source/test/config/dependency inputs and known runtime/environment' \
  'A file manifest alone cannot prove environment validity' \
  'previous failures, or explicit plan/project freshness requirements' \
  'newly run (exact command/result and checked state)' \
  'reused (prior report/state, exact result and reason inputs/environment remain valid)' \
  'failed, or not checked (reason/impact)' \
  'A builder pass is check evidence, never independent review'; do
  check "$contract" grep -Fq "$contract" "$ROOT/workflow/rules.md"
done
for prompt in "$ROOT"/skills/workflow-{build,review,ui}/SKILL.md "$ROOT"/agents/wf-{builder,orchestrator}.md; do
  check "$prompt evidence handoff" grep -q 'compact evidence handoff' "$prompt"
  check "$prompt evidence path" grep -q 'latest review evidence path' "$prompt"
  check "$prompt check provenance" grep -q 'checked-state' "$prompt"
done
check 'reviewer captures evidence' grep -q 'workflow/review-evidence.mjs' "$ROOT/agents/wf-reviewer.md"
check 'reviewer writes only reports/evidence' grep -q 'write only reports and new review evidence artifacts' "$ROOT/agents/wf-reviewer.md"
check 'reviewer check provenance' grep -q 'newly run, reused with provenance/reason, failed or not checked' "$ROOT/agents/wf-reviewer.md"
check 'finalize referenced manifests only' grep -q 'review evidence manifests only through report references' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'finalize verifies manifest identity' grep -q 'verify same-task membership and identity' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'finalize deletes only verified manifests' grep -q 'including the verified referenced evidence manifests' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'finalize never deletes source or sessions' grep -q 'Never delete the summary, directories, source/config files, journals, session logs' "$ROOT/skills/workflow-finalize/SKILL.md"
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
# Exercise the existing workflow-directory link, not a real-profile install.
mkdir "$T/source"
printf 'fixture\n' > "$T/source/check.txt"
node "$T/config/workflow/review-evidence.mjs" capture --root "$T/source" --file check.txt --output "$T/evidence.json" > "$T/capture.json"
node "$T/config/workflow/review-evidence.mjs" compare --root "$T/source" --file check.txt --evidence "$T/evidence.json" > "$T/compare.json"
check 'installed-style helper path captures evidence' jq -e '.uncertainty == [] and .exhaustive == false' "$T/capture.json"
check 'installed-style helper comparison' jq -e '.unchanged == ["check.txt"] and .added == [] and .modified == [] and .deleted == [] and .uncertainty == []' "$T/compare.json"
echo 'all workflow contracts passed'
