#!/bin/bash

if [[ -d "BACKUP" ]];
then
    echo "Backup folder already exists, please delete before running the script again."
    exit 1
fi

mkdir BACKUP

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
        if [[ ! -d "../BACKUP/$ORIGIN" ]];
        then
            mkdir "../BACKUP/$ORIGIN"
        fi
        sudo cp --remove-destination -pv "$i/$j" "../BACKUP/$ORIGIN"
        sudo cp --remove-destination --parents -pv "$j" "$i"
        ln -fv $i/$j $j
    done
    cd - &> /dev/null
done
