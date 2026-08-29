# Active Context

Last updated: 2026-08-29

## Now

Phase 0 → Phase 1. The repository is established, governed, and published;
the first source connector is next.

## Recently done

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

## Next

`llm/plans/2026-08-29-fantasyguru-ingestion.md` — capture the FantasyGuru
Draft Guide rankings (rankings views, **not** projections), starting with
the terms-of-service check in step 2.

## Watch out for

- Never commit anything under `data/` or `docs/data/*.json` except the
  sample dataset. `git add -f` is the only way this fails, and it is the
  failure ADR-0001 exists to prevent.
- The Draft Guide publishes both rankings and projections. Verify which
  view a capture came from on the page itself.
