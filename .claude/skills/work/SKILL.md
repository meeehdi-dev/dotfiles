---
name: work
description: Workflow entry. Sets up or reuses the task workspace (a built-in worktree in Git, in place otherwise), then starts Plan. The only workflow command; run by the user as /work [task or report].
argument-hint: "[task or report]"
disable-model-invocation: true
---

# Work (entry)

Read `~/.claude/workflow/rules.md` first. Input: $ARGUMENTS, taken literally as the task or report (phase names, JSON and quotes included). Never jump to a remembered phase: `/work` always starts Plan.

Helper: `H=~/.claude/workflow/task.sh`. Any helper or Git error not handled below → pause, report the exact output, create nothing more.

## 1. Workspace kind

Run `$H key` in the current directory.

- `"kind": "directory"` → **non-Git, in place**. If this conversation already has a non-Git task for this root, reuse its identity. Otherwise new task id: `uuidgen | tr '[:upper:]' '[:lower:]'`. Identity = id, `root` (also the original cwd) and `projectKey`; it lives only in this conversation and the plan path. Write nothing, create no repository or worktree, run no Git status/diff. Tell the user: edits hit the actual files, with no isolation, baseline or rollback (symlink targets included). Go to 4.
- `"kind": "git"` → if this conversation already has a non-Git task whose root contains the current directory (or that `root` resolves to a path inside this repository), a repository appeared later: pause, tell the user the existing non-Git task can't become a Git task and grants no Git authority, ask for direction in chat, and create nothing (no id, worktree or metadata). Otherwise go to 2.

## 2. Reuse

Run `$H info`.

- Exit 0 → reuse that task (no nested worktree, no progress inferred from the metadata). Stay in the current directory. Go to 4.
- Exit 3 with `"linkedWorktree": true` and the checkout under `.claude/worktrees/` → a Claude worktree without task metadata: pause and ask for recovery direction.
- Exit 3 otherwise → no task yet, go to 3.
- Exit 1 (mismatch, wrong branch, broken metadata) → pause, report, create nothing.

## 3. New Git task

1. Read-only, from the current directory: original cwd `pwd -P`, launch commit `git rev-parse --verify 'HEAD^{commit}'` (fails on an unborn repo → pause), branch `git branch --show-current` (empty → "detached HEAD"). Tell the user: "New task starts at <branch> (<commit>) from <checkout>."
2. `git status --porcelain=v1 --untracked-files=all`. If it prints anything, `AskUserQuestion`: "Proceed from committed files only" / "Cancel", explaining that pending files stay in the source checkout and nothing is copied, stashed or staged. "Cancel" or a dismissed question → stop: no task, no phase, nothing created; continue in chat when ready. If the source root has a `.worktreeinclude`, say that Claude Code copies the ignored files it lists into the new worktree.
3. New task id: `uuidgen | tr '[:upper:]' '[:lower:]'`.
4. `EnterWorktree` with `name` = the task id. It must land in `<checkout>/.claude/worktrees/<id>` on branch `worktree-<id>`; if it fails, pause and report (nothing to clean).
5. In the new worktree: `$H init <id> <original cwd> <launch commit>`. On failure, pause and report the retained worktree and branch: no rollback, no `ExitWorktree remove`, no retry with another id.
6. Launch subdirectory: if the original cwd is below the checkout root, `cd` to the same relative path in the task root. If it isn't in the committed files, `AskUserQuestion`: "Work from the task root" / "Pick another directory in chat"; don't change directory silently.

## 4. Plan

Tell the user the task identity: id, project key, kind (Git: task root and branch; non-Git: in place, no baseline) and the default plan path `${CLAUDE_CONFIG_DIR:-~/.claude}/plans/<projectKey>/<id>.md`. Then invoke the `workflow-plan` skill with the literal input (empty → Plan asks in chat) and these identity notes. Don't plan or implement here.
