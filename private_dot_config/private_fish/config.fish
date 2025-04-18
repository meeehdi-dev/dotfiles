# remove greeting
set fish_greeting

# exports
set -gx EDITOR nvim
set -gx GPG_TTY (tty)

# nvim
alias vi nvim
alias vim nvim
alias rm "rm -I"

# bat
alias cat bat

# chezmoi
abbr c chezmoi

# git
abbr ga "git add"
abbr gc "git commit"
abbr gco "git checkout"
abbr gd "git diff"
abbr gds "git diff --staged"
abbr gf "git fetch"
abbr gl "git pull"
abbr gp "git push"
abbr gs "git status"
abbr gca "git commit --amend"

# tmux
abbr t 'tmux new-session -s "$(hostname | tr . _)" 2>/dev/null || tmux attach -t "$(hostname | tr . _)"'
# abbr ta "tmux attach -t"
# abbr tls "tmux list-sessions"

# i3-like window switching
# function tmux_switch_window
#   set target $argv[1]
#   if test -z "$target"
#     echo "Usage: tmux-window.sh <window_number>"
#     exit 1
#   end
#
#   set win (tmux display-message -p "#{window_index}")
#   set pane_count (tmux display-message -p "#{window_panes}")
#   set lines_count (string trim (tmux capture-pane -p | grep -Ev "^\$" | wc -l))
#   set cmd (tmux display-message -p "#{pane_current_command}")
#   set path (tmux display-message -p "#{pane_current_path}")
#
#   tmux select-window -t :$target || tmux new-window -t :$target -c $path
#
#   if test "$win" != "$target"; and test "$pane_count" = "1"; and test "$lines_count" = "2"; and test "$cmd" = "fish"
#     tmux kill-window -t $win
#   end
# end

# bell if cmd > 5sec
# set ignored_cmd "vim" "nvim" "tmux"
# function bell --on-event fish_postexec
#   set cmd (string split " " $argv)[1]
#   if test $CMD_DURATION -gt 5000; and not contains $cmd $ignored_cmd
#     echo -e \07
#   end
# end

# homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"

# fzf
fzf --fish | source

# prompt
starship init fish | source

# bun
set --export BUN_INSTALL "$HOME/.bun"
set --export PATH $BUN_INSTALL/bin $PATH

# vi mode
# fish_vi_key_bindings

# Added by OrbStack: command-line tools and integration
# This won't be added again if you remove it.
source ~/.orbstack/shell/init2.fish 2>/dev/null || :
