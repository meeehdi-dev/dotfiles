#!/usr/bin/env bash
# Fixture JSON and disposable config/home directories; no Claude sessions or network.
#   bash .claude/workflow/tests/statusline.test.sh
set -uo pipefail

SCRIPT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)/statusline.sh
T=$(mktemp -d) || { echo "mktemp failed" >&2; exit 1; }
trap 'rm -rf -- "$T"' EXIT
export CLAUDE_CONFIG_DIR="$T"

fails=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; [ -z "${2:-}" ] || printf '%s\n' "$2" | sed 's/^/     /'; fails=$((fails + 1)); }

OUT= RC=0
CACHE="$T/statusline-rate-limits.json"
run() { rm -f -- "$CACHE"; OUT=$(printf '%s' "$1" | bash "$SCRIPT"); RC=$?; }
plain() { printf '%s' "$OUT" | sed $'s/\033\\[[0-9;]*m//g'; }
is() {
  run "$2"
  local got; got=$(plain)
  if [ "$RC" -eq 0 ] && [ "$got" = "$3" ]; then pass "$1"; else fail "$1 (rc=$RC)" "got:  [$got]"$'\n'"want: [$3]"; fi
}
win() { printf '{"used_percentage":%s,"resets_at":%s}' "$1" "$(($(date +%s) + $2))"; }

both="{\"rate_limits\":{\"five_hour\":$(win 38 $((2 * 3600 + 13 * 60 - 30))),\"seven_day\":$(win 95 $((76 * 3600 - 30)))}}"
is "both windows, no leading divider" "$both" "5h █████░░░ 62% left ↻2h13m │ 7d ░░░░░░░░ 5% left ↻3d4h"
case "$OUT" in *$'\033[33m'*) pass "<=10% left is yellow" ;; *) fail "<=10% left is yellow" ;; esac
case "$OUT" in *'38;5'* | *'48;5'*) fail "no badge or 256-color codes" ;; *) pass "no badge or 256-color codes" ;; esac

run "{\"rate_limits\":{\"five_hour\":$(win 50 600)}}"
case "$OUT" in *$'\033[33m'*) fail "no yellow above 10% left" ;; *) pass "no yellow above 10% left" ;; esac

is "null rate_limits" '{"rate_limits":null}' ""
is "missing rate_limits" '{"session_id":"abc"}' ""
is "window without used_percentage is left out" \
  "{\"rate_limits\":{\"five_hour\":{\"resets_at\":1},\"seven_day\":$(win 0 $((3 * 86400 - 30)))}}" \
  "7d ████████ 100% left ↻3d"
is "out-of-range and non-numeric windows are left out" \
  '{"rate_limits":{"five_hour":{"used_percentage":120,"resets_at":1},"seven_day":{"used_percentage":"5","resets_at":1}}}' ""
is "minutes only, rounded up" "{\"rate_limits\":{\"five_hour\":$(win 10 $((44 * 60 + 30)))}}" "5h ███████░ 90% left ↻45m"
is "past reset shows 0m" "{\"rate_limits\":{\"five_hour\":$(win 90 -100)}}" "5h █░░░░░░░ 10% left ↻0m"
is "reset seconds ago shows 0m, not -0m" "{\"rate_limits\":{\"five_hour\":$(win 90 -10)}}" "5h █░░░░░░░ 10% left ↻0m"
is "malformed input prints nothing" 'not json' ""
is "non-object rate_limits" '{"rate_limits":"x"}' ""
is "context in k" '{"context_window":{"used_percentage":12.4,"context_window_size":200000}}' "12%/200k"
is "context in M" '{"context_window":{"used_percentage":3,"context_window_size":1000000}}' "3%/1M"
is "context without used_percentage is left out" '{"context_window":{"used_percentage":null,"context_window_size":200000}}' ""
is "context and usage separated once" \
  "{\"context_window\":{\"used_percentage\":12,\"context_window_size\":200000},\"rate_limits\":{\"five_hour\":$(win 0 59)}}" \
  "12%/200k │ 5h ████████ 100% left ↻1m"

rm -f -- "$CACHE"
mkdir -p "$T/home/.claude-maison"
printf '%s\n' "printf '\\033[2m▸\\033[0m ↓1.2K ↑300 │ \\033[33m\\033[1m~\$0.42\\033[0m │ ━╌ 12%%'" > "$T/home/.claude-maison/statusline.sh"
OUT=$(printf '{}' | HOME="$T/home" CLAUDE_MAISON=1 bash "$SCRIPT"); RC=$?
if [ "$RC" -eq 0 ] && [ "$(plain)" = "~\$0.42" ]; then pass "maison cost alone"; else fail "maison cost alone" "$(plain)"; fi
OUT=$(printf '{}' | HOME="$T/home" bash "$SCRIPT")
if [ "$(plain)" = "" ]; then pass "no cost outside maison"; else fail "no cost outside maison" "$(plain)"; fi
rm -f -- "$CACHE"
OUT=$(printf '{"context_window":{"used_percentage":12,"context_window_size":200000},"rate_limits":{"five_hour":%s}}' "$(win 0 59)" | HOME="$T/home" CLAUDE_MAISON=1 bash "$SCRIPT")
if [ "$(plain)" = '12%/200k │ ~$0.42 │ 5h ████████ 100% left ↻1m' ]; then pass "context, cost, and usage separators"; else fail "context, cost, and usage separators" "$(plain)"; fi

mkdir "$T/workflow-state"
printf 'build\n' > "$T/workflow-state/s1"
is "legacy phase state ignored" "{\"session_id\":\"s1\",\"rate_limits\":{\"five_hour\":$(win 0 59)}}" "5h ████████ 100% left ↻1m"

run "{\"rate_limits\":{\"five_hour\":$(win 10 $((44 * 60 + 30))),\"seven_day\":$(win 5 -10)}}"
got=$(printf '{"session_id":"abc"}' | bash "$SCRIPT" | sed $'s/\033\\[[0-9;]*m//g')
if [ "$got" = "5h ███████░ 90% left ↻45m" ]; then pass "startup shows cached, unexpired windows"
else fail "startup shows cached, unexpired windows" "got: [$got]"; fi

echo
if [ "$fails" -eq 0 ]; then echo "all statusline.sh tests passed"; else echo "$fails statusline.sh test(s) failed"; exit 1; fi
