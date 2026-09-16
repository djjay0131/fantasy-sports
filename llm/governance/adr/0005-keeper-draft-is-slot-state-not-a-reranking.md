# ADR-0005: A keeper draft is slot state on the ranker's board, not a re-ranking

Status: Accepted
Date: 2026-09-07

## Context

The Foxwoods league (CBS, 12 teams, 15-round snake, half PPR with 6-point
passing TDs) enters the draft with 27 keepers already on rosters. Each keeper
consumes its owner's pick in a declared round, so pick 1 of the room is not
pick 1 of the draft, and "who is on the clock" cannot be `taken + 1`.

Two temptations follow. One is to re-rank for the scoring — half PPR nudges
RBs and QBs up relative to a full-PPR list. The other is to treat keepers as
ordinary "gone" clicks and let the snake math drift.

## Decision

1. **The ranker's board is used unchanged.** Scoring differences are shown on
   the page (the format label) and left to the drafter's judgement; ADR-0002
   and ADR-0003 forbid inventing a second ranking here, and the owner's rule is
   that Jeff's PPR list is the spine of every league.
2. **Keepers are draft-slot state**, captured once per league in a private
   config (`data/processed/<league>-league.json`: order, keepers by team and
   round, lineup, scoring label) and turned by `scripts/keeper-draft.mjs` into
   a slot file (`docs/data/<league>-draft.json`, git-ignored). Every keeper is
   resolved against the board; an unresolved one is retained with `id: null`
   and reported, never dropped.
3. **Snake math runs over open slots only.** "On the clock", "your next pick",
   and "picks between" count the picks that will actually be made in the room.
   The overall-board marker ("your pick N") lands on the k-th non-keeper
   player, where k is the number of open slots before pick N — the honest
   answer to "how deep into his list will I be picking".
4. **One board script serves every snake page.** `docs/assets/redraft.js`
   reads the league from `<body data-*>`; a page with no keeper file is plain
   snake arithmetic, so the ESPN redraft page is unchanged in behaviour.
5. **Live feed is source-neutral.** The tab-side poller is per site (ESPN API,
   CBS draft-results page); the AppleScript bridge, the local server, and the
   board are shared. The server writes `draft-live.<league>.json` so two leagues
   never overwrite each other.

## Consequences

- Adding a keeper league is one config file and one HTML page; no new JS.
- The board is only as right as the keeper config; it is read from the league
  site and dated in the file's `source` field.
- Public Pages shows the sample board for these pages: the keeper file, the
  live file, and the ranker's data are all private (ADR-0001).
