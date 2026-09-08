#!/bin/bash
# espn-bridge.sh — pull the draft payload out of the ESPN tab and post it locally.
#
#   nohup scripts/espn-bridge.sh > /tmp/fs-bridge.log 2>&1 &
#
# Every 12s: AppleScript reads window.__fsLive.payload from the logged-in ESPN
# league tab (set there by scripts/espn-poller.js) and curls it to the local
# board server. Runs until killed. Nothing leaves this machine.
PORT=${PORT:-8722}
LAST=""
while true; do
  PAYLOAD=$(osascript <<'AS' 2>/dev/null
tell application "Google Chrome"
  repeat with w in windows
    repeat with tb in tabs of w
      if URL of tb contains "fantasy.espn.com/football/league?leagueId=334829" then
        return execute tb javascript "(window.__fsLive && window.__fsLive.payload) || ''"
      end if
    end repeat
  end repeat
  return ""
end tell
AS
)
  if [ -n "$PAYLOAD" ] && [ "$PAYLOAD" != "$LAST" ]; then
    if curl -s -m 5 -X POST "http://localhost:$PORT/api/draft-live" -H 'content-type: application/json' --data-binary "$PAYLOAD" >/dev/null; then
      LAST="$PAYLOAD"
      echo "$(date '+%H:%M:%S') posted $(echo "$PAYLOAD" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(len(d["picks"]),"picks")' 2>/dev/null)"
    fi
  elif [ -z "$PAYLOAD" ]; then
    echo "$(date '+%H:%M:%S') no payload (tab closed or poller not armed?)"
  fi
  sleep 12
done
