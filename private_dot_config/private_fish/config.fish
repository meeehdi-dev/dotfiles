# remove greeting
set fish_greeting

# exports
set -gx TERM "xterm-256color"
set -gx EDITOR "nvim"
set -gx GPG_TTY (tty)
set -gx DISPLAY ":0"
set -gx MESA_D3D12_DEFAULT_ADAPTER_NAME "NVIDIA"

# nvim
alias vim "nvim"

# bat
alias cat "bat"

# chezmoi
abbr c "chezmoi"

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
abbr t "tmux attach -t main || tmux new-session -s main"
abbr ta "tmux attach -t"
abbr tls "tmux list-sessions"

# update
abbr u "sudo apt update && sudo apt upgrade -y && sudo apt autoremove -y"

# i3-like window switching
function tmux_switch_window
  set target $argv[1]
  if test -z "$target"
    echo "Usage: tmux-window.sh <window_number>"
    exit 1
  end

  set win (tmux display-message -p "#{window_index}")
  set pane_count (tmux display-message -p "#{window_panes}")
  set lines_count (string trim (tmux capture-pane -p | grep -Ev "^\$" | wc -l))
  set cmd (tmux display-message -p "#{pane_current_command}")
  set path (tmux display-message -p "#{pane_current_path}")

  tmux select-window -t :$target || tmux new-window -t :$target -c $path

  if test "$win" != "$target"; and test "$pane_count" = "1"; and test "$lines_count" = "2"; and test "$cmd" = "fish"
    tmux kill-window -t $win
  end
end

# bell if cmd > 5sec
set ignored_cmd "vim" "nvim" "tmux"
function bell --on-event fish_postexec
  set cmd (string split " " $argv)[1]
  if test $CMD_DURATION -gt 5000; and not contains $cmd $ignored_cmd
    echo -e \07
  end
end

set -l os (uname)
if test "$os" = Linux # WSL
  # homebrew
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
end

# fzf
fzf --fish | source

# prompt
starship init fish | source

# mise-en-place
~/.local/bin/mise activate fish | source
