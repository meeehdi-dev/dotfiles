export PATH=$HOME/bin:/usr/local/bin:$PATH

# zsh
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="agnoster"
COMPLETION_WAITING_DOTS="true"
plugins=(
    git
    tmux
    ssh-agent
)
source $ZSH/oh-my-zsh.sh

# lang
export LANG=en_US.UTF-8

# editor
export EDITOR='vim'

# ssh
export SSH_KEY_PATH="~/.ssh/rsa_id"

# base16
BASE16_SHELL="$HOME/.config/base16-shell/"
[ -n "$PS1" ] && \
    [ -s "$BASE16_SHELL/profile_helper.sh" ] && \
    eval "$("$BASE16_SHELL/profile_helper.sh")"

# ubuntu
alias update="sudo apt-get update"
alias upgrade="sudo apt-get upgrade"
alias autoremove="sudo apt-get autoremove"
alias clean="sudo apt-get clean"
alias uuac="update && upgrade && autoremove && clean"

# vcxsrv
export DISPLAY=":0"
alias startx="cd $HOME/win/Documents && xlaunch.exe -run config.xlaunch &> /dev/null && cd -"
alias wp="sh $HOME/.fehbg"
alias i3="startx; wp; exec i3"

# misc
alias cat="lolcat"
