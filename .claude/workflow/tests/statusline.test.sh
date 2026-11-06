#!/usr/bin/env bash
# Tests for ../statusline.sh: fixture JSON on stdin, output checked with ANSI codes stripped.
# Phase state lives under a mktemp -d CLAUDE_CONFIG_DIR, removed on exit.
#
#   bash .claude/workflow/tests/statusline.test.sh
set -uo pipefail

SCRIPT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)/statusline.sh
T=$(mktemp -d) || { echo "mktemp failed" >&2; exit 1; }
trap 'rm -rf -- "$T"' EXIT
export CLAUDE_CONFIG_DIR="$T"
mkdir "$T/workflow-state"

fails=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; [ -z "${2:-}" ] || printf '%s\n' "$2" | sed 's/^/     /'; fails=$((fails + 1)); }

OUT= RC=0
CACHE="$T/statusline-rate-limits.json"
run() { rm -f -- "$CACHE"; OUT=$(printf '%s' "$1" | bash "$SCRIPT"); RC=$?; }
plain() { printf '%s' "$OUT" | sed $'s/\033\\[[0-9;]*m//g'; }
# is <name> <json> <expected stripped output>
is() {
  run "$2"
  local got; got=$(plain)
  if [ "$RC" -eq 0 ] && [ "$got" = "$3" ]; then pass "$1"; else fail "$1 (rc=$RC)" "got:  [$got]"$'\n'"want: [$3]"; fi
}
# win <used_percentage> <seconds until reset>: one rate-limit window object
win() { printf '{"used_percentage":%s,"resets_at":%s}' "$1" "$(($(date +%s) + $2))"; }

BADGE=" auto "
both="{\"rate_limits\":{\"five_hour\":$(win 38 $((2 * 3600 + 13 * 60 - 30))),\"seven_day\":$(win 95 $((76 * 3600 - 30)))}}"
is "both windows" "$both" "$BADGE │ 5h █████░░░ 62% left ↻2h13m │ 7d ░░░░░░░░ 5% left ↻3d4h"
case "$OUT" in *$'\033[33m'*) pass "<=10% left is yellow" ;; *) fail "<=10% left is yellow" ;; esac
rest=${OUT#*$'\033[0m'}  # everything after the badge
case "$rest" in *'38;5'* | *'48;5'*) fail "no 256-color codes in the usage segments" ;; *) pass "no 256-color codes in the usage segments" ;; esac

run "{\"rate_limits\":{\"five_hour\":$(win 50 600)}}"
case "$OUT" in *$'\033[33m'*) fail "no yellow above 10% left" ;; *) pass "no yellow above 10% left" ;; esac

rm -f -- "$CACHE"; baseline=$(printf '{}' | bash "$SCRIPT")
run '{"rate_limits":null}'
if [ "$OUT" = "$baseline" ]; then pass "null rate_limits prints exactly the badge"; else fail "null rate_limits prints exactly the badge" "$(plain)"; fi
is "missing rate_limits" '{"session_id":"abc"}' "$BADGE"
is "window without used_percentage is left out" \
  "{\"rate_limits\":{\"five_hour\":{\"resets_at\":1},\"seven_day\":$(win 0 $((3 * 86400 - 30)))}}" \
  "$BADGE │ 7d ████████ 100% left ↻3d"
is "out-of-range and non-numeric windows are left out" \
  '{"rate_limits":{"five_hour":{"used_percentage":120,"resets_at":1},"seven_day":{"used_percentage":"5","resets_at":1}}}' "$BADGE"
is "minutes only, rounded up" "{\"rate_limits\":{\"five_hour\":$(win 10 $((44 * 60 + 30)))}}" "$BADGE │ 5h ███████░ 90% left ↻45m"
is "past reset shows 0m" "{\"rate_limits\":{\"five_hour\":$(win 90 -100)}}" "$BADGE │ 5h █░░░░░░░ 10% left ↻0m"
is "reset seconds ago shows 0m, not -0m" "{\"rate_limits\":{\"five_hour\":$(win 90 -10)}}" "$BADGE │ 5h █░░░░░░░ 10% left ↻0m"
is "malformed input still prints the badge" 'not json' "$BADGE"
is "non-object rate_limits" '{"rate_limits":"x"}' "$BADGE"
is "context in k" '{"context_window":{"used_percentage":12.4,"context_window_size":200000}}' "$BADGE │ 12%/200k"
is "context in M" '{"context_window":{"used_percentage":3,"context_window_size":1000000}}' "$BADGE │ 3%/1M"
is "context without used_percentage is left out" '{"context_window":{"used_percentage":null,"context_window_size":200000}}' "$BADGE"

for pb in plan:75 ui:75 build:214 review:246 finalize:71; do
  p=${pb%:*}
  printf '%s\n' "$p" > "$T/workflow-state/s1"
  is "phase badge: $p" "{\"session_id\":\"s1\",\"rate_limits\":{\"five_hour\":$(win 0 59)}}" " $p  │ 5h ████████ 100% left ↻1m"
  case "$OUT" in $'\033[48;5;'"${pb#*:}m"$'\033[38;5;16m '"$p "$'\033[0m'*) pass "phase badge colors: $p" ;; *) fail "phase badge colors: $p" ;; esac
done
case "$baseline" in $'\033[48;5;238m\033[38;5;252m auto \033[0m') pass "auto badge unchanged" ;; *) fail "auto badge unchanged" ;; esac

run "{\"rate_limits\":{\"five_hour\":$(win 10 $((44 * 60 + 30))),\"seven_day\":$(win 5 -10)}}"
got=$(printf '{"session_id":"abc"}' | bash "$SCRIPT" | sed $'s/\033\\[[0-9;]*m//g')
if [ "$got" = "$BADGE │ 5h ███████░ 90% left ↻45m" ]; then pass "startup without rate_limits shows cached, unexpired windows"
else fail "startup without rate_limits shows cached, unexpired windows" "got: [$got]"; fi

echo
if [ "$fails" -eq 0 ]; then echo "all statusline.sh tests passed"; else echo "$fails statusline.sh test(s) failed"; exit 1; fi
