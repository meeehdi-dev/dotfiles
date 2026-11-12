---
name: work
description: Start the workflow in place, in the current checkout or folder, always at Plan. The only workflow command; run by the user as /work [task or report].
argument-hint: "[task or report]"
disable-model-invocation: true
---

# Work

Read `~/.claude/workflow/rules.md` first. Input: $ARGUMENTS, taken literally (phase names, JSON and quotes included). `/work` always starts Plan, never a remembered phase.

1. Run `bash ~/.claude/workflow/task.sh describe` from the current directory. Any error: pause and report; create nothing more. It returns a new task identity, canonical root and kind, and in Git the start commit and pre-existing changed paths. Write no repository metadata, create no branches/worktrees and change no cwd. Do not copy ignored files, stash or stage anything.
2. Tell the user the task ID, root, kind and default plan path `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plans/<projectKey>/<id>.md`. Warn that builds edit the actual working copy, with no isolation; non-Git additionally has no baseline or rollback (symlink targets included). Preserve pre-existing changed paths unless the approved plan explicitly includes them.
3. Invoke `workflow-plan` once with the literal input and complete identity/baseline notes. Main-session notes also carry this Claude session ID: `${CLAUDE_SESSION_ID}`. Keep it for badge completion/explicit exit, not task identity. Bare `/work` still starts Plan, which asks for the task in chat.

Don't plan or implement here. Subsequent phases/replans reuse this identity and baseline, not a fresh description.
