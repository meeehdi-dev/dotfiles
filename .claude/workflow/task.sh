#!/usr/bin/env bash
# Workflow task helper for Claude Code's built-in worktrees. See rules.md "Task identity and workspace".
# Never runs `git worktree add`, merges, commits or pushes; only init writes metadata and the exclude line,
# and only cleanup deletes (ignored files in the task root, then the merged worktree without force).
#
#   task.sh key [path]                  JSON {kind, projectKey, ...} for a path (default: cwd)
#   task.sh init <id> <original-cwd> <launch-commit>
#                                       run inside the new worktree: write workflow-task.json, add exclude entry
#   task.sh info [path]                 print validated task metadata; exit 3 when the checkout has none
#   task.sh verify-merge <base> [task-root]   run in the source checkout after the merge
#   task.sh cleanup <base> [task-root]        verify-merge, git clean -fdX, leftover check, worktree remove
#
# Exit codes: 0 ok, 1 failure (pause and report), 2 usage, 3 no task metadata in this Git checkout.
set -euo pipefail
export LC_ALL=C

METADATA=workflow-task.json
EXCLUDE=/.claude/worktrees/
UUID_RE='^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

NOTE= # appended to every failure message, e.g. what remains
die() { printf 'task.sh: %s%s\n' "$*" "$NOTE" >&2; exit 1; }
usage() { sed -n '6,11p' "$0" >&2; exit 2; }
g() { git --no-optional-locks "$@"; }
canon() { [ -n "$1" ] && (cd -- "$1" 2>/dev/null && pwd -P) || die "not an accessible directory: ${1:-<empty>}"; }
sha12() { printf '%s' "$1" | shasum -a 256 | cut -c1-12; }
sanitize() { printf '%s' "$1" | tr -c 'A-Za-z0-9_.-' '-'; }
inside() { [ "$1" = "$2" ] || [ "${1#"$2"/}" != "$1" ]; } # $1 equals or is below $2

# Prints "git" or "directory". Only Git's explicit not-a-repository answer, with no .git marker in any
# ancestor, counts as non-Git; unborn repos keep kind git, other errors fail.
kind_of() {
  local dir=$1 err current
  command -v git >/dev/null || die "git is not installed; can't tell Git from non-Git, pausing"
  if err=$(g -C "$dir" rev-parse --show-toplevel 2>&1 >/dev/null); then echo git; return; fi
  case "$err" in
    "fatal: not a git repository (or any of the parent directories): .git") ;;
    "fatal: not a git repository (or any parent up to mount point "*) ;;
    *) die "git failed in $dir: $err" ;;
  esac
  current=$dir
  while :; do
    if [ -e "$current/.git" ] || [ -L "$current/.git" ]; then
      die "broken Git metadata at $current/.git; not falling back to non-Git"
    fi
    [ "$current" = / ] && break
    current=$(dirname -- "$current")
  done
  echo directory
}

git_key() { # $1 canonical common git dir
  local name
  name=$(basename -- "$1")
  [ "$name" = .git ] && name=$(basename -- "$(dirname -- "$1")")
  printf '%s-%s' "$(sanitize "$name")" "$(sha12 "$1")"
}

# Sets ROOT, ADMIN, COMMON (canonical) for the checkout containing $1.
identity() {
  local top admin common
  top=$(g -C "$1" rev-parse --show-toplevel) || die "no work tree at $1 (bare repo or Git error)"
  admin=$(g -C "$1" rev-parse --absolute-git-dir) || die "can't read the git dir of $1"
  common=$(g -C "$1" rev-parse --path-format=absolute --git-common-dir) || die "can't read the common git dir of $1"
  ROOT=$(canon "$top"); ADMIN=$(canon "$admin"); COMMON=$(canon "$common")
  FILE="$ADMIN/$METADATA"
}
has_task() { [ -e "$FILE" ] || [ -L "$FILE" ]; }

# Prints the source checkout of task worktree $1 with id $2: the checkout whose .claude/worktrees/<id> it is,
# which must be another worktree of the same repository. Uses only git run in the task worktree.
source_of() {
  local src=${1%/.claude/worktrees/"$2"} list line path
  [ "$src" != "$1" ] && [ -n "$src" ] || die "worktree $1 is not <checkout>/.claude/worktrees/$2"
  list=$(g -C "$1" worktree list --porcelain) || die "git worktree list failed in $1"
  while IFS= read -r line; do
    [ "${line#worktree }" != "$line" ] || continue
    path=$(cd -- "${line#worktree }" 2>/dev/null && pwd -P) || continue
    [ "$path" = "$src" ] && { printf '%s\n' "$src"; return; }
  done <<<"$list"
  die "$src is not a worktree of this repository"
}

cmd_key() {
  local dir kind
  dir=$(canon "${1:-.}")
  kind=$(kind_of "$dir")
  if [ "$kind" = directory ]; then
    jq -n --arg k "$(sanitize "$(basename -- "$dir")")-$(sha12 "$dir")" --arg r "$dir" \
      '{kind: "directory", projectKey: $k, root: $r}'
  else
    identity "$dir"
    jq -n --arg k "$(git_key "$COMMON")" --arg c "$COMMON" --arg r "$ROOT" \
      '{kind: "git", projectKey: $k, repository: $c, checkout: $r}'
  fi
}

cmd_init() {
  [ $# -eq 3 ] || usage
  local id=$1 commit=$3 origin kind source exclude pending
  origin=$(canon "$2")
  [[ "$id" =~ $UUID_RE ]] || die "task id is not a lowercase UUID v4: $id"
  [[ "$commit" =~ ^([0-9a-f]{40}|[0-9a-f]{64})$ ]] || die "launch commit must be a full object id: $commit"
  kind=$(kind_of "$PWD")
  [ "$kind" = git ] || die "init must run inside the new task worktree"
  identity "$PWD"
  [ "$ADMIN" != "$COMMON" ] || die "$ROOT is the main checkout, not a linked worktree; nothing written"
  source=$(source_of "$ROOT" "$id")
  [ "$(g -C "$ROOT" symbolic-ref --quiet --short HEAD || true)" = "worktree-$id" ] || die "worktree branch is not worktree-$id; nothing written"
  [ "$(g -C "$ROOT" rev-parse --verify 'HEAD^{commit}')" = "$commit" ] || die "worktree HEAD is not the launch commit $commit (check worktree.baseRef: \"head\"); nothing written"
  inside "$origin" "$source" || die "original cwd $origin is outside the source checkout $source; nothing written"
  pending=$(g -C "$ROOT" status --porcelain=v1 --untracked-files=all)
  [ -z "$pending" ] || die "new worktree already has pending files; nothing written"
  ! has_task || die "$FILE already exists; refusing to overwrite"
  # Written before the exclude line: a failure here leaves the source checkout untouched.
  (umask 077; set -o noclobber
    jq -n --arg id "$id" --arg k "$(git_key "$COMMON")" --arg repo "$COMMON" --arg src "$source" \
      --arg o "$origin" --arg root "$ROOT" --arg c "$commit" \
      '{kind: "git", id: $id, projectKey: $k, repository: $repo, sourceRoot: $src, originalCwd: $o,
        root: $root, branch: ("worktree-" + $id), commit: $c}' > "$FILE") \
    || die "could not write $FILE"
  exclude="$COMMON/info/exclude"
  if ! { [ -f "$exclude" ] && grep -qxF -- "$EXCLUDE" "$exclude"; }; then
    mkdir -p -- "$COMMON/info" || die "metadata written, but could not create $COMMON/info for the exclude entry"
    { [ ! -s "$exclude" ] || [ -z "$(tail -c 1 -- "$exclude")" ] || echo; echo "$EXCLUDE"; } >> "$exclude" \
      || die "metadata written, but could not add $EXCLUDE to $exclude"
  fi
  cat -- "$FILE"
}

# locate sets ROOT/ADMIN/COMMON/FILE for the checkout containing $1; load then validates FILE
# against that checkout and sets T_* variables.
locate() {
  local dir kind
  dir=$(canon "$1")
  kind=$(kind_of "$dir")
  [ "$kind" = git ] || die "$dir is not in a Git checkout; non-Git tasks have no metadata"
  identity "$dir"
}
load() {
  local json source origin
  json=$(jq -c . "$FILE" 2>/dev/null) && [ -n "$json" ] || die "unreadable or invalid JSON: $FILE"
  # jq -e exits 1 on false; each field must be a non-empty string, with no extra keys.
  jq -e --arg re "$UUID_RE" '
    (keys == (["branch","commit","id","kind","originalCwd","projectKey","repository","root","sourceRoot"] | sort))
    and ([.[] | strings | select(length > 0)] | length) == 9
    and .kind == "git" and (.id | test($re)) and .branch == "worktree-" + .id
    and (.commit | test("^([0-9a-f]{40}|[0-9a-f]{64})$")) and (.projectKey | test("^[A-Za-z0-9_.-]+-[0-9a-f]{12}$"))
    and ([.repository, .sourceRoot, .originalCwd, .root] | all(startswith("/")))' <<<"$json" >/dev/null \
    || die "invalid task metadata in $FILE; ask for recovery direction"
  T_ID=$(jq -r .id <<<"$json"); T_ROOT=$(jq -r .root <<<"$json"); T_BRANCH=$(jq -r .branch <<<"$json")
  T_REPO=$(jq -r .repository <<<"$json"); T_SOURCE=$(jq -r .sourceRoot <<<"$json")
  T_COMMIT=$(jq -r .commit <<<"$json"); T_KEY=$(jq -r .projectKey <<<"$json"); T_JSON=$json
  origin=$(jq -r .originalCwd <<<"$json")
  [ "$T_ROOT" = "$ROOT" ] || die "metadata root $T_ROOT does not match this checkout $ROOT"
  [ "$T_REPO" = "$COMMON" ] || die "metadata repository $T_REPO does not match $COMMON"
  [ "$T_KEY" = "$(git_key "$COMMON")" ] || die "metadata projectKey $T_KEY does not match the repository"
  [ "$(g -C "$ROOT" symbolic-ref --quiet --short HEAD || true)" = "$T_BRANCH" ] \
    || die "checkout is not on $T_BRANCH; restore that branch in $ROOT before continuing"
  source=$(source_of "$ROOT" "$T_ID")
  [ "$T_SOURCE" = "$source" ] || die "metadata sourceRoot $T_SOURCE does not match the source checkout $source"
  [ -d "$origin" ] && [ "$(canon "$origin")" = "$origin" ] && inside "$origin" "$T_SOURCE" \
    || die "original cwd $origin is missing, not canonical or outside $T_SOURCE"
  g -C "$ROOT" cat-file -e "$T_COMMIT^{commit}" 2>/dev/null || die "start commit $T_COMMIT is missing"
}

cmd_info() {
  locate "${1:-.}"
  if ! has_task; then
    jq -n --arg r "$ROOT" --argjson linked "$([ "$ADMIN" != "$COMMON" ] && echo true || echo false)" \
      '{task: null, checkout: $r, linkedWorktree: $linked}'
    exit 3
  fi
  load
  jq . <<<"$T_JSON"
}

# Shared by verify-merge and cleanup; $1 base, $2 task root. Deletes nothing.
verify() {
  local base=$1 head pending list line current=
  NOTE='; nothing deleted'
  locate "$2"
  has_task || die "no task metadata in $ROOT (from the source checkout, pass the task root)"
  load
  g -C "$T_SOURCE" check-ref-format --branch "$base" >/dev/null 2>&1 || die "invalid base branch name: $base"
  [ "$base" != "$T_BRANCH" ] || die "base must not be the task branch"
  [ "$T_ROOT" != "$T_SOURCE" ] || die "task root is the source checkout"
  [ "$(g -C "$T_SOURCE" branch --show-current)" = "$base" ] || die "source checkout $T_SOURCE is not on $base"
  head=$(g -C "$T_ROOT" rev-parse --verify 'HEAD^{commit}') || die "can't read the task HEAD in $T_ROOT"
  g -C "$T_SOURCE" merge-base --is-ancestor "$head" HEAD \
    || die "task HEAD $head is not merged into $base"
  pending=$(g -C "$T_ROOT" status --porcelain=v1 --untracked-files=all) || die "git status failed in $T_ROOT"
  [ -z "$pending" ] || { NOTE="$NOTE:
$pending"; die "task worktree has tracked or non-ignored pending files"; }
  list=$(g -C "$T_SOURCE" worktree list --porcelain) || die "git worktree list failed"
  while IFS= read -r line; do
    if [ "${line#worktree }" != "$line" ]; then
      current=$(cd -- "${line#worktree }" 2>/dev/null && pwd -P) || current=
    elif [ "$current" = "$T_ROOT" ] && [ "${line%% *}" = locked ]; then
      die "worktree $T_ROOT is locked; not unlocking it"
    fi
  done <<<"$list"
}

cmd_verify_merge() {
  [ $# -ge 1 ] && [ $# -le 2 ] || usage
  verify "$1" "${2:-.}"
  echo "verified: $T_BRANCH ($T_ROOT) is merged into $1 in $T_SOURCE"
}

cmd_cleanup() {
  [ $# -ge 1 ] && [ $# -le 2 ] || usage
  local here left
  verify "$1" "${2:-.}"
  here=$(pwd -P)
  ! inside "$here" "$T_ROOT" || die "run cleanup from outside the task worktree (after ExitWorktree keep)"
  NOTE=
  g -C "$T_ROOT" clean -fdX >/dev/null || die "git clean -fdX failed in $T_ROOT; some ignored files may remain, worktree and branch retained"
  left=$(g -C "$T_ROOT" status --porcelain=v1 --untracked-files=all --ignored=matching) \
    || die "ignored files removed, but git status failed in $T_ROOT; worktree and branch $T_BRANCH retained"
  [ -z "$left" ] || die "ignored files removed, but contents remain (protected nested repos?); worktree $T_ROOT and branch $T_BRANCH retained:
$left"
  g -C "$T_SOURCE" worktree remove -- "$T_ROOT" \
    || die "ignored files removed, but git worktree remove failed; worktree $T_ROOT and branch $T_BRANCH retained"
  echo "removed worktree $T_ROOT; branch $T_BRANCH kept; nothing pushed"
}

[ $# -ge 1 ] || usage
command -v jq >/dev/null || die "jq is required"
sub=$1; shift
case "$sub" in
  key) [ $# -le 1 ] || usage; cmd_key "$@" ;;
  init) cmd_init "$@" ;;
  info) [ $# -le 1 ] || usage; cmd_info "$@" ;;
  verify-merge) cmd_verify_merge "$@" ;;
  cleanup) cmd_cleanup "$@" ;;
  *) usage ;;
esac
