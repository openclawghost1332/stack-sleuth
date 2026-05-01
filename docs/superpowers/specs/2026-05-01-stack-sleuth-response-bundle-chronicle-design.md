# Stack Sleuth Response Bundle Chronicle Design

Generated on 2026-05-01
Status: Approved via autonomous cycle brief

## Problem statement
Stack Sleuth can now export and replay one saved response bundle, which is great for one incident handoff. The next operational gap is comparing several saved bundles over time. Once responders have a few `response-bundle.json` artifacts from different releases, there is still no first-class Stack Sleuth workflow for asking which owners keep getting paged, whether the release gate is improving, or which recurring hotspots are sticking around.

## Goal
Add Response Bundle Chronicle, a saved-artifact comparison workflow that accepts several labeled response bundle replay artifacts and produces a deterministic trend report from their preserved bundle and embedded dataset fields.

## User-visible workflow

### Input contract
Response Bundle Chronicle accepts labeled snapshots in this format:

```text
=== release-2026-04-24 ===
{ ...saved response-bundle.json... }

=== release-2026-05-01 ===
{ ...saved response-bundle.json... }
```

The same format should work in three places:
1. CLI `--bundle-chronicle <path|->`
2. Browser shared workspace paste
3. Example fixture and README snippets

### Output story
Bundle Chronicle should answer five questions quickly:
1. Which response owners are new, rising, steady, falling, flapping, or resolved?
2. Which recurring hotspots and case signatures are appearing or calming down across saved bundles?
3. What is the latest release gate verdict and how did it drift from the prior saved bundle?
4. Which source workflow did the latest saved bundle come from?
5. Which bundle inventory files stayed present, appeared, or disappeared across snapshots?

Bundle Chronicle must stay honest about saved-artifact limits. It can use only preserved bundle metadata and embedded dataset state. It cannot recover raw traces, support frames, or culprit-level blast radius detail that were not saved.

## Recommended approach
Use the shipped response-bundle replay contract as the input layer, then build one chronicle engine that normalizes each saved bundle and compares the preserved signals across snapshots.

## Architecture

### New core module
Create `src/bundle-chronicle.js` with responsibilities:
1. Parse labeled chronicle snapshots from `=== label ===` blocks.
2. Validate each snapshot with `inspectResponseBundleReplayInput` from `src/bundle-replay.js`.
3. Reuse the embedded dataset for owner, hotspot, case, and release-gate trends.
4. Add bundle-specific context for source workflow and manifest file inventory drift.
5. Render copy-ready text and Markdown summaries for CLI and browser flows.

### Data model
`analyzeResponseBundleChronicle` should return:
- `snapshots`: ordered validated bundle snapshots with labels
- `ownerTrends`: owner series from `bundle.dataset.responseQueue`
- `hotspotTrends`: hotspot series from `bundle.dataset.recurringHotspots`
- `caseTrends`: case presence series from `bundle.dataset.cases`
- `inventoryTrends`: file-presence series from `bundle.manifest.files`
- `summary`: latest bundle story, gate drift, source workflow drift, and trend counts
- `labels`: ordered snapshot labels

### Trend rules
Keep the same trend vocabulary already used by Timeline Radar and Casebook Chronicle:
- `new`
- `rising`
- `flapping`
- `steady`
- `falling`
- `resolved`

For manifest inventory, treat presence as a `1/0` series across snapshots and classify with the same vocabulary.

## CLI integration
Add `--bundle-chronicle` mode in `bin/stack-sleuth.js`.

Behavior:
- validate one workflow mode at a time, like `--chronicle`, `--replay-bundle`, and `--replay-shelf`
- require at least two labeled snapshots
- support text, Markdown, and JSON output
- fail loudly for invalid JSON, wrong bundle kind, unsupported version, or empty chronicle input

## Browser integration
The shared workspace should detect a response bundle chronicle before falling through to single-bundle replay.

When detected:
- render main summary cards as a saved-bundle drift workflow
- reuse portfolio and timeline cards for owner, hotspot, case, and inventory trend lists
- explain preserved limits clearly in blast-radius and support-frame areas
- add a dedicated example and caption

The browser must call the same chronicle engine as the CLI.

## Files to change
- Create: `src/bundle-chronicle.js`
- Modify: `bin/stack-sleuth.js`
- Modify: `src/main.js`
- Modify: `src/examples.js`
- Modify: `README.md`
- Create: `tests/bundle-chronicle.test.mjs`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/browser-copy.test.mjs`
- Modify: `tests/examples.test.mjs`
- Modify: `tests/readme.test.mjs`

## Error handling
Snapshot-level failures must be explicit:
- malformed or unlabeled chronicle blocks: instruct the user to use `=== label ===` sections with saved response-bundle JSON
- unsupported bundle kind: name the wrong kind
- unsupported bundle version: name the bad version and supported versions
- invalid JSON: say which chronicle snapshot could not be parsed
- too few snapshots: require at least two labeled saved bundles

Browser copy should explain that Bundle Chronicle is a saved-bundle workflow, not a raw-trace workflow.

## Testing strategy
1. Unit-test chronicle parsing, validation, trend classification, bundle inventory drift, and renderers in `tests/bundle-chronicle.test.mjs`.
2. Extend CLI tests for `--bundle-chronicle` text, Markdown, JSON, and error cases.
3. Extend browser tests for chronicle auto-detection, rendering, and copy.
4. Update example and README tests so public docs stay aligned with the shipped surface.

## Non-goals
- persistent bundle catalogs or services
- browser directory uploads
- editing saved bundles
- reconstructing trace-level details from saved artifacts
- replacing Casebook Shelf this cycle

## Success criteria
- A stranger can paste two or more saved `response-bundle.json` blobs in labeled sections and get a coherent saved-bundle drift summary.
- CLI and browser stay aligned because they reuse the same chronicle engine.
- Output preserves bundle-specific context instead of pretending the artifacts were raw trace inputs.
- README and examples make the workflow obvious from the public repo homepage.