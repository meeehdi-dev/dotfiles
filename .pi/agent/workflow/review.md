# Review

For standalone review, resolve the plan/reference and scope first; ask if ambiguous, never guess a base or the latest plan. Call an independent `reviewer` in the task root with the reference, baseline/scope, current state, and active feedback. Standalone review is read-only and has no correction-loop authority.

Show its concise verdict and report. Findings need an explicit user decision to fix/replan or proceed with them unaddressed; do not silently accept them as limitations. Blocked review needs the missing input. A new review is always allowed.

## After a clean review

Build uses this step too. Require complete plan coverage and no open findings, incomplete work, blockers, or uncertain coverage; a finished build alone is not enough.

Summarize the result and ask for human code approval, offering optional Plannotator code review and optional UI review. Use a meaningful choice rather than fixed menu text; if the user already approved and chose the next step, do not ask again.

Requested code review → open Plannotator `review` with the task root and `gate: true`; use an explicit base only when supplied, and ask the user to verify the comparison against the task baseline in the browser. Non-Git has no Plannotator code review. End the turn and wait.

- Explicit code approval → `workflow_phase` to UI if requested, otherwise Finalize after explicit UI skip.
- Annotations → save the feedback with plan/current-state references and clarify whether to replan or proceed without addressing it. Do not infer new implementation authority from annotations alone.
- Dismissal, silence, or failure → not approval; wait for chat.

Carry the original plan, current state/feedback paths, decisions, limitations, review scope, and relevant check evidence into the next phase. Avoid a second approval question when the user's choice already covers it.
