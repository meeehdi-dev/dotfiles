# Global agent instructions

## Implementation and decisions

- Default to direct, surgical changes for the requested happy path. Do not add complexity unless I explicitly ask for it: no speculative abstractions, compatibility branches, fallback chains, dependency discovery, or unrelated fixes or refactors. Reuse existing patterns and assume tools/configuration I explicitly confirm.
- If extra checks or broader handling seem necessary, raise the concrete failure case during Plan's clarification questions and get my agreement before adding them. Without a Plan phase, ask before expanding scope. Keep existing safety protections; do not silently remove them or add complexity on my behalf. Decide routine, reversible implementation details yourself.
- Read relevant code, callers, tests, and instructions before editing. Preserve existing and unrelated user work. Never cut security, validation, accessibility, or error handling that prevents data loss.
- Require explicit task authority for new dependencies, installs, lockfile/snapshot updates, migrations, deployment, and destructive actions. Ask when that authority is unclear.

## Testing and verification

- Never write or run end-to-end (E2E) tests unless I explicitly ask for that action. A general request to implement a feature, fix a bug, add coverage, or verify a change is not permission to write or run E2E tests.
- Keep verification proportional to the change. Use a few focused unit/integration checks for non-trivial logic or bug fixes where practical; do not build exhaustive case matrices or new test infrastructure unless I explicitly ask. Trivial edits need no new tests. Never weaken tests to manufacture a pass.
- Run relevant, safe tests, typechecks, and non-fixing lint automatically within the active phase's limits. Check what unfamiliar scripts run first, including whether they invoke E2E tests or have side effects.
- Report actual check results and distinguish new failures from pre-existing or environmental problems. Never claim an unrun check passed.

## Git and workflow

- Git is read-only by default. The workflow extension may create the task branch/worktree when explicitly starting Plan; that setup is not general agent Git-write authority. After setup Plan remains non-mutating; Build/Review remain Git-read-only except explicitly authorized disposable test fixtures. UI may manage only its inspected task dev-server process through the workflow helper. Authorized Finalize asks for local in-place merge (no push) or GitHub PR, unless already explicitly chosen. It may stage only identified task changes and create/reuse signed task commits with existing GPG identity/hooks. Local mode merges into the verified original checkout's local base, leaves pushing manual, and may remove only the clean merged task worktree after return, retaining the branch. PR mode normally pushes only the task branch through existing SSH and creates/reuses an explicit-destination gh PR, then reports its URL and returns. Follow the phase contracts and established task/publication authority; task creation, standalone Review and documentation-only Finalize grant no publication authority. Locked SSH/GPG agents or missing separate gh authentication require user terminal recovery, confirmation and state reconciliation, never secret handling, credential/configuration changes, unsigned fallback, force-push, implicit forks, CI polling or GitHub merge. Local merge and non-forced merged-worktree cleanup require the explicit Finalize route choice and its safety checks. Perform other Git writes only when explicitly requested and only if the active workflow phase permits them. Never alter unrelated work or rewrite history without specific authority.
- Use workflow phases when selected; handle ordinary requests directly without mandatory plans or review gates. Keep phase-specific handoffs, artifact routing, and restrictions in the workflow prompts rather than imposing them on every task.

## Communication

- Be concise: summarize the outcome, actual checks, and material limitations. Show relevant file paths clearly.
- End with one or two short lines stating what was skipped or not checked and any material risk. Do not create extra reports or journals unless requested or required by applicable instructions.
