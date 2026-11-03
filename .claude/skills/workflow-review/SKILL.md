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

1. Task root. Git: `~/.claude/workflow/task.sh info` (exit 0 → task root; exit 3 → the current checkout; exit 1 → pause and report). Scope: staged, unstaged and untracked changes unless the user gave a base. Non-Git: the explicitly scoped files; ask in chat if unclear; there's no baseline.
2. Spawn a new `wf-reviewer` in **standalone** mode with: absolute plan/reference path, task root and kind, scope or base, known same-task report paths. Don't paste the conversation. Wait for its completion notification.
3. Route on its verdict:
   - `Verdict: findings` → show the findings and report path, then `AskUserQuestion`: "Back to plan to revalidate" (invoke `workflow-plan` with the report path; Plan revalidates, it doesn't blindly implement) or "Proceed without replanning" (the findings stay unaddressed; then "UI or Finalize" below, no Plannotator session). No extra approval gate on the report itself.
   - `Verdict: clean` → "Clean result → human approval" below.
   - `Verdict: blocked` → explain what's missing and ask in chat.
4. A new review is always allowed; earlier reports and approvals are evidence, not locks.

## Clean result → human approval

Used by this skill and `workflow-build`. Only a clean standalone or whole-plan review reaches this; never a finished build without whole-plan review, a blocked loop, or a UI-correction loop (that returns to UI).

1. Resolve the original implementation plan from the input and reports; if missing or ambiguous, ask in chat.
2. `AskUserQuestion` with exactly, in order: "Review code in Plannotator", "Approve code and go to UI", "Approve code, skip UI, and go to Finalize". Outside Git, only the last two (no browser code or file review).
3. A direct approval invokes its skill once (`workflow-ui` or `workflow-finalize`) with the plan path and the notes in step 6, with no extra question.
4. "Review code in Plannotator" approves nothing by itself. Tell the user that closing the tab without deciding sends nothing and they can reply in chat. Then in background Bash with a long timeout (the CLI, since the `plannotator` tool has no diff type): `plannotator review <task root> --gate --json --diff-type uncommitted`, or `--base <ref>` instead of `--diff-type` when the user asked for a base. Pass the task root explicitly, never the source checkout or an app subdirectory; ask the user to check the comparison in the browser. End the turn. Route only on the JSON `decision`, never the `message` text:
   - `approved` (notes are guidance, not change requests) → "UI or Finalize" below.
   - `annotated` → save a feedback report (requests, plan/report references, context for Plan), then `AskUserQuestion`: "Back to plan to revalidate" (`workflow-plan` with that report) or "Proceed without replanning" (the requests stay unimplemented; then "UI or Finalize").
   - `dismissed`, silence, a closed tab or a failure isn't approval: wait for chat.
5. UI or Finalize (after browser approval or "Proceed without replanning"): resolve the plan as in step 1, then `AskUserQuestion`: UI (optional live-app review) or Finalize, unless the user already said which. Invoke the chosen skill once with the plan path and the notes in step 6.
6. Notes to UI/Finalize: absolute paths of every known same-task clarification, review, blocker, UI and feedback report, plus material decisions and accepted limitations with reasons.
