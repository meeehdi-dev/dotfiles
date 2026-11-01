# Run with: fish --no-config .config/fish/tests/work.fish
set -l config (path resolve (status dirname)/../config.fish)
set -l block (string match -r '(?ms)^function work\n.*?^end$' -- (string collect < "$config") | string collect)
if test (count $block) -ne 1
    printf 'FAIL: could not extract work\n' >&2
    exit 1
end
set -gx WORK_TEST_DIR (mktemp -d)
or exit 1
function cleanup --on-event fish_exit
    command rm -rf -- "$WORK_TEST_DIR"
end
printf '%s\n' "$block" 'work $argv' > "$WORK_TEST_DIR/runner.fish"

# Stub credentials: no real agents, keys, or signatures.
printf '%s\n' '#!/bin/sh
case "${0##*/}" in
    git)
        [ "$*" = "config --get user.signingkey" ] || exit 90
        [ -n "$WORK_TEST_KEY" ] || exit 1
        printf "%s\n" "$WORK_TEST_KEY"
        ;;
    ssh-add)
        printf "ssh-add\n" >> "$WORK_TEST_DIR/log"
        [ "$#" = 3 ] && [ "$1" = -t ] && [ "$2" = "${WORK_TEST_HOURS}h" ] && [ "$3" = "$HOME/.ssh/id_ed25519" ] || exit 91
        exit "$WORK_TEST_SSH_STATUS"
        ;;
    gpg)
        printf "gpg\n" >> "$WORK_TEST_DIR/log"
        [ "$#" = 5 ] && [ "$1" = --local-user ] && [ "$2" = "$WORK_TEST_KEY" ] && [ "$3" = --sign ] && [ "$4" = --output ] && [ "$5" = /dev/null ] || exit 92
        [ "$(cat)" = "work credential warm-up" ] || exit 93
        printf "discarded signature\n" > "$5"
        exit "$WORK_TEST_GPG_STATUS"
        ;;
esac' > "$WORK_TEST_DIR/stub"
command chmod +x "$WORK_TEST_DIR/stub"
for name in git ssh-add gpg
    command ln -s stub "$WORK_TEST_DIR/$name"
end
set -gx PATH "$WORK_TEST_DIR" $PATH
set -gx WORK_TEST_KEY test-signing-identity
set -gx WORK_TEST_HOURS 1
set -gx WORK_TEST_SSH_STATUS 0
set -gx WORK_TEST_GPG_STATUS 0

function check --argument-names label expected_status expected_log
    printf '' > "$WORK_TEST_DIR/log"
    command fish --no-config "$WORK_TEST_DIR/runner.fish" $argv[4..] > "$WORK_TEST_DIR/stdout" 2> "$WORK_TEST_DIR/stderr"
    set -l result $status
    set -l log (string collect < "$WORK_TEST_DIR/log")
    if test "$result" != "$expected_status"; or test "$log" != "$expected_log"; or test -s "$WORK_TEST_DIR/stdout"
        printf 'FAIL %s: status %s, log <%s>\n' "$label" "$result" "$log" >&2
        exit 1
    end
end

set -l success (printf 'ssh-add\ngpg' | string collect)
check default 0 "$success"
set -gx WORK_TEST_HOURS 2
check override 0 "$success" 2
check invalid-hours 1 '' 0
set -gx WORK_TEST_KEY ''
check missing-key 1 ''
set -gx WORK_TEST_KEY test-signing-identity
set -gx WORK_TEST_HOURS 1
set -gx WORK_TEST_SSH_STATUS 7
check ssh-failure 7 ssh-add
set -gx WORK_TEST_SSH_STATUS 0
set -gx WORK_TEST_GPG_STATUS 8
check gpg-failure 8 "$success"
printf 'PASS: 6 work checks (stubbed credentials only)\n'
