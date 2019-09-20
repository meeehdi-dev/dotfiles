#!/bin/bash

rsync -r --exclude="install.sh" . $HOME
