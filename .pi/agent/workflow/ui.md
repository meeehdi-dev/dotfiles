# UI (optional live review)

Input: original plan path plus notes (report paths; after a correction loop, the feedback path and URL/route). Human visual review, not another audit: read the plan and only the UI routes you need. Don't rerun checks, fix code, start servers, install, scan ports or write Git.

1. **URL.** The user runs the dev server; edits are in place, so a running server already serves the task's code. If the notes carry a URL/route, reuse it. Otherwise ask for the URL; if none is running, first inspect the project and print its existing dev command and directory (e.g. `cd <root>/<app> && npm run dev`). A bare port means `http://localhost:<port>/`. Live review needs loopback HTTP; ask about remote or HTTPS targets instead of guessing.
2. **Open.** Warn that interactions are live and can change real data. Tell the user closing the tab sends nothing. Call the `plannotator` tool, action `annotate`, `target` = URL, `gate: true`, end the turn. If the live preview is unavailable, ask the user to run `/plannotator-annotate <url> --app --gate`. Never treat a static-page approval as live UI approval.
3. **Route** on the decision and chat:
   - **Requested changes** (even with an approval) → save a UI feedback report (`~/.pi/reviews/<key>/<id>-ui-feedback-<UTC timestamp>.md`: plan context, URL/route, requests, coverage limits). It's human feedback, not confirmed defects.
     - Small, clear, localized fixes within the design → `workflow_phase` build with the plan path; notes: "UI-correction loop authorized: <user's feedback>", the feedback report as supplemental acceptance criteria, every known report path, the URL/route, "return to UI after a clean whole-plan review".
     - Needs replanning, a consequential decision or more authority → `workflow_phase` plan with the feedback report and the plan path.
   - **Explicit approval, or explicit skip** → `workflow_phase` finalize with the plan path; notes: every known same-task report path, decisions, accepted limitations.
   - **Dismissed, empty, closed tab or failure** → not approval. Once chat resumes, `workflow_question`: "Retry live review", "Skip UI and go to Finalize", "Change direction".
