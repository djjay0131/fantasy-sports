# ADR-0004: The Guillotine board is a derived re-rank, not a second ranking

Status: Accepted
Date: 2026-08-30

## Context

A guillotine league is a survival contest, not a scoring contest. The
lowest-scoring team each week is eliminated and its whole roster returns to
FAAB waivers; there are no playoffs. Three consequences follow, and all three
sources consulted (Fantasy Life, DraftSharks, RotoWire) agree on them:

1. Points must arrive **early**. A player who breaks out in Week 10 is worth
   nothing to a team eliminated in Week 3.
2. **Floor beats ceiling.** You are avoiding a last-place week, not chasing a
   first-place one.
3. **Bye weeks are the format's distinctive risk.** In this league — 18 teams,
   14 roster spots — about 252 players are rostered on draft day, so a Week-5
   bye is covered from an essentially empty waiver pool. Each elimination
   returns a full roster, so by Week 13 roughly a dozen rosters have come back
   and cover is easy.

That creates an obvious temptation: build a second set of rankings for this
format. Doing so would mean inventing floor, consistency, and injury-risk
scores that have no source — precisely what ADR-0002 forbids — and would
discard the ranker's judgement, which ADR-0003 says outranks ours.

## Decision

The Guillotine board is a **derived re-rank of the ranker's board**, not a
ranking of its own. Specifically:

1. **Ordering** starts from the ranker's positional order and is shifted by a
   small number of explicit terms, each expressed in **rank slots** so it is
   legible:
   - **Bye-week cover difficulty** — a per-position weight, applied in full at
     the earliest bye in the data and decaying linearly to zero at the latest.
     Weights are ordered by how hard a position is to replace from waivers in
     an 18-team league (TE 8, RB 8, WR 5, QB 5, K/DST 3), not by how valuable
     the position is.
   - **Human risk flags** in `data/processed/guillotine-flags.json`, each with
     a penalty and a note, both displayed on the board.
2. **Tiers preserve the ranker's tier SIZES; membership follows the adjusted
   order.** His tiers encode "these five are the same player to me" — a
   judgement worth keeping. Which five belong there is what the format
   changes.
3. **Every row shows its own work**: the ranker's original rank and the move
   against it. A re-rank you cannot audit is an assertion.
4. **SOS is displayed and never computed with.** The export carries a 2–10 SOS
   value whose polarity is documented nowhere we can verify. A sign error
   would silently invert the adjustment for every player, and a wrong number
   confidently applied is worse than a missing one.
5. **No invented risk model.** This pipeline has no injury or snap-count feed,
   and will not synthesize one. The board says so where a risk column would
   otherwise sit.

The board also tracks the drafter's own roster and its bye distribution,
because bye stacking is the failure this format punishes and it is invisible
on a conventional board.

## Rationale

The adjustment terms were chosen by one test: *is this something the data
actually contains, or something we would be making up?* Bye week is in the
export and is the factor every source names. Injury risk is not in the export
and is left to a human. Floor and consistency are not in the export and are
not modelled at all — the ranker's ordering already embeds his read on them.

Expressing shifts in rank slots rather than a hidden score keeps the whole
model arguable. A reader can see that Jonathan Taylor moved six slots and why,
and disagree with the weight rather than with an opaque number.

Preserving tier sizes rather than recomputing them is the same instinct as
ADR-0003 one level up: keep the part that is the expert's judgement, change
only the part the format changes.

## Alternatives Considered

### Alternative 1 — A separate guillotine ranking

Rank players for this format from scratch. Rejected: it needs floor and risk
inputs that do not exist here, and it would compete with the ranker's
judgement rather than adapt it.

### Alternative 2 — Adjust with SOS as well as bye

Weight early-season strength of schedule, which RotoWire names as a factor.
Rejected **for now**: the export's SOS polarity is unverified. If a future
capture documents it, this becomes a real candidate — and it should arrive as
its own ADR, not a quiet addition.

### Alternative 3 — Recompute tiers from the adjusted order

Run the local gap-based tiering on the adjusted ranks. Rejected: adjusted
ranks are near-uniformly spaced by construction, so the gaps carry almost no
signal and the resulting tiers would be noise wearing the shape of analysis.

## Consequences

### Positive

- The board adapts the ranker's work rather than competing with it.
- The single largest format-specific risk is modelled from real data, and the
  model is visible on every row.
- Bye stacking — the thing that actually eliminates people — is surfaced live
  as the drafter picks.
- The adjustment is one config object, so the weights can be argued with and
  changed in one place.

### Negative / Tradeoffs

- The bye weights are a judgement call, not a measurement. They are documented
  as such, but they are the model's softest part.
- Real guillotine factors the board does **not** capture: injury risk,
  snap-count ramps, early-season schedule, and floor-vs-ceiling variance. The
  strategy panel names them so the drafter applies them by hand.
- A second board to keep in step with the first.

### Risks

- **The weights get mistaken for evidence.** Mitigated by stating the policy
  in the module, the ADR, and the page legend.
- **Bye adjustment double-counts against a ranker who already accounted for
  byes.** Unknown whether he does; the move column makes the effect visible,
  which is the best available check.
- **League-size drift.** The weights were reasoned for an 18-team league.
  `--teams` changes the label but not the weights; a materially smaller league
  should revisit them.

## Impacted Areas

- [x] Product
- [x] Domain model
- [x] UX
- [x] Implementation
- [x] Documentation

## Related Documents

- `llm/governance/adr/0002-rankings-not-projections.md`
- `llm/governance/adr/0003-source-tiers-are-authoritative.md`
- `src/fantasy/guillotine.mjs`, `scripts/guillotine.mjs`
- `docs/cheatsheets/guillotine.html`

## Related Issues / PRs

- Guillotine cheat sheet (2026-08-30)

## Supersedes

None.

## Superseded By

None.
