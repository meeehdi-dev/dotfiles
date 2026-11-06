#!/usr/bin/env bash
# statusLine: workflow phase badge for this session, then the 5h/7d plan usage limits.
root="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
input=$(cat)
session=$(jq -r '.session_id // ""' <<<"$input" 2>/dev/null)
phase=""
[[ "$session" =~ ^[A-Za-z0-9_-]+$ ]] && phase=$(head -n1 "$root/workflow-state/$session" 2>/dev/null)
# pi badge colors: plan/ui accent, build warning, review muted, finalize success
case "$phase" in
  plan|ui) bg=75 fg=16 ;;
  build) bg=214 fg=16 ;;
  review) bg=246 fg=16 ;;
  finalize) bg=71 fg=16 ;;
  *) phase=auto bg=238 fg=252 ;;
esac
printf '\033[48;5;%sm\033[38;5;%sm %s \033[0m' "$bg" "$fg" "$phase"

# Context: used % of the window / window size (e.g. 12%/200k, 3%/1M)
ctx=$(jq -r '.context_window | select((.used_percentage | type) == "number" and (.context_window_size | type) == "number")
  | "\(.used_percentage | round)%/\(.context_window_size
      | if . >= 1000000 then "\(. / 100000 | round / 10)M" else "\(. / 1000 | round)k" end)"' <<<"$input" 2>/dev/null)
[ -z "$ctx" ] || printf ' \033[2m│\033[0m %s' "$ctx"

# API cost under maison (LVMH): reuse its statusline, which prices the transcript from Vertex rates it keeps updated.
# shortcut: scrapes the first "$1.23" (or "~$1.23") from its output, revisit if a maison update changes that format
maison_sl="$HOME/.claude-maison/statusline.sh"
if [ "${CLAUDE_MAISON:-}" = 1 ] && [ -f "$maison_sl" ]; then
  cost=$(bash "$maison_sl" <<<"$input" 2>/dev/null | sed $'s/\033\\[[0-9;]*m//g' | grep -oE '~?\$[0-9]+\.[0-9]+' | head -n1)
  [ -z "$cost" ] || printf ' \033[2m│\033[0m %s' "$cost"
fi

# rate_limits only arrives after the session's first API response: cache the last one so startup shows it too.
cache="$root/statusline-rate-limits.json"
if jq -e '.rate_limits | type == "object"' <<<"$input" >/dev/null 2>&1; then
  jq -c '.rate_limits' <<<"$input" >"$cache.$$" 2>/dev/null && mv -f "$cache.$$" "$cache"
elif [ -s "$cache" ]; then
  # cached windows past their reset are stale, so they are dropped
  input=$(jq -c --slurpfile c "$cache" '.rate_limits = ($c[0] | with_entries(select(
    (.value.resets_at | type) == "number" and .value.resets_at > now)))' <<<"$input" 2>/dev/null)
fi

# Usage windows as pi's chatgpt-usage footer, in basic ANSI only (dim, default fg, yellow warning).
# One line per valid window: label, used cells (of 8), % left, warning (1/0), minutes to reset (rounded up).
windows=$(jq -r '
  .rate_limits as $r | select($r | type == "object")
  | ["5h", "five_hour"], ["7d", "seven_day"] | . as [$label, $key] | $r[$key]
  | select(type == "object" and (.used_percentage | type) == "number" and (.resets_at | type) == "number"
           and .used_percentage >= 0 and .used_percentage <= 100)
  | [$label, (.used_percentage / 100 * 8 | round), (100 - .used_percentage | round),
     (if 100 - .used_percentage <= 10 then 1 else 0 end), (([0, .resets_at - now] | max) / 60 | ceil)]
  | join(" ")' <<<"$input" 2>/dev/null)
d=$'\033[2m' y=$'\033[33m' r=$'\033[0m'
while read -r label used left warn mins; do
  [ -n "$label" ] || continue
  c=""; [ "$warn" = 1 ] && c=$y
  bar=""; for ((i = used; i < 8; i++)); do bar+="█"; done
  [ -z "$bar" ] || bar="$c$bar$r"
  dots=""; for ((i = 0; i < used; i++)); do dots+="░"; done
  [ -z "$dots" ] || bar+="$d$dots$r"
  days=$((mins / 1440)) hours=$((mins % 1440 / 60)) rest=$((mins % 60))
  if ((days)); then eta="${days}d"; ((hours)) && eta+="${hours}h"
  elif ((hours)); then eta="${hours}h"; ((rest)) && eta+="${rest}m"
  else eta="${mins}m"; fi
  printf ' %s│%s %s%s%s %s %s%s%% left%s %s↻%s%s' "$d" "$r" "$d" "$label" "$r" "$bar" "$c" "$left" "$r" "$d" "$eta" "$r"
done <<<"$windows"
exit 0
