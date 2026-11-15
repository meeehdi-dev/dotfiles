# Workflow rules

Automate the handoffs, not the model's reasoning: approved Plan → Build → independent whole-plan Review → in-scope fixes ↔ focused follow-up Review → human code approval → optional UI → Finalize. User direction wins within its stated authority; do not add confirmations to authorized transitions.

## Roles and authority

- Plan, human review/UI, and Finalize run in the main session. Build delegates to `orchestrator`, which uses `builder` and independent `reviewer` subagents. Standalone Review delegates to `reviewer` and stays read-only. Use `subagent` in single mode with the task root as `cwd`; subagents report decisions/blockers to their caller, not the user.
- Plan approval explicitly authorizes the planned implementation, review, and automatic in-scope correction rounds until clean or blocked. It is not code/UI approval. A direct Build request without loop authority covers only the supplied scope. Never infer authority from filenames, earlier reports, silence, cancellation, a closed tab, or a tool failure.
- No new scope/design, dependencies, installs, lockfile/snapshot updates, migrations, destructive actions, E2E, or deployment without explicit task authority. Git is read-only unless explicitly authorized. Finalize's narrow, verified artifact cleanup is authorized by the workflow; it never authorizes general deletion.
- Preserve security, validation, accessibility, error handling that prevents data loss, and unrelated user work. A user exception applies only within its stated scope.
- Missing authority, a consequential decision, or inability to progress is a blocker. Continue safe independent work, then ask once with a consolidated summary. Do not repeat a failed approach without new evidence or silently accept unresolved findings.

## Workspace and context

- Work in place: no branches, worktrees, or isolation. Use the recorded task root explicitly for file paths, Git commands, subagents, and Plannotator targets.
- Git: the recorded start commit and pre-existing changed paths define the baseline. Those changes are the user's; leave them alone and out of review unless the approved scope includes them. Include task changes that are staged, unstaged, or untracked; never guess a base branch.
- Non-Git: no baseline or undo. Track changed files and review those plus the files the plan names; disclose that change detection is non-exhaustive. No Plannotator code review.
- Read the complete plan/reference, current state, active feedback, and applicable project instructions. Discover instructions along the task-root ancestor chain and under affected paths, not sibling repositories or whole home/config trees; honor explicit external references. Inspect connected code where your role needs it. Reuse unchanged loaded context; read extra history/docs/skills for concrete questions, not ceremony.

## Handoffs and artifacts

- Plans default to `~/.pi/plans/<key>/<id>.md`; clarification/feedback docs use `<id>-<topic>.md` there. Progress/review/UI reports default to `~/.pi/reviews/<key>/<id>-<topic>-<UTC timestamp>.md`. Key/id come from task metadata. Explicit user/project paths override these per artifact type; expand `~` for file tools and choose a new name rather than overwrite an unrelated artifact.
- Keep handoffs small and resumable: absolute plan/current-state/active-feedback paths, task root/baseline, explicit authority, changed scope, unresolved findings/blockers, material decisions/limitations, relevant check results, and next action. Link history rather than copying transcripts. Use stable finding references when needed. Do not require a new report for every build chunk.
- Read before revising your current progress state; preserve input documents and prior review reports until Finalize. Track the task's artifacts through links so cleanup can identify them safely. The approved plan remains the implementation reference; changed design/scope returns to Plan.

## Review and verification

- Initial loop review is independent and whole-plan. Follow-up review checks fixes, outstanding findings, and affected callers/integration paths, retaining only still-valid prior coverage. Expand review when shared contracts change, concurrent changes invalidate coverage, scope is uncertain, or prior whole-plan coverage is missing. Never narrow an explicitly requested standalone review.
- Review current code/diffs, not just builder claims. Record reviewed scope and revision/working-tree state, what changed since the prior review, and what coverage remains valid. Concurrent edits invalidate affected conclusions: recheck or report uncertainty. Incomplete or stale coverage cannot be clean. Clean means complete plan coverage with no open findings, incomplete work, or blockers; a focused review alone is not a new whole-plan review.
- Fingerprint manifests are optional; see README.md for the shared helper's capture/compare commands. They show byte identity, not correctness or environment validity. If used, preserve their scope and limitations and link them from the review; never use uncertain evidence to claim coverage.
- Independently run focused checks for changed behavior. Reuse prior broad passes only when relevant code/tests/config/dependencies and the known runtime/environment remain valid and no freshness requirement applies. Unknown/changed inputs, previous failures, or required fresh checks mean rerun affected checks or disclose the blocker/limitation. Builder passes are evidence, not independent review.
- Inspect unfamiliar scripts before running them; no unauthorized E2E or side effects. Report exact commands/results, distinguish new failures from pre-existing/environmental ones, and explain reused or skipped checks honestly. Never weaken tests to get a pass.

## Human interaction

- Use `workflow_phase` with an absolute plan/report path and concise notes; `workflow_exit` ends the workflow without touching files.
- Use the `plannotator` tool for plan approval and requested code/live-app review; consult its skill when needed. Before opening, explain that closing without submitting sends no decision and chat remains available. End the turn after opening and wait for explicit feedback/approval.
- Use `workflow_question` for meaningful finite choices and chat for free-form input; plan clarifications belong in Plannotator when needed. No prescribed menu wording or redundant approval gates. Cancellation means wait for chat, not reopen the picker.
