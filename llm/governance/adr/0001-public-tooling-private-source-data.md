# ADR-0001: Public tooling, private source data

Status: Accepted
Date: 2026-08-29

## Context

This repository is public, and that is deliberate: the ingestion pipeline,
the identity resolution, the tiering method, and the board itself are
research the owner intends to share.

The primary rankings source for the 2026 season is Jeff Mans' Draft Guide
at fantasyguru.com — a paid subscriber product. The owner holds a personal
subscription. A personal subscription licenses one subscriber to *use* the
rankings; it does not license republication. Committing those rankings to a
public repository, or rendering them on a public GitHub Pages site, would
redistribute another party's paid product to everyone. The same applies to
any comparable paid service added later.

Rankings are also, individually, close to facts — but a curated, ordered
board is the expressive product being sold, and the subscriber terms, not
the copyrightability of a single row, are what bind here.

The project therefore has to satisfy two requirements at once: the research
is public, and the source data is not.

## Decision

Split the repository along the licence boundary rather than along the code
/ data boundary.

1. **Public plane.** Everything that is the project's own work: ingestion
   and normalization code, the identity resolver, the tiering algorithm,
   the site, the methodology, the governance. Committed and published.
2. **Private plane.** Everything derived from a paid source: raw captures
   (`data/raw/`), normalized rows (`data/processed/`), and the rendered
   board dataset (`docs/data/rankings.json`). Git-ignored, never committed,
   never published.
3. **The site reads its data at runtime.** The published board is a static
   page that fetches `./data/rankings.json`. On the public site that file
   is absent and the page falls back to
   `docs/data/rankings.sample.json` — a small dataset built from freely
   available consensus rankings, labelled as such. Run the same site
   locally with your own `rankings.json` in place and it renders your real
   board. The public artifact and the private artifact are the same code
   with different data.
4. **One committed dataset.** `docs/data/rankings.sample.json` is the only
   ranking data in the repository, and its provenance is recorded in the
   file and on the page.

## Rationale

The split is enforceable rather than aspirational. `.gitignore` covers the
whole `data/` tree and `docs/data/*.json` with a single sample-file
exception, so the failure mode requires a deliberate `git add -f`. The
review question in the governance delta puts that in front of a human on
every PR that touches ingestion, `.gitignore`, or `docs/data/`.

It also preserves the thing that made the project worth doing publicly. The
interesting content is not Jeff Mans' ordering — it is the method: how
sources are reconciled onto a canonical identity, where tier breaks are
computed, how disagreement between sources is surfaced. All of that ships.

Attribution alone was rejected because attribution is not a licence.
Crediting the source does not make republication permitted, and a repo that
gets a takedown takes the research down with it.

## Alternatives Considered

### Alternative 1 — Private repository

Keep everything private and publish nothing. Satisfies the licence
trivially, but abandons the stated goal of sharing the research, and gives
up the review and citation value of a public repo.

### Alternative 2 — Publish everything with attribution

Publish the FantasyGuru-derived board publicly with prominent credit.
Rejected: attribution does not convert a subscriber licence into a
redistribution licence. Exposes the repository to a takedown that would
remove the tooling along with the data, and misrepresents what the
subscription permits.

### Alternative 3 — Public site fed only from free sources

Build the public board exclusively from freely available consensus
rankings, and never wire the paid source in at all. Clean, but it makes the
paid source useless to the project, which is the reverse of why the
subscription exists. Adopted *partially*: the free consensus set is the
sample dataset, not the only dataset.

## Consequences

### Positive

- The research, the method, and the tooling are public and citable.
- The subscriber licence is respected without a lawyer in the loop.
- The public and private boards are the same code path, so the published
  site is a real demonstration of the tool rather than a mock-up.
- The enforcement lives in `.gitignore` and CI-adjacent review, not in
  anyone's memory.

### Negative / Tradeoffs

- A reader of the public site sees the sample board, not the owner's real
  board. The site has to say so clearly or it misleads.
- Two datasets to keep schema-compatible.
- The owner's real board is not backed up by this repository, and needs its
  own backup story.

### Risks

- **A future contributor commits real data.** Mitigated by `.gitignore`,
  the `licensed-data` label, and the delta's first domain review question.
  Residual risk: a `git add -f` by an agent that has not read `CLAUDE.md`.
- **Scope creep in the sample dataset.** If the sample grows to mirror the
  paid board row-for-row it becomes the same violation by another name. The
  sample is capped at a top-N consensus set and cites its source.
- **Terms change.** The subscriber terms are read at ingest time, not
  once. A term change that forbids automated access ends the connector.

## Impacted Areas

- [x] Product
- [x] Data architecture
- [x] Integrations
- [x] Security/privacy
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/governance/governance-delta.md` §Project Principles 3, §Domain Review Questions
- `llm/specs/2026-08-29-fantasy-sports-platform-design.md`
- `CLAUDE.md` §Licensed source data never enters the public plane
- `.gitignore`

## Related Issues / PRs

- Initial repository establishment (2026-08-29)

## Supersedes

None.

## Superseded By

None.
