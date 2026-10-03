#!/bin/sh
# Record the Mac screen for N seconds into video/out/<name>.mp4, for the chat clips.
# Keeps the display awake (a screensaver ruined one take) and parks the pointer on
# Chrome's debugging banner, which the edit crops away.
# Usage: ./record_screen.sh <name> <seconds>
set -e
cd "$(dirname "$0")/out"
name="$1"; seconds="$2"
[ -n "$name" ] && [ -n "$seconds" ] || { echo "usage: $0 <name> <seconds>"; exit 1; }

if pgrep -x ffmpeg >/dev/null; then echo "another recording is running"; exit 1; fi

python3 -c "import Quartz; Quartz.CGWarpMouseCursorPosition((1000, 178))"
osascript -e 'tell application "Google Chrome" to activate'
caffeinate -d -u -t $((seconds + 5)) &
ffmpeg -v error -y -f avfoundation -capture_cursor 0 -framerate 30 -pixel_format nv12 \
    -t "$seconds" -i "Capture screen 0:none" -c:v libx264 -preset ultrafast -crf 18 \
    "$name.mp4" > "$name.log" 2>&1 &
echo "recording $name for ${seconds}s"
