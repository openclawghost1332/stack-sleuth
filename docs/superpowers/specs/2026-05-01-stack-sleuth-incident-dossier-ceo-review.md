# CEO REVIEW SUMMARY

- **Project:** Stack Sleuth incident dossier export
- **Date:** 2026-05-01
- **Mode:** SELECTIVE_EXPANSION
- **Status:** DONE

## 0. Nuclear Scope Challenge

### Premise challenge
- **Right problem?** Yes. Stack Sleuth already computes a high-signal incident answer, but it still lacks a first-class share artifact.
- **Direct outcome?** Turn structured pack and portfolio workflows into a standalone dossier that survives beyond the terminal session.
- **If we do nothing?** The product stays operator-impressive but harder to hand off, harder to show on a phone, and weaker as a visible public artifact.

### Existing code leverage
- Pack and portfolio analyzers already concentrate the strongest signal.
- Notebook, workspace, and capsule routes already normalize into those workflows.
- Handoff, forge, dataset, and merge outputs already exist inside the portfolio flow and can be surfaced without inventing new analysis logic.

### Current state → this plan → 12-month ideal
- **Current state:** strong structured analysis, weak share boundary.
- **This plan:** standalone HTML dossier for pack and portfolio workflows, including routed sources.
- **12-month ideal:** Stack Sleuth becomes a compact incident command deck that can ingest several evidence shapes and emit one portable briefing artifact.

### Alternatives
#### Approach A: Markdown polish
- Effort: S
- Risk: Low
- Pros: fastest.
- Cons: not a real product-boundary change.
- Reuses: markdown renderers.

#### Approach B: Standalone HTML dossier for structured workflows
- Effort: M
- Risk: Medium
- Pros: strongest visible artifact, reuses current engines, easy public demo story.
- Cons: new rendering layer, docs, and sample artifact needed.
- Reuses: pack, portfolio, notebook, workspace, capsule routing.

#### Approach C: Universal browser export studio
- Effort: L
- Risk: High
- Pros: broadest eventual UX.
- Cons: too much surface area for one cycle.
- Reuses: browser app and every workflow.

**Recommendation:** Approach B.

## Strongest challenges
1. Keep the dossier curated. If it becomes a raw dump, the artifact loses credibility.
2. Keep one source of truth by reusing existing analyzers and export text.
3. Keep scope tight to pack and portfolio plus routed notebook, workspace, and capsule coverage.

## Recommended path
Ship the dossier renderer, wire it into CLI HTML output for structured workflows, commit a sample generated artifact, and document the feature clearly.

## Accepted scope
- `--html` output for pack, portfolio, notebook, workspace, and capsule workflows.
- Pack dossier summary sections.
- Portfolio dossier summary plus gate, queues, recurring signals, and preserved export text.
- Sample generated HTML artifact in the repo.
- README updates.

## Deferred
- Browser-side export controls.
- HTML for direct trace, regression, timeline, casebook, dataset replay, shelf, and chronicle.
- Hosted sharing.
- PDF or screenshot output.

## NOT in scope
- New analyzers.
- Collaboration features.
- Storage backends.
- Auth.
