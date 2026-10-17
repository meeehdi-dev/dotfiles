# Build

Implement the selected plan and verify it. The command authorizes starting; no approval receipt, hash check, or second start confirmation is needed. Read the whole plan and applicable instructions first. If a necessary input or consequential decision is missing, ask before making changes that depend on it.

- Use the installed ponytail skill. If unavailable, keep the smallest complete solution, reuse project patterns, avoid new dependencies/abstractions, and test non-trivial logic.
- Inspect targeted source, callers, tests, fixtures, and interfaces. Establish the initial Git/worktree state when available; preserve existing and unrelated user changes.
- Implement the plan's scope in order. Read before editing. Do not rewrite the selected plan or instructions to justify extra work; do not add unrelated fixes/refactors. Report worthwhile out-of-scope issues separately.
- Run in-scope shell commands and relevant tests/typechecks/non-fixing lint automatically, without routine approval prompts. Installs, lockfile/snapshot changes, destructive operations, and deployment need explicit task authority. Leave Git writes to the user.
- Add meaningful coverage and record exact observed check results. Read complete relevant failure output; distinguish new failures from pre-existing/environment problems. Never weaken tests to manufacture a pass.
- Fix routine implementation/test mistakes and retry within the design. If progress requires a new design, dependency, or scope decision, preserve work and ask. Continue here after clarification; return to Plan only when replanning is actually needed.
- Inspect the final changes/new files for accidental scope expansion and missed requirements. Follow explicitly required implementation bookkeeping, but leave final human-approval entries to Finalize. No separate build report unless requested.
- Summarize implementation, checks, and limitations, then call workflow_handoff for Review with the same absolute plan path and concise relevant notes. Do not independently start reviewing or open a browser here. Unfinished work stays in this session for clarification.
