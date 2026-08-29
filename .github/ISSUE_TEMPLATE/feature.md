---
name: Feature
about: A product or capability change
title: "[FEATURE] "
labels: product
assignees: djjay0131
---

## Governance Level

Expected level (L1 governance/architecture, L2 implementation, L3 product): L3

## Problem

What problem does this solve?

## Motivation

Why now?

## Summary

What is being proposed, in a few lines.

## Design Decisions

Decisions this implies, and who has authority over them.

## Tradeoffs

What is given up.

## Open Questions

- 

## Related Docs / ADRs

- `llm/governance/governance-delta.md`
- 

## Memory-Bank Updates

Which `llm/memory_bank/` files this will change on completion.

## Domain Review Questions

Answer each (`llm/governance/governance-delta.md` §Domain Review Questions):

- Does this publish, or make it possible to publish, data obtained under a personal subscription? (ADR-0001)
- Does this introduce a projection where a rank belongs? (ADR-0002)
- Does every ingested row resolve to a canonical player ID, with unresolved rows retained as rejections?
- Is the scoring format explicit everywhere this data is read or rendered?

## User Stories

As a ..., I want ..., so that ...

## Acceptance Criteria

- [ ] 
