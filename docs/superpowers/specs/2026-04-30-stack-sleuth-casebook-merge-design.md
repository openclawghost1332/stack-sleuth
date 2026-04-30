# Stack Sleuth Casebook Merge Design

Generated on 2026-04-30
Status: Approved for unattended cycle execution
Mode: Builder

## Problem statement
Casebook Forge can emit reusable case entries from a labeled portfolio, but teams still have to manually reconcile that export with older labeled histories. Stack Sleuth needs one deterministic workflow that turns a release portfolio into an updated incident-memory dataset instead of a one-shot export.

## What makes this cool
Paste a release-worth of incident packs and get back a living casebook: which incidents were added, which known cases were refreshed, which source packs taught the system something new, and which duplicate signatures need a human to clean them up.

## Premises
1. Stack Sleuth should stay copy-paste friendly and deterministic, not depend on a backend.
2. A labeled incident portfolio is already the strongest shared input format, so the merge workflow should reuse it instead of inventing a second bundle format.
3. Human-authored metadata like `fix`, `owner`, and `runbook` is higher trust than auto-generated summary text and must never be silently overwritten.
4. Merge ambiguity is itself useful output. Exact-signature duplicates or contradictory metadata should produce visible warnings instead of hidden tie-breaking.

## Approaches considered

### Approach A: Minimal forge enrichment
- Add richer Casebook Forge summary text but keep manual merge work outside the product.
- Effort: S
- Risk: Low
- Pros: tiny diff, easy to ship
- Cons: weak product step, still manual, does not solve living dataset curation
- Reuses: existing forge output only

### Approach B: Dedicated Casebook Merge engine (recommended)
- Build a merge report on top of the existing portfolio and forge engines, emit a merged export, and surface add/update/conflict counts everywhere Stack Sleuth already speaks.
- Effort: M
- Risk: Medium
- Pros: strong compounding product step, reusable engine, obvious CLI and browser story
- Cons: more report plumbing and export logic
- Reuses: portfolio parser, casebook analysis, forge representative rendering, labeled metadata parsing

### Approach C: Persistent synced incident memory
- Add saveable state, edit workflows, and external sync.
- Effort: XL
- Risk: High
- Pros: bigger long-term product
- Cons: too much surface area, breaks one-cycle portability, pushes into backend work
- Reuses: existing analysis engines, but needs new persistence layer

## Recommended approach
Ship Approach B. It is the biggest step that still fits a single cycle while preserving Stack Sleuth's portable CLI-plus-static-demo identity.

## Architecture
Add a new `src/merge.js` engine that accepts the same labeled portfolio format used by Portfolio Radar and Casebook Forge. The engine should analyze the portfolio, collect embedded historical casebook entries from any `@@ history @@` sections, reuse forged portfolio cases as candidate updates, and produce a deterministic merged case set keyed by exact signature.

The merge report should preserve one canonical label per signature, prefer existing historical labels over new fallback labels, preserve human-written guidance (`summary`, `fix`, `owner`, `runbook`) unless the field is missing, and synthesize lightweight reusable metadata for the merged export such as `seen-count` and `source-packs`. If several historical labels share the same exact signature or disagree on preserved guidance fields, the report should mark that case as conflicted and include review notes in summary output.

CLI, markdown, JSON, and browser wiring should expose both the merge summary and the merged export text. Portfolio rendering in the browser should continue to show Casebook Forge while adding a dedicated Casebook Merge card so outsiders can see the transition from active triage to living incident memory.

## Components and file responsibilities
- `src/merge.js`: merge engine, summary builders, export rendering, and deterministic conflict detection.
- `bin/stack-sleuth.js`: new `--merge-casebook` workflow routing plus text and markdown renderers.
- `src/main.js`: portfolio-mode browser rendering for merge summary and merged export.
- `src/examples.js`: portfolio example copy that demonstrates merge behavior.
- `index.html`: new Casebook Merge result cards.
- `README.md`: CLI and browser docs for Casebook Merge.
- `tests/merge.test.mjs`: merge engine, conflict handling, and render coverage.
- `tests/cli.test.mjs`, `tests/browser-copy.test.mjs`, `tests/readme.test.mjs`: workflow coverage.

## Data flow
1. Parse a labeled portfolio.
2. Run the existing portfolio analysis and casebook forge analysis.
3. Collect embedded historical cases from any pack `@@ history @@` sections.
4. Group historical cases and forged cases by exact signature.
5. For each signature:
   - choose a canonical label
   - preserve existing trusted metadata
   - fill missing summary from the forged representative diagnosis when needed
   - compute `seen-count` and `source-packs`
   - emit conflict notes for duplicate labels or metadata disagreement
6. Sort merged cases deterministically and render:
   - summary counts (`existing`, `new`, `updated`, `conflicted`)
   - review queue / warnings
   - merged labeled export text

## Error handling
- Empty or unlabeled portfolio: fail with the same clear workflow errors used by Portfolio Radar and Casebook Forge.
- Portfolio with no runnable packs: fail clearly instead of emitting an empty merge.
- Portfolio with no history sections: still succeed by creating a brand-new merged casebook from forged cases.
- Duplicate signatures with conflicting metadata: succeed but report explicit conflict warnings.

## Testing strategy
- Add merge engine tests for fresh portfolios, portfolios with embedded history, preserved metadata, synthesized metadata, deterministic ordering, and conflict detection.
- Add CLI tests for `--merge-casebook` text and JSON flows.
- Add browser-copy tests so portfolio rendering mentions Casebook Merge and the living casebook story.
- Add README tests that assert the new workflow is documented.
- Run the full Node test suite after implementation.

## Open questions resolved for this unattended cycle
- Approval gate: the cron instruction to run an aggressive autonomous cycle is treated as approval to proceed after writing this spec and the implementation plan.
- Metadata scope: preserve existing `summary`, `fix`, `owner`, and `runbook`, and add merge-only metadata `seen-count` plus `source-packs`.
- Conflict policy: do not auto-resolve beyond deterministic canonical selection; surface warnings instead.

## Success criteria
- `stack-sleuth --merge-casebook <portfolio>` emits a merged casebook summary and reusable export.
- The browser portfolio flow visibly demonstrates merge output in addition to Casebook Forge.
- Tests cover preserved guidance, new-case synthesis, and conflict warnings.
- README makes the living-casebook workflow obvious to an outsider.