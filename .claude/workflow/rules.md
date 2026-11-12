# Workflow rules (shared by every workflow skill and agent)

Plan → Build F1 → Build F2 → … → whole-plan Review → focused Build ↔ follow-up Review → optional UI → Finalize.
Features are built one per fresh `wf-builder` with no review in between; humans approve only after a clean standalone review or complete plan coverage (initial whole-plan review plus valid follow-up evidence). Focused UI feedback loops Build ↔ Review back to UI; decisions go to Plan.
The workflow guides; it never overrides the user's change of direction. A specific user instruction at a blocker wins within its stated scope, without a phase detour or reconfirmation; it never overrides security or data-loss protections.

- **Only after `/work`.** Otherwise handle requests directly; never invoke workflow skills or `wf-*` agents. `/work [task or report]` is the only entry command and always starts Plan, taking the argument literally.
- One session, in place. Plan, Review routing, UI and Finalize run in the main session; Build calls `wf-orchestrator`, which spawns fresh `wf-builder` / `wf-reviewer` agents via Agent, one at a time. Standalone review spawns a fresh reviewer. Wait for completion. Handoffs pass paths and notes, never the transcript.
- Phase changes invoke the appropriate `workflow-*` skill once when authorized; no extra start confirmation. Unreadable rules/skills: report the path and pause.
- Read the complete reference and applicable instructions (CLAUDE.md); reuse unchanged context already loaded. Builders/reviewers inspect connected code; routing agents consult code only when evidence conflicts or is missing. Other docs only when needed. Preserve unrelated user work. Instruction discovery is bounded to the task-root ancestor chain and nested CLAUDE.md under affected paths, never sibling repositories or a whole home/config tree; honor explicitly referenced external instructions. Load extra framework docs/skills only for affected work or a concrete unresolved question. Context reuse is within this agent, not across fresh agents.

## Workspace

- Work in place in the task root, on whatever is checked out. No worktrees, branches or isolation. Use absolute paths and `git -C <root>`; tell subagents to run commands in the task root because the session cwd may be a subdirectory.
- `/work` obtains identity from `task.sh describe`: UUID, canonical root, project key, kind, Git start commit (null if unborn) and pre-existing changed paths. Keep these unchanged across phase handoffs/replans; do not rediscover a new baseline. Identity lives in handoffs and the plan, not persistent repository metadata. Missing identity: ask, never infer it from a filename.
- **Git:** pre-existing changed paths are the user's: leave them alone and keep them out of task reviews unless the plan says otherwise. Preserve start-commit changes and distinguish them from task changes. Git failures are not non-Git; pause and report.
- **Non-Git:** no baseline or undo. Builders list changed files; Review covers those plus files the plan names and says change detection isn't exhaustive. No Plannotator code review. A repository appearing later grants no Git authority; ask for direction.
- Existing worktrees and old task metadata are not migrated or cleaned up. A task may run in an existing checkout without taking ownership of its resources.

## Artifacts

- Root: `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`. Expand `~` before file tools.
- Plans `<root>/plans/<key>/<id>.md`; Plan feedback/clarifications `<root>/plans/<key>/<id>-<topic>.md`; progress, review, checkpoint, blocker and UI feedback reports `<root>/reviews/<key>/<id>-<topic>-<UTC timestamp>.md`. Key and id come from task identity, never prose.
- Explicit user paths or project instructions override per artifact type. Pick a new name if a report's default exists.
- Artifacts must stand alone without the conversation. Read before revising. Preserve input and earlier reports; only Finalize consolidates and deletes them.

## Plans and progress

- One plan with numbered features and stable IDs (F1, F2…), acceptance criteria per feature, ordered steps, explicit dependencies. Features are coherent behaviors, not one per file/test. A single-feature or unnumbered plan is one unit.
- The plan stays primary and unchanged. Every builder/reviewer reads it in full, plus the latest authoritative progress/review state and active feedback. Read historical reports only to resolve missing or conflicting evidence; predecessor links preserve history, not a mandatory reading list. Finalize still reads all artifacts before deleting any.
- The latest state stands alone: plan path, predecessor links, loop authority, every feature's state, material decisions/reasons, accepted limitations/reasons, changed paths, blockers/dependencies, unresolved findings with stable IDs/status, exact check results and next action. Preserve prior review coverage and its evidence; never drop an unresolved issue.
- Handoffs carry: task identity/baseline, explicit loop authorization, feature ID or review mode, next action, absolute plan/latest-state/active-feedback paths, material decisions, accepted limitations, and any user exception with its scope. Link other artifacts through the latest state, not the transcript.
- Compact evidence handoff (Build, Review and UI): latest state, latest review evidence path (or explicitly none), changed paths, finding IDs/status and affected criteria, explicit required checks, and prior exact check results with checked-state references plus relevant environment/limitations. Builders carry prior review evidence forward; corrections are not reviewed. History stays linked.
- Never guess completion: reconcile state and check evidence; builders/reviewers verify against code. Partial work is not complete or reviewed. Resolve the original plan before routing to UI/Finalize; ask if missing or ambiguous.

## Review continuity

- First review after feature builds: independent whole-plan review. After corrections (including localized UI feedback), use follow-up review: prior findings, new changes, affected acceptance criteria, callers and integration paths. Retain prior clean coverage only for unchanged implementation with valid evidence.
- Expand to whole-plan review when shared contracts change, concurrent/unrelated changes invalidate prior coverage, the affected scope is uncertain, or no valid prior whole-plan review exists. Never narrow an explicitly requested standalone review.
- Reports identify newly checked scope and retained prior coverage, with source revision and relevant working-tree state. A focused review is not a fresh whole-plan review. Clean loop completion requires complete plan coverage and no open findings, incomplete features or blockers; uncertain/stale coverage must be rechecked.
- Long reviews/audits save a new small `review-checkpoint` report at completed logical scope boundaries before expanding into another substantial area: reviewed scope, findings/evidence, revision and relevant working-tree state, remaining questions. Mark it incomplete, never clean. A replacement reviewer validates it against current code before reusing evidence; it is not a resumable session.
- No hard token/turn cap. Investigation without a new concrete hypothesis or evidence of progress is a blocker/uncertainty, not a reason to keep exploring.

## Review evidence and checks

- Use `node "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/workflow/review-evidence.mjs"` (shared implementation with Pi). Capture the inspected state before review: `capture --root /absolute/task --output /absolute/artifacts/<id>-review-evidence-<UTC timestamp>.json`; compare with `compare --root /absolute/task --evidence /prior.json`. Use new same-task evidence artifacts in the report directory outside task source, never overwrite; do not hash newly created workflow artifacts as source changes. If artifact placement conflicts with source scope, report uncertainty rather than silently excluding source.
- Repeat `--exclude relative/path` for recorded pre-existing user paths, keeping the same scope across captures/comparisons. Non-Git requires repeated `--file relative/path` for the explicit reviewed set and is non-exhaustive. Git inventory is the repository root, including tracked and nonignored untracked files. Preserve scope in the report; do not add exclusions merely to get a clean comparison.
- Follow-ups compare against the last valid reviewed manifest, then inspect findings, corrections and affected callers/contracts. Retain prior coverage only where implementation and relevant dependencies remain valid; a manifest is evidence, not a review verdict. Per-path fingerprints establish identity, not semantics, environment validity or complete coverage; same-file changes require inspecting affected behavior, not assuming unchanged functions. Symlink identity does not verify target contents; external inputs and submodule internals remain unverified.
- Missing older manifests, malformed/mismatched/unreadable evidence or uncertainty require rechecking uncertain coverage once and establishing evidence, or a blocker. Never reconstruct old diffs/patches or regenerate aggregate hashes as retrospective proof. Keep whole-plan expansion triggers and standalone scope unchanged.
- Before completing a review, compare the current state with its inspected-state capture, then save a new evidence artifact linked from the report. Verify that the new manifest matches the inspected-state capture (including revision and scope); capture alone is not verification. Exit 2 or reported uncertainty is not a clean comparison; exit 0 can still report changed paths. Concurrent changes invalidate affected conclusions: recheck affected scope or block, never claim the new capture was inspected. Checkpoint evidence is explicitly incomplete; validate it before retention. Link manifests and comparison conclusions, not copied manifest bodies or transcripts.
- Independently run focused checks for changed behavior. Previously passing broad checks may be reused only when relevant source/test/config/dependency inputs and known runtime/environment remain valid and no explicit freshness requirement exists. A file manifest alone cannot prove environment validity. Changed inputs, unknown scope/environment, previous failures, or explicit plan/project freshness requirements require rerunning affected checks or reporting a blocker/limitation; never silently pass.
- Label every check: newly run (exact command/result and checked state), reused (prior report/state, exact result and reason inputs/environment remain valid), failed, or not checked (reason/impact). A builder pass is check evidence, never independent review. Reports keep current cumulative state, new findings/checks, evidence links and retained-coverage rationale compact. Without a concrete new hypothesis, stop evidence exploration: recheck uncertain scope or report the blocker.

## Authority

- Loop authorization must be explicit (plan approval or the user's words), never inferred from a filename or report. Plan approval authorizes all planned features, then whole-plan Review and automatic in-scope correction rounds until clean or blocked. It is not code/UI approval or publication authority. A direct Build request without it covers only its supplied scope. Standalone Review stays read-only.
- Without specific authority: no new scope/design, dependencies, installs, lockfile/snapshot updates, migrations, destructive actions, E2E or deployment. Never remove security, validation, accessibility or data-loss protections.
- Git is read-only by default unless the user explicitly asks otherwise. No workflow publication, prerequisite-copying or install exceptions.
- UI reviews a user-running dev server. Never start, adopt or stop it. Live interactions can change real data.

## Human surfaces (main session only)

- Consult the installed plannotator skill when required; reuse it if loaded and unchanged. Use the `plannotator` tool when available; otherwise use its documented CLI in background Bash with a long timeout and `--gate --json`. Route on `decision`, never message text. Before opening, say closing without deciding sends nothing and the user can reply in chat. End the turn after opening.
- Code review targets the absolute task root; pass an explicit base when requested, otherwise ask the user to check the comparison, start baseline and pre-existing changes. No code review outside Git.
- `AskUserQuestion` for finite choices with context and explicit labels; chat for free-form input. Plan's clarifications use Plannotator only; if unavailable pause until it works or the user names another channel. Subagents cannot ask: they report to their caller.
- A choice authorizes only what it describes. Cancelled = wait for chat. Never infer approval from silence, empty feedback, a closed tab or tool failure. Don't add question gates to authorized transitions.

## Leaving

- `/work` carries the substituted Claude session ID in main-session notes. After successful Finalize, or an explicit request to leave, run `bash ~/.claude/workflow/phase-hook.sh end <session-id>` with that exact ID, then stop. If identity is missing, ask rather than guessing. The helper clears only this session's phase badge. Failure: report and retain recovery context; do not claim successful exit.
- Leaving touches no task files, Git resources or servers, changes no cwd, publishes nothing and marks nothing approved. Existing changes/resources stay in place. A later `/work` starts a new Plan.

## Blockers

A missing consequential decision, unavailable required authority/input, or demonstrated inability to progress. Repeating a failed approach without new evidence is not progress (no numeric retry cap). Record evidence, defer the blocked work, continue safe independent work, then ask once with a consolidated summary.
