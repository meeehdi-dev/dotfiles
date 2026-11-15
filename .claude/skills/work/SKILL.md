---
name: work
description: Start the workflow in place at Plan. The only workflow entry command, invoked by the user as /work [task or report].
argument-hint: "[task or report]"
disable-model-invocation: true
---

# Work

Read `~/.claude/workflow/rules.md`. Input: $ARGUMENTS, taken literally, including phase names, JSON, and quotes. `/work` always starts Plan, never a remembered phase.

Run `bash ~/.claude/workflow/task.sh describe` from the current directory. On error, pause and report; create nothing more. Keep the returned task identity/root/kind/baseline unchanged through subsequent handoffs. No repository metadata, branches/worktrees, cwd changes, copying ignored files, stashing, or staging.

Tell the user the task ID, root, kind, and default plan path `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plans/<projectKey>/<id>.md`. Builds edit the actual working copy with no isolation; non-Git also has no baseline or rollback, including symlink targets. Preserve pre-existing changes unless the approved scope includes them.

Invoke `workflow-plan` once with the literal input and complete task identity/baseline. Bare `/work` starts Plan, which asks for the task in chat. Do not plan or implement in this entry skill.
