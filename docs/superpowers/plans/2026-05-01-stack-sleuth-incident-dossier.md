# Implementation Plan: Stack Sleuth incident dossier export

Date: 2026-05-01
Status: READY
Mode: TDD + subagent-driven development

## Goal
Ship a standalone HTML dossier export for Stack Sleuth's strongest structured workflows so pack, portfolio, notebook, workspace, and capsule inputs can become shareable phone-friendly artifacts.

## Why this slice
- It compounds the richest workflows already in the repo.
- It creates a visible outsider-facing artifact without inventing a new analysis engine.
- It is ambitious enough to matter, but bounded enough to ship this cycle.

## Scope
### In
1. New `--html` CLI output mode.
2. Standalone HTML dossier rendering for:
   - `--pack`
   - `--portfolio`
   - `--notebook`
   - `--workspace`
   - `--capsule`
3. Curated pack dossier sections:
   - headline
   - findings
   - omissions
   - hotspots
   - checklist
4. Curated portfolio dossier sections:
   - release gate
   - priority queue
   - response queue
   - routing gaps
   - recurring incidents and hotspots
   - preserved handoff or reuse exports surfaced from existing analyses
5. README updates plus at least one committed generated sample dossier.

### Out
- Browser-side export buttons.
- HTML export for direct trace, digest-only, regression-only, timeline-only, casebook-only, chronicle, dataset replay, or shelf replay flows.
- PDF or screenshot output.

## Workstreams

### Workstream 1, dossier renderer foundation
Owner: main session

Files:
- `src/report.js` (new)
- `tests/report.test.mjs` (new)

Tasks:
1. Add view-model helpers for pack and portfolio dossiers.
2. Render a self-contained HTML page with summary cards and section blocks.
3. Include defensive empty-state handling.

Tests first:
- pack dossier contains heading, findings, omissions, hotspots, and checklist.
- portfolio dossier contains gate, queues, recurring signals, and export text.

### Workstream 2, CLI wiring and routed workflow support
Owner: implementation subagent or main session

Files:
- `bin/stack-sleuth.js`
- `tests/cli.test.mjs`

Tasks:
1. Parse `--html` as a mutually exclusive output mode alongside text, markdown, and json.
2. Route supported structured workflows through the dossier renderer.
3. Reject unsupported HTML workflows with a clear message.

Tests first:
- `--pack --html` succeeds.
- `--portfolio --html` succeeds.
- `--notebook --html`, `--workspace --html`, and `--capsule --html` reuse the routed dossier path.
- unsupported flows such as plain stdin trace plus `--html` fail with a helpful message.

### Workstream 3, public artifact and docs
Owner: main session

Files:
- `README.md`
- `sample/portfolio-dossier.html` (new)
- `tests/readme.test.mjs`

Tasks:
1. Document `--html` usage and supported workflows.
2. Add a sample dossier artifact generated from an existing sample portfolio.
3. Link the sample clearly from the README.

Tests first:
- README mentions HTML dossier export and sample artifact.

## Execution order
1. Create isolated git worktree.
2. Add failing renderer tests.
3. Implement renderer until renderer tests pass.
4. Add failing CLI tests.
5. Implement CLI `--html` support until CLI tests pass.
6. Add failing README tests.
7. Update docs and commit sample artifact.
8. Run full test suite.
9. Run publish helper, commit, and rely on auto-push hook.

## Subagent usage
- Spawn one fresh coding subagent in the isolated worktree to review the renderer and CLI test matrix before or during implementation.
- Keep the main session responsible for integration, docs, artifact generation, and final verification.

## Risks and mitigations
1. Risk: HTML becomes an uncurated field dump.
   - Mitigation: drive the renderer from small dossier view-model helpers with explicit section order.
2. Risk: CLI support sprawls into every workflow.
   - Mitigation: fail clearly outside the accepted structured workflows.
3. Risk: sample artifact diverges from renderer output.
   - Mitigation: generate the committed sample via the CLI after tests pass.

## Definition of done
- `npm test` passes.
- Stack Sleuth emits a standalone HTML dossier for structured workflows.
- README shows the feature and sample artifact.
- A generated dossier file is committed as a visible public demo asset.
