#!/usr/bin/env bash
# Focused helper integration tests in isolated, disposable local Git fixtures. No E2E/network.
set -euo pipefail
HELPER=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)/task.sh
T=$(mktemp -d); T=$(cd -- "$T" && pwd -P)
trap 'rm -rf -- "$T"' EXIT
mkdir "$T/home"
export HOME="$T/home" XDG_CONFIG_HOME="$T/home/.config" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_TERMINAL_PROMPT=0 GIT_OPTIONAL_LOCKS=0
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_CEILING_DIRECTORIES CLAUDE_CONFIG_DIR
check() { local name=$1; shift; "$@" || { echo "FAIL $name" >&2; exit 1; }; echo "ok $name"; }

S="$T/repo with spaces"
git init -q -b main "$S"
git -C "$S" config user.name test
git -C "$S" config user.email test@example.invalid
git -C "$S" config commit.gpgsign false
mkdir "$S/app"
printf 'before\n' > "$S/old name"
printf 'unchanged\n' > "$S/app/file"
git -C "$S" add -- 'old name' app/file
git -C "$S" commit -qm 'test: initial fixture'
C=$(git -C "$S" rev-parse HEAD)
git -C "$S" mv -- 'old name' 'new name'
printf 'changed\n' >> "$S/app/file"
printf 'untracked\n' > "$S/untracked name"
printf 'newline\n' > "$S/"$'new\nline'
# Snapshot repository metadata and status before read-only discovery.
find "$S/.git" -type f -exec shasum -a 256 {} \; | sort > "$T/before"
git -C "$S" status --porcelain=v1 -z > "$T/status"
OUT=$(bash "$HELPER" describe "$S/app")
check 'root, identity, start commit and exact dirty paths from subdirectory' jq -e --arg root "$S" --arg commit "$C" '
  .kind == "git" and .root == $root and .commit == $commit
  and (.id | test("^[0-9a-f-]{36}$"))
  and (.pending | sort) == (["old name", "new name", "app/file", "untracked name", "new\nline"] | sort)' <<<"$OUT"
KEY="repo-with-spaces-$(printf '%s' "$S/.git" | shasum -a 256 | cut -c1-12)"
check 'stable project key' test "$(jq -r .projectKey <<<"$OUT")" = "$KEY"
find "$S/.git" -type f -exec shasum -a 256 {} \; | sort > "$T/after"
check 'discovery writes no Git metadata' cmp "$T/before" "$T/after"
git -C "$S" status --porcelain=v1 -z > "$T/status-after"
check 'pending work untouched' cmp "$T/status" "$T/status-after"
check 'no extra working-copy files' test "$(find "$S" -path "$S/.git" -prune -o -type f -exec printf x \; | wc -c | tr -d ' ')" = 4

mkdir "$T/folder"
OUT=$(bash "$HELPER" describe "$T/folder")
check 'non-Git identity without baseline' jq -e --arg root "$T/folder" '.kind == "directory" and .root == $root and (has("commit") | not)' <<<"$OUT"
check 'non-Git directory remains empty' test -z "$(ls -A "$T/folder")"
git init -q -b main "$T/unborn"
OUT=$(bash "$HELPER" describe "$T/unborn")
check 'unborn is Git with no start commit' jq -e '.kind == "git" and .commit == null and .pending == []' <<<"$OUT"

mkdir "$T/broken"; printf 'gitdir: missing\n' > "$T/broken/.git"
if bash "$HELPER" describe "$T/broken" >"$T/out" 2>&1; then echo 'FAIL broken Git accepted' >&2; exit 1; fi
echo 'ok broken Git is not non-Git'
if bash "$HELPER" describe "$T/missing" >"$T/out" 2>&1; then echo 'FAIL missing directory accepted' >&2; exit 1; fi
echo 'ok missing directory rejected'
for command in init info cleanup verify-merge; do
  if bash "$HELPER" "$command" >"$T/out" 2>&1; then echo "FAIL obsolete $command accepted" >&2; exit 1; fi
done
echo 'all task.sh tests passed'
