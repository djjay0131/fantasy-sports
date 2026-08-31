# Governance Delta: fantasy-sports

Status: Active
Last updated: 2026-08-29
Governance: agentic-governance v0.3

This file localizes the canonical governance in
[`agentic-governance`](https://github.com/djjay0131/agentic-governance) for
this project. Canonical docs defer to this file wherever project specifics
are needed. Keep it short — durable design content belongs in the
design-authority document and ADRs, not here. This file declares project
facts, never policy; changing it is semantic (L1) and it is permanently
deny-listed from the L0 fast track.

## Mission

fantasy-sports is a rankings-and-tiers decision-support project for fantasy
football drafts and in-season roster moves. It ingests rankings from
multiple sources, normalizes them onto a canonical player identity,
computes positional tiers from the ranking distribution, and publishes the
tooling and methodology as a public site. It is **not** a projection
engine, not a league-management application, and not a redistribution
channel for anyone else's paid product.

## Design-Authority Document

`llm/specs/2026-08-29-fantasy-sports-platform-design.md`

## Project Principles

1. **Rankings, not projections.** The unit of output is an ordinal board
   and its tier breaks. Points-scored estimates are out of scope; where a
   source only publishes projections, they are converted to a rank and the
   projection is discarded.
2. **Never lose raw source data.** Every ingest writes an immutable,
   timestamped raw capture before any parsing. Normalization is always
   re-derivable from the raw capture.
3. **Licensed data never enters the public plane.** Data obtained under a
   personal subscription stays under the git-ignored `data/` and
   `docs/data/` paths. Enforced by `.gitignore` and reviewed on every PR.
   See ADR-0001.
4. **Canonical player identity at every write boundary.** Every ingested
   row resolves to a canonical player ID before it is stored; unresolved
   rows are retained as rejections, not dropped.
5. **Rejections are data.** Unmatched players, format mismatches, and
   parse failures are recorded and surfaced, never silently skipped.
6. **Tier boundaries are computed, then reviewed.** The algorithm proposes
   breaks; a human accepts or overrides them, and the override is recorded
   alongside the computed value.
7. **The site is a derived view.** Nothing in `docs/` is a source of
   truth; every published page names the `llm/` document or dataset it
   projects.

## Domain Review Questions

- Does this change publish, or make it possible to publish, data obtained
  under a personal subscription? (ADR-0001)
- Does this introduce a projection where a rank belongs? (Principle 1)
- Does every ingested row resolve to a canonical player ID, and are
  unresolved rows retained as rejections? (Principles 4, 5)
- Does the tiering change alter tier boundaries without recording the
  computed value it overrode? (Principle 6)
- Is the scoring format (PPR setting, QB count, league size) explicit
  everywhere this data is read or rendered?
- Is the source and capture date of every ranking visible to a reader of
  the board?

## Repository Layout

The paths this repo binds. The canon prescribes the shape
(agentic-governance `llm/governance/project-operating-system.md`
§Repository Areas); this block binds it here, so nothing downstream
hardcodes a path. Declare only the slots this repo uses — an absent slot
is not a violation, an undeclared path is.

- Governance directory: `llm/governance/`
- ADR directory: `llm/governance/adr/`
- Spec directory: `llm/specs/`
- Plans directory: `llm/plans/`
- Features directory: `llm/features/`
- Memory-bank path: `llm/memory_bank/`
- Artifacts directory (the data plane): `docs/`

This repo declares no constitution directory: the executive role charters
are the canonical ones in agentic-governance `llm/constitution/`, adopted
without adjustment (see §Constitution Adjustments).

## Roadmap

Path: `llm/features/BACKLOG.md`

## Governance Check Command

`node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout`

In CI the canonical repo is checked out alongside this one and the same
script is invoked from this repo's root
(`.github/workflows/ci.yml`).

## L0 Path Allowlist

The fenced block below is an instance of the canonical rule set in
agentic-governance `llm/governance/l0-fast-track.md` §Template Allowlist,
which also defines the block grammar and the diff shapes. The check
command parses **this** block and reads it from `origin/main`, never from
a PR's tree.

```l0-allowlist
# Instance of agentic-governance `llm/governance/l0-fast-track.md`
# §Template Allowlist — the source of this rule set and its grammar.
allow llm/memory_bank/** path-only
allow llm/governance/adr/README.md index-table-rows
allow llm/governance/adr/[0-9][0-9][0-9][0-9]-*.md status-line-only
allow llm/features/BACKLOG.md checkbox-only
allow llm/** link-target-only
allow docs/** link-target-only
deny src/**
deny scripts/**
deny .github/**
deny llm/governance/governance-delta.md
deny llm/governance/adr/0000-template.md
```

## Platform Enforcement Reality

Verified 2026-08-29 against `github.com/djjay0131/fantasy-sports` via
`gh api repos/djjay0131/fantasy-sports/branches/main/protection`. The repo is
public, so the protection API is available on the free plan — unlike the
private repos in this portfolio, where a 403 makes protection unavailable.

- **Branch protection on `main`: AVAILABLE and CONFIGURED.** Pull requests
  required; 1 approving review; stale reviews dismissed on new pushes;
  conversation resolution required; force pushes and branch deletion
  disabled; `strict` (branch must be up to date before merging).
- **Required status checks: AVAILABLE and CONFIGURED** — `governance-checks`,
  `licensed-data-guard`, and `tests`, all from `.github/workflows/ci.yml`.
- **`enforce_admins`: DISABLED.** The owner can bypass every rule above.
  This is honest rather than aspirational: the owner is the only
  maintainer, and an admin lockout with no second human is an outage, not a
  control. It also means the protection above constrains agents and
  contributors, not the owner.
- Token/identity model: all agent sessions authenticate with the owner's
  token. Steward, auditor, and architect are **procedural roles, not
  distinct identities** — nothing at the platform layer distinguishes an
  agent commit from the owner's. This is the binding constraint on any
  future fast-track activation, not branch protection.
- Hardening path: a dedicated machine account for the steward, plus
  `enforce_admins` once a second human reviewer exists, would convert the
  remaining convention into enforcement. Neither is pursued while the
  steward is INACTIVE.

## Steward Activation Status

Status: INACTIVE

Steward merge authority ships inert (agentic-governance
`llm/governance/l0-fast-track.md` §Per-Repo Activation). To activate:

- Activation ADR: none — required
- Activation PR: none — required, human-approved and human-merged

## Milestone Labels

- `phase-0-foundation` — repo, governance, site skeleton
- `phase-1-ingestion` — source connectors and raw capture
- `phase-2-identity` — canonical player identity and rejections
- `phase-3-tiering` — tier computation and human override
- `phase-4-board` — the published cheat-sheet board
- `phase-5-in-season` — waivers, starts/sits, trade evaluation

## Special Labels

- `source-connector` — work on a specific rankings source
- `licensed-data` — touches data obtained under a personal subscription;
  requires the ADR-0001 review question to be answered explicitly

## Constitution Adjustments

None. The canonical executive charters in agentic-governance
`llm/constitution/` apply unmodified.

## Related Repos

- [`agentic-governance`](https://github.com/djjay0131/agentic-governance) —
  canonical governance; authority flows from it to this delta.
- `baseball-ai` — sibling sport-analytics project; no authority relationship,
  but ingestion and identity patterns are shared by convention.
