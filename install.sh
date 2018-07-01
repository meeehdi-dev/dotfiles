#!/bin/bash

DO_BACKUP=false
DO_COPY=false
DO_LINK=false

if [[ "$1" = "" ]];
then
    DO_COPY=true
    DO_LINK=true
fi

if [[ "$1" = "backup" ]];
then
    DO_BACKUP=true
    DO_COPY=true
    DO_LINK=true
fi

if [[ "$1" = "link" ]];
then
    DO_LINK=true
fi

if [[ $DO_BACKUP = true ]];
then
    if [[ -d "BACKUP" ]];
    then
        echo "Backup folder already exists, please delete before running the script again."
        exit 1
    fi
    mkdir BACKUP
fi

for i in "" "etc";
do
    ORIGIN=$i
    if [[ "$i" = "" ]];
    then
        ORIGIN="home"
        cd $ORIGIN
        i=$HOME
    else
        cd $ORIGIN
        i="/$ORIGIN"
    fi
    LIST=`find . -name '*' -type f`
    for j in $LIST;
    do
        if [[ $DO_BACKUP = true ]];
        then
            if [[ ! -d "../BACKUP/$ORIGIN" ]];
            then
                mkdir "../BACKUP/$ORIGIN"
            fi
            sudo cp --remove-destination -pv "$i/$j" "../BACKUP/$ORIGIN"
        fi
        if [[ $DO_COPY = true ]];
        then
            sudo cp --remove-destination --parents -pv "$j" "$i"
        fi
        if [[ $DO_LINK = true ]];
        then
            ln -fv $i/$j $j
        fi
    done
    cd - &> /dev/null
done
