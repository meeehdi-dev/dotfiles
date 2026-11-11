# Workflow rules (shared by every phase and workflow agent)

Plan → Build F1 → Build F2 → … → whole-plan Review → focused Build ↔ follow-up Review → optional UI → Finalize.
Features are built one per fresh `builder` with no review in between; humans approve only after a clean standalone review or complete plan coverage (initial whole-plan review plus valid follow-up evidence). Focused UI feedback loops Build ↔ Review back to UI; decisions go to Plan.
The workflow guides; it never overrides the user's change of direction. A specific user instruction at a blocker wins within its stated scope, without a phase detour or reconfirmation; it never overrides security or data-loss protections.

- One session, in place. Plan, Review routing, UI and Finalize run in the main session; the build loop runs in an `orchestrator` subagent that spawns `builder` / `reviewer`; standalone review spawns a `reviewer`. Use the `subagent` tool in single mode with `cwd` = the task root. Handoffs pass paths and notes, never the transcript.
- Phase changes: `workflow_phase` (mode, absolute plan/report path, notes). Leaving: `workflow_exit`.
- Read the complete reference and applicable instructions (AGENTS.md); reuse unchanged context already loaded in this session. Builders/reviewers inspect connected code; routing agents consult code only when evidence conflicts or is missing. Other docs only when needed. Preserve unrelated user work.

## Workspace

- Work in place in the task root, on whatever is checked out. No worktrees, no branches, no isolation. Use the task root explicitly (absolute paths, `git -C <root>`, subagent `cwd`), because the session cwd can be a subdirectory.
- **Git:** the start commit and the paths that already had changes at `/work` are recorded. Those paths are the user's: leave them alone and keep them out of reviews unless the plan says otherwise.
- **Non-Git:** no baseline and no undo. Builders list changed files in their reports; Review covers those plus files the plan names and says change detection isn't exhaustive. No Plannotator code review.

## Artifacts

- Plans `~/.pi/plans/<key>/<id>.md`; Plan feedback/clarifications `~/.pi/plans/<key>/<id>-<topic>.md`; progress, review, blocker and UI feedback reports `~/.pi/reviews/<key>/<id>-<topic>-<UTC timestamp>.md`. Key and id come from the task, never prose. Expand `~` before using file tools.
- Explicit user paths or project instructions override per artifact type. Pick a new name if a report's default exists.
- Artifacts must stand alone without the conversation. Read before revising. Preserve input and earlier reports; only Finalize consolidates and deletes them.

## Plans and progress

- One plan with numbered features and stable IDs (F1, F2…), acceptance criteria per feature, ordered steps, explicit dependencies. Features are coherent behaviors, not one per file/test. A single-feature or unnumbered plan is one unit.
- The plan stays primary and unchanged. Every builder/reviewer reads it in full, plus the latest authoritative progress/review state and active feedback. Read historical reports only to resolve missing or conflicting evidence; predecessor links preserve history, not a mandatory reading list. Finalize still reads all artifacts before deleting any.
- The latest state stands alone: plan path, predecessor links, loop authority, every feature's state, material decisions/reasons, accepted limitations/reasons, changed paths, blockers/dependencies, unresolved findings with stable IDs/status, exact check results and next action. Preserve prior review coverage and its evidence; never drop an unresolved issue.
- Handoffs carry: explicit loop authorization, feature ID or review mode, next action, absolute plan/latest-state/active-feedback paths, material decisions, accepted limitations, and any user exception with its scope. Link other artifacts through the latest state, not the transcript.
- Never guess completion: reconcile state and check evidence; builders/reviewers verify against code. Partial work is not complete or reviewed.

## Review continuity

- First review after feature builds: independent whole-plan review. After corrections (including localized UI feedback), use follow-up review: prior findings, new changes, affected acceptance criteria, callers and integration paths. Retain prior clean coverage only for unchanged implementation with valid evidence.
- Expand to whole-plan review when shared contracts change, concurrent/unrelated changes invalidate prior coverage, the affected scope is uncertain, or no valid prior whole-plan review exists. Never narrow an explicitly requested standalone review.
- Reports identify newly checked scope and retained prior coverage, with source revision and relevant working-tree state. A focused review is not a fresh whole-plan review. Clean loop completion requires complete plan coverage and no open findings, incomplete features or blockers; uncertain/stale coverage must be rechecked.
- Long reviews/audits save a new small `review-checkpoint` report at completed logical scope boundaries before expanding into another substantial area: reviewed scope, findings/evidence, revision and relevant working-tree state, remaining questions. Mark it incomplete, never clean. A replacement reviewer validates it against current code before reusing evidence; it is not a resumable session.
- No hard token/turn cap. Investigation without a new concrete hypothesis or evidence of progress is a blocker/uncertainty, not a reason to keep exploring.

## Authority

- Loop authorization must be explicit (plan approval or the user's words), never inferred from a filename or report. Plan approval authorizes building all planned features, then whole-plan Review and automatic in-scope correction rounds until clean or blocked. It is not code or UI approval. A direct Build request without it covers only its supplied scope. Standalone Review stays read-only.
- Without specific authority: no new scope/design, dependencies, installs, lockfile/snapshot updates, migrations, destructive actions, E2E or deployment.
- Git is read-only by default, unless the user explicitly asks otherwise.

## Human surfaces (main session only)

- Plannotator via the `plannotator` tool for plan, code and live-app review. Consult the installed plannotator skill when required; reuse it if already loaded and unchanged. Before opening, tell the user that closing the tab without deciding sends nothing and they can reply in chat. End the turn after opening.
- `workflow_question` for finite choices, with context and explicit action labels; chat for free-form input. Plan's clarifications use Plannotator only. Subagents can't ask: they report to their caller.
- A choice authorizes only what it clearly describes. Cancelled = wait for chat. Never infer approval from silence, a closed tab, a cancel or a tool failure. Don't add question gates to authorized transitions.

## Blockers

A missing consequential decision, unavailable required authority/input, or demonstrated inability to progress. Repeating a failed approach without new evidence is not progress (no numeric retry cap). Record evidence, defer the blocked work, continue safe independent work, then ask once with a consolidated summary.
