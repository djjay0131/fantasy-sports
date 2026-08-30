# ADR-0003: A source's own tiers are authoritative over ours

Status: Accepted
Date: 2026-08-29

## Context

The project's first real source — Jeff Mans' Draft Guide export from
fantasyguru.com — turned out to publish **tiers of its own**, not just an
ordering. The export carries `Rank | Tier | Player | Team | Bye | ADP | SOS`,
and QB, RB, WR and TE all arrive pre-tiered by the ranker. K and DST do not.

This was not anticipated. The design doc assumed tiers would always be
derived here, from the rank distribution, and ADR-0002 makes tier breaks the
project's primary output. If the local algorithm runs unconditionally it
overwrites the expert's tiering with a statistical approximation of it — and
the board then shows a number the author never wrote, under his name.

The local algorithm was also built for a case that does not yet exist: it
measures separation in units of cross-source disagreement, and with one
source there is no disagreement to measure. It falls back to a raw-gap
heuristic, which is strictly less informed than the judgement of the person
who made the rankings.

## Decision

Tier precedence, highest first:

1. **A human override** recorded in this repo, which always records what it
   overrode (Principle 6).
2. **The source's own tiers**, where a single source supplies them for every
   player at that position. Carried through unchanged.
3. **Tiers computed here**, where the source publishes none (K, DST), or
   where several sources are being reconciled and no one of them is
   authoritative over the consensus.

The board **always states which of the three it is showing**, per position.
A computed tier is never presented as the author's.

Concretely: `tierPosition()` takes a `sourceTiersFrom` argument and derives
breaks from `source_tiers[source]` when every player at that position carries
one; `scripts/tier.mjs` passes it only when `sources.length === 1`. The
computed breaks are still calculated and still stored alongside, so the
algorithm remains inspectable and comparable against the expert's.

## Rationale

The subscription is bought for Mans' judgement. His tiers *are* that
judgement, expressed more precisely than his ordering alone: he is saying
"these five are the same player to me." Replacing that with a gap heuristic
discards the most valuable thing in the export and keeps the least.

Keeping the computed breaks alongside costs nothing and buys something real
— a standing comparison between what the algorithm would have said and what
the expert did say. That is the evidence needed to know whether the local
tiering is any good before it is ever trusted on its own.

The rule reverses cleanly under multiple sources. Once two rankers disagree,
neither one's tiering is authoritative over the reconciliation, the
separation formula has actual variance to work with, and computing is right
again.

## Alternatives Considered

### Alternative 1 — Always compute

Ignore source tiers; run the algorithm everywhere for consistency. Rejected:
it presents a derived approximation under the ranker's name and throws away
information the source explicitly provides.

### Alternative 2 — Show both, side by side

Render the source's tiers and ours as parallel columns. Rejected for the
draft-day board: two tier numbers per player is exactly the ambiguity a
cheat sheet exists to remove. The comparison belongs in analysis, and the
data to do it is retained.

### Alternative 3 — Compute, but seed from the source's tiers

Use the source tiers as a prior and let the algorithm adjust. Rejected as
unfalsifiable: with one source there is no signal to adjust *with*, so any
movement would be the heuristic's noise dressed as refinement.

## Consequences

### Positive

- The board shows the expert's tiers, which is what the subscription buys.
- Provenance is explicit per position; nothing computed masquerades as
  authored.
- The local algorithm still runs everywhere, so its output can be compared
  against a real expert's tiering before anyone relies on it.
- K and DST still get tiers, and are labelled as ours.

### Negative / Tradeoffs

- Tier semantics now vary by position within one board: QB-TE are Mans',
  K/DST are ours. The board must say so, every time, or it misleads.
- Two code paths to keep correct instead of one.
- A source that publishes *bad* tiers is now carried through faithfully.
  That is the intended behaviour — the fix is a human override, recorded.

### Risks

- **A partially-tiered position.** If a source tiers some players and not
  others, `breaksFromSourceTiers` returns null and the whole position falls
  back to computed. That is the safe direction, but it is silent; the board's
  provenance line is the only signal.
- **Precedence drift.** If a second source is added and the single-source
  condition is written loosely, one ranker's tiers could silently win over a
  consensus. The condition is `sources.length === 1` and should stay that
  explicit.

## Impacted Areas

- [x] Product
- [x] Domain model
- [x] Data architecture
- [x] UX
- [x] Implementation

## Related Documents

- `llm/governance/adr/0002-rankings-not-projections.md`
- `llm/specs/2026-08-29-fantasy-sports-platform-design.md` §Tier
- `src/fantasy/tiering.mjs`, `scripts/tier.mjs`, `src/fantasy/sources/fantasyguru.mjs`

## Related Issues / PRs

- FantasyGuru connector (2026-08-29)

## Supersedes

None. Refines ADR-0002.

## Superseded By

None.
