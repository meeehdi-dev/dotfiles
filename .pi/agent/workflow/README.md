# Personal Pi workflow

**Plan → Build each feature → whole-plan Review → focused Build ↔ follow-up Review → optional UI → Finalize**, in one session, in place.

## Usage

- `/work [task or report]` starts Plan in the current repository or folder. Nothing is created: no worktree, branch or metadata file. In Git, the start commit and pre-existing changes are recorded so Review can tell them apart.
- Steer phases in chat. The agent switches with `workflow_phase`, asks finite choices with `workflow_question` and leaves with `workflow_exit`. The status badge shows the phase.
- Plan approval (Plannotator) authorizes the whole build loop. Build makes one call to the `orchestrator` subagent, which runs a fresh `builder` per feature, then an independent `reviewer` on the whole plan. Correction/UI rounds use focused follow-up reviews, expanding to whole-plan when contracts change, coverage is stale or scope is uncertain. Clean means complete plan coverage with no open findings, incomplete features or blockers. Expand the subagent output with Ctrl+O to watch nested agents.
- After a clean review: optional Plannotator code review, then approve to UI or Finalize. UI reviews your running dev server live. Finalize merges the plan and reports into one decision record and stops.

## Files

- `~/.pi/agent/extensions/workflow-modes.ts`: `/work`, the phase tools, prompt injection, badge.
- `~/.pi/agent/extensions/subagent/`: the pi example subagent extension (pi 1.5.0), patched to show nested activity and usage.
- `~/.pi/agent/agents/{orchestrator,builder,reviewer}.md`: agent prompts and models.
- `~/.pi/agent/workflow/`: `rules.md` (shared) and one file per phase.
- Artifacts: plans in `~/.pi/plans/<key>/`, reports in `~/.pi/reviews/<key>/`.

## Context and usage

- Handoffs carry the full plan, latest authoritative progress/review state and active feedback. Prior reports stay linked; read them only for missing/conflicting evidence. Finalize still reads all artifacts before consolidation/deletion.
- Workflow sections no longer embed the full Plannotator manual. Pi discovers the skill normally; agents read it when required and reuse unchanged loaded context.
- Long reviews/audits save incomplete checkpoints at logical boundaries. Replacement reviewers validate evidence against current code. Children still use `--no-session`: checkpoints are not resumable sessions.
- Subagent rows show **Own** usage and **Total (incl. nested)** usage. Totals include recorded live/failed children, count each call once and prefer finished results over live snapshots. Context size belongs to the individual agent, not an aggregate window.
- These subprocess totals are display-only; they are not added to the main Pi footer. Cache reads/writes are separate from uncached input; output includes reasoning. Costs are estimates, not subscription quota.
- Measure subsequent user-requested workflows by comparable task/provider and separate initial builds from UI/correction rounds. No automatic paid benchmarks or promised savings percentage. Models and reasoning are unchanged.

## Review evidence (Pi and Claude Code)

One dependency-free helper has two entry paths: `~/.pi/agent/workflow/review-evidence.mjs` (relative alias) and `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/workflow/review-evidence.mjs` (canonical implementation). Existing workflow links expose them; no real-profile installation is needed for local checks.

```sh
# Use an existing same-task report directory outside the task source; choose new names.
node ~/.pi/agent/workflow/review-evidence.mjs capture --root /absolute/task --output /absolute/reports/id-review-evidence-start.json
node ~/.pi/agent/workflow/review-evidence.mjs compare --root /absolute/task --evidence /absolute/reports/id-review-evidence-prior.json
# After inspecting findings, corrections and affected callers, compare against start too.
node ~/.pi/agent/workflow/review-evidence.mjs compare --root /absolute/task --evidence /absolute/reports/id-review-evidence-start.json
node ~/.pi/agent/workflow/review-evidence.mjs capture --root /absolute/task --output /absolute/reports/id-review-evidence-end.json
```

- Use task-ID/UTC-named artifacts in actual workflows, link the new manifest from the report and verify it matches the inspected capture. Concurrent changes invalidate affected conclusions; recheck or block. Checkpoints remain incomplete. Keep artifacts outside task source so new reports/manifests aren't counted as source changes.
- Git captures tracked and nonignored untracked paths at the repository root. Repeat `--exclude relative/path` only for the recorded pre-existing user paths. Non-Git requires repeated `--file relative/path` for the explicit reviewed file set and is non-exhaustive. Comparison must use the same exclusions/file scope. Capture exclusively creates a new output; compare writes nothing. Exit 2 means uncertainty/error, never permission to narrow; exit 0 may include changed paths.
- Fingerprints prove bytes/type/executable identity, not correctness, unchanged functions, environment or external inputs. Symlink identity is recorded without reading target contents; targets/submodule internals remain unverified. Do not copy source or serialize secrets into evidence.
- Build, Review and UI carry the latest state, latest review evidence path (or none), changed paths/findings/affected criteria, required checks and prior exact results with checked-state references and known environment/limitations. Builders preserve prior evidence without calling corrections reviewed. History stays linked, not a reading list.
- Initial review remains independent and whole-plan; standalone scope never narrows. Follow-ups compare the last valid reviewed manifest and inspect affected behavior/callers/contracts, retaining only valid coverage. Shared contracts, concurrent/unrelated changes invalidating coverage, uncertain scope or missing whole-plan coverage trigger expansion. Missing older manifests mean recheck uncertain coverage once and establish evidence, never reconstruct old diffs/patches or retrospective aggregate hashes.
- Independently run focused checks for changed behavior. Reuse passing broad checks only with valid relevant source/test/config/dependency inputs, known runtime/environment and no freshness requirement. A manifest cannot prove environment validity. Changed/unknown inputs or environment, previous failures and plan/project freshness requirements mean rerun affected checks or report a blocker/limitation. Label newly run, reused (source/reason), failed and not checked distinctly; builder passes aren't independent reviews.
- Bound instruction discovery to the task-root ancestor chain and nested instructions under affected paths, not siblings/home trees; honor explicit external references. Read the complete plan, current state and required rules/skills; load extra docs/skills only for affected work or a concrete question. This does not reuse context across agents or change models/effort.
- Finalize reads referenced same-task manifests, verifies identity/membership, consolidates decisions/limitations, then deletes only identified consolidated artifacts after verification. Never source, sessions, directories or unrelated evidence.

## Models

Subagents follow the session's provider (the `pi` GPT or Claude profile); another provider inherits the session model.

| Agent | GPT (`openai-codex`) | Claude (`claude-code`, same as `.claude/agents/wf-*`) |
| --- | --- | --- |
| main session | your choice | your choice |
| orchestrator | gpt-6.1-sol, medium | sonnet, medium |
| builder | gpt-6.1-sol, medium | sonnet, high |
| reviewer | gpt-6.1-sol, high | opus, high |

`sonnet`/`opus` resolve to the newest matching Claude model (now `claude-sonnet-5-5`/`claude-opus-5-5`).

## Limits

- No isolation: agents edit your working copy. Commit or stash first for a clean baseline.
- Non-Git folders work in place, with no baseline, undo or Plannotator code review.
- The orchestrator call blocks the session for the whole loop; Ctrl+C stops it.

## Verification

`npm test` here (`node --test tests/*.test.mjs`): loads both extensions, checks `/work` in a temp repo and folder, and checks stable skill-free workflow sections, nested activity rendering, recursive usage totals, focused follow-up prompt contracts and disposable review-evidence fixtures (both helper entry paths). `bash .claude/workflow/tests/contracts.test.sh` from the repository root checks Claude prompt contracts and installed-style helper access in disposable config directories only. No network, model or browser.
