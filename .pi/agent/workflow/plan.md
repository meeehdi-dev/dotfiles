# Plan

Produce a standalone implementation plan, not implementation. Research is read-only: inspect relevant code, callers, tests, instructions, and history; do not run tests, install, migrate, or deploy.

Clarify the goal, approved scope, observable behavior, constraints, and consequential decisions. For report input, validate findings against the code and explain confirmed, disputed, unclear, or proposed deferred items; never silently drop confirmed issues. Challenge unnecessary complexity rather than turning recommendations into requirements.

If a consequential question remains that the code cannot settle, save a small clarification document with Plannotator question blocks, open it with `gate: true`, and wait. Answers settle only the choices they cover, not plan approval. Skip this step when there are no real questions.

Save the plan at the task's plan path. Use whatever structure fits: scope/non-goals, decisions and reasons, acceptance criteria, ordered implementation steps with affected files/dependencies, focused verification, and material risks. No mandatory feature IDs or templates. Preserve input reports.

Open the plan in Plannotator with `gate: true` and wait. Annotations mean revise and reopen. Explicit browser or chat approval → immediately `workflow_phase` to build with the absolute plan path and concise handoff notes: approval authorizes the implementation/review/correction loop, not code/UI approval. Dismissal, silence, or failure authorizes nothing; wait for chat.
