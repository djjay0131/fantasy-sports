# Progress

Last updated: 2026-08-29

## Works

- Repository scaffold, governance adoption (agentic-governance v0.3),
  ADR system, GitHub surface, CI wiring.
- Static board renders positional tiers from a JSON dataset with no build
  step; falls back to the committed sample when no private dataset is
  present.

## In flight

- FantasyGuru Draft Guide connector — plan written, not yet implemented.

## Not started

- Identity resolution, cross-source reconciliation, tier computation in
  code, additional formats, in-season features.

## Decisions recorded

| Date | Decision | Where |
|---|---|---|
| 2026-08-29 | Public tooling, private source data | ADR-0001 |
| 2026-08-29 | Rankings, not projections | ADR-0002 |
| 2026-08-29 | Adopted agentic-governance v0.3; steward INACTIVE | `llm/governance/governance-delta.md` |
| 2026-08-29 | Branch protection configured on `main`; `enforce_admins` deliberately off (single maintainer) | `llm/governance/governance-delta.md` §Platform Enforcement Reality |
