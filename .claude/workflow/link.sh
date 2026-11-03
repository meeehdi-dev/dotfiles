#!/usr/bin/env bash
# Install the workflow into Claude config dirs. Idempotent: a second run changes nothing.
# - Links workflow/, agents/wf-*.md, skills/work, skills/workflow-*, rules/agents.md (relative
#   links, like stow). Never replaces a real file or folder, or a symlink pointing elsewhere (even dangling).
# - Removes dangling symlinks in skills/, agents/, rules/ whose chain ends inside dotfiles (old skills/plan).
# - Merges into settings.json with jq: the phase hook, statusLine, worktree.baseRef "head",
#   the ponytail marketplace and enabledPlugins entry. Other keys are kept; writes only on change.
#   A key the user set differently, or invalid JSON, skips that whole config dir.
# Usage: link.sh [config dirs…]   (default: ~/.claude ~/.claude-lvmh ~/.claude-vo2)
set -u
[ $# -gt 0 ] || set -- "$HOME/.claude" "$HOME/.claude-lvmh" "$HOME/.claude-vo2"
status=0

# rel <target> <dir>: target relative to dir (both canonical, absolute)
rel() {
  local t=$1 d=$2 up=""
  while [ "${t#"$d"/}" = "$t" ]; do d=${d%/*}; up="../$up"; done
  printf '%s%s\n' "$up" "${t#"$d"/}"
}

# follow <path>: end of its symlink chain (not canonical)
follow() {
  local p=$1 t n=0
  while [ -L "$p" ] && [ $n -lt 20 ]; do
    t=$(readlink "$p"); case $t in /*) ;; *) t="$(dirname "$p")/$t" ;; esac
    p=$t n=$((n + 1))
  done
  printf '%s\n' "$p"
}

# Resolve physically, even when run through a stowed link (~/.claude/workflow/link.sh).
src="$(cd -P "$(dirname "$(follow "${BASH_SOURCE[0]}")")/.." && pwd -P)"

# canon <path>: canonical path of an existing file or folder, following symlinks
canon() {
  local p; p=$(follow "$1")
  if [ -d "$p" ]; then (cd "$p" && pwd -P)
  else printf '%s/%s\n' "$(cd "$(dirname "$p")" && pwd -P)" "$(basename "$p")"; fi
}

# stale <link>: a dangling symlink whose chain ends inside $src
stale() {
  local d
  [ -L "$1" ] && [ ! -e "$1" ] || return 1
  d=$(cd "$(dirname "$(follow "$1")")" 2>/dev/null && pwd -P) || return 1
  case "$d/" in "$src"/*) return 0 ;; esac
  return 1
}

# Find stale links in every dir first: a chain can run through another config dir's link.
stale_list=""
for cfg in "$@"; do
  for sub in skills agents rules; do
    [ -d "$cfg/$sub" ] && [ ! -L "$cfg/$sub" ] || continue
    for l in "$cfg/$sub"/*; do stale "$l" && stale_list="$stale_list$l"$'\n'; done
  done
done

hook='{"matcher":"Skill|Agent","hooks":[{"type":"command","command":"bash ~/.claude/workflow/phase-hook.sh"}]}'
statusline='{"type":"command","command":"bash ~/.claude/workflow/statusline.sh"}'
market='{"source":{"source":"github","repo":"DietrichGebert/ponytail"}}'
# Prints {conflicts, settings}. A conflict is a workflow key already set to something else.
merge='
  def has_path(p): try (getpath(p) != null) catch true;
  def mine: [.hooks.PreToolUse[]? | select(any(.hooks[]?; (.command? // "") | tostring | test("workflow/phase-hook\\.sh")))];
  { conflicts: [
      (if (mine | length) > 0 and (mine | index([$hook]) == null) then "hooks.PreToolUse (phase-hook)" else empty end),
      (if has_path(["statusLine"]) and .statusLine != $sl then "statusLine" else empty end),
      (if has_path(["worktree","baseRef"]) and .worktree.baseRef != "head" then "worktree.baseRef" else empty end),
      (if has_path(["extraKnownMarketplaces","ponytail"]) and .extraKnownMarketplaces.ponytail != $mk then "extraKnownMarketplaces.ponytail" else empty end),
      (if has_path(["enabledPlugins","ponytail@ponytail"]) and .enabledPlugins["ponytail@ponytail"] != true then "enabledPlugins.ponytail@ponytail" else empty end)
    ],
    settings: (
      (if (mine | length) > 0 then . else .hooks.PreToolUse += [$hook] end)
      | .statusLine //= $sl
      | .worktree.baseRef //= "head"
      | .extraKnownMarketplaces.ponytail //= $mk
      | .enabledPlugins["ponytail@ponytail"] //= true
    ) }'

for cfg in "$@"; do
  [ -d "$cfg" ] || { echo "skip $cfg: not a directory"; status=1; continue; }

  # Settings first: a conflict or bad file skips the whole dir.
  file="$cfg/settings.json"
  if [ -L "$file" ]; then echo "skip $cfg: settings.json is a symlink"; status=1; continue; fi
  if [ -e "$file" ]; then cur=$(cat "$file") || { echo "skip $cfg: cannot read settings.json"; status=1; continue; }
  else cur='{}'; fi
  out=$(jq -e --argjson hook "$hook" --argjson sl "$statusline" --argjson mk "$market" \
    'if type == "object" then . else error("not an object") end | '"$merge" <<<"$cur" 2>/dev/null) \
    || { echo "skip $cfg: settings.json is not a JSON object, or a workflow key has an unexpected type"; status=1; continue; }
  conflicts=$(jq -r '.conflicts | join(", ")' <<<"$out")
  if [ -n "$conflicts" ]; then echo "skip $cfg: set differently by you: $conflicts"; status=1; continue; fi

  # Links
  printf '%s' "$stale_list" | while IFS= read -r l; do
    case $l in "$cfg"/*) rm "$l" && echo "removed dangling $l" ;; esac
  done
  for item in workflow agents/wf-*.md skills/work skills/workflow-* rules/agents.md; do
    for path in "$src"/$item; do
      [ -e "$path" ] || continue
      rel_path="${path#"$src"/}" dest="$cfg/$rel_path"
      dir=$(dirname "$dest")
      mkdir -p "$dir" || { status=1; continue; }
      if [ -e "$dest" ] || [ -L "$dest" ]; then
        [ -e "$dest" ] && [ "$(canon "$dest")" = "$path" ] && continue
        if [ -L "$dest" ]; then echo "skip $dest: symlink points elsewhere ($(readlink "$dest"))"
        else echo "skip $dest: real file or folder exists"; fi
        status=1; continue
      fi
      ln -s "$(rel "$path" "$(cd "$dir" && pwd -P)")" "$dest" && echo "linked $dest" || status=1
    done
  done

  # Write settings only when they change in meaning.
  new=$(jq '.settings' <<<"$out")
  if [ "$(jq -n --argjson a "$cur" --argjson b "$new" '$a == $b')" = true ]; then continue; fi
  tmp=$(mktemp "$file.XXXXXX") || { status=1; continue; }
  if [ -e "$file" ]; then chmod "$(stat -f %Lp "$file" 2>/dev/null || stat -c %a "$file")" "$tmp"; else chmod 644 "$tmp"; fi
  printf '%s\n' "$new" >"$tmp" && mv "$tmp" "$file" && echo "updated $file" || { rm -f "$tmp"; status=1; }
done
exit $status
