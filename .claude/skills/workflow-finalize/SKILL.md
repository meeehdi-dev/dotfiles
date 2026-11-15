---
name: workflow-finalize
description: Leave one verified decision record, clean only consolidated task artifacts, and end the workflow. No publication. Only inside a /work task.
user-invocable: false
argument-hint: "[plan path] [notes]"
---

# Finalize

Run only after the user ran `/work` in this conversation; otherwise handle the request directly. Read `~/.claude/workflow/rules.md`. Input: $ARGUMENTS (original plan, task identity, current state/feedback).

Leave concise, accurate task documentation, then stop. No journal, commit suggestion, Git writes, server management, publication, source test reruns, or prompt about what comes next. An authorized handoff needs no further start confirmation.

- Resolve the original plan and this task's exact artifacts through current state, links, and same-task reports in the configured artifact locations. Read them fully, including history, before consolidating. Filename or mtime alone is not proof of membership. If identity, ownership, or input is ambiguous/unreadable/conflicting, pause cleanup and delete nothing.
- Honor project/user documentation locations and retention instructions. When workflow docs live in the repository, use its existing documented destination; do not invent a new docs structure. Without local instructions, keep the external defaults and use the plan path as the final record.
- Unless explicit retention instructions say otherwise, keep one concise standalone decision record: task, final choices and documented reasons, relevant rejected alternatives, accepted limitations, deferred/unresolved findings and reasons. Remove obsolete checklists/routing and raw review ceremony, not material decisions. Never invent rationale, promote proposals to approval, or label unresolved work fixed. Repeated Finalize preserves existing decisions; no new inputs means no rewrite.
- Read the record back against its sources before deleting anything. Delete only this task's identified, fully consolidated, unshared artifacts; preserve any history the project requires. Optional manifests are eligible only through report references after verifying same-task root/kind/scope/revision identity; preserve their limitations in the record. Failure → delete nothing. Never delete the final record, directories, source/config files, unrelated docs, journals, session logs, or Plannotator history. Leave ambiguous/shared artifacts untouched; no broad cleanup sweeps or Git writes. A partial deletion failure retains the record and remaining files: report exactly what remains, not rollback.
- Report the final record path and what was removed or retained. On success, end the workflow and handle subsequent requests directly until a new `/work`. No phase helper, session-ID bookkeeping, cwd change, or task-resource cleanup is needed. On failure, report it and retain recovery context; do not claim successful completion.
