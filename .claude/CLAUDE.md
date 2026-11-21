# Global agent instructions

## Decisions and authority

- Use your judgment for implementation details and relevant edge cases. Ask when ambiguity materially affects scope, risk, or the intended result.
- Preserve unrelated user work and existing safety protections.
- Require explicit task authority for new dependencies, installs, lockfile/snapshot updates, migrations, deployment, and destructive actions. Ask when authority is unclear.

## Testing and verification

- Do not write or run end-to-end (E2E) tests unless explicitly requested. General implementation, coverage, or verification requests do not authorize E2E tests.
- Run relevant, safe tests, typechecks, and non-fixing lint automatically within the task's limits. Inspect unfamiliar scripts first for E2E tests and side effects.
- Never weaken tests to get a pass. Report actual check results, distinguishing new failures from pre-existing or environmental problems.

## Git

- Git is read-only unless explicitly authorized. Authority to change code does not authorize publishing, worktree cleanup, or rewriting history.
- Use the `gh` CLI when possible for GitHub operations.
- Use Conventional Commits for commit messages.
- Before committing or pushing, check credentials non-interactively: `echo | gpg --batch --pinentry-mode error --local-user "$(git config user.signingkey)" --sign -o /dev/null` and `ssh-add -l`. If either fails, stop and ask me to unlock them; a GPG prompt hangs the session and breaks the terminal display.

## Subagents

- Planning requests go to `planner` (after `explorer` when the cause or code location is unknown). Show the plan in chat; use Plannotator only when I ask for it.
- Building goes to `builder`; run builders in parallel when slices touch disjoint files.
- Reviewing goes to `reviewer`.
- Use `explorer` on your own for broad read-only searches (many files, unknown location) instead of reading them in the main context.
- I glue the steps together: don't chain plan → build → review automatically unless I ask. Handle small tasks directly.

## Communication

- Be concise: summarize the outcome, actual checks, and material limitations. Show relevant file paths clearly.
- Do not create reports or journals unless requested or required by applicable instructions.
