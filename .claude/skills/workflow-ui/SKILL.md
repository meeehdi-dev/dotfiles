---
name: workflow-ui
description: Optional live human review of a user-running dev server in Plannotator. Routes feedback to Build or Plan; never manages servers. Only inside a /work task.
user-invocable: false
argument-hint: "[plan path] [notes]"
---

# UI

Run only inside a conversation where the user ran `/work`; otherwise handle the request directly. Read `~/.claude/workflow/rules.md` first. Input: $ARGUMENTS (original plan path, task identity/baseline, latest progress/review state, active feedback and known URL/route).

Preserve rules.md's compact evidence handoff in feedback and all routing notes: latest review evidence path (or none), changed paths/findings/affected criteria, required checks and prior exact results with checked-state/environment references. Local corrections use follow-up scope, not automatic whole-plan rereview or all broad checks; expansion and freshness requirements still apply.

Human visual review, not another audit. Read the plan and only needed routes/contracts; reuse unchanged context. Don't rerun checks, fix code, install prerequisites, edit config, scan ports, migrate data, start/stop servers, provision infrastructure or write Git.

1. Reuse the task root and original plan from handoffs; ask if missing/ambiguous. Ask for the user's running dev-server URL if not known. Never start, adopt or stop that server. A bare port means `http://localhost:<port>/`; preserve route/query/fragment. Live review needs loopback HTTP; ask about remote/HTTPS targets rather than guessing. Confirm the app is the task's implementation, not another checkout.
2. Warn that interactions are live and can change real data; prefer disposable dev data. Follow rules.md Human surfaces: consult the Plannotator skill, use its tool when available, otherwise documented CLI `plannotator annotate <url> --gate --json` in background Bash with a long timeout. Say closing without deciding sends nothing and the user can reply in chat. End the turn after opening. Never treat static-page approval as live approval; uncertain preview is a blocker, not permission to silently substitute static review.
3. Route tool feedback, CLI `decision` and chat:
   - **Requested changes** (including requests accompanying approval): save a new UI feedback report with task/plan context, URL/route, requests and coverage limits. Feedback is not yet confirmed defects. No picker.
     - Small, clear, localized fixes within the design → invoke `workflow-build` once with original plan path, task identity/baseline, latest progress/review state and active-feedback paths, material decisions/limitations with reasons, URL/route, and "UI-correction loop authorized: <user feedback>; return to UI after clean review with complete plan coverage; follow-up scope per rules.md".
     - Consequential decision, replanning or more authority → invoke `workflow-plan` with feedback report, exact original plan path and latest state.
     - Address requests before Finalize unless the user explicitly withdraws/defers them.
   - **Explicit live approval or explicit skip** → invoke `workflow-finalize` once with original plan path, task identity and main-session ID, latest progress/review state/active-feedback paths, decisions and accepted limitations/deferrals with reasons. History remains linked for consolidation.
   - **Dismissed, empty, closed tab or failure** → not approval. Once chat resumes, `AskUserQuestion`: "Retry live review", "Skip UI and go to Finalize", "Change direction".

Explicit workflow exit follows rules.md Leaving and does not touch the user's server.
