#!/bin/bash

rsync -r --exclude=".git" --exclude="install.sh" . $HOME
