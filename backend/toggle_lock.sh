#!/bin/bash

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <session_code> <locked|unlocked>"
    exit 1
fi

SESSION_CODE="$1"

case "$2" in
    locked)
        VALUE=1
        ;;
    unlocked)
        VALUE=0
        ;;
    *)
        echo "Error: second argument must be 'locked' or 'unlocked'."
        echo "Usage: $0 <session_code> <locked|unlocked>"
        exit 1
        ;;
esac

sqlite3 jammy.db \
    "UPDATE sessions SET locked=$VALUE WHERE code='$SESSION_CODE';"

echo "Session '$SESSION_CODE' is now $2."