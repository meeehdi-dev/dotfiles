#!/bin/bash

if [[ "$1" = "up" ]];
then
    amixer set Master 2%+
fi
if [[ "$1" = "down" ]];
then
    amixer set Master 2%-
fi
if [[ "$1" = "toggle" ]];
then
    amixer set Master toggle
fi


RID=""
DUNST_VOL=$HOME/.config/dunst/.dunst_volume
if [[ -f $DUNST_VOL ]];
then
    ID=`cat $DUNST_VOL`
    RID=" -r $ID"
fi

VOL=`amixer get Master | tail -n1 | cut -d" " -f6`
MUTE=`amixer get Master | tail -n1 | cut -d" " -f8`

dunstify -p$RID "Volume $MUTE" "$VOL" > $DUNST_VOL
