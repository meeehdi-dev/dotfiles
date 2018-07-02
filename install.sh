#!/bin/bash

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
        sudo cp --remove-destination --parents -pv "$j" "$i"
        ln -fv $i/$j $j
    done
    cd - &> /dev/null
done
