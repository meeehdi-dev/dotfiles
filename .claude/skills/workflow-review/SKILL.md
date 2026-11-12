---
name: workflow-review
description: Workflow standalone Review. Independent read-only review of the current changes against a plan/reference in a fresh subagent, then findings routing or human approval. Use when the user asks to hand off to review or review the work against a plan. Only inside a /work task in this conversation.
user-invocable: false
argument-hint: "[plan/reference]"
---

# Review (standalone)

Run this phase only in a conversation where the user ran `/work`. Otherwise stop: don't run the phase, handle the request as an ordinary one.

Read `~/.claude/workflow/rules.md` first. Input: $ARGUMENTS (plan/reference, optional base; ask if missing or if the scope is ambiguous, never guess `main` or the latest plan).

Standalone review is read-only and carries no loop authority, whatever the plan or reports say.

1. Reuse task identity/baseline from `/work` and handoffs. Git: staged, unstaged and untracked task changes plus changes since start commit, or the explicit base requested; keep pre-existing changed paths separate unless the plan includes them. Non-Git: changed files from progress plus plan-named files, with no baseline or exhaustive detection. Ask if identity/scope is unclear.
2. Spawn a new `wf-reviewer` in **standalone** mode with: absolute plan/reference path, task identity/baseline, scope or base, latest authoritative progress/review state and active-feedback paths. History stays linked through state; read only for missing/conflicting evidence. Include rules.md's compact evidence handoff: latest review evidence path (or none), changed paths/findings/affected criteria, required checks and prior exact results with checked-state/environment references. Standalone scope never narrows through reuse. Don't paste the conversation. Wait for its completion notification.
3. Route on its verdict:
   - `Verdict: findings` → show the findings and report path, then `AskUserQuestion`: "Back to plan to revalidate" (invoke `workflow-plan` with the report path; Plan revalidates, it doesn't blindly implement) or "Proceed without replanning" (the findings stay unaddressed; then "UI or Finalize" below, no Plannotator session). No extra approval gate on the report itself.
   - `Verdict: clean` → "Clean result → human approval" below.
   - `Verdict: blocked` → explain what's missing and ask in chat.
4. A new review is always allowed; earlier reports and approvals are evidence, not locks.

## Clean result → human approval

Used by this skill and `workflow-build`. Only a clean standalone review or complete plan coverage (initial whole-plan review plus valid follow-up evidence) reaches this; never an unreviewed build, blocked loop or UI-correction loop (which returns to UI).

1. Resolve the original implementation plan from the input and reports; if missing or ambiguous, ask in chat.
2. `AskUserQuestion` with exactly, in order: "Review code in Plannotator", "Approve code and go to UI", "Approve code, skip UI, and go to Finalize". Outside Git, only the last two (no browser code or file review).
3. A direct approval invokes its skill once (`workflow-ui` or `workflow-finalize`) with the plan path and the notes in step 6, with no extra question.
4. "Review code in Plannotator" approves nothing by itself. Follow rules.md Human surfaces: use the tool when available, `action: review`, absolute task root, `gate: true`, and `options.base` when requested. Otherwise use the documented CLI in background Bash with a long timeout, `plannotator review <task root> --gate --json` (add `--base <ref>` when requested). Ask the user to check the comparison, recorded start baseline and pre-existing changes; browser defaults can include unrelated changes. Warn that closing sends no approval, end the turn and wait. Route on tool feedback or the CLI JSON `decision`, never message text:
   - `approved` (notes are guidance, not change requests) → "UI or Finalize" below.
   - `annotated` → save a feedback report (requests, plan/report references, context for Plan), then `AskUserQuestion`: "Back to plan to revalidate" (`workflow-plan` with that report) or "Proceed without replanning" (the requests stay unimplemented; then "UI or Finalize").
   - `dismissed`, silence, a closed tab or a failure isn't approval: wait for chat.
5. UI or Finalize (after browser approval or "Proceed without replanning"): resolve the plan as in step 1, then `AskUserQuestion`: UI (optional live-app review) or Finalize, unless the user already said which. Invoke the chosen skill once with the plan path and the notes in step 6.
6. Notes to UI/Finalize: task identity/baseline and main-session ID, absolute plan/latest authoritative progress/review state/active-feedback paths, material decisions and accepted limitations with reasons. Carry rules.md's compact evidence handoff, including the latest review evidence path and check provenance. History remains linked for Finalize, not a mandatory reading list for other phases.
