#!/bin/bash

for i in "" "etc";
do
    if [[ "$i" = "" ]];
    then
        cd home
        i=$HOME
    else
        cd $i
        i="/"$i
    fi
    LIST=`find . -name '*' -type f`
    for j in $LIST;
    do
        sudo cp --parents -v $j $i
        ln -fv $i/$j $j
    done
    cd - &> /dev/null
done
