---
name: workflow-ui
description: Workflow UI phase. Optional human visual review of the task's local app in Plannotator; starts and stops an inspected dev server or reuses a user-supplied URL. Use when the user approves code and picks UI, when a UI-correction loop returns, or when the user asks to hand off to UI. Only inside a /work task in this conversation.
user-invocable: false
argument-hint: "[plan path] [notes]"
---

# UI (optional live review)

Run this phase only in a conversation where the user ran `/work`. Otherwise stop: don't run the phase, handle the request as an ordinary one.

Read `~/.claude/workflow/rules.md` first. Input: $ARGUMENTS (original plan path plus notes: known report paths, and after a UI-correction loop the feedback path, URL/route and server ownership).

Human visual review, not another audit. Read the plan and only the UI routes/contracts you need; no prior Review report is required. Don't rerun checks, fix code, edit journals, scan ports, migrate data, start containers/databases, provision infrastructure or write Git. The only extra authority is rules.md Preparation (managed Git) and the dev-server lifecycle below. Explicit user direction at a blocker wins within its scope (rules.md, Authority); safety checks stay.

1. **Task root.** Git: `~/.claude/workflow/task.sh info` (exit 0 → managed task root, Preparation applies; exit 3 → current checkout, no Preparation; exit 1 → pause and report). Non-Git: the conversation's root; the app dir must sit inside it (canonical path, no symlink escape); edits are in place without rollback. The app must serve this task root, never the source checkout.
2. **User-managed URL.** If the user supplies a URL (or notes say it's user-managed), use it as is: never start, adopt or stop that server. A bare port means `http://localhost:<port>/`; keep route/query/fragment. Plannotator live review needs loopback HTTP (`localhost`, `127.0.0.1`, `[::1]`): ask about remote or HTTPS targets instead of guessing. Skip to step 5.
3. **Prepare and start (owned server).**
   - Inspect the project's existing dev command, every script it invokes, prerequisites and external-data effects. Unclear command, authority, prerequisites or data effects → ask.
   - Managed Git with missing prerequisites: apply rules.md Preparation first, without a routine question or Build detour. Otherwise install nothing and change no config.
   - Start it with background Bash (`run_in_background` with `timeout: 7200000`, the maximum, so the default 30-minute cap doesn't kill it mid-review) in the absolute app directory inside the task root (e.g. `cd <app dir> && <command>`). No credentials in the command or environment, none read into the chat. If it ends anyway (exit or cap), say so and offer a restart or a user-managed URL.
   - One owned server at a time: if one from this phase still runs, reuse its URL or `TaskStop` it before starting again.
4. **URL from output.** Wait (Monitor until-loop, bounded) until a URL appears and output settles, the command exits, or startup times out. Read only URL matches from the output (e.g. grep for `http://(localhost|127.0.0.1|\[::1\])`), never dump raw logs: they can hold secrets. Only complete tokens (ending in whitespace or a quote) count; no guessed ports or split URLs.
   - Exactly one usable URL → use it, no URL question. After a correction loop, reapply the reviewed route/query/fragment from the notes.
   - Several URLs → keep the owned server, explain, and ask which one.
   - None, early exit or timeout → `TaskStop` the owned task first (an exited one is already stopped), explain the state, then ask for the actual URL or offer manual startup (show the app dir and the inspected command; a server the user starts is user-managed).
5. **Open.** Warn that interactions are live and can change real data; prefer disposable dev data. Tell the user that closing the tab without deciding sends nothing and they can reply in chat. Open the URL gated (rules.md, Human surfaces: `plannotator annotate <url> --gate --json`), end the turn. Keep the owned server running while Plannotator waits. If the live preview is unavailable or uncertain, reopen with the CLI `plannotator annotate <url> --app --gate --json` (it fails loudly instead of converting). Never treat a static-page approval as live UI approval.
6. **Stop before leaving.** Before any handoff or requested return, `TaskStop` the owned server (never a user-managed one; never kill by port, PID or process match). If it fails, report the retained task and manual recovery before continuing. A requested return then follows rules.md (`ExitWorktree keep`).
7. **Route** on the JSON `decision` and chat:
   - **Requested changes** (annotations or chat, even with an approval) → save a new standalone UI feedback report (`<root>/reviews/<key>/<id>-ui-feedback-<UTC timestamp>.md`: task and plan context, URL/route, requests/annotations, coverage limits). It's human feedback, not confirmed defects. No picker.
     - Small, clear, localized fixes within the design, needing no consequential decision or extra authority → step 6, then invoke `workflow-build` once with the original plan path. Notes: "UI-correction loop authorized: <user's UI feedback>", the feedback report as supplemental acceptance criteria, task root and kind, every known report path, the reviewed URL/route, server ownership (owned: restart on return; user-managed: reuse the URL), and "return to UI after a clean whole-plan review". Build validates the feedback; UI never fixes code.
     - Needs replanning, a consequential decision or more authority → step 6, then invoke `workflow-plan` once with the feedback report and the exact original plan path.
     - Requests are addressed before Finalize unless the user explicitly withdraws or defers them.
   - **Explicit live approval, or explicit skip** → step 6, then invoke `workflow-finalize` once with the original plan path. Notes: absolute paths of every known same-task report (incoming plus any new UI feedback report), material decisions, accepted deferrals/limitations with reasons, and approval/skip guidance. Never replace the plan with a report list or pass the transcript.
   - **Dismissed, empty, closed tab or failure** → not approval (rules.md). Once chat resumes, `AskUserQuestion`: "Retry live review", "Skip UI and go to Finalize", or "Change direction" (clarify in chat).
