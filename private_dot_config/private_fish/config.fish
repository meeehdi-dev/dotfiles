# remove greeting
set fish_greeting

# exports
set -gx EDITOR nvim
set -gx GPG_TTY (tty)
set -x nvm_default_version latest

# nvim
alias vi nvim
alias vim nvim

# interactive rm for folders
alias rm "rm -I"

# bat
alias cat bat

# tmux
alias t 'tmux new-session -s "$(hostname | tr . _)" 2>/dev/null || tmux attach -t "$(hostname | tr . _)"'

# chezmoi
abbr c chezmoi

# pnpm
abbr p pnpm

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

# homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"

# fzf
fzf --fish | source

# prompt
starship init fish | source

# bun
set -x BUN_INSTALL "$HOME/.bun"
set -x PATH $BUN_INSTALL/bin $PATH

source ~/.orbstack/shell/init2.fish 2>/dev/null || :
