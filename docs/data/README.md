# docs/data/

The board reads its dataset from this directory **at runtime**.

| File | Tracked? | What it is |
|---|---|---|
| `rankings.sample.json` | yes | Sample board from freely available consensus rankings. The only ranking data in this repository. |
| `rankings.json` | **no — git-ignored** | Your real board, built from your own sources. Never committed (ADR-0001). |

`docs/cheatsheets/` tries `rankings.json` first and falls back to
`rankings.sample.json`. On the published site only the sample exists, so the
public page shows the sample; locally, your file wins.

Generate one:

```bash
node scripts/tier.mjs --in data/processed/rows.json --out docs/data/rankings.json
```

Writing to `rankings.sample.json` requires `--allow-sample`, because it is
the one file here that becomes public.

See `llm/governance/adr/0001-public-tooling-private-source-data.md`.
