export PATH=$HOME/.yarn/bin:$HOME/bin:/usr/local/bin:$PATH

if [[ ! $DISPLAY && $XDG_VTNR -eq 1 ]];
then
    exec startx
fi
