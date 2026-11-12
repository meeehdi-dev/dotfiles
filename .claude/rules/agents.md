# Global agent instructions

## Implementation and decisions

- Default to direct, surgical changes for the requested happy path. No added complexity unless I ask: no speculative abstractions, compatibility branches, fallback chains, dependency discovery, or unrelated fixes/refactors. Reuse existing patterns; trust tools/configuration I confirm.
- If extra checks or broader handling seem necessary, raise the concrete failure case in Plan's clarification questions and get my agreement first; without a Plan phase, ask before expanding scope. Never silently remove existing safety protections or add complexity on my behalf. Decide routine, reversible details yourself.
- Read relevant code, callers, tests and instructions before editing. Preserve existing and unrelated work. Never cut security, validation, accessibility, or error handling that prevents data loss.
- New dependencies, installs, lockfile/snapshot updates, migrations, deployment and destructive actions need explicit task authority. Ask when authority is unclear.

## Testing and verification

- Never write or run end-to-end (E2E) tests unless I explicitly ask for that. A general request to implement, fix, add coverage or verify is not that permission.
- Keep verification proportional: a few focused unit/integration checks for non-trivial logic or bug fixes; no exhaustive matrices or new test infrastructure unless asked. Trivial edits need no new tests. Never weaken tests to get a pass.
- Run relevant, safe tests, typechecks and non-fixing lint automatically within the active phase's limits. Check what unfamiliar scripts run first (E2E, side effects).
- Report actual results; separate new failures from pre-existing or environmental ones. Never claim an unrun check passed.

## Git and workflow

- Git is read-only by default unless I explicitly ask otherwise. Workflow tasks work in place and grant no publication or worktree-cleanup authority. Never alter unrelated work or rewrite history without specific authority.
- Always use the `gh` CLI when possible for GitHub operations.
- Every commit message follows Conventional Commits (`type(scope)!: description`).
- Never add `Co-Authored-By` or other AI attribution trailers/lines to commit messages or PR descriptions.
- Within `/work`, phase, routing, scope and procedural rules are defaults: my specific instruction at an unexpected blocker wins within its stated scope, without a phase detour or repeated confirmation. It never overrides higher-priority policy, helper integrity checks or data-loss protections, and authorizes no unrelated work or silent destruction. Explain concrete technical limits and use ordinary tools, not generic bypasses. Forward the exact exception and scope in handoff notes.
- Use workflow phases only after I run `/work` in the conversation; otherwise never invoke workflow skills or `wf-*` agents and handle requests directly, without mandatory plans or review gates. Phase handoffs, artifact routing and restrictions live in the workflow rules and skills, not here.

## Communication

- Be concise: outcome, actual checks, material limitations. Show relevant file paths clearly.
- End with one or two short lines on what was skipped or not checked and any material risk. No extra reports or journals unless requested or required by applicable instructions.
