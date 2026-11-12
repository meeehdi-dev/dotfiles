# Build (orchestration)

Input: absolute plan path plus notes. The heavy work happens in subagents so this session stays small. Route from state, check evidence and verdicts; inspect code only to resolve missing/conflicting evidence. Don't implement or review here without an explicit user exception.

1. The handoff authorizes starting; no confirmation. Continuation needs explicit loop authorization: plan approval, the user's words, or a UI handoff authorizing a UI-correction loop. Without it (e.g. "build F2"), spawn one `builder` for exactly that scope, marked "no loop authority", then follow `review.md` from its step 1 (standalone review and routing). Skip steps 2–3.
2. Call `subagent` with agent `orchestrator`, `cwd` = task root, and a task containing: absolute plan path, "loop authorized: <source>", task root and kind (Git start commit and pre-existing changed paths, or non-Git), absolute latest authoritative progress/review state and active-feedback paths (history remains linked), and notes (answers, decisions, accepted limitations, user exceptions). For a UI-correction loop add the feedback report path, reviewed URL/route and "return to UI after clean review with complete plan coverage". Preserve rules.md's compact evidence handoff: latest review evidence path (or none), changed paths/findings/affected criteria, required checks and prior exact results with checked-state/environment references. Carry it through verdict routing below. Never paste the conversation.
3. Route on its first line:
   - `Verdict: blocked` → give the user the blocker summary: finite choices via `workflow_question`, design decisions in chat. Then start a new orchestrator with the same plan, the latest report paths and the answers. New scope still needs approval; `workflow_phase` plan with the latest report only when an answer requires replanning.
   - `Verdict: replan` → `workflow_phase` plan with the feedback report; notes carry the plan and progress report paths.
   - `Verdict: clean` in a UI-correction loop → `workflow_phase` ui with the plan path; notes carry latest progress/review state and active-feedback paths, the URL/route. No approval picker.
   - `Verdict: clean` otherwise → follow "Clean result → human approval" in `review.md` with the orchestrator's report paths.
4. Show the user a short summary each time: features done, report path, checks.
