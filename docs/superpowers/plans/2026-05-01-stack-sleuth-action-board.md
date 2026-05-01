# Stack Sleuth Action Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic Action Board workflow that turns live incident portfolios and saved Stack Sleuth replay artifacts into lane-based coordination cards without adding mutable app state.

**Architecture:** Add one shared board engine that normalizes portfolio reports, dataset replays, and response bundle replays into the same card model. Preserve routing-gap and runbook-gap data in saved artifacts, keep older artifacts replayable with explicit caveats, and surface the board through CLI, browser, examples, and docs.

**Tech Stack:** Node.js ESM, built-in `node:test`, static HTML/CSS/JS, existing Stack Sleuth portfolio, dataset, bundle, and browser renderers.

---

## File structure

- Create: `src/action-board.js`
- Create: `tests/action-board.test.mjs`
- Modify: `src/dataset.js`
- Modify: `src/bundle.js`
- Modify: `src/bundle-replay.js`
- Modify: `src/examples.js`
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/browser-copy.test.mjs`
- Modify: `tests/readme.test.mjs`
- Modify: `tests/dataset.test.mjs`
- Modify: `tests/bundle.test.mjs`
- Modify: `tests/bundle-replay.test.mjs`

### Task 1: Build the shared Action Board engine

**Files:**
- Create: `src/action-board.js`
- Test: `tests/action-board.test.mjs`

- [ ] **Step 1: Write the failing Action Board tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { buildActionBoard } from '../src/action-board.js';

test('buildActionBoard groups portfolio signals into deterministic lanes', () => {
  const report = analyzeIncidentPortfolio(PORTFOLIO_FIXTURE);
  const board = buildActionBoard(report);

  assert.equal(board.summary.totalCards > 0, true);
  assert.deepEqual(board.lanes.map((lane) => lane.key), [
    'owner-work',
    'ownership-gaps',
    'runbook-gaps',
    'steward-backlog',
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/action-board.test.mjs`
Expected: FAIL because `../src/action-board.js` does not exist yet.

- [ ] **Step 3: Write the minimal engine**

```js
export function buildActionBoard(input) {
  const normalized = normalizeBoardInput(input);
  return {
    source: normalized.source,
    lanes: buildLanes(normalized),
    summary: buildSummary(normalized),
  };
}
```

- [ ] **Step 4: Re-run the focused test and verify GREEN**

Run: `node --test tests/action-board.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit the engine slice**

```bash
git add src/action-board.js tests/action-board.test.mjs
git commit -m "feat: add stack sleuth action board engine"
```

### Task 2: Preserve Action Board routing data in datasets and response bundles

**Files:**
- Modify: `src/dataset.js`
- Modify: `src/bundle.js`
- Modify: `src/bundle-replay.js`
- Test: `tests/dataset.test.mjs`
- Test: `tests/bundle.test.mjs`
- Test: `tests/bundle-replay.test.mjs`

- [ ] **Step 1: Write failing persistence and compatibility tests**

```js
test('buildCasebookDataset preserves routing and runbook gap cards for board replay', () => {
  const dataset = buildCasebookDataset(PORTFOLIO_FIXTURE);
  assert.equal(dataset.version, 2);
  assert.ok(Array.isArray(dataset.routingGaps));
  assert.ok(Array.isArray(dataset.runbookGaps));
});

test('inspectReplayDatasetInput replays version 1 datasets with board caveats', () => {
  const replay = inspectReplayDatasetInput(V1_DATASET_FIXTURE);
  assert.equal(replay.valid, true);
  assert.equal(replay.dataset.board?.summary.hasReplayLimitations, true);
});
```

- [ ] **Step 2: Run the focused persistence tests and verify RED**

Run: `node --test tests/dataset.test.mjs tests/bundle.test.mjs tests/bundle-replay.test.mjs`
Expected: FAIL because the dataset and bundle schemas do not preserve Action Board routing data yet.

- [ ] **Step 3: Implement the minimal schema upgrade and replay fallback**

```js
export const DATASET_VERSION = 2;

return {
  ...existingFields,
  routingGaps: portfolioReport.unownedPacks ?? [],
  runbookGaps: portfolioReport.runbookGaps ?? [],
  board: buildActionBoard(portfolioReport),
};
```

```js
const SUPPORTED_BUNDLE_VERSIONS = new Set([1, 2, RESPONSE_BUNDLE_VERSION]);
```

- [ ] **Step 4: Re-run the focused persistence tests and verify GREEN**

Run: `node --test tests/dataset.test.mjs tests/bundle.test.mjs tests/bundle-replay.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit the persistence slice**

```bash
git add src/dataset.js src/bundle.js src/bundle-replay.js tests/dataset.test.mjs tests/bundle.test.mjs tests/bundle-replay.test.mjs
git commit -m "feat: preserve stack sleuth action board replay data"
```

### Task 3: Surface the Action Board in CLI and browser flows

**Files:**
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `src/examples.js`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/browser-copy.test.mjs`

- [ ] **Step 1: Write failing CLI and browser tests**

```js
test('cli board workflow renders Action Board summary from a portfolio', async () => {
  const result = await runCli(['--board', portfolioPath]);
  assert.match(result.stdout, /Stack Sleuth Action Board/);
  assert.match(result.stdout, /owner work/i);
});

test('browser portfolio replay renders Action Board cards', async () => {
  const harness = await bootBrowserHarness();
  await loadPortfolioExample(harness);
  assert.match(harness.get('action-board-summary-value').textContent, /Action Board/i);
});
```

- [ ] **Step 2: Run the focused UI tests and verify RED**

Run: `node --test tests/cli.test.mjs tests/browser-copy.test.mjs`
Expected: FAIL because `--board` and the browser board cards do not exist yet.

- [ ] **Step 3: Implement the minimal CLI route and browser cards**

```js
if (args.board) {
  const board = buildActionBoard(loadBoardInput(args.board));
  printBoard(board, outputMode);
  process.exit(0);
}
```

```js
actionBoardSummaryValue.textContent = board.summary.headline;
renderChecklist(actionBoardCardsValue, flattenBoardCards(board));
```

- [ ] **Step 4: Re-run the focused UI tests and verify GREEN**

Run: `node --test tests/cli.test.mjs tests/browser-copy.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit the integration slice**

```bash
git add src/main.js index.html src/examples.js tests/cli.test.mjs tests/browser-copy.test.mjs
git commit -m "feat: surface stack sleuth action board"
```

### Task 4: Refresh docs, README assertions, and full-suite verification

**Files:**
- Modify: `README.md`
- Modify: `tests/readme.test.mjs`
- Modify: any sample fixture files required by the new board example

- [ ] **Step 1: Write the failing README assertion**

```js
test('README documents the Action Board workflow and replay caveats', async () => {
  const readme = await fs.readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Action Board/i);
  assert.match(readme, /routing gaps|runbook gaps/i);
  assert.match(readme, /saved artifacts preserve/i);
});
```

- [ ] **Step 2: Run the docs test and verify RED**

Run: `node --test tests/readme.test.mjs`
Expected: FAIL because the README does not mention the Action Board yet.

- [ ] **Step 3: Update README, examples, and saved-artifact notes**

```md
- Action Board turning a portfolio or saved replay artifact into owner work, routing gaps, runbook gaps, and steward backlog cards.
- Saved dataset and response bundle replay preserve Action Board state when available and disclose replay limitations for older artifacts.
```

- [ ] **Step 4: Run the full suite and verify GREEN**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit the documentation slice**

```bash
git add README.md tests/readme.test.mjs sample src/examples.js
git commit -m "docs: add stack sleuth action board workflow"
```

## Self-review
- Spec coverage: engine, saved-artifact preservation, replay caveats, CLI, browser, docs, and tests all map to at least one task.
- Placeholder scan: no TBD or TODO markers remain.
- Type consistency: use `buildActionBoard`, `routingGaps`, `runbookGaps`, `lanes`, and `summary.hasReplayLimitations` consistently across tasks.

## Execution handoff
Plan complete and saved to `docs/superpowers/plans/2026-05-01-stack-sleuth-action-board.md`.
For this autonomous cycle, execute with the required subagent-driven-development workflow in-session.
