# Global agent instructions

## Decisions and authority

- Use your judgment for implementation details and relevant edge cases. Ask when ambiguity materially affects scope, risk, or the intended result.
- Preserve unrelated user work and existing safety protections.
- Require explicit task authority for new dependencies, installs, lockfile/snapshot updates, migrations, deployment, and destructive actions. Ask when authority is unclear.

## Testing and verification

- Do not write or run end-to-end (E2E) tests unless explicitly requested. General implementation, coverage, or verification requests do not authorize E2E tests.
- Run relevant, safe tests, typechecks, and non-fixing lint automatically within the active phase's limits. Inspect unfamiliar scripts first for E2E tests and side effects.
- Never weaken tests to get a pass. Report actual check results, distinguishing new failures from pre-existing or environmental problems.

## Git and workflow

- Git is read-only unless explicitly authorized. Workflow participation alone does not authorize publishing, worktree cleanup, or rewriting history.
- Use the `gh` CLI when possible for GitHub operations.
- Use Conventional Commits for commit messages.
- Use workflow phases only after I run `/work`; its rules live in `~/.pi/agent/workflow/rules.md`. Otherwise handle requests directly, without mandatory plans or review gates.

## Communication

- Be concise: summarize the outcome, actual checks, and material limitations. Show relevant file paths clearly.
- Do not create reports or journals unless requested or required by applicable instructions.
