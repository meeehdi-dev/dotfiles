export PATH=$HOME/.yarn/bin:$HOME/bin:/usr/local/bin:$PATH

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
export SSH_KEY_PATH="~/.ssh/id_rsa"

# compiler
export CC=clang
export CXX=clang++

# base16
BASE16_SHELL="$HOME/.config/base16-shell/"
[ -n "$PS1" ] && \
    [ -s "$BASE16_SHELL/profile_helper.sh" ] && \
    eval "$("$BASE16_SHELL/profile_helper.sh")"

# misc
alias lesss="vim -u $HOME/.vimrc.more"
