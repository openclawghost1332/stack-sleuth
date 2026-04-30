# Stack Sleuth Casebook Dataset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a portable Casebook Dataset workflow that packages portfolio triage into a reusable artifact and lets Casebook Radar consume that saved artifact through the existing `--history` path.

**Architecture:** Add one shared `src/dataset.js` module on top of Portfolio Radar and Casebook Merge. Route a new `--dataset` CLI mode through that module, teach Casebook Radar history loading to recognize saved dataset JSON and recover labeled export text from it, then surface the dataset in the portfolio browser flow and docs.

**Tech Stack:** Plain JavaScript, Node.js test runner, static browser UI, shared CLI/browser modules.

---

## File structure

- `src/dataset.js` - shared dataset builder, dataset renderers, dataset parsing helpers, and history re-ingest support.
- `src/casebook.js` - shared history loading helper that accepts either labeled text or saved dataset JSON.
- `bin/stack-sleuth.js` - `--dataset` workflow mode, dataset output routing, and casebook history loading changes.
- `src/main.js` - portfolio browser card rendering and reset behavior for Casebook Dataset.
- `src/examples.js` - dedicated dataset example.
- `index.html` - dataset card markup and example copy.
- `styles.css` - preserve multiline formatting for dataset export card.
- `tests/dataset.test.mjs` - dataset engine and re-ingest coverage.
- `tests/cli.test.mjs` - CLI dataset workflow and dataset-backed `--history` coverage.
- `tests/browser-copy.test.mjs` - browser portfolio dataset rendering and reset coverage.
- `tests/examples.test.mjs` - dataset example coverage.
- `README.md` - document `--dataset` plus dataset-backed `--history` reuse.

### Task 1: Build the shared Casebook Dataset engine

**Files:**
- Create: `src/dataset.js`
- Modify: `src/casebook.js`
- Test: `tests/dataset.test.mjs`

- [ ] **Step 1: Write the failing dataset engine tests**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCasebookDataset, parseDatasetHistory } from '../src/dataset.js';

const portfolioInput = `@@@ checkout-prod @@@\n@@ current @@\nTypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n\n@@@ profile-rollout @@@\n@@ current @@\nTypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n\n@@ history @@\n=== release-2026-04-15 ===\n>>> owner: web-platform\nTypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)`;

test('buildCasebookDataset packages merge and portfolio signals into a reusable artifact', () => {
  const dataset = buildCasebookDataset(portfolioInput);

  assert.equal(dataset.kind, 'stack-sleuth-casebook-dataset');
  assert.equal(dataset.version, 1);
  assert.match(dataset.summary.headline, /Casebook Dataset captured/i);
  assert.ok(dataset.responseQueue.length >= 1);
  assert.ok(dataset.cases.length >= 1);
  assert.match(dataset.exportText, /^=== release-2026-04-15 ===/m);
});

test('parseDatasetHistory converts saved dataset json into labeled history batches', () => {
  const dataset = buildCasebookDataset(portfolioInput);
  const batches = parseDatasetHistory(JSON.stringify(dataset));

  assert.equal(batches[0].label, 'release-2026-04-15');
  assert.equal(batches[0].metadata.owner, 'web-platform');
  assert.match(batches[0].traces, /renderProfile/);
});
```

- [ ] **Step 2: Run the dataset tests to verify they fail**

Run: `npm test -- tests/dataset.test.mjs`
Expected: FAIL with `Cannot find module '../src/dataset.js'` or missing export errors.

- [ ] **Step 3: Write the minimal dataset engine and shared history loader**

```javascript
// src/dataset.js
import { analyzeIncidentPortfolio } from './portfolio.js';
import { analyzeCasebookMerge } from './merge.js';
import { parseLabeledTraceBatches } from './labeled.js';

export function buildCasebookDataset(input) {
  const portfolioReport = input?.priorityQueue ? input : analyzeIncidentPortfolio(input);
  const mergeReport = analyzeCasebookMerge(portfolioReport);
  return {
    kind: 'stack-sleuth-casebook-dataset',
    version: 1,
    summary: buildDatasetSummary(portfolioReport, mergeReport),
    portfolio: { packOrder: portfolioReport.portfolio?.packOrder ?? [] },
    responseQueue: portfolioReport.responseQueue ?? [],
    recurringIncidents: portfolioReport.recurringIncidents ?? [],
    recurringHotspots: portfolioReport.recurringHotspots ?? [],
    cases: mergeReport.cases.map((entry) => ({
      label: entry.label,
      signature: entry.signature,
      sourcePacks: entry.sourcePacks,
      metadata: entry.metadata,
      conflicts: entry.conflicts,
    })),
    exportText: mergeReport.exportText,
  };
}

export function parseDatasetHistory(input) {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  if (parsed?.kind !== 'stack-sleuth-casebook-dataset' || typeof parsed?.exportText !== 'string' || !parsed.exportText.trim()) {
    return null;
  }
  return parseLabeledTraceBatches(parsed.exportText);
}
```

```javascript
// src/casebook.js
import { parseDatasetHistory } from './dataset.js';

export function parseCasebookHistoryInput(history) {
  if (Array.isArray(history)) {
    return history;
  }

  const datasetHistory = parseDatasetHistory(history);
  if (datasetHistory?.length) {
    return datasetHistory;
  }

  return parseLabeledTraceBatches(history);
}
```

- [ ] **Step 4: Update `analyzeCasebook()` to use the shared history loader and run the dataset tests**

Run: `npm test -- tests/dataset.test.mjs tests/casebook.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit the engine task**

```bash
git add src/dataset.js src/casebook.js tests/dataset.test.mjs
git commit -m "feat: add reusable casebook dataset engine"
```

### Task 2: Add CLI dataset workflow plus dataset-backed history reuse

**Files:**
- Modify: `bin/stack-sleuth.js`
- Modify: `tests/cli.test.mjs`
- Modify: `README.md`
- Test: `tests/cli.test.mjs`

- [ ] **Step 1: Write the failing CLI tests for `--dataset` and dataset-backed `--history`**

```javascript
test('CLI reads a portfolio with --dataset and prints a Casebook Dataset summary', () => {
  const result = runCli(['--dataset', '-'], { input: portfolioInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Dataset/);
  assert.match(result.stdout, /Reusable casebook export/);
});

test('CLI Casebook Radar accepts a saved dataset JSON file through --history', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-dataset-'));
  const datasetPath = path.join(tempDir, 'history.json');
  const datasetResult = runCli(['--dataset', '-', '--json'], { input: portfolioInput });
  await fs.promises.writeFile(datasetPath, datasetResult.stdout, 'utf8');

  const result = runCli(['--history', datasetPath], { input: casebookCurrentInput });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Radar/);
  assert.match(result.stdout, /Known incidents: 1/);
});
```

- [ ] **Step 2: Run the CLI tests to verify they fail**

Run: `npm test -- tests/cli.test.mjs`
Expected: FAIL with unsupported `--dataset` workflow or missing dataset summary output.

- [ ] **Step 3: Wire the CLI dataset mode and serializable payload helpers**

```javascript
import {
  buildCasebookDataset,
  renderCasebookDatasetTextSummary,
  renderCasebookDatasetMarkdownSummary,
} from '../src/dataset.js';

const datasetArgumentError = validateOptionValue(args, '--dataset');
const datasetPath = readOptionValue(args, '--dataset');
```

```javascript
if (datasetPath) {
  const datasetInput = datasetPath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(datasetPath, 'dataset');
  const portfolio = parseIncidentPortfolio(datasetInput);
  if (!portfolio.packOrder.length) {
    fail('Casebook Dataset requires @@@ label @@@ blocks around one or more incident packs.');
  }

  const report = buildCasebookDataset(portfolio);
  if (!report.summary.runnablePackCount) {
    fail('Casebook Dataset requires at least one runnable labeled incident pack.');
  }

  writeOutput(report, mode, renderDatasetCliTextSummary, renderDatasetCliMarkdownSummary);
  process.exit(0);
}
```

- [ ] **Step 4: Update CLI docs and rerun the focused tests**

Run: `npm test -- tests/cli.test.mjs tests/readme.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit the CLI task**

```bash
git add bin/stack-sleuth.js tests/cli.test.mjs README.md
git commit -m "feat: add stack sleuth casebook dataset cli"
```

### Task 3: Surface the dataset in the browser, examples, and docs

**Files:**
- Modify: `src/main.js`
- Modify: `src/examples.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `tests/browser-copy.test.mjs`
- Modify: `tests/examples.test.mjs`
- Modify: `README.md`
- Test: `tests/browser-copy.test.mjs`, `tests/examples.test.mjs`

- [ ] **Step 1: Write the failing browser and example tests for the dataset card**

```javascript
assert.match(indexHtml, /Casebook Dataset/i);
assert.match(indexHtml, /Load Casebook Dataset example/i);
```

```javascript
test('browser portfolio flow surfaces the Casebook Dataset card and export text', async () => {
  const harness = await loadBrowserHarness();
  try {
    await harness.input('trace-input', portfolioInput);
    await harness.click('explain-button');

    assert.match(harness.get('dataset-summary-value').textContent, /Casebook Dataset captured/i);
    assert.match(harness.get('dataset-export-value').textContent, /"kind": "stack-sleuth-casebook-dataset"/);
  } finally {
    harness.restore();
  }
});
```

- [ ] **Step 2: Run the browser and examples tests to verify they fail**

Run: `npm test -- tests/browser-copy.test.mjs tests/examples.test.mjs`
Expected: FAIL because dataset elements and example wiring do not exist yet.

- [ ] **Step 3: Add the dataset card, browser rendering, and example wiring**

```javascript
const datasetSummaryValue = document.querySelector('#dataset-summary-value');
const datasetExportValue = document.querySelector('#dataset-export-value');
```

```javascript
const dataset = buildCasebookDataset(report);
datasetSummaryValue.textContent = dataset.summary.headline;
datasetExportValue.textContent = JSON.stringify(dataset, null, 2);
```

```javascript
examples.push({
  label: 'Casebook Dataset',
  caption: 'A labeled incident portfolio becomes a portable incident-memory dataset that can be saved and later reused through Casebook Radar.',
  portfolio: portfolioTrace,
});
```

- [ ] **Step 4: Update reset copy, README, and rerun the full suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit the browser/docs task**

```bash
git add src/main.js src/examples.js index.html styles.css tests/browser-copy.test.mjs tests/examples.test.mjs README.md
git commit -m "feat: add casebook dataset browser flow"
```

## Spec self-review
- Coverage: dataset engine, CLI mode, `--history` reuse, browser visibility, tests, examples, and docs are all mapped to tasks.
- Placeholder scan: no TODO/TBD placeholders remain.
- Consistency: the plan uses one dataset kind string, one `--dataset` flag, and one dataset export surface across all tasks.

Plan complete and saved to `docs/superpowers/plans/2026-04-30-stack-sleuth-casebook-dataset.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Autonomous cycle choice: Subagent-Driven.
