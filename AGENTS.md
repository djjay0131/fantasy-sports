# AGENTS.md

<!-- BEGIN agentic-governance: repository layout -->
See `CLAUDE.md`. It carries this repository's agent instructions —
the two-plane rule (`llm/` control plane, `docs/` data
plane), the Q1/Q2 pre-write decision procedure, the tool-contract
exemption class, and the output-location preferences for design
specs and implementation plans.

This file exists because some tools read `AGENTS.md` rather than
`CLAUDE.md` (`obra/superpowers` `using-superpowers/SKILL.md` names
both). It restates no policy of its own; `CLAUDE.md` is the only
copy.
<!-- END agentic-governance: repository layout -->

<!-- BEGIN fantasy-sports: licensed data -->
`CLAUDE.md` also carries this repo's licensed-data rule: data obtained
under a personal subscription never enters the public plane
(`llm/governance/adr/0001-public-tooling-private-source-data.md`).
<!-- END fantasy-sports: licensed data -->
