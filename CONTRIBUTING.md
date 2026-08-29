# Contributing to fantasy-sports

Status: Active
Last updated: 2026-08-29
Owner: djjay0131

## Purpose

Quickstart for humans and AI agents contributing to this project. This
guide holds no policy of its own: every rule below is a pointer to its
single source of truth. If anything here appears to conflict with a linked
document, the linked document wins.

This project follows
[agentic-governance](https://github.com/djjay0131/agentic-governance);
project specifics live in `llm/governance/governance-delta.md`.

## Scope

Orientation and pointers only.

## Read First

1. The memory bank's `activeContext.md` (path in `llm/governance/governance-delta.md`)
2. The design-authority document (named in `llm/governance/governance-delta.md`)
3. `llm/governance/governance-delta.md` — this project's mission, principles, and
   local parameters
4. agentic-governance `llm/governance/governance-levels.md` — how changes are
   classified (L0–L3)
5. agentic-governance `llm/governance/project-operating-system.md` — how work is
   executed day to day, including workflow-mode selection

## How to Contribute

1. Start from an issue (templates in `.github/ISSUE_TEMPLATE/`).
2. Branch from `main` — never commit to `main` directly. Branch naming:
   agentic-governance `llm/governance/architecture-governance.md` §Branch Naming.
3. Classify your change at a governance level (L0–L3) before opening the
   PR. Uncertain classification means semantic, which means human review
   (agentic-governance `llm/governance/governance-levels.md`, Conservative Default).
4. Open a draft PR early using `.github/pull_request_template.md`,
   including the governance-level declaration. Keep the PR scoped to one
   concern.
5. Meet the applicable Definition of Done for the declared level:
   agentic-governance `llm/governance/definition-of-done.md`.
6. Reviews of semantic (L1–L3) work apply agentic-governance
   `llm/governance/review-checklist.md`. L0 administrative work follows the
   fast-track lane in agentic-governance `llm/governance/l0-fast-track.md` and the
   Repository Steward charter — noting this repo's Steward Activation
   Status in `llm/governance/governance-delta.md`.

## Where the Rules Live

| Topic | Source of truth |
|---|---|
| Governance levels, semantic test, conservative default, escalation, merge authority | agentic-governance `llm/governance/governance-levels.md` |
| L0 fast track (conditions, certification, allowlist, activation) | agentic-governance `llm/governance/l0-fast-track.md` |
| Decision control, authority hierarchy, ADR requirement, branch naming, documentation standards, AI-agent operating rules | agentic-governance `llm/governance/architecture-governance.md` |
| Work-item lifecycle, workflow-selection policy (single agent / specialist team / ultracode), agent contracts, quality gates, local sync | agentic-governance `llm/governance/project-operating-system.md` |
| Definition of Done (per work type, per level) | agentic-governance `llm/governance/definition-of-done.md` |
| Review checklist (L1–L3) | agentic-governance `llm/governance/review-checklist.md` |
| Label taxonomy, including governance-level labels | agentic-governance `llm/governance/labels.md` |
| Prompt and execution pattern libraries | agentic-governance `llm/governance/patterns/` + this repo's `llm/governance/patterns/execution-patterns.md` |
| Role charters (Chief Architect, Chief Reviewer/Governance Auditor, Chief Product Officer, Repository Steward) | agentic-governance `llm/constitution/` + `plugin/agents/` |
| This project's mission, principles, design-authority document, memory-bank and roadmap paths, L0 allowlist, platform enforcement reality, steward activation status | `llm/governance/governance-delta.md` |
| ADR mechanics, template, and index | `llm/governance/adr/README.md` |
| Memory-bank structure, reading order, update triggers | The memory bank's own README |

## AI Agent Contributors

AI agents follow the AI Agent Operating Rules in agentic-governance
`llm/governance/architecture-governance.md` and work under a bounded contract per
`llm/governance/project-operating-system.md` (skeleton:
`llm/governance/patterns/prompt-patterns.md`). AI agents never merge their own work,
with the single exception defined in agentic-governance
`llm/constitution/shared-principles.md`.

## Assumptions

- The canonical agentic-governance docs are reachable from this repo
  (sibling checkout or GitHub); `llm/governance/governance-delta.md` pins the
  governance version this repo follows.

## Open Questions

- None.

## Cross-References

- `llm/governance/governance-delta.md` — this project's governance delta
- agentic-governance `llm/governance/architecture-governance.md`,
  `llm/governance/governance-levels.md`, `llm/governance/project-operating-system.md`
