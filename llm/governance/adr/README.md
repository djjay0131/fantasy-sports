# Architecture Decision Records

Durable decisions for this repository. An ADR *is* the decision, not a
report of one, so ADRs are control-plane content and live here under
`llm/governance/adr/`. A published ADR index may be generated into the
artifacts tree as a derived view.

Files are named `NNNN-short-title.md`, numbered from `0001`.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](0001-public-tooling-private-source-data.md) | Public tooling, private source data | Accepted |
| [0002](0002-rankings-not-projections.md) | Rankings, not projections | Accepted |
| [0003](0003-source-tiers-are-authoritative.md) | A source's own tiers are authoritative over ours | Accepted |
| [0004](0004-guillotine-is-a-derived-board.md) | The Guillotine board is a derived re-rank, not a second ranking | Accepted |

## Lifecycle

1. Proposed
2. Accepted
3. Superseded
4. Deprecated

Each row's Status cell must match the first word of the corresponding
file's `Status:` line; the `adr-index` check in the canonical
`plugin/scripts/governance-checks.mjs` enforces this.

Creating or modifying ADR *content* is L1. Flipping an ADR *status* to
record a decision already approved in a merged PR is L0, and must be
status-line-only in the constrained form
`Status: <Proposed|Accepted|Superseded|Deprecated> (via PR #n[, YYYY-MM-DD])`.

Use `0000-template.md` when drafting a new ADR. See agentic-governance
`llm/governance/architecture-governance.md` §ADR Process for the full policy.
