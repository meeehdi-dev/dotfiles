---
name: workflow-ui
description: Optional live human review of the user's running dev server; route localized feedback through fixes and review. Only inside a /work task.
user-invocable: false
argument-hint: "[plan path] [notes]"
---

# UI

Run only after the user ran `/work` in this conversation; otherwise handle the request directly. Read `~/.claude/workflow/rules.md`. Input: $ARGUMENTS (original plan, task identity/baseline, current state/feedback, known URL/route); ask if identity or plan is missing/ambiguous.

Human live-app review, not another audit. Read the plan and needed routes/contracts; do not rerun checks, edit code/config, install, scan ports, migrate, provision infrastructure, manage servers, or write Git.

Reuse the provided URL/route or ask for the user's running dev server. Never start, adopt, or stop it. A bare port means `http://localhost:<port>/`; preserve route/query/fragment and confirm it serves this task's implementation. Require loopback HTTP for live review; clarify remote/HTTPS targets rather than guessing.

Warn that live interactions can change real data; prefer disposable dev data. Open gated Plannotator live review of the URL using its tool or documented CLI, then end the turn and wait. A static preview is not live approval; an uncertain/unavailable live preview is a blocker, not permission to silently substitute static review.

- Requested changes, even alongside approval: save a concise feedback report with task/plan/current-state references, URL/route, requests, and coverage limits. Clear localized requests within the design authorize a UI-correction loop: invoke `workflow-build` with that authority, feedback, and a return-to-UI instruction. After fixes and clean focused follow-up review, return here automatically. Consequential design changes or missing authority go to `workflow-plan`. Address requests before Finalize unless explicitly withdrawn/deferred by the user.
- Explicit live approval or explicit skip → invoke `workflow-finalize` with the original plan, task identity, current state/feedback, and decisions/limitations.
- Dismissal, silence, or failure is not approval. Wait for chat; offer retry/skip/change direction when appropriate, without repeatedly reopening review.

Leaving the workflow never touches the user's server.
