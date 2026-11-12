---
name: workflow-finalize
description: Consolidate the task plan and reports into one standalone decision record, verify before deleting consolidated artifacts, then end the workflow. No publication. Only inside a /work task.
user-invocable: false
argument-hint: "[plan path] [notes]"
---

# Finalize

Run only in a conversation where the user ran `/work`; otherwise handle the request directly. Read `~/.claude/workflow/rules.md` first. Input: $ARGUMENTS (plan path, task identity and main-session ID, linked progress/review state and feedback).

Tidy this task's artifacts, then stop. No journal, commit suggestion, Git writes, server management, publication, or question/hint about what comes next. A handoff authorizes starting without another confirmation. Don't rerun source tests or reopen Plannotator.

1. **Inputs.** Read the whole plan and applicable instructions. Given a report, resolve its original plan through references; ask only if missing/ambiguous. Fix the exact set of task artifacts: plan, clarifications, progress, review, checkpoints, blockers and UI feedback, from links/notes plus same-task reports in the configured artifact directories. Read them completely, including historical reports. Include review evidence manifests only through report references: read each and verify same-task membership and identity (canonical task root, kind, scope/exclusions and revision against its report). Evidence is not semantic approval. Filename or mtime alone doesn't prove membership. Unclear/shared membership, unreadable inputs or conflicting decisions/reasons: pause, ask and delete nothing. Explicit artifact paths override defaults, but never assume source files are disposable reports.
2. **Write.** Replace the plan with a concise standalone decision record: task, final choices with documented reasons, rejected alternatives only when they explain a choice, accepted limitations and deferred findings with reasons. No checklists, routing, review ceremony, raw test output, or links to files being deleted. Don't invent rationale, promote proposals to approval or call unresolved findings fixed. Repeated Finalize preserves existing decisions; no new inputs means no rewrite.
3. **Verify, then delete.** Read the summary back and check that sources' decisions/reasons are represented. Failure → delete nothing. Only then delete the other identified, fully consolidated, unshared artifacts, including the verified referenced evidence manifests; preserve final decisions and evidence limitations in the summary. Never delete the summary, directories, source/config files, journals, session logs, Plannotator history or anything outside the identified artifact set. A partial deletion failure retains the summary and remaining files; report exactly what remains, don't claim rollback.
4. **Report and end.** Report summary path, deleted artifacts or exactly what remains, and any material evidence limitations. On success run `bash ~/.claude/workflow/phase-hook.sh end "${CLAUDE_SESSION_ID}"` to clear only this session's badge and stop. Failure: report it and retain recovery context; do not claim successful completion. No cwd change or task-resource cleanup.
