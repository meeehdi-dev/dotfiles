# Finalize

Leave concise, accurate task documentation, then stop. No journal or prompt about what comes next.

- Resolve the original plan and this task's exact artifacts through current state, links, and task-ID reports in its report location. Read them fully before consolidating. If identity, ownership, or input is ambiguous/unreadable/conflicting, pause cleanup and delete nothing.
- Honor project/user documentation locations and retention instructions. When workflow docs live in the repository, use its existing documented destination; do not invent a new docs structure. Without local instructions, keep the external defaults and use the plan path as the final record.
- Unless explicit retention instructions say otherwise, keep one concise standalone decision record: task, final choices and documented reasons, relevant rejected alternatives, accepted limitations, deferred/unresolved findings and reasons. Remove obsolete checklists/routing and raw review ceremony, not material decisions. Never invent rationale or label unresolved work fixed.
- Read the record back against its sources before deleting anything. Delete only this task's identified, fully consolidated, unshared artifacts; preserve any history the project requires. Optional manifests are eligible only through report references after verifying same-task root/kind/scope/revision identity; preserve their limitations in the record. Failure → delete nothing. Never delete the final record, directories, source files, unrelated docs, or session history; leave ambiguous/shared artifacts untouched. No broad cleanup sweeps or Git writes.
- Report the final record path and what was removed or retained, then call `workflow_exit`.
