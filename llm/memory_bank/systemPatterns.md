# System Patterns

Last updated: 2026-08-29

## Pipeline shape

`capture → normalize → reconcile → tier → render`. Sport-agnostic; only
parsers, the position set, and the format schema are football-specific.

## Immutable capture

Every ingest writes a timestamped raw artifact before parsing. Captures are
never edited, only superseded. Everything downstream must be re-derivable
from a capture.

## Rejections are data

Unresolved players, missing formats, and parse failures are written with a
reason and surfaced in the run report. Nothing is silently skipped.

## Disagreement narrows a tier break

Tier breaks are measured as separation between mean ranks in units of
source disagreement. If the sources cannot agree which of two players goes
first, they are interchangeable and stay in one tier. A break survives only
where the sources agree there is a real step down.

## Computed, then overridden — never replaced

Tier breaks are proposed by the algorithm and accepted or overridden by a
human. The override is stored **alongside** the computed value so the
algorithm's error stays inspectable.

## Same code, different data

The published site and the owner's private board are one code path. The
only difference is whether `docs/data/rankings.json` is present. This is
what makes ADR-0001 enforceable rather than aspirational.

## Format travels with the row

Scoring format (PPR setting, QB count, league size) is a required field on
every rank, from capture to board. A rank without a format is a rejection,
never a default.
