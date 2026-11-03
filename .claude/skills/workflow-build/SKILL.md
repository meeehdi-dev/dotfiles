---
name: workflow-build
description: Workflow Build phase. Runs the per-feature build/independent-review loop and the whole-plan review loop (or a focused UI-correction loop) for an approved plan in fresh subagents, then routes to human approval, UI or Plan. Use after a plan is approved, from UI with a correction loop, or when the user asks to hand off to build.
user-invocable: false
argument-hint: "[plan path]"
---

# Build (orchestration)

Read `~/.claude/workflow/rules.md` first. Input: $ARGUMENTS (absolute plan path plus notes; ask if missing).

The heavy work happens in fresh subagents so this conversation stays small. Don't implement or review here.

1. The request or handoff authorizes starting; no start confirmation. Automatic continuation needs explicit loop authorization: plan approval, the user's words, or a UI handoff authorizing a UI-correction loop. Without it (e.g. "build F2", no approved plan), after step 2 spawn one new `wf-builder` for exactly the supplied scope with step 3's handoff fields (no loop authorization; mode = that feature or finding IDs), marked "no loop authority", wait for it, then run `~/.claude/skills/workflow-review/SKILL.md` from step 2 (standalone review and its routing) with the builder's summary. No next-feature work; skip steps 3-4.
2. Task root. Git: run `~/.claude/workflow/task.sh info`. Exit 0 → the managed task root (Preparation applies). Exit 3 → no managed task: work in the current checkout, no Preparation, and tell the user. Exit 1 → pause and report. Non-Git: the root and explicit file scope from the notes (no baseline); ask in chat if unclear.
3. Spawn a new `wf-orchestrator` with: absolute plan path, "loop authorized: <source>", task root and kind (managed Git, Git without task metadata, or non-Git with its file scope), absolute paths of known same-task reports, and notes (answers, decisions, accepted limitations, explicit-direction exceptions). For a UI-correction loop add the feedback report path, reviewed URL/route, server ownership and "return to UI after a clean whole-plan review". Don't paste the conversation. Wait for its completion notification; don't poll it or work meanwhile.
4. Route on its final answer:
   - `Verdict: blocked` → give the user the consolidated blocker summary: finite choices via `AskUserQuestion`, design decisions in chat. Then spawn a new `wf-orchestrator` with the same plan, the latest report paths and the answers (no extra start confirmation). New scope still needs approval; invoke `workflow-plan` with the latest report only when the answer requires replanning.
   - `Verdict: replan` (UI-correction loop) → invoke `workflow-plan` once with the feedback report, the original plan path and the progress report paths. No picker.
   - `Verdict: clean` in a UI-correction loop → invoke `workflow-ui` once with the original plan path; notes carry every report path (feedback included), the URL/route and ownership. No approval picker, no Finalize: the corrected UI still needs human review.
   - `Verdict: clean` otherwise → follow "Clean result → human approval" in `~/.claude/skills/workflow-review/SKILL.md`, with the orchestrator's report paths.
5. Show the user a short summary each time: features done, report path, checks.
