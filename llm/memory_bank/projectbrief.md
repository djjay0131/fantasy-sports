# Project Brief

Last updated: 2026-08-29

**fantasy-sports** is a rankings-and-tiers decision-support project for
fantasy football drafts and in-season roster moves.

- **Owner:** djjay0131
- **Repo:** https://github.com/djjay0131/fantasy-sports (public)
- **Site:** https://djjay0131.github.io/fantasy-sports/
- **Governance:** agentic-governance v0.3 — `llm/governance/governance-delta.md`
- **Design authority:** `llm/specs/2026-08-29-fantasy-sports-platform-design.md`

## The one-sentence version

Ingest rankings from several sources, resolve them onto canonical player
identities, compute positional tier breaks, and publish the method
publicly while keeping licensed source data private.

## Two decisions that shape everything

1. **ADR-0001** — the repo is public, the paid source data is not. The
   split is enforced by `.gitignore`, and the site reads its dataset at
   runtime so the public and private boards are the same code.
2. **ADR-0002** — rankings, not projections. Point estimates are discarded
   at the ingest boundary, not merely hidden.

## Default league profile

Full PPR, 1QB, 12-team.
