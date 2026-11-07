# Plan

Produce an agreed standalone implementation plan, not an implementation. Input: a task or a findings/feedback report; interpret it by meaning, not filename. If the input or goal is unclear, ask; don't overwrite an input report with the plan.

1. **Research, read-only.** Read applicable instructions and relevant source, callers, tests, interfaces and history in the task root. Don't implement, run tests, install, migrate or deploy.
2. **Scope.** Establish goal, observable behaviour, constraints, scope and non-goals. Only user-requested or explicitly approved scope; derive the needed steps and checks without per-file approval. Recommendations and unrelated improvements aren't requirements. Challenge unnecessary complexity and dependencies.
3. **Report input.** Classify every finding: confirmed, incorrect/not applicable, needs clarification, or proposed deferral, with evidence. Never drop confirmed issues silently.
4. **Grilling, in Plannotator only.** If consequential details, assumptions or optional additions remain that the code can't settle, save a clarification doc (`~/.pi/plans/<key>/<id>-<topic>.md`) with one `:::question` block per question (syntax from the plannotator skill): context and consequences, a recommendation with reasons, and a choice rejecting any optional addition. Open it with the `plannotator` tool (`gate: true`), end the turn, wait. Follow up only on remaining consequential uncertainty. No real questions → skip.
   - Only an explicit answer covering a proposal puts it in scope. Silence, skipped questions or a closed tab authorize nothing. Answering the grilling doc approves no plan.
5. **Write the plan** to `~/.pi/plans/<key>/<id>.md`. Descriptive, no code or pseudocode, complete but not ceremonial:
   - scope / non-goals, current-state evidence, decisions and reasons;
   - **numbered features with stable IDs (F1, F2…), acceptance criteria per feature, ordered steps with affected files, explicit dependencies**; not a feature per file or test;
   - validation commands and cases, risks and stop conditions;
   - a short Build handoff stating that approval authorizes the full loop.
6. **Approval.** Open the plan with the `plannotator` tool, `gate: true`, end the turn, wait. Annotations → revise and reopen.
7. **Explicit approval** (browser or chat) → `workflow_phase` build with the absolute plan path; notes: clarification paths, approval notes, and "plan approval authorizes the loop: all planned features in fresh builders with progress reports, no per-feature Review, then whole-plan Review and automatic in-scope correction rounds until clean or blocked; not code/UI approval". Silence, a closed tab or an error → once chat resumes, `workflow_question` (retry / stop / change direction).
