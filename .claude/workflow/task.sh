#!/usr/bin/env bash
# Read-only task description: task.sh describe [path]. No persistent task metadata.
set -euo pipefail
export LC_ALL=C

die() { printf 'task.sh: %s\n' "$*" >&2; exit 1; }
g() { git --no-optional-locks "$@"; }
canon() { (cd -- "$1" 2>/dev/null && pwd -P) || die "not an accessible directory: $1"; }
key() { printf '%s-%s' "$(printf '%s' "$1" | tr -c 'A-Za-z0-9_.-' '-')" "$(printf '%s' "$2" | shasum -a 256 | cut -c1-12)"; }

[ $# -ge 1 ] && [ $# -le 2 ] && [ "$1" = describe ] || { echo 'usage: task.sh describe [path]' >&2; exit 2; }
command -v jq >/dev/null || die 'jq is required'
command -v git >/dev/null || die "git is not installed; can't tell Git from non-Git"
dir=$(canon "${2:-.}")
id=$(uuidgen | tr '[:upper:]' '[:lower:]')
if root=$(g -C "$dir" rev-parse --show-toplevel 2>&1); then
  root=$(canon "$root")
  common=$(g -C "$root" rev-parse --path-format=absolute --git-common-dir) || die 'cannot read common Git directory'
  common=$(canon "$common")
  name=$(basename -- "$common")
  [ "$name" != .git ] || name=$(basename -- "$(dirname -- "$common")")
  # Unborn HEAD is valid; an existing but unreadable HEAD is not.
  commit=$(g -C "$root" rev-parse --verify -q 'HEAD^{commit}') || {
    ref=$(g -C "$root" symbolic-ref -q HEAD) || die 'cannot resolve HEAD'
    if g -C "$root" show-ref --verify --quiet "$ref"; then die 'cannot read HEAD commit';
    else rc=$?; [ "$rc" -eq 1 ] || die 'cannot inspect HEAD ref'; fi
    commit=
  }
  # -z keeps spaces, newlines and renames unambiguous; record both rename paths.
  pending=$(g -C "$root" status --porcelain=v1 -z --untracked-files=all | jq -Rs '
    split("\u0000") | reduce .[] as $entry ({paths: [], rename: false};
      if $entry == "" then .
      elif .rename then .paths += [$entry] | .rename = false
      else .paths += [$entry[3:]] | .rename = ($entry[0:2] | test("[RC]")) end) | .paths') || die 'cannot read changed paths'
  jq -n --arg id "$id" --arg root "$root" --arg key "$(key "$name" "$common")" --arg commit "$commit" --argjson pending "$pending" \
    '{id: $id, kind: "git", root: $root, projectKey: $key, commit: (if $commit == "" then null else $commit end), pending: $pending}'
else
  case "$root" in
    'fatal: not a git repository (or any of the parent directories): .git'|'fatal: not a git repository (or any parent up to mount point '*) ;;
    *) die "git failed in $dir: $root" ;;
  esac
  current=$dir
  while :; do
    [ ! -e "$current/.git" ] && [ ! -L "$current/.git" ] || die "broken Git metadata at $current/.git; not falling back to non-Git"
    [ "$current" != / ] || break
    current=$(dirname -- "$current")
  done
  jq -n --arg id "$id" --arg root "$dir" --arg key "$(key "$(basename -- "$dir")" "$dir")" \
    '{id: $id, kind: "directory", root: $root, projectKey: $key}'
fi
