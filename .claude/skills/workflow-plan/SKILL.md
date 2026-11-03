---
name: workflow-plan
description: Workflow Plan phase. Investigate a task or a findings/feedback report, settle consequential questions in Plannotator, and save a standalone plan with numbered features for gated approval. Use from /work, or when Review/UI routes back to Plan to replan within the same task.
user-invocable: false
argument-hint: "[task or report] [task identity notes]"
---

# Plan

Read `~/.claude/workflow/rules.md` first. Input: $ARGUMENTS (task or report plus task identity notes; empty → ask in chat).

Produce an agreed standalone implementation plan, not an implementation. Explicit user direction at a blocker wins over these defaults within its scope (rules.md, Authority); safety and helper checks stay. Interpret the input by meaning, not filename. If the input or goal is unclear, ask; don't invent defects in an arbitrary document or overwrite an input report with the plan.

1. **Task root.** Reuse the validated task: in Git, `~/.claude/workflow/task.sh info` (failure → pause and report; no new worktree from here). Outside Git, use the identity from this conversation; if there is none, ask (the user starts with `/work`).
2. **Research, read-only.** Read applicable instructions and relevant source, callers, tests, interfaces and history. Outside Git, don't ask for Git status/diff/history; list the explicit task files and note the missing baseline and in-place risk. Don't implement, run tests, install, migrate, manage services or deploy.
3. **Scope.** Establish goal, observable behaviour, constraints, scope and non-goals. Only user-requested or explicitly approved scope; derive the needed steps and checks without per-file approval. Recommendations, inferred preferences and unrelated improvements aren't requirements. Challenge unnecessary complexity and dependencies.
4. **Report input.** Classify every finding: confirmed, incorrect/not applicable, needs clarification, or proposed deferral, with evidence. Agree on exclusions; never drop confirmed issues silently.
5. **Grilling, in Plannotator only.** If consequential details, assumptions or optional additions remain that the code can't settle, invoke the `plannotator` skill, then save a separate clarification doc (`<root>/plans/<key>/<id>-<topic>.md`) with one `:::question` block per question (syntax from that skill), its context covering consequences, a recommendation with reasons, and a choice that rejects any optional addition. Open it gated (rules.md, Human surfaces), end the turn, wait. Follow up only on remaining consequential uncertainty. No real questions → skip; never invent a round.
   - These questions go through Plannotator, never `AskUserQuestion` or a chat fallback. If Plannotator is unavailable, pause these decisions until it works or the user names another channel. A close without answers picks no default.
   - Only an explicit answer covering a proposal puts it in scope. Silence, skipped questions, a closed tab, a tool failure or approval of another item authorize nothing; keep those proposals out, and pause if an unanswered one blocks requested behaviour. Plan approval never legitimizes silently added scope.
   - Answering the grilling doc approves no plan and authorizes no Build.
6. **Write the plan** to `<root>/plans/<key>/<id>.md` (key and id from the validated task; explicit paths win). Descriptive, no code or pseudocode, complete but not ceremonial:
   - scope / non-goals, current-state evidence and references, decisions and reasons;
   - **numbered features with stable IDs (F1, F2…), acceptance criteria per feature, ordered steps with affected files/interfaces, explicit dependencies**; not a feature per file or test, no separately approved sub-plans;
   - validation commands and cases, risks and stop conditions;
   - a short Build handoff: "Approved → workflow-build with this plan; the per-feature loop is authorized for in-scope work."
   Map report findings to steps or agreed exclusions. Resolve consequential decisions first.
7. **Approval, separate from grilling.** Open the plan gated in Plannotator, end the turn, wait. Annotations → revise and reopen. Resolve conflicts and unanswered consequential questions.
8. **Explicit approval** (browser or chat) → invoke the `workflow-build` skill once with the absolute plan path, the approval as loop authorization, clarification paths and any approval notes. Silence, a closed tab or an error → `AskUserQuestion` (retry / stop / change direction) once the conversation resumes. Don't implement here.
