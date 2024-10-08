# remove greeting
set fish_greeting

# neovim
alias vim="nvim"

# exports
set -gx TERM "xterm-256color"
set -gx EDITOR "nvim"
set -gx GPG_TTY (tty)
set -gx DISPLAY ":0"
set -gx MESA_D3D12_DEFAULT_ADAPTER_NAME "NVIDIA"

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

# node
abbr yw "yarn workspace"
abbr p "pnpm"

# functions
function cdr
  cd (git rev-parse --show-toplevel)
end

function tmux_switch_window
  set target $argv[1]
  if test -z "$target"
    echo "Usage: tmux-window.sh <window_number>"
    exit 1
  end

  set win (tmux display-message -p "#{window_index}")
  set pane_count (tmux display-message -p "#{window_panes}")
  set lines_count (tmux capture-pane -p | grep -Ev "^\$" | wc -l)
  set cmd (tmux display-message -p "#{pane_current_command}")
  set path (tmux display-message -p "#{pane_current_path}")

  tmux select-window -t :$target || tmux new-window -t :$target -c $path

  if test "$win" != "$target"; and test "$pane_count" = "1"; and test "$lines_count" = "2"; and test "$cmd" = "fish"
    tmux kill-window -t $win
  end
end

set ignored_cmd "vim" "nvim" "tmux" "bro"
function bell --on-event fish_postexec
  set cmd (string split " " $argv)[1]
  if test $CMD_DURATION -gt 5000; and not contains $cmd $ignored_cmd
    echo -e \07
  end
end

function bro --argument-names command
  if test "$command" = "commit"
    set diff (git diff --staged)
    if test -z "$diff"
      echo "No changes to commit."
      return 1
    end
    ollama run bropilot "```diff\
$diff\
```" | read msg
    echo $msg
    while read --nchars 1 -l response --prompt-str="Confirm? (y)" or return 1
      switch $response
        case y Y
          git commit -m "$msg"
          break
        case '*'
          ollama run bropilot "```diff\
$diff\
```" | read msg
          echo $msg
          continue
      end
    end
  end
  return 0
end

# prompt
starship init fish | source
