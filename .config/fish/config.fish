if status --is-interactive
  set BASE16_SHELL "$HOME/.config/base16-shell/"
  source "$BASE16_SHELL/profile_helper.fish"
end

# git
alias ga="git add"
alias gc="git commit"
alias gd="git diff"
alias gf="git fetch"
alias gl="git pull"
alias gp="git push"
alias gs="git status"

alias r="ranger"
alias vim="nvim"

# system update (echo at the end to avoid fish error due to missing argument)
alias uuac="sudo apt update; sudo apt upgrade; sudo apt autoremove; sudo apt clean; echo"

# use fd for fzf to respect .gitignore
export FZF_DEFAULT_COMMAND="fd --type f"
