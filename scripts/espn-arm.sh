#!/bin/bash
# espn-arm.sh — (re)inject the poller into the ESPN league tab.
osascript - "$(cat "$(dirname "$0")/espn-poller.js")" <<'AS'
on run argv
  set src to item 1 of argv
  tell application "Google Chrome"
    repeat with w in windows
      repeat with tb in tabs of w
        if URL of tb contains "fantasy.espn.com/football/league?leagueId=334829" then
          return execute tb javascript src
        end if
      end repeat
    end repeat
    return "league tab not found"
  end tell
end run
AS
