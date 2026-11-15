# UI (optional)

Human live-app review, not another audit. Read the plan and needed routes; do not rerun checks, edit code, start servers, install, scan ports, or write Git.

Reuse the provided URL/route or ask for it. The user runs the dev server; if needed, inspect the project and give its existing dev command and directory. A bare port means `http://localhost:<port>/`. Require loopback HTTP for live review; clarify remote/HTTPS targets rather than guessing.

Warn that live interactions can change real data, then open Plannotator `annotate` for the URL with `gate: true` and wait. If live preview is unavailable, ask the user to use `/plannotator-annotate <url> --app --gate`; static-page approval is not live UI approval.

- Requested changes, even alongside approval: save a concise feedback report with the plan/current-state references, URL/route, requests, and coverage limits. Clear localized requests within the design authorize a UI-correction loop: `workflow_phase` to build with that authority, feedback, and a return-to-UI instruction. After fixes and clean focused follow-up review, return here automatically. Consequential design changes or missing authority go to Plan.
- Explicit approval or explicit skip → `workflow_phase` to finalize with the plan and current state/feedback.
- Dismissal, silence, or failure is not approval. Wait for chat; offer retry/skip/change direction when appropriate, without repeatedly reopening review.
