# Stack Sleuth Response Bundle Replay Design

Generated on 2026-05-01
Status: Approved via autonomous cycle brief

## Problem statement
Stack Sleuth can now export a deterministic response bundle for portfolio-shaped incident workflows, but the resulting folder still behaves like a dead artifact. Teams can open individual files, yet Stack Sleuth cannot reopen the saved package as one first-class workflow, and the browser cannot replay the bundle story from a single pasted payload.

## Goal
Make response bundles reopenable by adding a self-contained replay JSON artifact, a shared replay normalizer, CLI replay support, and browser replay support, while keeping older saved bundle directories usable in the CLI.

## User-visible workflow

### Export story
When Stack Sleuth exports a response bundle, the directory should still contain the current human-facing files, but it should now also include one self-contained replay JSON artifact that captures the manifest plus the replayable component contents.

### Replay story
A responder should be able to:
1. Run `node ./bin/stack-sleuth.js --replay-bundle ./sample/response-bundle/response-bundle.json`
2. Run `node ./bin/stack-sleuth.js --replay-bundle ./sample/response-bundle`
3. Paste a response bundle replay JSON artifact into the browser workspace

In each case, Stack Sleuth should recover the release gate verdict, source workflow, bundle timestamp, preserved file inventory, replayable casebook dataset, handoff markdown, and merge-review summary without asking for the original labeled portfolio.

## Recommended approach
Keep the existing bundle directory contract, add `response-bundle.json` as a self-contained replay artifact, and introduce a shared replay layer that can normalize either the new JSON artifact or a saved bundle directory.

## Architecture

### Bundle export changes
- Keep the existing component files:
  - `manifest.json`
  - `incident-dossier.html`
  - `portfolio-summary.md`
  - `handoff.md`
  - `casebook.txt`
  - `casebook-dataset.json`
  - `merge-review.md`
- Add `response-bundle.json` as the self-contained replay artifact.
- Bump the response-bundle version to `2` for newly exported bundles.
- Keep the replay artifact non-recursive by embedding the component file contents under a separate `artifacts` map that does not include `response-bundle.json` itself.

### New replay module
Create `src/bundle-replay.js` with responsibilities:
1. Inspect pasted JSON input and recognize a self-contained response bundle replay artifact.
2. Read a saved bundle directory from disk in the CLI by loading `manifest.json`, `casebook-dataset.json`, and optional component files.
3. Normalize version-1 and version-2 bundles into one structured replay shape.
4. Render concise text and markdown-adjacent summaries for CLI and browser surfaces.

### Replay truth model
Replay must reuse preserved fields, not fake a second analysis pass:
- `manifest` provides source mode, bundle timestamp, headline, gate verdict, and file inventory.
- `casebook-dataset.json` remains the structured replay backbone for summary counts, gate data, response queue, recurring signals, and saved export text.
- `handoff.md`, `merge-review.md`, `portfolio-summary.md`, and `incident-dossier.html` stay as preserved component artifacts for display or preview only.

## Integration points
- `src/bundle.js`: export version-2 bundles and emit `response-bundle.json`.
- `src/bundle-replay.js`: normalize bundle replay artifacts and render summaries.
- `bin/stack-sleuth.js`: add `--replay-bundle <path|->` support, including directory replay.
- `src/main.js`: detect pasted response bundle replay JSON before dataset, shelf, or chronicle detection and render a response-bundle replay surface.
- `src/examples.js`: add a response-bundle replay example sourced from the committed sample artifact.
- `README.md`: document replay commands and the self-contained replay artifact.

## Error handling and compatibility
- Version-1 bundle directories without `response-bundle.json` must still replay in the CLI if `manifest.json` and `casebook-dataset.json` exist.
- Browser replay only supports the self-contained JSON artifact, and unsupported or malformed JSON must raise a bundle-specific replay error.
- Version mismatches must report the supported bundle versions explicitly.
- Replay must never imply that raw traces or blast-radius details were recovered if only saved bundle data is present.

## Testing strategy
1. Unit-test bundle replay inspection, version normalization, and summary rendering in `tests/bundle-replay.test.mjs`.
2. Extend bundle builder tests to verify version `2`, the new `response-bundle.json` file, and non-recursive replay payload contents.
3. Extend CLI tests for replay JSON input, replay directory input, stdin replay, and legacy version-1 bundle-directory compatibility.
4. Extend browser-copy or browser-flow tests for pasted replay JSON detection and user-facing copy.
5. Extend README and sample-artifact tests so the public docs stay aligned.

## Non-goals
- Multi-bundle comparison or drift workflows
- Zip or tar packaging
- Browser directory upload
- Editing or annotating bundles after export
- Re-running portfolio analysis from invented raw-trace data

## Success criteria
- New bundles include one self-contained replay JSON artifact.
- Stack Sleuth can replay the self-contained artifact from the CLI and browser.
- Stack Sleuth can still replay older saved bundle directories in the CLI.
- README and the committed sample artifact make the reopenable bundle story obvious to outsiders.
