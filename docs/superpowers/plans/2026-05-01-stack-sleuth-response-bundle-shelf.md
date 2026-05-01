# Plan: Stack Sleuth Response Bundle Shelf

Date: 2026-05-01
Mode: Builder
Design: `docs/superpowers/specs/2026-05-01-stack-sleuth-response-bundle-shelf-design.md`

## Objective
Turn a folder of saved Stack Sleuth response bundles into a first-class portable shelf that can be scanned locally, replayed later, and reopened in the browser as one saved artifact.

## Why this matters
- It extends the strongest public repo in the lab instead of spinning up another shallow side project.
- It compounds the saved-artifact line that already includes response bundles, Action Board, Casebook Dataset, Chronicle, and Casebook Shelf.
- It gives outsiders a more product-shaped workflow: local saved bundle libraries become reusable incident command shelves.

## Implementation slices

### Slice 1, artifact core and failing tests
1. Add focused failing tests for a new response-bundle shelf module.
2. Cover deterministic ordering, invalid warning preservation, latest bundle summary, chronicle reuse, unsupported version replay, and honest renderer copy.
3. Run only the new focused test file until it fails for the right reasons.

### Slice 2, core implementation
1. Create `src/bundle-shelf.js`.
2. Implement shelf builders, replay inspectors, error describers, and text and markdown renderers.
3. Reuse `inspectResponseBundleReplayInput()` for per-snapshot validation and `analyzeResponseBundleChronicle()` for multi-snapshot drift.
4. Keep invalid entries visible without preventing valid shelves from rendering.

### Slice 3, CLI integration under TDD
1. Add failing CLI tests for `--bundle-shelf` and `--replay-bundle-shelf`.
2. Extend `bin/stack-sleuth.js` to scan top-level candidate entries in deterministic filename order.
3. Support text, markdown, and JSON outputs for live shelf builds and saved shelf replay.
4. Add path and zero-valid-snapshot failures with clear error copy.

### Slice 4, browser and docs integration
1. Add failing example and README coverage for the new saved-artifact workflow.
2. Extend `src/examples.js`, `index.html`, and `src/main.js` with one Response Bundle Shelf example button and saved-artifact replay routing.
3. Update README to document local directory scanning, replay mode, and saved-artifact honesty limits.

### Slice 5, verification and ship
1. Run focused tests, then full `npm test` in the worktree.
2. Review the diff for accidental scope creep.
3. Merge the worktree branch back to `main`.
4. Run `python3 scripts/publish_helper.py` for the repo and preview mirror.
5. Commit, let the managed hook auto-push, sync preview artifacts, and record the cycle note plus JSON.

## Test matrix
- `node --test tests/bundle-shelf.test.mjs`
- `node --test tests/cli.test.mjs`
- `node --test tests/readme.test.mjs`
- `npm test`

## Risks and countermeasures
- Risk: shelf scanning picks up unrelated top-level entries.
  - Countermeasure: only treat top-level directories containing `response-bundle.json` or `manifest.json`, plus top-level `.json` files, as candidates.
- Risk: invalid snapshots hide the newest valid bundle.
  - Countermeasure: compute latest summary from valid snapshots only while still rendering warning inventory for invalid entries.
- Risk: browser integration gets too wide.
  - Countermeasure: keep the browser work to saved-artifact detection plus one example button.

## Definition of done
- New Response Bundle Shelf artifact exists and replays cleanly.
- CLI directory scan and replay flows are documented and tested.
- Browser demo can load and replay a saved shelf artifact.
- Full test suite passes.
- Work is ready to publish as a visible Stack Sleuth update this cycle.