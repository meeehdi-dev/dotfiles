# Global agent instructions

## Implementation and decisions

- Default to direct, surgical changes for the requested happy path. Do not add complexity unless I explicitly ask for it: no speculative abstractions, compatibility branches, fallback chains, dependency discovery, or unrelated fixes or refactors. Reuse existing patterns and assume tools/configuration I explicitly confirm.
- If extra checks or broader handling seem necessary, raise the concrete failure case during Plan's clarification questions and get my agreement before adding them. Without a Plan phase, ask before expanding scope. Keep existing safety protections; do not silently remove them or add complexity on my behalf. Decide routine, reversible implementation details yourself.
- Read relevant code, callers, tests, and instructions before editing. Preserve existing and unrelated user work. Never cut security, validation, accessibility, or error handling that prevents data loss.
- Require explicit task authority for new dependencies, installs, lockfile/snapshot updates, migrations, deployment, and destructive actions. Ask when authority is unclear.

## Testing and verification

- Never write or run end-to-end (E2E) tests unless I explicitly ask for that action. A general request to implement a feature, fix a bug, add coverage, or verify a change is not permission to write or run E2E tests.
- Keep verification proportional to the change. Use a few focused unit/integration checks for non-trivial logic or bug fixes where practical; do not build exhaustive case matrices or new test infrastructure unless I explicitly ask. Trivial edits need no new tests. Never weaken tests to manufacture a pass.
- Run relevant, safe tests, typechecks, and non-fixing lint automatically within the active phase's limits. Check what unfamiliar scripts run first, including whether they invoke E2E tests or have side effects.
- Report actual check results and distinguish new failures from pre-existing or environmental problems. Never claim an unrun check passed.

## Git and workflow

- Git is read-only by default, unless I explicitly ask otherwise. Workflow tasks work in place and grant no publication or worktree-cleanup authority. Never alter unrelated work or rewrite history without specific authority.
- Always use the `gh` CLI when possible for GitHub operations.
- Every commit message follows Conventional Commits (`type(scope)!: description`, e.g. `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`; `BREAKING CHANGE:` footer or `!` for breaking changes).
- Within /work, phase, routing, scope and procedural restrictions are defaults: a specific user instruction at an unexpected blocker takes precedence within its stated scope, without a phase detour or repeated confirmation. Preserve higher-priority policies, helper identity/integrity checks and data-loss protections; deviations do not authorize unrelated work or silent destruction. Explain concrete technical limitations and use ordinary tools where appropriate, not generic bypasses. Forward the exact applicable exception and scope in existing handoff notes.
- Use workflow phases only after I run `/work`; its rules live in `~/.claude/workflow/rules.md`. Otherwise handle requests directly, without mandatory plans or review gates.

## Communication

- Be concise: summarize the outcome, actual checks, and material limitations. Show relevant file paths clearly.
- End with one or two short lines stating what was skipped or not checked and any material risk. Do not create extra reports or journals unless requested or required by applicable instructions.
