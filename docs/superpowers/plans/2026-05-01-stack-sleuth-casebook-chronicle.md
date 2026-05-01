# Stack Sleuth Casebook Chronicle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Casebook Chronicle so Stack Sleuth can compare several saved Casebook Dataset artifacts across release windows in the CLI and browser.

**Architecture:** Build one shared chronicle engine on top of labeled saved dataset snapshots, then route both CLI and browser through that engine. Reuse existing dataset replay validation and Timeline Radar trend language so saved-artifact chronology feels native and deterministic.

**Tech Stack:** Node.js, ESM modules, built-in `node:test`, browser DOM rendering

---

## File structure

- Create `src/chronicle.js`
  - Parse labeled chronicle snapshots
  - Validate saved datasets with existing dataset replay helpers
  - Build owner, hotspot, and case trend series
  - Render text and Markdown summaries
- Modify `bin/stack-sleuth.js`
  - Add `--chronicle` argument parsing, validation, routing, serialization, and failures
- Modify `src/main.js`
  - Detect chronicle bundles before single-dataset replay
  - Render chronicle summary and saved-artifact trend cards
  - Wire the new example button and copy flow
- Modify `src/examples.js`
  - Add chronicle fixture built from several saved datasets
- Modify `index.html`
  - Add a Casebook Chronicle example button
  - Refresh hero copy so the new workflow is visible
- Modify `README.md`
  - Document CLI and browser chronicle usage
- Create `tests/chronicle.test.mjs`
  - Unit tests for parsing, validation, classification, and rendering
- Modify `tests/cli.test.mjs`
  - Add chronicle mode success and failure coverage
- Modify `tests/browser-copy.test.mjs`
  - Add chronicle browser routing and copy coverage
- Modify `tests/examples.test.mjs`
  - Keep example metadata aligned
- Modify `tests/readme.test.mjs`
  - Assert README covers Chronicle workflows

---

### Task 1: Build the shared chronicle engine

**Files:**
- Create: `src/chronicle.js`
- Create: `tests/chronicle.test.mjs`
- Test: `tests/chronicle.test.mjs`

- [ ] **Step 1: Write the failing chronicle unit tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCasebookChronicle,
  parseCasebookChronicleSnapshots,
  renderCasebookChronicleMarkdownSummary,
  renderCasebookChronicleTextSummary,
} from '../src/chronicle.js';

test('parseCasebookChronicleSnapshots keeps labeled dataset snapshots in order', () => {
  const snapshots = parseCasebookChronicleSnapshots(chronicleInput);
  assert.deepEqual(snapshots.map((item) => item.label), ['release-a', 'release-b', 'release-c']);
});

test('analyzeCasebookChronicle classifies owner, hotspot, and case trends', () => {
  const chronicle = analyzeCasebookChronicle(chronicleInput);
  assert.equal(chronicle.summary.snapshotCount, 3);
  assert.ok(chronicle.ownerTrends.some((item) => item.trend === 'rising'));
  assert.ok(chronicle.hotspotTrends.some((item) => item.trend === 'steady'));
  assert.ok(chronicle.caseTrends.some((item) => item.trend === 'new'));
});

test('chronicle renderers describe saved-artifact chronology without pretending to have trace detail', () => {
  const chronicle = analyzeCasebookChronicle(chronicleInput);
  assert.match(renderCasebookChronicleTextSummary(chronicle), /Casebook Chronicle/i);
  assert.match(renderCasebookChronicleMarkdownSummary(chronicle), /# Stack Sleuth Casebook Chronicle/);
});
```

- [ ] **Step 2: Run the chronicle unit tests to verify they fail**

Run:
```bash
node --test tests/chronicle.test.mjs
```

Expected: FAIL with missing `../src/chronicle.js` exports.

- [ ] **Step 3: Write the minimal chronicle engine**

```js
import { inspectReplayDatasetInput } from './dataset.js';

export function parseCasebookChronicleSnapshots(input) {
  // parse === label === blocks into { label, source }
}

export function analyzeCasebookChronicle(input) {
  // validate snapshots, build owner/hotspot/case series, classify trends
}

export function renderCasebookChronicleTextSummary(report) {
  // produce deterministic text summary
}

export function renderCasebookChronicleMarkdownSummary(report) {
  // produce deterministic markdown summary
}
```

Implementation requirements:
- require at least two snapshots in analysis callers
- validate each snapshot with `inspectReplayDatasetInput`
- expose explicit snapshot-level failure reasons for CLI and browser layers
- classify `new`, `rising`, `flapping`, `steady`, `falling`, `resolved`
- use only saved dataset fields: `summary`, `responseQueue`, `recurringHotspots`, `cases`, `portfolio.packOrder`

- [ ] **Step 4: Run the chronicle unit tests to verify they pass**

Run:
```bash
node --test tests/chronicle.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit the chronicle engine slice**

```bash
git add src/chronicle.js tests/chronicle.test.mjs
git commit -m "feat: add casebook chronicle engine"
```

---

### Task 2: Wire Chronicle into the CLI

**Files:**
- Modify: `bin/stack-sleuth.js`
- Modify: `tests/cli.test.mjs`
- Test: `tests/cli.test.mjs`

- [ ] **Step 1: Write the failing CLI tests**

```js
test('CLI chronicle mode renders saved dataset trend summaries', async () => {
  const { stdout } = await runCli(['--chronicle', chronicleFixturePath]);
  assert.match(stdout, /Casebook Chronicle/);
  assert.match(stdout, /Owner trends/);
});

test('CLI chronicle mode rejects unsupported dataset versions loudly', async () => {
  const { stderr, code } = await runCliExpectFailure(['--chronicle', badChroniclePath]);
  assert.equal(code, 1);
  assert.match(stderr, /unsupported version/i);
});
```

- [ ] **Step 2: Run the CLI tests to verify they fail**

Run:
```bash
node --test tests/cli.test.mjs
```

Expected: FAIL because `--chronicle` is not recognized yet.

- [ ] **Step 3: Add CLI argument parsing and routing**

```js
const chronicleArgumentError = validateOptionValue(args, '--chronicle');
const chroniclePath = readOptionValue(args, '--chronicle');

if (chroniclePath) {
  const chronicleInput = chroniclePath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(chroniclePath, 'chronicle');
  const chronicle = analyzeCasebookChronicle(chronicleInput);
  writeOutput(chronicle, mode, renderCasebookChronicleTextSummary, renderCasebookChronicleMarkdownSummary);
  process.exit(0);
}
```

Integration requirements:
- add `--chronicle` to one-workflow-at-a-time validation
- fail if fewer than two snapshots are present
- surface snapshot-level parse, kind, version, and JSON errors clearly
- extend JSON serialization so chronicle data is stable in `--json`

- [ ] **Step 4: Run the CLI tests to verify they pass**

Run:
```bash
node --test tests/cli.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit the CLI slice**

```bash
git add bin/stack-sleuth.js tests/cli.test.mjs
git commit -m "feat: add chronicle cli workflow"
```

---

### Task 3: Wire Chronicle into the browser, examples, and docs

**Files:**
- Modify: `src/main.js`
- Modify: `src/examples.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `tests/browser-copy.test.mjs`
- Modify: `tests/examples.test.mjs`
- Modify: `tests/readme.test.mjs`
- Test: `tests/browser-copy.test.mjs`
- Test: `tests/examples.test.mjs`
- Test: `tests/readme.test.mjs`

- [ ] **Step 1: Write the failing browser and docs tests**

```js
test('browser routes chronicle bundles before single dataset replay', () => {
  renderWithInput(chronicleExample.chronicle);
  assert.match(readText('#headline-value'), /Casebook Chronicle/);
  assert.match(readText('#timeline-summary-value'), /snapshot/i);
});

test('examples include a Casebook Chronicle fixture', () => {
  assert.ok(examples.find((item) => item.label === 'Casebook Chronicle'));
});

test('README documents Casebook Chronicle workflows for browser and CLI', async () => {
  const readme = await fs.readFile('README.md', 'utf8');
  assert.match(readme, /Casebook Chronicle/);
  assert.match(readme, /--chronicle/);
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run:
```bash
node --test tests/browser-copy.test.mjs tests/examples.test.mjs tests/readme.test.mjs
```

Expected: FAIL because the browser, examples, and README do not know Chronicle yet.

- [ ] **Step 3: Add the minimal browser and docs implementation**

```js
const chronicleExample = examples.find((item) => item.label === 'Casebook Chronicle');

if (looksLikeChronicle(traceText)) {
  renderChronicleWorkflow(analyzeCasebookChronicle(traceText));
  return;
}

loadChronicleButton?.addEventListener('click', () => loadTraceExample(chronicleExample));
```

Browser requirements:
- add a Casebook Chronicle example button in `index.html`
- detect chronicle bundles before single-dataset replay
- render summary, owner trends, hotspot trends, and case trends into existing cards
- explain saved-artifact limits in blast-radius and support-frame copy
- ensure `Copy result` emits chronicle text summary

Docs requirements:
- describe chronicle input format and CLI usage in `README.md`
- add an example snapshot bundle to `src/examples.js`
- keep hero copy public-facing and outsider-legible

- [ ] **Step 4: Run the targeted browser and docs tests to verify they pass**

Run:
```bash
node --test tests/browser-copy.test.mjs tests/examples.test.mjs tests/readme.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit the browser and docs slice**

```bash
git add src/main.js src/examples.js index.html README.md tests/browser-copy.test.mjs tests/examples.test.mjs tests/readme.test.mjs
git commit -m "feat: add chronicle browser workflow"
```

---

### Task 4: Full verification and release prep

**Files:**
- Modify if needed: any files above
- Test: `npm test`

- [ ] **Step 1: Run the full test suite**

Run:
```bash
npm test
```

Expected: PASS with all suites green.

- [ ] **Step 2: Smoke-test the new CLI workflow manually**

Run:
```bash
node ./bin/stack-sleuth.js --chronicle ./tmp/casebook-chronicle-example.txt
node ./bin/stack-sleuth.js --chronicle ./tmp/casebook-chronicle-example.txt --markdown
node ./bin/stack-sleuth.js --chronicle ./tmp/casebook-chronicle-example.txt --json
```

Expected: text, Markdown, and JSON summaries all render without errors.

- [ ] **Step 3: Review the diff for wording drift or fake trace detail**

```bash
git diff --stat main...HEAD
git diff main...HEAD
```

Expected: Chronicle copy stays explicit that this is a saved-dataset workflow.

- [ ] **Step 4: Commit any final polish**

```bash
git add -A
git commit -m "chore: polish chronicle release"
```

Only if there is real polish left after verification.

---

## Self-review
- Spec coverage: parser, validation, trend engine, CLI, browser, examples, docs, and tests are all mapped to tasks.
- Placeholder scan: no TODO or TBD placeholders remain.
- Type consistency: the plan uses one shared name, Casebook Chronicle, and one CLI flag, `--chronicle`, throughout.

## Execution handoff
Plan complete and saved to `docs/superpowers/plans/2026-05-01-stack-sleuth-casebook-chronicle.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Autonomous cycle choice: **Subagent-Driven (recommended)**.