---
name: workflow-review
description: Independent read-only standalone review, followed by findings routing or human code approval. Only inside a /work task.
user-invocable: false
argument-hint: "[plan/reference] [notes]"
---

# Review

Run only after the user ran `/work` in this conversation; otherwise handle the request directly. Read `~/.claude/workflow/rules.md`. Input: $ARGUMENTS (plan/reference, optional base, and task notes).

For standalone review, resolve the reference, task identity/baseline, and scope first; ask if ambiguous, never guess a base or the latest plan. Call an independent `wf-reviewer` via Agent in standalone mode with the reference, baseline/scope, current state, and active feedback. Tell it to use the task root explicitly and wait for completion. Standalone review is read-only and has no correction-loop authority.

Show its concise verdict and report. Findings need an explicit user decision to fix/replan or proceed with them unaddressed; do not silently accept them as limitations. Blocked review needs the missing input. A new review is always allowed.

## After a clean review

Build uses this step too. Require complete plan coverage and no open findings, incomplete work, blockers, or uncertain coverage; a finished build alone is not enough. UI-correction loops return directly to UI instead.

Summarize the result and ask for human code approval, offering optional Plannotator code review and optional UI review. Use a meaningful choice rather than fixed menu text; if the user already approved and chose the next step, do not ask again.

Requested code review → open gated Plannotator code review for the absolute task root, using its tool when available or the documented CLI otherwise. Use an explicit base only when supplied; ask the user to verify the browser comparison against the task baseline and pre-existing changes. Non-Git has no Plannotator code review. End the turn and wait.

- Explicit code approval → invoke `workflow-ui` if requested, otherwise `workflow-finalize` after explicit UI skip.
- Annotations → save the feedback with plan/current-state references and clarify whether to replan or proceed without addressing it. Do not infer new implementation authority from annotations alone.
- Dismissal, silence, or failure → not approval; wait for chat.

Carry the original plan, task identity/baseline, current state/feedback paths, decisions, limitations, review scope, and relevant check evidence into the next phase. Avoid a second approval question when the user's choice already covers it.
