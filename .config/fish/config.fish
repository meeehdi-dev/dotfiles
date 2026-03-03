# remove greeting
set fish_greeting

# theme
fish_config theme choose "Catppuccin Mocha"

# exports
set -gx EDITOR nvim
set -gx GPG_TTY (tty)
set -x nvm_default_version latest
set -x BUN_INSTALL "$HOME/.bun"

# interactive rm for folders
alias rm "rm -I"

# tmux
alias t 'tmux new-session -s "$(hostname | tr . _)" 2>/dev/null || tmux attach -t "$(hostname | tr . _)"'

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

# bun
fish_add_path $BUN_INSTALL/bin

# fzf
fzf --fish | source

# zoxide
zoxide init fish | source

 # fnm
fnm env --use-on-cd --version-file-strategy=recursive --corepack-enabled --resolve-engines --shell fish | source
