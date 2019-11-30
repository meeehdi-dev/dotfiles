alias r="ranger"
alias vim="nvim"

# git
abbr ga "git add"
abbr gc "git commit"
abbr gco "git checkout"
abbr gd "git diff"
abbr gf "git fetch"
abbr gl "git pull"
abbr gp "git push"
abbr gs "git status"

# tmux
abbr ta "tmux a -t"
abbr tls "tmux list-sessions"

# system update
abbr uuac "sudo apt update; sudo apt upgrade; sudo apt autoremove; sudo apt clean"

# use fd for fzf to respect .gitignore
export FZF_DEFAULT_COMMAND="fd --type f"

# set vim as default editor
export EDITOR="vim"
