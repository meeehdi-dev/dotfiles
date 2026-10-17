# UI

Optional human visual review, not another automated audit. Use the selected task/plan reference; no prior Review receipt is needed. Read it completely and inspect only relevant UI routes/contracts as necessary. Do not rerun the audit/tests, fix code, edit journals, install, scan ports, manage servers, or write Git.

- Ask for the already-running app's local HTTP URL. A bare port means http://localhost:<port>/. Retain route/query/fragment. Plannotator live review supports loopback HTTP, not remote hosts or HTTPS; ask about unsuitable targets rather than guessing one.
- The user starts/stops the app. Warn that interactions are live and may change real data; prefer disposable development data.
- Normally call plannotator annotate on the URL with gate: true, then end the turn. The public tool auto-detects live apps but cannot force --app: if the live preview is unavailable or uncertain, ask the user to run /plannotator-annotate <url> --app --gate. Do not silently substitute a static page or treat static-page approval as live UI approval.
- Requested changes: write a standalone new report with task/plan context, URL, requests/annotations, and coverage limitations. Preserve original inputs/reports. This is human feedback, not independently confirmed code defects. Ask whether to return to Plan to revalidate it or proceed.
- A chosen Plan route uses workflow_handoff with that report's absolute path. Explicit approval of the live UI, or the user's explicit choice to proceed/skip, uses workflow_handoff for Finalize with the original plan/reference and any guidance notes.
- Dismissal, empty feedback, failure, or unavailable live review is not approval. Ask in chat whether to retry, skip, or change direction. A plain browser close may send no message; tell the user they can continue here at any time.
