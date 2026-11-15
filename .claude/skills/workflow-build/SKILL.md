---
name: workflow-build
description: Delegate an authorized build, independent review, and focused correction loop, then route its result. Only inside a /work task.
user-invocable: false
argument-hint: "[plan path] [notes]"
---

# Build

Run only after the user ran `/work` in this conversation; otherwise handle the request directly. Read `~/.claude/workflow/rules.md`. Input: $ARGUMENTS (absolute plan path and notes; ask if missing).

Reuse the task identity/baseline; ask if missing, never rediscover it. Delegate implementation, not implement or review in the main session unless the user explicitly requests an exception.

With explicit loop authority, call `wf-orchestrator` via Agent with the plan, task identity/baseline, current state/feedback, authority source, and relevant decisions/check evidence. Tell it to use the task root explicitly. It builds coherent chunks, then independently reviews the whole plan and handles in-scope fixes with focused follow-up review. Wait for completion; do not ask again to start an authorized loop.

Without loop authority, call one `wf-builder` for only the requested scope, marked “no loop authority”, then invoke `workflow-review` for an independent standalone review; do not authorize further fixes implicitly.

Route the orchestrator's result:
- `clean`: follow the human code-approval step in `workflow-review`. For a UI-correction loop, invoke `workflow-ui` directly with the original plan, state/feedback, and URL/route instead.
- `blocked`: summarize what needs authority/input and ask once. Resume with the answer and latest state; return to Plan only if scope/design needs changing.
- `replan`: invoke `workflow-plan` with the report and original plan references.

Keep the user summary short: outcome, current report paths, checks, and material limitations. Carry enough state to resume, not the transcript.
