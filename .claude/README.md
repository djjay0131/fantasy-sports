# .claude/

`settings.json` enables the three marketplaces this project works under:

| Marketplace | Provides |
|---|---|
| `constellize/marketplace` | Constellize specialist personas and the craft / deliver / design / memory / grow workflows |
| `obra/superpowers-marketplace` | Superpowers skills — brainstorming, writing-plans, and everything downstream |
| `djjay0131/agentic-governance` | The `governance` plugin: executive personas, `/governance:establish`, `/governance:audit` |

**Superpowers output paths are overridden.** Its defaults write design
specs to `docs/superpowers/specs/` and plans to `docs/superpowers/plans/`.
This repo declares an `llm/` control plane, so `CLAUDE.md` binds specs to
`llm/specs/` and plans to `llm/plans/` — a standing user preference that
outranks any skill default. `docs/superpowers/` must never be created.

If a marketplace name here does not resolve, list what is installed with
`/plugin` and correct the plugin key rather than the marketplace URL.
