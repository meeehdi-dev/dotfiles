# set vi mode
fish_vi_key_bindings

# remove greeting
set fish_greeting

# theme
fish_config theme choose catppuccin-mocha --color-theme=dark

# global exports
set -gx EDITOR nvim
set -gx GPG_TTY (tty)

# exports
set -x BUN_INSTALL "$HOME/.bun"
set -x PNPM_INSTALL "$HOME/Library/pnpm"
set -x LOCAL_INSTALL "$HOME/.local"

# interactive rm for folders
alias rm "rm -I"

# bat
alias cat bat

# aseprite
alias aseprite "$HOME/code/gamedev/aseprite/build/bin/aseprite"

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
fish_add_path $LOCAL_INSTALL/bin

# pnpm
fish_add_path $PNPM_INSTALL

# fzf
fzf --fish | source

# zoxide
zoxide init fish | source

# fnm
if command -v fnm >/dev/null
    fnm env --use-on-cd --version-file-strategy=recursive --corepack-enabled --resolve-engines --shell fish | source
end

# claude
function claude
    set -l profile (printf '%s\n' None Personal VO2 LVMH | fzf --prompt='Claude account> ')
    if test -z "$profile"
        return
    end

    switch $profile
        case None
            return
        case Personal
            env CLAUDE_CONFIG_DIR="$HOME/.claude" claude $argv
        case VO2
            env CLAUDE_CONFIG_DIR="$HOME/.claude-vo2" claude $argv
        case LVMH
            env CLAUDE_CONFIG_DIR="$HOME/.claude-lvmh" maison $argv
    end
end
