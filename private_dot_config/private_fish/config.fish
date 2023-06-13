# remove greeting
set fish_greeting

# chezmoi
alias c="$HOME/bin/chezmoi"

# neovim
alias nvim="$HOME/nvim-linux64/bin/nvim"
alias vim="nvim"

# exports
set -gx EDITOR nvim
set -gx GPG_TTY (tty)

# prompt
starship init fish | source

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

# vim
abbr v "nvim"

# yarn
abbr yw "yarn workspace"
abbr yu "yarn upgrade-interactive"
abbr ygu "yarn global upgrade-interactive"

