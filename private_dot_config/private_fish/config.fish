# remove greeting
set fish_greeting

# chezmoi
alias chezmoi="$HOME/bin/chezmoi"
abbr c "chezmoi"

# neovim
alias nvim="$HOME/nvim/bin/nvim"
alias vim="$HOME/nvim/bin/nvim"

# exports
set -gx TERM "xterm-256color"
set -gx EDITOR "$HOME/nvim/bin/nvim"
set -gx GPG_TTY (tty)

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
abbr t "tmux"
abbr ta "tmux attach -t"
abbr tls "tmux list-sessions"

# update
abbr u "sudo apt update && sudo apt upgrade -y && sudo apt autoremove -y"

# yarn
abbr yw "yarn workspace"

# prompt
starship init fish | source

