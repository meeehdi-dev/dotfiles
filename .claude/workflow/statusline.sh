#!/usr/bin/env bash
# statusLine: workflow phase badge for this session, then the ponytail badge if installed.
root="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
session=$(jq -r '.session_id // ""')
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
[ -f "$root/ponytail-statusline.sh" ] && printf ' %s' "$(bash "$root/ponytail-statusline.sh")"
exit 0
