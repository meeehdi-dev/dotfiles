#!/usr/bin/env bash
# Tests for ../task.sh in throwaway repos under one mktemp -d dir, removed on exit.
# Plain `git worktree add` stands in for EnterWorktree. No signing, remote or network;
# global/system Git config and HOME are isolated so nothing is written outside the temp dir.
#
#   bash .claude/workflow/tests/task.test.sh
set -uo pipefail
export LC_ALL=C

HELPER=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)/task.sh
T=$(mktemp -d) && T=$(cd -- "$T" && pwd -P) || { echo "mktemp failed" >&2; exit 1; }
trap 'rm -rf -- "$T"' EXIT

mkdir "$T/home"
export HOME="$T/home" XDG_CONFIG_HOME="$T/home/.config" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_TERMINAL_PROMPT=0 GIT_OPTIONAL_LOCKS=0
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_CEILING_DIRECTORIES CLAUDE_CONFIG_DIR

fails=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; [ -z "${2:-}" ] || printf '%s\n' "$2" | sed 's/^/     /'; fails=$((fails + 1)); }
check() { local name=$1; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }

OUT= RC=0
# run <dir> <task.sh args...>: runs the helper from <dir>, sets OUT (stdout+stderr) and RC.
run() { local dir=$1; shift; OUT=$(cd -- "$dir" && bash "$HELPER" "$@" 2>&1); RC=$?; }
# refuses <name> <pattern> <dir> <args...>: helper must exit 1 with a message matching pattern.
refuses() {
  local name=$1 pat=$2; shift 2
  run "$@"
  if [ "$RC" -eq 1 ] && grep -qE -- "$pat" <<<"$OUT"; then pass "$name"; else fail "$name (rc=$RC)" "$OUT"; fi
}
succeeds() {
  local name=$1; shift
  run "$@"
  if [ "$RC" -eq 0 ]; then pass "$name"; else fail "$name (rc=$RC)" "$OUT"; fi
}
commit() { git -C "$1" add -A && git -C "$1" commit -q -m "$2"; }

ID=3f2b8c1e-9a4d-4e7f-8b6a-1c2d3e4f5a6b
ID2=7d1e2f3a-4b5c-4d6e-9f80-a1b2c3d4e5f6

# --- source repo: tracked app/, ignored deps/, one unrelated untracked file ---
S="$T/src"
git init -q -b main "$S"
git -C "$S" config user.name test
git -C "$S" config user.email test@example.invalid
git -C "$S" config commit.gpgsign false
git -C "$S" config tag.gpgsign false
mkdir "$S/app"; echo a > "$S/app/a"; printf 'deps/\n' > "$S/.gitignore"
commit "$S" init
git -C "$S" branch dev
C=$(git -C "$S" rev-parse HEAD)
echo unrelated > "$S/unrelated.txt"
mkdir "$S/deps"; echo keep > "$S/deps/source-ignored"

W="$S/.claude/worktrees/$ID"
git -C "$S" worktree add -q -b "worktree-$ID" "$W" HEAD
FILE="$S/.git/worktrees/$ID/workflow-task.json"

# --- init ---
succeeds "init writes metadata" "$W" init "$ID" "$S/app" "$C"
if [ -f "$FILE" ]; then
  exp_key=$(cd "$S" && bash "$HELPER" key | jq -r .projectKey)
  got=$(jq -r '[.kind, .id, .branch, .root, .sourceRoot, .originalCwd, .commit, .repository, .projectKey] | join("|")' "$FILE")
  want="git|$ID|worktree-$ID|$W|$S|$S/app|$C|$S/.git|$exp_key"
  check "init metadata fields" test "$got" = "$want"
  check "metadata in the worktree's git admin dir, not the work tree" test ! -e "$W/workflow-task.json"
else
  fail "init metadata file at $FILE"
fi
check "projectKey is <repo>-<12 hex of sha256(common dir)>" \
  test "$(jq -r .projectKey "$FILE" 2>/dev/null)" = "src-$(printf '%s' "$S/.git" | shasum -a 256 | cut -c1-12)"
check "exclude entry added" grep -qxF /.claude/worktrees/ "$S/.git/info/exclude"
check "source status shows only the unrelated file" test "$(git -C "$S" status --porcelain)" = "?? unrelated.txt"
before=$(cat "$FILE")
refuses "init refuses existing metadata" 'already exists' "$W" init "$ID" "$S/app" "$C"
check "existing metadata unchanged" test "$(cat "$FILE")" = "$before"

W2="$S/.claude/worktrees/$ID2"
git -C "$S" worktree add -q -b "worktree-$ID2" "$W2" HEAD
succeeds "second init" "$W2" init "$ID2" "$S" "$C"
check "exclude entry not duplicated" test "$(grep -cxF /.claude/worktrees/ "$S/.git/info/exclude")" = 1

# --- info ---
succeeds "info validates from a subdirectory" "$W/app" info
check "info prints the task id" test "$(jq -r .id <<<"$OUT" 2>/dev/null)" = "$ID"
run "$S" info
check "info in the source checkout exits 3 (no task)" test "$RC" -eq 3
git -C "$W" checkout -q -b wrong-branch
refuses "info fails on a wrong branch" "not on worktree-$ID" "$W" info
git -C "$W" checkout -q "worktree-$ID"
git -C "$W" branch -q -D wrong-branch
succeeds "info passes again on the task branch" "$W" info

# --- verify-merge refusals (task commit plus an ignored file in the worktree) ---
echo b > "$W/app/b"; commit "$W" "task change"
mkdir "$W/deps"; echo x > "$W/deps/x"
refuses "verify-merge refuses an unmerged task" 'is not merged into main' "$S" verify-merge main "$W"
git -C "$S" merge -q --ff-only "worktree-$ID"
refuses "verify-merge refuses a wrong base (source not on it)" "is not on dev" "$S" verify-merge dev "$W"
refuses "verify-merge refuses the task branch as base" 'must not be the task branch' "$S" verify-merge "worktree-$ID" "$W"
echo changed >> "$W/app/a"
refuses "verify-merge refuses a pending tracked file" 'pending files' "$S" verify-merge main "$W"
refuses "cleanup refuses a pending tracked file" 'pending files' "$S" cleanup main "$W"
check "refused cleanup leaves ignored files" test -f "$W/deps/x"
git -C "$W" checkout -q -- app/a
echo new > "$W/app/untracked"
refuses "verify-merge refuses an untracked file" 'pending files' "$S" verify-merge main "$W"
refuses "cleanup refuses an untracked file" 'pending files' "$S" cleanup main "$W"
check "refused cleanup leaves ignored and untracked files" test -f "$W/deps/x" -a -f "$W/app/untracked"
rm -- "$W/app/untracked"
refuses "cleanup refuses to run inside the task worktree" 'outside the task worktree' "$W" cleanup main "$W"
check "worktree still present after refusals" test -d "$W" -a -f "$W/deps/x"

# --- verify-merge and cleanup success ---
succeeds "verify-merge passes once merged and clean" "$S" verify-merge main "$W"
succeeds "cleanup succeeds" "$S" cleanup main "$W"
check "cleanup removed the worktree (and its ignored files)" test ! -e "$W"
check "git no longer lists the worktree" bash -c '! git -C "$1" worktree list --porcelain | grep -qxF "worktree $2"' _ "$S" "$W"
check "cleanup kept the task branch" git -C "$S" show-ref --verify -q "refs/heads/worktree-$ID"
check "source unrelated untracked file untouched" test "$(cat "$S/unrelated.txt" 2>/dev/null)" = unrelated
check "source ignored file untouched" test "$(cat "$S/deps/source-ignored" 2>/dev/null)" = keep
check "other task worktree untouched" test -d "$W2"
check "source still on main at the merged task HEAD" \
  test "$(git -C "$S" branch --show-current) $(git -C "$S" rev-parse HEAD)" = "main $(git -C "$S" rev-parse "worktree-$ID")"

echo
if [ "$fails" -eq 0 ]; then echo "all task.sh tests passed"; else echo "$fails task.sh test(s) failed"; exit 1; fi
