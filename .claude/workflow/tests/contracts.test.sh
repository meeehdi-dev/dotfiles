#!/usr/bin/env bash
# Prompt-policy and installer integration checks in disposable config dirs; no real-profile install.
set -euo pipefail
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
T=$(mktemp -d)
trap 'rm -rf -- "$T"' EXIT
check() { local name=$1; shift; "$@" || { echo "FAIL $name" >&2; exit 1; }; echo "ok $name"; }
if grep -En 'EnterWorktree|ExitWorktree|task.sh (init|info|cleanup|verify-merge)|git (commit|push|merge|clean)|gh pr create|## Preparation|phase-hook.sh|CLAUDE_SESSION_ID' \
  "$ROOT"/skills/*/SKILL.md "$ROOT"/agents/wf-*.md "$ROOT/workflow/rules.md" "$ROOT/CLAUDE.md" "$ROOT/rules/agents.md"; then
  echo 'FAIL stale workflow authority or display bookkeeping' >&2; exit 1
fi
for agent in builder reviewer orchestrator; do
  check "$agent current-state context" grep -q 'current state, and active feedback' "$ROOT/agents/wf-$agent.md"
done
check 'approval starts build immediately' grep -Fq 'Explicit browser or chat approval → immediately invoke `workflow-build`' "$ROOT/skills/workflow-plan/SKILL.md"
check 'automatic independent initial review' grep -q 'automatically run an independent whole-plan review' "$ROOT/agents/wf-orchestrator.md"
check 'focused correction loop' grep -q 'in-scope findings → focused builder → focused follow-up reviewer' "$ROOT/agents/wf-orchestrator.md"
check 'coverage expansion' grep -q 'Expand review when shared contracts change' "$ROOT/workflow/rules.md"
check 'standalone scope preserved' grep -q 'Never narrow an explicitly requested standalone review' "$ROOT/workflow/rules.md"
check 'fingerprints optional' grep -q 'Fingerprint manifests are optional' "$ROOT/workflow/rules.md"
check 'reviewer independent focused checks' grep -q 'Independently run focused checks' "$ROOT/agents/wf-reviewer.md"
check 'reviewer writes only reports/evidence' grep -q 'Write only review reports and optional evidence artifacts, never source/config' "$ROOT/agents/wf-reviewer.md"
check 'no inferred authority' grep -q 'Never infer authority' "$ROOT/workflow/rules.md"
check 'explicit authority for risky actions' grep -Fq 'No new scope/design, dependencies, installs, lockfile/snapshot updates, migrations, destructive actions, E2E, or deployment without explicit task authority' "$ROOT/workflow/rules.md"
check 'Git read-only' grep -q 'Git is read-only unless explicitly authorized' "$ROOT/workflow/rules.md"
check 'cancel waits for chat' grep -q 'Cancellation means wait for chat' "$ROOT/workflow/rules.md"
check 'finalize project retention' grep -q 'Honor project/user documentation locations and retention instructions' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'one final decision record' grep -q 'keep one concise standalone decision record' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'finalize verifies before deletion' grep -q 'Read the record back against its sources before deleting anything' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'finalize narrow artifact set' grep -q 'identified, fully consolidated, unshared artifacts' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'optional manifests verified' grep -q 'same-task root/kind/scope/revision identity' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'failed verification deletes nothing' grep -q 'Failure → delete nothing' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'finalize protects source and history' grep -q 'Never delete the final record, directories, source/config files, unrelated docs, journals, session logs, or Plannotator history' "$ROOT/skills/workflow-finalize/SKILL.md"
check 'only user can invoke work' grep -qx 'disable-model-invocation: true' "$ROOT/skills/work/SKILL.md"
for entry in orchestrator:sonnet:medium builder:sonnet:high reviewer:opus:high; do
  IFS=: read -r agent model effort <<<"$entry"
  check "$agent model unchanged" grep -qx "model: $model" "$ROOT/agents/wf-$agent.md"
  check "$agent effort unchanged" grep -qx "effort: $effort" "$ROOT/agents/wf-$agent.md"
done

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

# Exercise the shared helper through its installed-style link, not a real profile.
mkdir "$T/source"
printf 'fixture\n' > "$T/source/check.txt"
node "$T/config/workflow/review-evidence.mjs" capture --root "$T/source" --file check.txt --output "$T/evidence.json" > "$T/capture.json"
node "$T/config/workflow/review-evidence.mjs" compare --root "$T/source" --file check.txt --evidence "$T/evidence.json" > "$T/compare.json"
check 'installed-style helper captures evidence' jq -e '.uncertainty == [] and .exhaustive == false' "$T/capture.json"
check 'installed-style helper comparison' jq -e '.unchanged == ["check.txt"] and .added == [] and .modified == [] and .deleted == [] and .uncertainty == []' "$T/compare.json"
echo 'all workflow contracts passed'
