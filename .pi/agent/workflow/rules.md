# Workflow rules (shared by every phase and workflow agent)

Plan → Build F1 → Build F2 → … → whole-plan Review ↔ focused Build → optional UI → Finalize.
Features are built one per fresh `builder` with no review in between; humans approve only after a clean whole-plan or standalone review. Focused UI feedback loops Build ↔ Review back to UI; decisions go to Plan.
The workflow guides; it never overrides the user's change of direction. A specific user instruction at a blocker wins within its stated scope, without a phase detour or reconfirmation; it never overrides security or data-loss protections.

- One session, in place. Plan, Review routing, UI and Finalize run in the main session; the build loop runs in an `orchestrator` subagent that spawns `builder` / `reviewer`; standalone review spawns a `reviewer`. Use the `subagent` tool in single mode with `cwd` = the task root. Handoffs pass paths and notes, never the transcript.
- Phase changes: `workflow_phase` (mode, absolute plan/report path, notes). Leaving: `workflow_exit`.
- Read the complete reference, applicable instructions (AGENTS.md) and connected code; other docs only when needed. Preserve unrelated user work.

## Workspace

- Work in place in the task root, on whatever is checked out. No worktrees, no branches, no isolation. Use the task root explicitly (absolute paths, `git -C <root>`, subagent `cwd`), because the session cwd can be a subdirectory.
- **Git:** the start commit and the paths that already had changes at `/work` are recorded. Those paths are the user's: leave them alone and keep them out of reviews unless the plan says otherwise.
- **Non-Git:** no baseline and no undo. Builders list changed files in their reports; Review covers those plus files the plan names and says change detection isn't exhaustive. No Plannotator code review.

## Artifacts

- Plans `~/.pi/plans/<key>/<id>.md`; Plan feedback/clarifications `~/.pi/plans/<key>/<id>-<topic>.md`; progress, review, blocker and UI feedback reports `~/.pi/reviews/<key>/<id>-<topic>-<UTC timestamp>.md`. Key and id come from the task, never prose. Expand `~` before using file tools.
- Explicit user paths or project instructions override per artifact type. Pick a new name if a report's default exists.
- Artifacts must stand alone without the conversation. Read before revising. Preserve input and earlier reports; only Finalize consolidates and deletes them.

## Plans and progress

- One plan with numbered features and stable IDs (F1, F2…), acceptance criteria per feature, ordered steps, explicit dependencies. A single-feature or unnumbered plan is one unit.
- The plan stays primary and unchanged. Every builder/reviewer reads it in full, plus the latest same-task reports. Small progress reports carry state between features, review reports after the build. The latest report stands alone; predecessor links keep the evidence.
- Handoffs carry: explicit loop authorization, feature ID or "whole-plan", next action, absolute plan/report paths, material decisions, accepted limitations, and any user exception with its scope.
- Never guess completion: reconcile progress from code, checks and reports. Partial work is not complete or reviewed.

## Authority

- Loop authorization must be explicit (plan approval or the user's words), never inferred from a filename or report. Plan approval authorizes building all planned features, then whole-plan Review and automatic in-scope correction rounds until clean or blocked. It is not code or UI approval. A direct Build request without it covers only its supplied scope. Standalone Review stays read-only.
- Without specific authority: no new scope/design, dependencies, installs, lockfile/snapshot updates, migrations, destructive actions, E2E or deployment.
- Git is read-only by default, unless the user explicitly asks otherwise.

## Human surfaces (main session only)

- Plannotator via the `plannotator` tool for plan, code and live-app review. Before opening, tell the user that closing the tab without deciding sends nothing and they can reply in chat. End the turn after opening.
- `workflow_question` for finite choices, with context and explicit action labels; chat for free-form input. Plan's clarifications use Plannotator only. Subagents can't ask: they report to their caller.
- A choice authorizes only what it clearly describes. Cancelled = wait for chat. Never infer approval from silence, a closed tab, a cancel or a tool failure. Don't add question gates to authorized transitions.

## Blockers

A missing consequential decision, unavailable required authority/input, or demonstrated inability to progress. Repeating a failed approach without new evidence is not progress (no numeric retry cap). Record evidence, defer the blocked work, continue safe independent work, then ask once with a consolidated summary.
