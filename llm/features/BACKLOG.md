# Backlog / Roadmap

Status: Active
Last updated: 2026-08-29

This file is the project roadmap
(`llm/governance/governance-delta.md` §Roadmap). Checkbox-only edits here
are L0-eligible; changing an item's text is semantic.

## Phase 0 — Foundation

- [x] Repository created and adopted onto agentic-governance v0.3
- [x] ADR-0001 public tooling / private source data
- [x] ADR-0002 rankings, not projections
- [x] Design authority document
- [x] GitHub Pages site skeleton with tiered board
- [x] Branch protection on `main` applied and reality recorded in the delta
- [ ] Governance checks green in CI

## Phase 1 — Ingestion

- [x] FantasyGuru Draft Guide connector (`llm/plans/2026-08-29-fantasyguru-ingestion.md`)
- [ ] Free consensus connector for the public sample dataset
- [x] Immutable timestamped raw capture for every source
- [x] Run report: rows in, rows rejected, format recorded

## Phase 2 — Identity

- [x] Canonical player ID scheme
- [ ] Alias table and resolver
- [x] Rejections retained with reasons and surfaced in the report
- [ ] Rookie / team-change disambiguation

## Phase 3 — Tiering

- [x] Source tiers take precedence over computed ones (ADR-0003)

- [x] Gap-based tier computation with per-position thresholds
- [ ] Cross-source disagreement narrows tier breaks (separation in units of spread)
- [x] Human override recorded alongside the computed value
- [ ] Clustering comparison (k-means / GMM) as an evaluation, not a default
- [ ] Source weighting ADR

## Phase 4 — The board

- [x] Live refresh: `scripts/refresh.mjs --watch` rebuilds on a new export; the page polls
- [x] Rank vs. ADP on every row — where the ranker sits against the draft room
- [ ] Direct pull from the source rather than watching for a manual download

- [x] Positional tier board, full PPR / 1QB / 12-team
- [ ] Additional formats (half-PPR, superflex)
- [x] Source and capture date visible on every row
- [ ] Print / one-page draft-day view
- [ ] Search and position filter

## Phase 5 — In season

- [ ] Weekly rankings axis
- [ ] Waiver-wire priority board
- [ ] Start/sit comparison
- [ ] Trade evaluation on ordinal terms (no point values)
- [ ] League platform integration ADR (Sleeper / ESPN / Yahoo)
