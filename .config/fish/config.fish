if status --is-interactive
  set BASE16_SHELL "$HOME/.config/base16-shell/"
  source "$BASE16_SHELL/profile_helper.fish"
end

alias r="ranger"
alias vim="nvim"

# git
abbr ga "git add"
abbr gc "git commit"
abbr gd "git diff"
abbr gf "git fetch"
abbr gl "git pull"
abbr gp "git push"
abbr gs "git status"

# system update (echo at the end to avoid fish error due to missing argument)
abbr uuac "sudo apt update; sudo apt upgrade; sudo apt autoremove; sudo apt clean"

# use fd for fzf to respect .gitignore
export FZF_DEFAULT_COMMAND="fd --type f"

# set vim as default editor
export EDITOR="vim"
