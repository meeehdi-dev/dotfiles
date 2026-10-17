# Personal Pi workflow

**Plan → Build → Review → optional UI → Finalize.** Guidance, not a permission system.

Installed through `~/.pi/agent/extensions/workflow-modes.ts`. Reload/restart Pi after changes. Ordinary Pi stays untouched until a phase is selected. Pi owns the model, thinking level, tools, permissions, and project trust; there are no workflow profiles.

## Commands

| Command | Job |
| --- | --- |
| `/plan [task or report]` | Investigate, settle consequential questions, save a standalone descriptive plan, and ask for approval. |
| `/build [plan]` | Read the plan, implement its scope, run relevant checks, then hand off to Review. |
| `/review [plan/reference]` | Independently inspect changes/checks and save a standalone findings or no-findings report. |
| `/ui [plan/reference]` | Optional human visual review of an already-running local app. |
| `/finalize [plan/reference]` | Only instructed journals/logs, then one task-wide Conventional Commit subject. Git writes stay yours. |
| `/workflow` | Show the current phase/input and help. |

Each phase command starts a **fresh independent session**, even when repeating or switching phases. No `/new` requirement, mandatory phase order, approval records, or completed-session lock. Commands begin immediately; missing inputs are clarified in chat. Plan input is interpreted by the agent, not a filename-suffix parser. The command's entire argument is text, not shell syntax; spaces, quotes, backslashes, and multiline tasks are not shell-expanded or executed.

Phase and input follow the active session branch and restore on reload/resume/tree navigation, without automatically running work. Old `workflow-state` entries/approval receipts are ignored, not migrated or deleted; start the desired phase again for an old session.

## Handoffs

The agent has one helper, **`workflow_handoff`**, taking `mode`, `input`, and optional short `notes`. Use an absolute saved plan/report reference, not the previous transcript. The helper dispatches `/workflow-handoff` internally to reach Pi's command-only session API, creates the fresh session, and starts the selected phase. It performs no approvals, file writes, checks, or Git operations.

- **Plan approval → Build:** normally review the saved plan with Plannotator's ordinary annotate tool (`gate: true`). Annotations stay in Plan for revision. Explicit browser or chat approval starts Build, carrying any guidance notes.
- **Completed Build → Review:** automatic helper handoff with the same plan. Missing decisions are questions, not terminal states; continue in Build after clarification.
- **Review findings:** show them and ask **Plan or proceed**. There is no extra approval gate for the findings report. Plan gets the report and independently revalidates it.
- **No actionable findings:** normally open ordinary Plannotator code review. Human requests get a new standalone report and the same **Plan or proceed** question. When proceeding/approved, ask **UI or Finalize**, then hand off using the original implementation-plan reference.
- **UI:** ask for the app URL/port; the user manages the server. Human requests get a report and a **Plan or proceed** choice. Explicit live approval or an explicit choice to skip/proceed starts Finalize. Interactions can change real application data.
- **Finalize:** update only instructed bookkeeping, or nothing when none is required, then suggest one commit subject for the whole task. No completion helper or Git writes.

If the next step is unclear, the agent asks. If Plannotator is unavailable/dismissed or its result is unclear, ask in chat whether to approve, retry, stop, skip, or change direction—never infer approval. **Closing a normal Plannotator tab without sending feedback can send no message:** continue in chat when ready; there is no watcher/polling layer. Opening a review should explain that fallback beforehand.

Session creation/dispatch failures show the manual phase command. The helper also prints that command when requesting a handoff, since it does not track dispatch acknowledgements. Cancellation does not imply success; ordinary chat remains available. Concise notes travel with the handoff and are repeated in failure notices.

## Ordinary tools, short instructions

The editable `plan.md`, `build.md`, `review.md`, `ui.md`, and `finalize.md` prompts are reread for each request. They append guidance without replacing Pi's other instructions. Build loads `ponytail`; Review loads `ponytail-review`. Missing skills/prompts warn and continue. Additional project docs are read only when relevant to the selected contract or a concrete missing-context/compatibility/safety question.

Use Pi's normal tools to read/write artifacts, inspect Git, run checks, and research. Explicit user/task paths or applicable project-owned workflow/agent instructions take precedence per artifact type: a path for one type does not redirect another. Otherwise use `~/.pi/plans/<project-key>/<task>.md` for Plans and Plan feedback reports, and `~/.pi/reviews/<project-key>/<task>-<UTC timestamp>.md` for standalone Review and workflow UI/feedback reports. Derive `<project-key>` from the project/repository root directory name (for example, `dotfiles`); add enough parent path to disambiguate same-named projects, and ask if identity remains unclear rather than mix or overwrite artifacts. Existing directories or historical files alone are not overrides. These are instruction-only defaults, not enforced locations; Pi's normal tools write the files. Expand `~` before calling filesystem tools unless they support tilde expansion. Plans/feedback reports must stand alone. Read before revising, preserve input reports/earlier reviews, and never revert user work automatically. Review covers staged, unstaged, and new files by default; explicit branch scopes need the user's base, not a guessed main. Use normal Plannotator comparison controls/commands and verify the browser scope; the public tool can inherit saved preferences.

UI uses supported Plannotator tools/commands only. The public tool auto-detects a local live app but cannot force `--app`; if uncertain/unavailable, ask the user to run `/plannotator-annotate <url> --app --gate`. Do not substitute static approval for live UI approval. No private package imports, custom URL probes, or app-server management.

There are no custom artifact/Git/check/UI runners, receipts/hashes, helper locks, worktree fingerprints, result polling, model settings, or code-level plan/commit validators. Role boundaries and successful routing rely on the agent following instructions, **not a sandbox or guaranteed model behavior**. You can steer or select another phase at any time.

Existing flat home-level and dotfiles-local plans/reports are grouped under `~/.pi/plans/dotfiles/` and `~/.pi/reviews/dotfiles/`, with references to relocated artifacts updated. Other historical content, approval files, and session logs are left untouched. The removed source/config/test files can leave obsolete Stow symlinks; remove only those stale links or restow the package. Never delete the approvals directory to reinstall.

## Verification

No dependencies added. Requires installed Pi and Node 22.19+.

Run `npm test` in this directory (or `~/.pi/agent/workflow`). Tests load the actual extension through Pi's installed loader with disposable projects and fresh extension runtimes. They check session/branch restoration, commands/handoffs, notes, tool neutrality, failures/cancellation, and prompt contracts—not live providers or browsers. `PI_TEST_PACKAGE_ROOT` selects another installed Pi package.

Real model adherence, TUI/RPC rendering, browser/annotation behavior, live-app forwarding, and long human conversations still need a human smoke test. The workflow does not enforce that the model read a file, ran a check, preserved a report, or interpreted approval correctly.
