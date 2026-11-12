---
name: workflow-build
description: Workflow Build phase. Builds each planned feature in a fresh builder subagent (no review in between), then runs initial whole-plan review with focused follow-ups (or a focused UI-correction loop) for an approved plan in fresh subagents, then routes to human approval, UI or Plan. Use after a plan is approved, from UI with a correction loop, or when the user asks to hand off to build. Only inside a /work task in this conversation.
user-invocable: false
argument-hint: "[plan path]"
---

# Build (orchestration)

Run this phase only in a conversation where the user ran `/work`. Otherwise stop: don't run the phase, handle the request as an ordinary one.

Read `~/.claude/workflow/rules.md` first. Input: $ARGUMENTS (absolute plan path plus notes; ask if missing).

The heavy work happens in fresh subagents so this conversation stays small. Don't implement or review here.

1. The request or handoff authorizes starting; no start confirmation. Automatic continuation needs explicit loop authorization: plan approval, the user's words, or a UI handoff authorizing a UI-correction loop. Without it (e.g. "build F2", no approved plan), after step 2 spawn one new `wf-builder` for exactly the supplied scope with step 3's handoff fields (no loop authorization; mode = that feature or finding IDs), marked "no loop authority", wait for it, then run `~/.claude/skills/workflow-review/SKILL.md` from step 2 (standalone review and its routing) with the builder's summary. No next-feature work; skip steps 3-4.
2. Reuse task identity/baseline from `/work` and the plan: task root, kind, start commit and pre-existing changed paths (or non-Git scope). Ask if missing. Work in place; no new baseline, metadata or install authority.
3. Spawn a new `wf-orchestrator` with: absolute plan path, "loop authorized: <source>", task identity/baseline, absolute latest authoritative progress/review state and active-feedback paths, and notes (answers, decisions and accepted limitations with reasons, explicit-direction exceptions). History stays linked through state, not a mandatory reading list. For a UI-correction loop add feedback path, reviewed URL/route and "return to UI after clean review with complete plan coverage; follow-up scope per rules.md". Preserve rules.md's compact evidence handoff: latest review evidence path (or none), changed paths/findings/affected criteria, required checks and prior exact results with checked-state/environment references. Carry it through verdict routing below. Don't paste the conversation. Wait for its completion notification; don't poll it or work meanwhile.
4. Route on its final answer:
   - `Verdict: blocked` → give the user the consolidated blocker summary: finite choices via `AskUserQuestion`, design decisions in chat. Then spawn a new `wf-orchestrator` with the same plan, the latest report paths and the answers (no extra start confirmation). New scope still needs approval; invoke `workflow-plan` with the latest report only when the answer requires replanning.
   - `Verdict: replan` (UI-correction loop) → invoke `workflow-plan` once with the feedback report, the original plan path and the progress report paths. No picker.
   - `Verdict: clean` in a UI-correction loop → invoke `workflow-ui` once with the original plan path; notes carry task identity/baseline, latest authoritative progress/review state and active-feedback paths, and the URL/route. No approval picker, no Finalize: the corrected UI still needs human review.
   - `Verdict: clean` otherwise → follow "Clean result → human approval" in `~/.claude/skills/workflow-review/SKILL.md`, with the orchestrator's report paths.
5. Show the user a short summary each time: features done, report path, checks.
