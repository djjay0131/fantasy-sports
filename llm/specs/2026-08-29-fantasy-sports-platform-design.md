# Design Doc: fantasy-sports platform

Status: Accepted
Date: 2026-08-29
Owner: djjay0131

This document is the **design authority** for this repository
(`llm/governance/governance-delta.md` §Design-Authority Document). Code and
plans defer to it; it defers only to the ADRs it cites and to canonical
governance.

## Purpose

Define the data model, pipeline, and published surface for a
rankings-and-tiers fantasy football decision-support system that is public
in its method and private in its licensed source data.

## Scope

- Ingesting rankings from multiple sources, including one paid subscriber
  source.
- Resolving every ingested row onto a canonical player identity.
- Aggregating ranks across sources for a stated scoring format.
- Computing positional tier breaks and supporting human override.
- Publishing a static, self-contained board (cheat sheet) as a GitHub Pages
  site.

## Out of Scope

- Point projections of any kind (ADR-0002).
- Auction values and value-over-replacement, which require a point scale.
- League management, roster syncing, or platform integrations (Sleeper,
  ESPN, Yahoo) — deferred to a later phase, not designed here.
- Live in-draft state tracking. Phase 5 candidate.

## Background

The 2026 draft board is being built primarily from Jeff Mans' Draft Guide
at fantasyguru.com, a paid subscriber product, supplemented by freely
available consensus rankings. The owner wants the research public; the
subscriber licence does not permit republishing the source board. ADR-0001
settles that tension by splitting on the licence boundary rather than the
code/data boundary.

## Proposed Design

### Four stages

```
capture  →  normalize  →  reconcile  →  tier  →  render
(raw)       (rows)        (consensus)   (breaks)  (board)
```

**1. Capture.** Each source has a connector that writes an immutable,
timestamped artifact to `data/raw/<source>/<YYYY-MM-DD>T<HH-MM-SS>.<ext>`
before anything is parsed. The capture is the evidentiary record: every
downstream artifact must be re-derivable from it (Principle 2). Captures
are never edited, only superseded.

**2. Normalize.** A parser turns one capture into rows of the canonical
shape:

```json
{
  "source": "fantasyguru",
  "captured_at": "2026-08-29T14:02:11Z",
  "format": { "ppr": 1.0, "qb": 1, "teams": 12 },
  "position": "RB",
  "player": { "id": "bijan-robinson-2023-atl", "name": "Bijan Robinson", "team": "ATL" },
  "rank_overall": 3,
  "rank_position": 1
}
```

`format` is required. A row without one is a rejection, not a default
(ADR-0002). Where a source publishes only projections, the parser sorts,
assigns `rank_position`, and **discards the projected value** — it is never
written.

**3. Reconcile.** Rows from all sources for one format are resolved onto a
canonical player identity and aggregated. Identity resolution is the part
that actually breaks in practice — name variants, suffixes, rookies with no
prior-season row, players who changed teams — so it is explicit rather than
incidental:

- A resolver maps `(name, team, position)` to a canonical ID via an
  alias table in `src/fantasy/identity/`.
- Unresolved rows are written to a rejections file with the reason. They
  are **retained, never dropped** (Principle 5), and surfaced in the run
  report so the alias table can be extended.
- Aggregation across sources is by average rank, with per-source rank and
  the spread retained so disagreement is visible rather than averaged away.

**4. Tier.** Within a position, tier breaks are computed from the
consensus rank sequence. The method is a gap-based cut: walk the ordered
list and open a new tier where adjacent players are **separated** by more
than the position's own distribution says is noise.

Separation is the gap between two players' mean ranks measured in units of
how much the sources disagree about them:

```
separation(i) = (mean[i+1] - mean[i]) / sqrt((sd[i]^2 + sd[i+1]^2) / 2 + eps)
```

Cross-source disagreement therefore *narrows* a break, which is the right
direction: if the sources cannot agree which of two players goes first,
they are interchangeable and belong in the same tier. A break survives only
where the sources agree there is a real step down.

The threshold is per-position, derived from that position's own separation
distribution (median + k x MAD), not a global constant — the shape of the RB
curve is nothing like the shape of the QB curve. With a single source
(sd = 0 everywhere) the formula degenerates, so the fallback is the raw gap
normalized by the position's median gap; the board labels that case
"single source" rather than "consensus".

A human reviews the proposed breaks. An override is recorded **alongside**
the computed value, never replacing it (Principle 6), so the algorithm's
error is inspectable:

```json
{ "position": "RB", "computed_breaks": [5, 12, 18], "accepted_breaks": [5, 14, 18], "note": "RB13 gap is a bye-week artifact" }
```

**5. Render.** The tiered board is written to `docs/data/rankings.json` and
read at runtime by a static page in `docs/`. No build step, no framework, no
server. The page is the same code whether it is showing the sample dataset
or the owner's real board — the only difference is which file is present
(ADR-0001).

### The two planes

`llm/` is control plane, `docs/` is data plane, per canonical
`llm/governance/project-operating-system.md` §Repository Areas. The
published site is a derived view and lives in `docs/`; every page names the
`llm/` document or dataset it projects.

`data/` is neither plane: it is git-ignored working state, and its contents
never reach the repository.

## Alternatives Considered

### Alternative 1 — Database-backed pipeline

Postgres or SQLite behind the pipeline, with the site querying an API.
Rejected for this phase: it adds a server to a problem that is a few
thousand rows refreshed a few times a week, and a static site is the
artifact that is easiest to publish, cache, and hand to someone else. A
database becomes justified at phase 5 (in-season, weekly, multi-league).

### Alternative 2 — Tiering by clustering (k-means / Gaussian mixture)

Fit a clustering model to the rank or score distribution. Rejected as the
default: it requires choosing k, is unstable at the top of a position where
the interesting decisions are, and produces breaks that are hard to explain
to the human doing the override. The gap-based cut is inspectable — the
reason for every break is a number you can point at. Clustering stays on
the table as a comparison method in phase 3.

### Alternative 3 — Render on the server, publish HTML

Generate the board as static HTML at build time rather than fetching JSON.
Rejected: it collapses ADR-0001's "same code, different data" property. A
prerendered public page would either contain the licensed data or require a
separate build path, and the divergence is exactly the risk being managed.

## Tradeoffs

- **No build step** keeps the site trivially publishable and reviewable,
  but caps interactivity at what vanilla JS can do. Accepted.
- **Rank-only** loses magnitude information (ADR-0002). Tier breaks are the
  compensation, and they are deliberately coarser than a point estimate.
- **Average-rank aggregation** is simple and robust but treats all sources
  as equal. Source weighting is a phase-3 candidate, gated on having enough
  history to justify weights rather than guessing them.

## Data / Evidence Implications

- Raw captures are immutable and timestamped; nothing downstream is
  authoritative over them.
- Every published number traces to a capture: source, capture date, and
  format travel with the row all the way to the board.
- Rejections are a first-class output with their own file and their own
  place in the run report.
- Retention: captures are kept for the season; there is no deletion path
  that removes a capture a published board depends on.

## AI Implications

- Identity resolution is the natural place for a model-assisted step
  (fuzzy name matching, rookie disambiguation), but it must propose into
  the alias table for human acceptance, never write a canonical ID
  directly.
- Any agent working in this repo is bound by `CLAUDE.md`, including the
  licensed-data rule. An agent that commits `data/` output is a governance
  failure, not a bug.

## Multi-Sport Implications

The capture → normalize → reconcile → tier → render shape is
sport-agnostic; only the parsers, the position set, and the format schema
are football-specific. `src/fantasy/` is structured so a second sport adds
connectors and a position config, not a second pipeline. The sibling
`baseball-ai` project shares the pattern by convention, not by dependency.

## Security / Privacy Implications

- No credentials are stored in the repository. The FantasyGuru connector
  operates against an already-authenticated browser session driven by the
  owner; it never handles a password and never persists a cookie to disk.
- `.env` and `*.har` are git-ignored — a HAR capture of an authenticated
  session contains session tokens as well as licensed data.
- The published site collects nothing, sets no cookies, and loads no
  third-party scripts.

## Open Questions

1. How often should the board refresh during draft season — per-day, or
   only on a source update? (Affects capture volume and the rejection
   review burden.)
2. Should tier breaks be recomputed per format, or computed once on a
   reference format and reused? Recomputing is more correct; reusing is
   more stable across formats.
3. What is the minimum source count before average-rank aggregation is
   more trustworthy than a single trusted source? Below that count the
   board should probably say "single source" rather than "consensus".
4. Where does in-season data live — same pipeline with a weekly format, or
   a separate axis?

## ADR Candidates

- Source weighting in rank aggregation (deferred to phase 3).
- Whether to add a database at phase 5.
- Sleeper/ESPN/Yahoo league integration and what it implies for identity.

## Related Documents

- `llm/governance/adr/0001-public-tooling-private-source-data.md`
- `llm/governance/adr/0002-rankings-not-projections.md`
- `llm/governance/governance-delta.md`
- `llm/plans/2026-08-29-fantasyguru-ingestion.md`
