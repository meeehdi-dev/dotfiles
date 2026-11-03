# Workflow rules (shared by every workflow skill and agent)

Plan → Build F1 → fresh Build F2 → … → whole-plan Review ↔ focused Build → optional UI → Finalize.
Features are built one per fresh builder with no review in between; humans approve only after a clean whole-plan or standalone review. Focused UI feedback loops Build ↔ Review back to UI; decisions go to Plan.
The workflow guides; it never restricts Claude Code or overrides the user's change of direction. Instructions plus one helper (`~/.claude/workflow/task.sh`); no receipts, state machine or locks.

- **Only after `/work`.** The workflow applies only in a conversation where the user ran `/work`. Otherwise requests are ordinary: never invoke `workflow-*` skills or `wf-*` agents, and none of these rules add gates.
- `/work [task or report]` is the only entry command and always starts Plan (literal argument; bare `/work` asks in chat). Other phases, standalone Review and return: ask in chat or via handoff.
- Plan, UI and Finalize run in the main session; Build and Review in fresh subagents (`wf-orchestrator` → `wf-builder` / `wf-reviewer`); wait for their completion notification. Handoffs pass paths and notes, never the transcript.
- Unreadable rules or phase skill: pause, report the path. Missing optional skill (plannotator, ponytail): use the fallback, say so.
- Read the complete reference, applicable instructions (CLAUDE.md) and connected code; other docs only when needed. Preserve unrelated user work.

## Task identity and workspace

- **Identity.** Task id = UUID v4. Project key = `<repo-name>-<12 hex of sha256(canonical common git dir)>`, non-Git `<folder-name>-<12 hex of sha256(canonical path)>` (`task.sh key <path>`).
- **Git workspace.** `/work` enters the built-in worktree named by the task id (`<sourceRoot>/.claude/worktrees/<id>/`, branch `worktree-<id>`, from launching HEAD), then `task.sh init` writes `workflow-task.json` in its git admin dir and the `info/exclude` entry. The source checkout is otherwise untouched (nothing copied, stashed or staged).
- **Reuse.** Every phase and replan reuses the validated task root (`task.sh info`): no nested worktrees, no progress inferred from metadata. Mismatches pause; partial failures keep and report resources, no rollback.
- **Non-Git.** Unborn repos, broken metadata, missing Git or command errors aren't non-Git: pause. Work in place, writing no metadata. Identity (id, root, original cwd, key) lives in the conversation and plan path; a new conversation is a new task. No repo/worktree creation, Git status/diff/publication, signing or auth. **No isolation, baseline or rollback** (symlink targets included). Review covers explicitly scoped files and says no baseline exists. A repository appearing later pauses the task, granting no Git authority.
- Worktrees isolate files only, **not services, ports, credentials, ignored deps, submodules or symlink targets**.

## Artifacts

- Root: `${CLAUDE_CONFIG_DIR:-$HOME/.claude}`. Expand `~` before using file tools.
- Plans `<root>/plans/<key>/<id>.md`; Plan feedback/clarifications `<root>/plans/<key>/<id>-<topic>.md`; Build progress, review, blocker, UI and feedback reports `<root>/reviews/<key>/<id>-<topic>-<UTC timestamp>.md`.
- Key and id come from the validated task, never the worktree basename or prose.
- Explicit user/task paths or project instructions override per artifact type; existing directories or old files don't. Keep exact references. Clarify conflicting targets; pick a new name if a report's default exists. These are instruction-only defaults, not enforced.
- Artifacts must stand alone without the conversation. Read before revising. Preserve input and earlier reports; only Finalize consolidates and deletes them.

## Plans and progress

- One original plan with numbered features and stable IDs (F1, F2…), acceptance criteria per feature, ordered steps, explicit dependencies. A single-feature or unnumbered plan is one unit.
- The original plan stays primary and unchanged. Every Build/Review agent reads it in full, plus instructions and the latest same-task reports. Small Build progress reports carry progress between features, Review reports after the build (no state store, no build journal, no transcript). The latest report stands alone for current progress; predecessor links keep the evidence.
- Handoff notes carry: explicit loop authorization, feature ID or "whole-plan", next action, absolute plan/report paths, material decisions, accepted limitations, and any explicit-direction exception with its scope.
- Resuming dispatches nothing. Never guess completion: reconcile progress from code, checks and reports. Partial work is not complete or reviewed.
- Before routing to UI/Finalize, resolve the original plan; if missing or ambiguous, ask, never substitute a later plan or report.

## Authority

- Phase, routing, scope and procedural rules are defaults. At an unexpected blocker, a specific user instruction wins within its stated scope in any phase: no phase-name veto, detour or reconfirmation. It grants no unrelated scope or future permission and never overrides higher-priority policy, real failures, security/data-loss protections or the helper's checks. If the helper can't do it, explain why and use ordinary tools; no generic bypasses; never call a technical failure a workflow prohibition. Exceptions go in handoff notes, never new persistent metadata. Normal approvals, read-only Review and automatic routing are otherwise unchanged; outside `/work` these defaults add no gates.
- Loop authorization must be explicit (plan approval or the user's words), never inferred from a filename, report or numbered features. Plan approval authorizes building all planned features (fresh builder per feature, no per-feature Review), then whole-plan Review and automatic in-scope correction/review rounds until clean or blocked. It is not code/UI approval or publication authority. A direct Build request without it covers only its supplied scope. Standalone Review stays read-only and asks how to route findings.
- Without specific authority: no new scope/design, dependencies, installs, lockfile/snapshot updates, migrations, destructive actions, E2E or deployment. Never remove security, validation, accessibility or data-loss protections.
- Git is read-only except: `/work` task setup, authorized disposable test fixtures, and Finalize's task-only publication. Plan is non-mutating, Review read-only. Task creation, standalone Review and docs-only Finalize grant no publication or other Git/service/credential/install authority.
- Finalize asks "Merge in-place (local only, no push)" or "Create or reuse a PR on GitHub" unless already chosen; both make one signed task-only commit. Local: only the verified merge into the source base and helper cleanup, no push or gh. PR: push only the task branch over SSH, create/reuse an explicit-destination PR. Locked GPG/SSH or missing gh auth: the user recovers in their terminal. Never handle secrets, change credentials/config, go unsigned, force-push, fork, poll CI, merge on GitHub, delete branches, or stash/reset/discard source work.
- Only UI runs a dev server: an inspected existing command in the task root via background Bash, URL from its output, `TaskStop` before any handoff or return. User-supplied URLs are never started or stopped. Live use can change real data.

## Preparation (managed Git, Build/UI only)

- Just before the first Build check or UI startup that needs them, prepare missing prerequisites without confirmation or a UI→Build detour.
- Inspect instructions, manifests, lockfiles and invoked scripts (install hooks too), then run the existing install command at the app root, only for missing or changed prerequisites. No new tools, dependencies, lockfile changes or shared dependency dirs.
- Copy only identified required ignored files from `sourceRoot` to the same relative task path when missing. Check ignored/untracked status in the task worktree (git can't target the source from inside it) and canonical containment of both paths; never follow symlinks out, overwrite, change originals, or bulk-copy ignored trees, caches or databases.
- Never expose or inject credentials; suppress secret-bearing output.
- Unknown commands, missing sources, incompatible config, lockfile changes, migrations, provisioning or unclear data effects: blocker, ask.
- Grants no unrelated installs, UI feature edits, infrastructure, deployment or Git writes.

## Human surfaces (main session only)

- Plannotator for artifact, code and live-app review (not plan mode): invoke the `plannotator` skill before first use in a session, then the `plannotator` tool if present, else the CLI in background Bash with a long timeout (`plannotator annotate <file|url> --gate --json`, `plannotator review <root> --gate --json`; route on `decision` only). Before opening, tell the user that closing the tab without deciding sends nothing and they can reply in chat. End the turn after opening.
- Code review targets the task root (uncommitted by default, `--base <ref>` when asked); ask the user to check the comparison. None outside Git.
- `AskUserQuestion` for finite choices, with context and explicit action labels; chat for free-form input (or for the options, if no picker). Plan's clarifications use Plannotator only. Subagents can't ask: they report to their caller.
- A choice authorizes only what it clearly describes. Cancelled = wait for chat; don't reopen or pick a default. Approval notes are guidance, not new scope.
- Never infer approval from silence, empty feedback, a closed tab, a cancel or a tool failure. Don't add question gates to authorized transitions.

## Handoffs and return

- When the next phase is known and authorized, invoke its skill once (`workflow-plan`, `-build`, `-review`, `-ui`, `-finalize`) with the absolute plan/report path and notes.
- Explicit return without publishing: `ExitWorktree` `keep` once, end the turn. Never `remove`. A bare exit never publishes, keeps everything and marks nothing approved or complete. If it fails, check `pwd` and report. Outside Git there is nothing to exit.
- Continue by resuming the conversation (re-enters its worktree), or run `/work` in the task worktree (reuses it, starts Plan) and steer in chat.
- Only Finalize returns after publication. PR: report the verified URL, `ExitWorktree keep`. Local: in the task, record its root and HEAD and confirm no tracked/non-ignored pending files; `ExitWorktree keep`; in the source, record its pending state, `git merge --ff-only` (signed `--no-ff` only with permission), verify ancestry and preservation; then `task.sh cleanup <base> <task-root>` (runs `verify-merge`, `git clean -fdX` in the task root only, checks leftovers, non-forced worktree removal, branch kept). **All ignored task data is disposable here**, never source originals. Failed checks delete nothing; partial cleanup reports what remains; nested repos are never force-cleaned.
- Non-Git Finalize checks docs, reports, and ends; failures stay for recovery.

## Blockers

A missing consequential decision, unavailable required authority/input, or demonstrated inability to progress. Repeating a failed approach without new evidence is not progress (no numeric retry cap). Record evidence and affected dependencies, defer the blocked work, continue safe independent work, then ask once with a consolidated summary.

## Clean result → human approval

Human approval follows only a clean standalone or whole-plan review, never a finished build (outside Git without browser code review). The procedure lives once, in `workflow-review`'s "Clean result → human approval"; `workflow-build` follows it there.

## Not applicable in Claude Code

Per-phase sessions, session tokens, reload/shutdown/tree semantics and the owned-server process group: phases are skill invocations (Build/Review in subagents), return is `ExitWorktree keep`, the UI server is background Bash stopped with `TaskStop`.
