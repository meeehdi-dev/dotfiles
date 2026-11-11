# Review (standalone)

Input: plan/reference, optional base. Ask if missing or if the scope is ambiguous; never guess `main` or the latest plan. Standalone review is read-only and carries no loop authority.

1. Call `subagent` with agent `reviewer`, `cwd` = task root, in **standalone** mode, with: absolute plan/reference path, task root and kind, scope (Git: changes since start excluding pre-existing paths, or the given base; non-Git: the explicit files), latest authoritative progress/review state and active-feedback paths (history remains linked). Never paste the conversation.
2. Route on its verdict:
   - `Verdict: findings` → show the findings and report path, then `workflow_question`: "Back to plan to revalidate" (`workflow_phase` plan with the report path; Plan revalidates, it doesn't blindly implement) or "Proceed without replanning" (findings stay unaddressed; then "UI or Finalize" below).
   - `Verdict: clean` → "Clean result → human approval" below.
   - `Verdict: blocked` → explain what's missing and ask in chat.
3. A new review is always allowed; earlier reports and approvals are evidence, not locks.

## Clean result → human approval

Used here and by Build. Only a clean standalone review or complete plan coverage (initial whole-plan review plus valid follow-up evidence under rules.md) reaches this; never a finished build without review, a blocked loop, or a UI-correction loop (that returns to UI).

1. Resolve the original plan from the input and reports; if missing or ambiguous, ask.
2. `workflow_question` with exactly, in order: "Review code in Plannotator", "Approve code and go to UI", "Approve code, skip UI, and go to Finalize". Non-Git: only the last two.
3. A direct approval → `workflow_phase` ui or finalize with the plan path and the notes in step 6.
4. "Review code in Plannotator" approves nothing by itself. Tell the user closing the tab sends nothing. Call the `plannotator` tool, action `review`, `target` = task root, `gate: true` (`options.base` only if the user asked for a base); ask the user to check the comparison in the browser (uncommitted changes vs the start commit). End the turn. Then:
   - approved (notes are guidance) → "UI or Finalize" below.
   - annotations → save a feedback report (requests, plan/report references, context for Plan), then `workflow_question`: "Back to plan to revalidate" or "Proceed without replanning" (requests stay unimplemented; then "UI or Finalize").
   - dismissed, silence or failure → not approval; wait for chat.
5. UI or Finalize: `workflow_question` UI (optional live-app review) or Finalize, unless the user already said which. Then `workflow_phase` accordingly.
6. Notes to UI/Finalize: absolute latest progress/review state and active-feedback paths, plus material decisions and accepted limitations with reasons. Historical artifacts stay linked for Finalize's full consolidation.
