# Tech Context

Last updated: 2026-08-29

## Stack

- **Pipeline:** Node (ESM, `.mjs`), no framework. Plain Node so the
  governance checks and the pipeline share a runtime and neither needs a
  dependency tree.
- **Site:** static HTML/CSS/vanilla JS in `docs/`, served by GitHub Pages
  from the `main` branch `/docs` folder. No build step by design
  (design doc §Alternative 3).
- **Data interchange:** JSON. `docs/data/rankings.json` is the board's
  runtime input.

## Environment

- Repos live under `~/code/` on the owner's Mac.
- Governance checks are invoked from the canonical repo:
  `node ~/code/agentic-governance/plugin/scripts/governance-checks.mjs --layout`.
- CI checks out `djjay0131/agentic-governance` alongside this repo and runs
  the same script.

## Plugins (`.claude/settings.json`)

- `constellize/marketplace` — Constellize specialist personas and the
  craft / deliver / design / memory / grow workflows.
- `obra/superpowers` — brainstorming, writing-plans, and downstream
  skills. **Output paths are overridden** in `CLAUDE.md`: specs to
  `llm/specs/`, plans to `llm/plans/`. `docs/superpowers/` must never
  be created.
- `djjay0131/agentic-governance` — the `governance` plugin: executive
  personas and `/governance:establish`, `/governance:audit`.

## Local run

```bash
node scripts/ingest.mjs --source fantasyguru --capture data/raw/...
node scripts/tier.mjs   --in data/processed/rankings.json --out docs/data/rankings.json
python3 -m http.server -d docs 8080
```
