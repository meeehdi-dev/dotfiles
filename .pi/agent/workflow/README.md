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

`npm test` here (`node --test tests/*.test.mjs`): loads both extensions, checks `/work` in a temp repo and folder, and checks stable skill-free workflow sections, nested activity rendering and recursive usage totals. No network, model or browser.
