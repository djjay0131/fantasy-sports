# fantasy-sports

Status: Active
Last updated: 2026-09-10

Research, data tooling, and draft-day decision support for fantasy football.
Rankings-first: this project ranks and **tiers** players, it does not publish
point projections.

Governance: [agentic-governance](https://github.com/djjay0131/agentic-governance)
v0.5 — project specifics in
[`llm/governance/governance-delta.md`](llm/governance/governance-delta.md).

## What is here

| Path | Purpose |
|---|---|
| `llm/` | Control plane — governance, ADRs, design specs, plans, backlog, memory bank |
| `docs/` | Data plane — the published GitHub Pages site and derived views |
| `src/fantasy/` | Ingestion, normalization, and tiering library |
| `scripts/` | Runnable entry points (ingest, normalize, tier, render) |
| `data/` | Local working data — **git-ignored, never published** |
| `tests/` | Test suite |

## The two-copy rule

Source rankings from a paid subscriber product (FantasyGuru's Draft Guide,
and any comparable service) are **licensed to one subscriber, not to the
internet**. This repository is public; that data is not.

- Raw scrapes and any tier set derived from a paid source land under
  `data/` and `docs/data/`, both git-ignored.
- The published site ships the **tooling, methodology, and tier structure**,
  plus a sample dataset built from freely available consensus rankings.
- Point the local site at your own `docs/data/rankings.json` and it renders
  your real board in the browser. Nothing leaves your machine.

See [`llm/governance/adr/0001-public-tooling-private-source-data.md`](llm/governance/adr/0001-public-tooling-private-source-data.md).

## Quick start

```bash
git clone https://github.com/djjay0131/fantasy-sports.git
cd fantasy-sports
node scripts/tier.mjs --in data/processed/rankings.json --out docs/data/rankings.json
python3 -m http.server -d docs 8080   # then open http://localhost:8080
```

## The board

Rankings, not projections. Every position is cut into tiers at the natural
gaps in the ranking distribution, because the only draft-day question that
matters is *"is there another player like this one still on the board?"* —
not *"how many points will he score?"* Tier boundaries are computed, then
reviewed by a human; the method is documented on the site and in
[`llm/specs/2026-08-29-fantasy-sports-platform-design.md`](llm/specs/2026-08-29-fantasy-sports-platform-design.md).

Default league profile: **full PPR, 1QB, 12-team**.

### Guillotine

A guillotine league chops the lowest-scoring team every week and has no
playoffs, so the board is re-ranked for survival: `scripts/guillotine.mjs`
shifts the ranker's ordering by bye-week cover difficulty (in an 18-team
league, an early bye is covered from an empty waiver pool and a late one from
a dozen eliminated rosters) plus any human risk flags, keeps his tier *sizes*,
and shows the move against his board on every row. It is a derived view, never
a second set of rankings — see
[`llm/governance/adr/0004-guillotine-is-a-derived-board.md`](llm/governance/adr/0004-guillotine-is-a-derived-board.md).

```bash
node scripts/refresh.mjs && node scripts/guillotine.mjs --teams 18
```

## Site

https://djjay0131.github.io/fantasy-sports/
