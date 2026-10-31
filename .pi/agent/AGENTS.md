# Global agent instructions

## Implementation and decisions

- Choose the smallest complete solution. Reuse existing project patterns, then platform features, then installed dependencies. Avoid speculative abstractions and unrelated fixes or refactors.
- Challenge consequential complexity, then honor my decision. Ask about ambiguity affecting behavior, scope, security, compatibility, or data loss; decide routine, reversible implementation details yourself.
- Read relevant code, callers, tests, and instructions before editing. Preserve existing and unrelated user work. Never cut security, validation, accessibility, or error handling that prevents data loss.
- Require explicit task authority for new dependencies, installs, lockfile/snapshot updates, migrations, deployment, and destructive actions. Ask when that authority is unclear.

## Testing and verification

- Never write or run end-to-end (E2E) tests unless I explicitly ask for that action. A general request to implement a feature, fix a bug, add coverage, or verify a change is not permission to write or run E2E tests.
- Add focused unit/integration coverage for non-trivial logic and bug fixes where practical. Trivial edits need no new tests. Never weaken tests to manufacture a pass.
- Run relevant, safe tests, typechecks, and non-fixing lint automatically within the active phase's limits. Check what unfamiliar scripts run first, including whether they invoke E2E tests or have side effects.
- Report actual check results and distinguish new failures from pre-existing or environmental problems. Never claim an unrun check passed.

## Git and workflow

- Git is read-only by default. The workflow extension may create the task branch/worktree when explicitly starting Plan; that setup is not general agent Git-write authority. After setup Plan remains non-mutating; Build/Review remain Git-read-only except explicitly authorized disposable test fixtures. UI may manage only its inspected task dev-server process through the workflow helper. Authorized Finalize may stage only identified task changes, create/reuse signed task commits with existing GPG identity/hooks, normally push only the task branch through existing SSH, and create/reuse an explicit-destination gh PR, then report its URL and return. Follow the phase contracts and established task/publication authority; task creation, standalone Review and documentation-only Finalize grant no publication authority. Locked SSH/GPG agents or missing separate gh authentication require user terminal recovery, confirmation and state reconciliation, never secret handling, credential/configuration changes, unsigned fallback, force-push, implicit forks, CI polling or merge. Perform other Git writes only when explicitly requested and only if the active workflow phase permits them. Never alter unrelated work or rewrite history without specific authority.
- Use workflow phases when selected; handle ordinary requests directly without mandatory plans or review gates. Keep phase-specific handoffs, artifact routing, and restrictions in the workflow prompts rather than imposing them on every task.

## Communication

- Be concise: summarize the outcome, actual checks, and material limitations. Show relevant file paths clearly.
- End with one or two short lines stating what was skipped or not checked and any material risk. Do not create extra reports or journals unless requested or required by applicable instructions.
