#!/bin/bash
# draft-arm.sh — (re)inject a poller into the logged-in league tab.
#
#   scripts/draft-arm.sh <url-substring> <poller.js>
#   e.g. scripts/draft-arm.sh leagueId=334829 scripts/espn-poller.js
#        scripts/draft-arm.sh foxwoodsdynasty scripts/cbs-poller.js
MATCH=${1:?url substring}; POLLER=${2:?poller.js}
osascript - "$MATCH" "$(cat "$POLLER")" <<'AS'
on run argv
  set m to item 1 of argv
  set src to item 2 of argv
  tell application "Google Chrome"
    repeat with w in windows
      repeat with tb in tabs of w
        if URL of tb contains m then
          return execute tb javascript src
        end if
      end repeat
    end repeat
    return "league tab not found"
  end tell
end run
AS
