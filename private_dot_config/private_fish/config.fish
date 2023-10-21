# remove greeting
set fish_greeting

# neovim
alias vim="nvim"

# exports
set -gx TERM "xterm-256color"
set -gx EDITOR "nvim"
set -gx GPG_TTY (tty)

# chezmoi
abbr c "chezmoi"

# git
abbr ga "git add"
abbr gc "git commit"
abbr gco "git checkout"
abbr gd "git diff"
abbr gf "git fetch"
abbr gl "git pull"
abbr gp "git push"
abbr gs "git status"

# file explorer
abbr r "ranger"

# tmux
abbr t "tmux attach -t main || tmux new-session -s main"
abbr ta "tmux attach -t"
abbr tls "tmux list-sessions"

# update
abbr u "sudo apt update && sudo apt upgrade -y && sudo apt autoremove -y"

# node
abbr yw "yarn workspace"
abbr n "nvm"
abbr p "pnpm"

# prompt
starship init fish | source

if status is-interactive
and not set -q TMUX
  tmux attach -t main || tmux new-session -s main
end
