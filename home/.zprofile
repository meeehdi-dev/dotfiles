if [[ `cat /proc/version | grep "Microsoft"` ]];
then
    cd $HOME
else
    if [[ ! $DISPLAY && $XDG_VTNR -eq 1 ]];
    then
        exec startx
    fi
fi
