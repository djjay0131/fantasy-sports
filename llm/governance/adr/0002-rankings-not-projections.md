# ADR-0002: Rankings, not projections

Status: Accepted
Date: 2026-08-29

## Context

Fantasy football data sources publish two different things that are easy to
conflate: **projections** (an estimate of points a player will score) and
**rankings** (an ordering of players against each other). Most sites
publish both, and many derive one from the other.

Projections carry a precision they do not have. A projection of 214.6
points invites arithmetic — differences, sums, replacement-level math — on
a number whose real uncertainty band is tens of points wide. Draft rooms
then act on differences that are noise.

The decision a drafter actually makes is ordinal and comparative: *given
what is on the board, who do I take, and can I wait?* That question is
answered by an ordering and by the gaps in it, not by a point estimate.

## Decision

The canonical unit of data in this project is an **ordinal rank within a
position, for a stated scoring format**, plus the **tier breaks** computed
from the rank distribution.

1. Ingest rankings where a source publishes them.
2. Where a source publishes only projections, convert to a within-position
   rank at ingest time and **discard the projected value**. It is not
   stored in `data/processed/` and never reaches the board.
3. Never render a point estimate on the board, and never compute one.
4. Every rank carries its scoring format (PPR setting, QB count, league
   size) and its capture date. A rank without a format is meaningless and
   is a rejection, not a default.

## Rationale

Discarding the projection rather than merely hiding it is the point. A
projection kept "for reference" gets used: it leaks into tie-breaks, into
value-over-replacement calculations, and into the UI as soon as someone
wants one more column. Removing it at the ingest boundary makes the
principle structural instead of a matter of discipline.

Tiers are where the ordinal view earns its keep. The gap between RB8 and
RB9 may be nothing and the gap between RB12 and RB13 may be a cliff; the
ordering alone does not say which, and a projection says it with false
precision. Computing breaks from the distribution of ranks across sources
answers "is there another player like this one still available?" — which is
the real draft-day question.

## Alternatives Considered

### Alternative 1 — Store projections, display ranks

Keep projected points in the data layer for tie-breaking and
value-over-replacement, but never show them. Rejected: the number's
presence guarantees its eventual use, and its uncertainty is not carried
alongside it. This is the failure mode the decision exists to prevent.

### Alternative 2 — Projections as the primary unit

Ingest and publish projections, deriving ranks from them. Rejected: it
inherits every source's scoring assumptions, makes cross-source
reconciliation a units problem, and presents noise as signal.

## Consequences

### Positive

- Cross-source reconciliation is a rank-aggregation problem, which is well
  understood and format-independent once format is fixed.
- No false precision reaches the board.
- Tier breaks become the primary output, which matches how drafts are
  actually run.

### Negative / Tradeoffs

- Value-over-replacement and auction dollar values are out of reach without
  reintroducing a point scale. Accepted: they are out of scope.
- Some sources' ranking pages are harder to parse than their projection
  tables. Accepted cost.
- Information is genuinely lost at ingest — a source's view of *how much*
  better a player is survives only as a tier break.

### Risks

- **Format drift.** A rank stored without its format is silently wrong.
  Mitigated by making format a required field and a rejection reason.
- **Pressure to add a points column.** Mitigated by the delta's second
  domain review question.

## Impacted Areas

- [x] Product
- [x] Domain model
- [x] Data architecture
- [x] UX
- [x] Implementation

## Related Documents

- `llm/governance/governance-delta.md` §Project Principles 1, 6
- `llm/specs/2026-08-29-fantasy-sports-platform-design.md`

## Related Issues / PRs

- Initial repository establishment (2026-08-29)

## Supersedes

None.

## Superseded By

None.
