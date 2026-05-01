# Stack Sleuth Casebook Chronicle Design

Generated on 2026-05-01
Status: Approved via autonomous cycle brief

## Problem statement
Stack Sleuth can already package one labeled incident portfolio into a reusable Casebook Dataset and replay one saved dataset artifact later. That closes the loop for one release handoff, but it still leaves a big operational gap: once several saved datasets exist, there is no first-class workflow for comparing them across release windows. Teams still cannot ask Stack Sleuth which owners keep getting paged, which hotspots keep resurfacing, or whether the casebook is stabilizing over time without reopening the original portfolio inputs.

## Goal
Add a new saved-artifact workflow, Casebook Chronicle, that accepts several labeled Casebook Dataset snapshots and turns them into a deterministic trend report for owner load, recurring hotspots, and merged case presence across release windows.

## User-visible workflow

### Input contract
Casebook Chronicle will accept labeled snapshots in this format:

```text
=== release-2026-04-15 ===
{ ...saved Casebook Dataset JSON... }

=== release-2026-04-22 ===
{ ...saved Casebook Dataset JSON... }
```

The same format should work in three places:
1. CLI `--chronicle <path|->`
2. Browser shared workspace paste
3. Example fixture and README snippets

### Output story
Chronicle should answer four questions quickly:
1. Which owners are new, rising, steady, falling, or resolved across snapshots?
2. Which recurring hotspot files keep showing up across saved datasets?
3. Which merged case signatures appeared, persisted, or disappeared?
4. Is the latest snapshot improving or regressing versus the prior saved dataset?

Chronicle must stay honest about saved-artifact limits. It can use only preserved dataset signals, not raw culprit frames, support frames, or blast radius details that were not stored.

## Recommended approach
Approach B from office-hours and CEO review: add a new chronicle engine on top of saved dataset artifacts, then wire that engine into CLI and browser flows.

## Architecture

### New core module
Create `src/chronicle.js` with four responsibilities:
1. Parse chronicle snapshots from labeled `=== label ===` blocks.
2. Validate each snapshot with the existing dataset replay contract from `src/dataset.js`.
3. Build trend series for owners, recurring hotspots, and merged cases.
4. Render text and Markdown summaries for CLI and browser copy.

### Data model
`analyzeCasebookChronicle` should return:
- `snapshots`: ordered validated dataset snapshots with labels
- `ownerTrends`: owner series using saved `responseQueue[].packCount`
- `hotspotTrends`: hotspot series using saved `recurringHotspots[].packCount`
- `caseTrends`: case presence series using saved `cases[].signature`
- `summary`: counts and latest-window headlines for new, rising, flapping, steady, falling, and resolved saved-artifact signals
- `labels`: ordered snapshot labels

### Trend rules
Use the same trend vocabulary as Timeline Radar so the new workflow feels native:
- `new`
- `rising`
- `flapping`
- `steady`
- `falling`
- `resolved`

Trend classification can stay local to `chronicle.js` if that keeps scope smaller than extracting a shared helper.

## CLI integration
Add a `--chronicle` mode in `bin/stack-sleuth.js`.

Behavior:
- validate one workflow mode at a time, like existing `--timeline`, `--dataset`, and `--replay-dataset`
- require at least two labeled snapshots
- fail loudly for invalid JSON, wrong dataset kind, unsupported version, or empty chronicle input
- support text, Markdown, and JSON output through the existing `writeOutput` path

## Browser integration
The shared workspace should detect a chronicle bundle before falling through to single-dataset replay. When detected:
- render main summary cards as a saved-artifact trend workflow
- reuse portfolio cards for owner, hotspot, and case trend lists
- reuse timeline cards for chronicle trend counts and latest-window movement
- explain preserved limits clearly in blast-radius and support-frame areas
- add a dedicated example button and caption

No new browser-only analysis path should exist. The browser should call the same chronicle engine as the CLI.

## Files to change
- Create: `src/chronicle.js`
- Modify: `bin/stack-sleuth.js`
- Modify: `src/main.js`
- Modify: `src/examples.js`
- Modify: `index.html`
- Modify: `README.md`
- Create: `tests/chronicle.test.mjs`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/browser-copy.test.mjs`
- Modify: `tests/examples.test.mjs`
- Modify: `tests/readme.test.mjs`

## Error handling
Every snapshot-level failure must be explicit:
- missing or malformed chronicle blocks: tell the user to use `=== label ===` sections with saved dataset JSON
- unsupported dataset kind: name the wrong kind
- unsupported dataset version: name the bad version and the supported one
- invalid JSON: say the chronicle snapshot could not be parsed
- too few snapshots: require at least two labeled datasets

Browser copy should explain that Chronicle is a saved-dataset workflow, not a raw-trace workflow.

## Testing strategy
1. Unit-test chronicle parsing, validation, trend classification, and renderers in `tests/chronicle.test.mjs`.
2. Extend CLI tests for `--chronicle` text, Markdown, JSON, and error cases.
3. Extend browser tests for chronicle auto-detection, example loading, rendered copy, and reset behavior.
4. Update README and example tests so public docs stay aligned with the shipped surface.

## Non-goals
- persistent dataset catalogs
- editing or merging chronicle snapshots
- reconstructing trace-level details from saved artifacts
- new storage layers or services

## Success criteria
- A stranger can paste two or more saved dataset JSON blobs in labeled sections and immediately get a coherent trend summary.
- CLI and browser copy stay aligned because they reuse the same chronicle engine.
- Unsupported saved datasets fail clearly.
- The README and example button make the workflow obvious from the public repo homepage.

## Open questions resolved
- Label format: use `=== label ===` so Chronicle matches existing casebook and timeline labeling patterns.
- Scope boundary: trend only what the dataset already preserves, not what the original traces once contained.