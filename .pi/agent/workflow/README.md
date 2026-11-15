# Personal Pi workflow

**Plan → Build → independent whole-plan Review → fixes ↔ focused follow-up Review → human code approval → optional UI → Finalize**, in one session, in place.

## Usage

- `/work [task or report]` starts Plan in the current repository or folder. It records the task root and, in Git, the start commit and pre-existing changed paths. It creates no branch, worktree, or metadata file.
- Review the plan in Plannotator. Explicit approval starts the implementation/review/correction loop without another confirmation; it is not code/UI approval.
- Build delegates to `orchestrator`, which chooses coherent chunks for `builder` subagents, then uses an independent `reviewer`. In-scope findings are fixed automatically; follow-ups review fixes and affected behavior, expanding when earlier coverage is no longer trustworthy.
- A clean result needs complete plan coverage with no open findings, incomplete work, blockers, or uncertain coverage. Then approve the code, optionally inspect it in Plannotator, and choose live UI review or explicitly skip it. Standalone review stays read-only unless you authorize fixes.
- For UI review, you run the dev server. Localized feedback starts a focused correction/review loop and returns to UI automatically; design/authority decisions return to Plan.
- Finalize leaves one concise decision record and removes only verified, fully consolidated task artifacts. Project documentation paths and retention instructions take precedence, including when all docs live in the repository. Ambiguous/shared artifacts are left alone.
- Steer in chat at any point. The agent uses `workflow_phase`, `workflow_question`, and `workflow_exit`; there is no workflow footer display.

The workflow automates handoffs, not investigation methods or document templates. Plans and reports should be proportional to the task. Handoffs retain the plan, current state/feedback, authority, changed scope, outstanding work, decisions/limitations, and relevant check evidence. History is linked, not repeatedly copied; a new report is not required for every build chunk.

## Files

- `~/.pi/agent/extensions/workflow-modes.ts`: `/work`, phase tools, task/session state, prompt injection.
- `~/.pi/agent/workflow/`: shared rules and phase responsibilities.
- `~/.pi/agent/agents/{orchestrator,builder,reviewer}.md`: subagent roles and models.
- `~/.pi/agent/extensions/subagent/`: subprocess execution, nested activity, and usage display.
- Default artifacts: `~/.pi/plans/<key>/<id>.md` and `~/.pi/reviews/<key>/<id>-<topic>-<UTC timestamp>.md`. Explicit user/project paths override the defaults.

## Optional fingerprint evidence

Independent review normally uses current code/diffs and review judgment. The dependency-free helper remains available through the Pi alias and its shared Claude implementation; it is optional for reviews in both workflows.

```sh
node ~/.pi/agent/workflow/review-evidence.mjs capture --root /absolute/task --output /absolute/reports/id-evidence.json
node ~/.pi/agent/workflow/review-evidence.mjs compare --root /absolute/task --evidence /absolute/reports/id-evidence.json
```

Use a new same-task output outside task source, with an existing parent directory. Repeat `--exclude relative/path` only for recorded pre-existing user paths; non-Git requires repeated `--file relative/path` for the reviewed file set and is non-exhaustive. Keep scope consistent across comparisons and link evidence from the review. Capture never overwrites; compare writes nothing. Exit 2 means error/uncertainty; exit 0 can still list changed paths.

Fingerprints establish byte/type/executable identity, not correctness, unchanged behavior, or environment validity. Symlink targets and submodule internals remain unverified. Never serialize source/secrets as evidence or treat uncertainty as a clean review. Focused checks remain independent; broad passes may be reused only with valid relevant inputs/environment and no freshness requirement. Report actual checks, reuse reasons, failures, and omissions honestly.

## Models and usage

Subagents follow the session provider; other providers inherit the session model. Models/reasoning are unchanged.

| Agent | GPT (`openai-codex`) | Claude (`claude-code`) |
| --- | --- | --- |
| main session | your choice | your choice |
| orchestrator | gpt-6.1-sol, medium | sonnet, medium |
| builder | gpt-6.1-sol, medium | sonnet, high |
| reviewer | gpt-6.1-sol, high | opus, high |

`sonnet`/`opus` resolve to the newest matching Claude model. Expand subagent output with Ctrl+O for nested activity. Rows show **Own** usage and **Total (incl. nested)**; totals count recorded live/failed children once, preferring finished results. Context size belongs to each agent, not an aggregate window. Subprocess totals are display-only, not added to the main footer; estimated costs are not subscription quota. Cache reads/writes are separate from uncached input; output includes reasoning.

## Limits and verification

- No isolation: agents edit the working copy and must preserve pre-existing user work. For a clean baseline, commit or stash yourself before starting.
- Non-Git has no baseline, undo, or Plannotator code review; change detection is non-exhaustive.
- The orchestrator call blocks for the loop; Ctrl+C stops it. Missing authority or lack of progress stops affected work, not an endless retry loop.
- No implicit authority for new scope, dependencies/installs, lockfile/snapshot updates, migrations, destructive actions, E2E, deployment, or Git writes. Verified task-artifact cleanup is the narrow Finalize exception.
- `npm test` here runs Node unit/integration checks for extension loading, task baselines, tool/state transitions, prompt policy, nested activity/usage, and disposable shared-helper fixtures. No network, model, browser, or E2E. These checks do not prove model compliance or review quality; no automatic paid benchmarks or promised savings.
