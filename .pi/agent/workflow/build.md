# Build

Delegate implementation; do not implement or review in the main session unless the user explicitly requests an exception.

With explicit loop authority, call `orchestrator` in the task root with the plan, current state/feedback, authority source, baseline, and relevant decisions/check evidence. It builds coherent chunks, then independently reviews the whole plan and handles in-scope fixes with focused follow-up review. Do not ask again to start an authorized loop.

Without loop authority, call one `builder` for only the requested scope, then follow `review.md` for an independent standalone review; do not authorize further fixes implicitly.

Route the orchestrator's result:
- `clean`: follow the human code-approval step in `review.md`. For a UI-correction loop, return directly to UI with the feedback and URL/route instead.
- `blocked`: summarize what needs authority/input and ask once. Resume with the answer and latest state; return to Plan only if scope/design needs changing.
- `replan`: return to Plan with the report and original plan references.

Keep the user summary short: outcome, current report paths, checks, and material limitations. Carry enough state to resume, not the transcript.
