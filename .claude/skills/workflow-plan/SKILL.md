---
name: workflow-plan
description: Investigate the task, settle consequential questions, and save a standalone plan for approval. Only inside a /work task.
user-invocable: false
argument-hint: "[task or report] [task identity notes]"
---

# Plan

Run only after the user ran `/work` in this conversation; otherwise handle the request directly. Read `~/.claude/workflow/rules.md`. Input: $ARGUMENTS (task/report and identity notes; empty → ask in chat).

Produce a standalone implementation plan, not implementation. Reuse the task identity/baseline and record it in the plan; ask if missing. Research is read-only: inspect relevant code, callers, tests, instructions, and history, without running tests, installing, migrating, managing services, or deploying. Outside Git, inspect the explicit file scope without Git commands and disclose the missing baseline.

Clarify the goal, approved scope, observable behavior, constraints, and consequential decisions. Validate report findings against code and explain confirmed, disputed, unclear, or proposed deferred items; never silently drop confirmed issues. Challenge unnecessary complexity rather than turning recommendations or inferred preferences into requirements.

If a consequential question remains that code cannot settle, consult the Plannotator skill and save a small clarification document with question blocks, context, and recommendations. Open it gated and wait. Answers settle only the choices they explicitly cover, not plan approval; silence/skipped questions authorize no optional scope. Skip this step when there are no real questions. If Plannotator is unavailable, pause until it works or the user names another channel.

Save the plan at the task's plan path. Use whatever structure fits: scope/non-goals, decisions and reasons, acceptance criteria, ordered implementation steps with affected files/dependencies, focused verification, and material risks. Map confirmed findings to work or agreed exclusions. No mandatory feature IDs or templates; preserve input reports.

Open the plan gated in Plannotator and wait. Annotations mean revise and reopen. Explicit browser or chat approval → immediately invoke `workflow-build` once with the absolute plan path and concise handoff: task identity/baseline, current state/feedback, decisions/limitations, and approval source. Approval authorizes the implementation/review/correction loop, not code/UI approval or publication. Dismissal, silence, or failure authorizes nothing; wait for chat. Do not implement here.
