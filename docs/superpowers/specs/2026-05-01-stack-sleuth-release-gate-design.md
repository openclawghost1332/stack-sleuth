# Stack Sleuth Release Gate Design

Generated on 2026-05-01
Status: Approved via autonomous cycle brief

## Problem statement
Stack Sleuth can already analyze a release portfolio deeply, but it still stops short of the decision teams actually need to make. After Portfolio Radar surfaces novel casebook incidents, regression movement, routing gaps, and timeline drift, a human still has to combine those signals into a release verdict. Saved Casebook Dataset artifacts and Casebook Shelf replays preserve useful signals, yet they do not preserve or compare that verdict over time.

## Goal
Add a shared Release Gate layer that turns existing Stack Sleuth portfolio signals into a deterministic verdict, preserves that verdict inside Casebook Dataset artifacts, and surfaces gate drift in Chronicle and Shelf.

## User-visible workflow

### Portfolio story
When a labeled incident portfolio is analyzed, Stack Sleuth should explicitly answer:
1. Is this release in hold, watch, clear, or needs-input state?
2. Which signals are blockers versus warnings?
3. What should the team do next?

### Saved-artifact story
When the portfolio is exported into a Casebook Dataset and later replayed via Dataset, Chronicle, or Shelf, Stack Sleuth should preserve the gate verdict and show whether release health improved, regressed, or stayed flat across saved snapshots.

## Recommended approach
Add a shared `src/gate.js` engine used by Portfolio Radar first, then preserve its output in Casebook Dataset summaries and reuse it in Chronicle and Shelf summaries.

## Architecture

### New core module
Create `src/gate.js` with responsibilities:
1. Build a deterministic gate verdict from portfolio-level signals.
2. Classify signals into blockers and warnings.
3. Render text and Markdown summaries for CLI-facing surfaces.
4. Compare saved gate verdicts across snapshots for Chronicle and Shelf drift summaries.

### Verdict model
Release Gate should use four verdicts:
- `hold`: blocking evidence exists
- `watch`: no blockers, but warning evidence exists
- `clear`: no blockers or warnings in runnable evidence
- `needs-input`: the portfolio or replay did not preserve enough runnable evidence for a confident gate

### Source signals
Use existing Stack Sleuth signals only:
- `totalNovelIncidents`
- `totalRegressionNew`
- `totalRegressionVolumeUp`
- `unownedPackCount`
- `runbookGapCount`
- `totalTimelineNew`
- `totalTimelineRising`
- recurring hotspot and recurring incident counts
- runnable and unrunnable pack counts

### Blocker and warning policy
Initial deterministic policy:
- Blockers: novel incidents, regression-new incidents, unowned runnable packs, timeline-new incidents
- Warnings: runbook gaps, regression volume-up incidents, timeline-rising incidents, recurring hotspot churn, recurring cross-pack incidents, unrunnable packs
- `needs-input`: no runnable packs exist

This policy should stay visible in tests and renderers so it is easy to audit.

## Integration points
- `src/portfolio.js`: compute `gate` and include it in the returned report plus text and Markdown summaries
- `src/dataset.js`: preserve normalized `gate` output without breaking older dataset artifacts
- `src/chronicle.js`: summarize latest gate verdict plus gate drift versus the prior snapshot
- `src/shelf.js`: include latest gate state in shelf summary and rendered text or Markdown output
- `src/main.js`: expose gate verdict and reasons naturally in existing portfolio, dataset replay, chronicle, and shelf cards
- `src/examples.js` and `README.md`: make the release-gate story obvious from the public repo homepage

## Error handling and compatibility
- Older Casebook Dataset artifacts without `gate` must still replay successfully with a normalized fallback gate.
- Release Gate must never claim raw-trace precision when running from saved datasets or shelves.
- Chronicle and Shelf should explicitly say when gate drift is unavailable because an older dataset did not preserve enough gate detail.

## Testing strategy
1. Unit-test gate verdict classification and snapshot drift helpers in `tests/gate.test.mjs`.
2. Extend portfolio tests for gate verdicts and rendered output.
3. Extend dataset tests for gate preservation and backward-compatible replay.
4. Extend chronicle and shelf tests for gate drift summaries.
5. Extend browser, CLI, examples, and README tests so public copy stays aligned.

## Non-goals
- Manual approval flows
- External deploy or CI integrations
- Numeric risk scores beyond verdicts and explicit evidence counts
- Mutable release state storage

## Success criteria
- Portfolio Radar now emits a clear release verdict with auditable blocker or warning reasons.
- Casebook Dataset preserves that gate so saved artifacts stay decision-ready.
- Chronicle and Shelf show whether gate health improved, regressed, or stayed flat across snapshots.
- A stranger can understand the new workflow from the README and browser surface in under a minute.
