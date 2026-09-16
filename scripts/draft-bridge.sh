#!/bin/bash
# draft-bridge.sh — pull the draft payload out of the league tab and post it locally.
#
#   nohup scripts/draft-bridge.sh <url-substring> <poller.js> > /tmp/fs-bridge.log 2>&1 &
#   e.g. scripts/draft-bridge.sh foxwoodsdynasty scripts/cbs-poller.js
#
# Every 12s: AppleScript reads window.__fsLive.payload from the logged-in tab
# (set there by the poller) and curls it to the local board server. If the
# payload is gone (tab reloaded or navigated), the poller is re-armed. Runs
# until killed. Nothing leaves this machine.
MATCH=${1:?url substring}; POLLER=${2:?poller.js}
PORT=${PORT:-8722}
LAST=""
while true; do
  PAYLOAD=$(osascript - "$MATCH" <<'AS' 2>/dev/null
on run argv
  set m to item 1 of argv
  tell application "Google Chrome"
    repeat with w in windows
      repeat with tb in tabs of w
        if URL of tb contains m then
          return execute tb javascript "(window.__fsLive && window.__fsLive.payload) || ''"
        end if
      end repeat
    end repeat
    return ""
  end tell
end run
AS
)
  if [ -n "$PAYLOAD" ] && [ "$PAYLOAD" != "$LAST" ]; then
    if curl -s -m 5 -X POST "http://localhost:$PORT/api/draft-live" -H 'content-type: application/json' --data-binary "$PAYLOAD" >/dev/null; then
      LAST="$PAYLOAD"
      echo "$(date '+%H:%M:%S') posted $(echo "$PAYLOAD" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(len(d["picks"]),"picks")' 2>/dev/null)"
    fi
  elif [ -z "$PAYLOAD" ]; then
    R=$(bash "$(dirname "$0")/draft-arm.sh" "$MATCH" "$POLLER" 2>&1)
    echo "$(date '+%H:%M:%S') no payload — re-arm: $R"
  fi
  sleep 12
done
