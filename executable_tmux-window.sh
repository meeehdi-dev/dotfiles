#/bin/bash

if [ -z "$1" ]; then
  echo "Usage: tmux-window.sh <window_number>"
  exit 1
fi

CURRENT_WIN=$(tmux display-message -p "#{window_index}")
HAS_PANE=$(tmux display-message -p "#{window_panes}")
PROC=$(tmux display-message -p "#{pane_current_command}")

tmux select-window -t :$1 || tmux new-window -t :$1

if [ $CURRENT_WIN -ne $1 ] && [ $HAS_PANE -eq "1" ] && [ $PROC = "fish" ]; then
  tmux kill-window -t $CURRENT_WIN
fi
