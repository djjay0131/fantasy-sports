# Active Context

Last updated: 2026-09-10

## Now

Phase 0 → Phase 1. The repository is established, governed, and published;
the first source connector is next.

## Recently done

- 2026-09-10 — **Upgraded onto agentic-governance v0.5** (was v0.3). No
  content moved: the two-plane layout was already correct. The delta now
  states the **Sprints** slot decision (absent — no sprint content in any
  tree; slot added in canon 0.5.0), names `.claude/`, `src/`, `scripts/`
  and `tests/` as paths outside the slot table, and re-verifies
  §Platform Enforcement Reality against the GitHub API. `CONTRIBUTING.md`
  step 4 picks up canon 0.5.2 — opening the draft PR is an author
  responsibility, not the owner's.
- 2026-08-29 — Repository created and **adopted onto agentic-governance
  v0.3**. Delta at `llm/governance/governance-delta.md`; layout declared
  (`llm/` control plane, `docs/` data plane); routing rule installed in
  `CLAUDE.md` and `AGENTS.md`. Steward activation status: INACTIVE.
- 2026-08-29 — ADR-0001 (public tooling / private source data) and
  ADR-0002 (rankings, not projections) accepted.
- 2026-08-29 — Design authority document written.
- 2026-08-29 — GitHub Pages site published with the tiered board reading
  `docs/data/rankings.json` at runtime, falling back to the committed
  sample dataset.

- 2026-08-29 — **FantasyGuru connector built and the real board is live
  locally.** 377 rows, 0 rejections. Jeff Mans publishes his own tiers for
  QB/RB/WR/TE (K/DST untiered), which prompted **ADR-0003**: a source's own
  tiers outrank ours. `scripts/refresh.mjs --watch` rebuilds the board when a
  new export lands; the page polls every 45s.

- 2026-08-30 — **Guillotine board added** for an 18-team league (1QB/2RB/2WR/1TE/2FLEX + 6 bench).
  ADR-0004: it is a derived re-rank of the ranker's board, not a second ranking. Shifts are bye-week
  cover difficulty (per-position weights) plus human risk flags; SOS is displayed but never computed
  with, because the export's polarity is undocumented.

## Next

- Find the URL behind the Draft Guide's Download button so `refresh.mjs` can
  pull directly instead of watching the Downloads folder. Blocked on reading
  the page: Chrome's "Allow JavaScript from Apple Events" is off and the
  Claude in Chrome extension is not connected.
- Re-export from fantasyguru.com — the capture in hand is from 2026-08-08 and
  the season starts soon.
- Jeff's **overall** rankings export, so the guillotine board can be sequenced
  on his board rather than per-position. The single-table export has no overall
  column and the only overall ordering in the file is ADP.
- Merge PR #1 (platform enforcement reality) — it also carries the
  `.gitignore` anchor fix without which the sample board is untracked.

## Watch out for

- Never commit anything under `data/` or `docs/data/*.json` except the
  sample dataset. `git add -f` is the only way this fails, and it is the
  failure ADR-0001 exists to prevent.
- The Draft Guide publishes both rankings and projections. Verify which
  view a capture came from on the page itself.
- The Downloads folder holds an Excel *frameset* `.html` beside the real
  `.xls` export. `refresh.mjs` parses before it captures and refuses a file
  that yields no players — do not loosen that check.
