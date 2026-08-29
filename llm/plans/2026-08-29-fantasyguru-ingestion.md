# Plan: FantasyGuru Draft Guide ingestion

Status: In progress
Date: 2026-08-29
Design authority: `llm/specs/2026-08-29-fantasy-sports-platform-design.md`
Governance level: L2 (implementation)

## Goal

Capture Jeff Mans' Draft Guide rankings from fantasyguru.com for the 2026
season (full PPR, 1QB, 12-team), normalize them onto canonical player
identities, compute positional tiers, and render the board locally — with
nothing licensed reaching the public repository (ADR-0001).

## Preconditions

- Owner holds an active fantasyguru.com subscription and is signed in in
  their own Chrome.
- `.gitignore` covers `data/` and `docs/data/*.json` before any capture is
  taken. **This step is first and is not optional.**

## Steps

- [ ] 1. Verify `.gitignore` blocks `data/` and `docs/data/rankings.json`;
      confirm with `git check-ignore -v` on a probe path.
- [ ] 2. Read fantasyguru.com's terms of service for the subscriber
      account. Record what they say about automated access in
      `data/raw/fantasyguru/TERMS-NOTES.md` (git-ignored). If automated
      access is forbidden, stop and switch to a manual-export path.
- [ ] 3. Locate the Draft Guide's **rankings** views — one per position —
      distinguishing them from the projections views. Record the URLs.
- [ ] 4. Capture each position's rankings page to
      `data/raw/fantasyguru/<YYYY-MM-DD>T<HH-MM-SS>-<pos>.html` (or the
      underlying JSON payload where the page fetches one). Immutable;
      never edited.
- [ ] 5. Write `src/fantasy/sources/fantasyguru.mjs` — parse a capture into
      canonical rows. Required fields per ADR-0002: `format`,
      `position`, `rank_position`. Discard any projected point value.
- [ ] 6. Write `src/fantasy/identity/` — alias table plus resolver.
      Seed it from the capture; every unresolved row goes to
      `data/processed/rejections.json` with a reason.
- [ ] 7. Write `scripts/ingest.mjs` — capture path in, normalized rows and
      a run report out. The report states row count, rejection count, and
      the format it recorded.
- [ ] 8. Write `src/fantasy/tiering.mjs` — gap-based positional tier
      breaks per the design doc, with per-position thresholds derived from
      that position's own distribution.
- [ ] 9. Write `scripts/tier.mjs` — normalized rows in,
      `docs/data/rankings.json` out, including `computed_breaks` and an
      empty `accepted_breaks` for human override.
- [ ] 10. Review the computed breaks by position; record any override
      alongside the computed value (Principle 6).
- [ ] 11. Serve `docs/` locally and confirm the board renders the real
      board with correct tiers, source, and capture date.
- [ ] 12. Confirm `git status` shows **no** data files staged or
      untracked-but-addable. Run the governance check with `--layout`.

## Verification

- `git check-ignore -v data/raw/fantasyguru/*.html docs/data/rankings.json`
  returns a match for every path.
- `git status --porcelain` lists no path under `data/` or `docs/data/`
  except `rankings.sample.json` and `README.md`.
- The run report's rejection list is empty or every entry has a reason a
  human has read.
- Every rendered player row shows a source and a capture date.
- `node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout`
  passes, and the layout line does not read `SKIP — NOT VERIFIED`.

## Risks

- **Terms of service forbid automated access.** Step 2 exists to find this
  before any capture, not after. Fallback: manual export by the owner,
  parsed from disk.
- **The rankings are rendered client-side from an authenticated XHR.** Then
  the capture is that JSON payload, not the HTML. Preferred outcome —
  cleaner parse.
- **A capture gets committed.** Step 1 precedes step 4 specifically to
  close this window.
- **Rankings vs projections confusion.** The Draft Guide publishes both;
  step 3 requires the distinction to be verified on the page, not assumed
  from a URL.
