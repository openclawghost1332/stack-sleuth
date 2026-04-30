# Stack Sleuth Casebook Forge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a labeled incident portfolio into a reusable Stack Sleuth casebook export that can be fed back into future Casebook Radar runs.

**Architecture:** Add a shared forge engine on top of Portfolio Radar, make the labeled-history export the primary contract, then expose that engine through a dedicated CLI mode and portfolio-aware browser cards/copy flows.

**Tech Stack:** Vanilla JavaScript, Node.js test runner, browser ES modules

---

## File map
- Create: `src/forge.js`
- Create: `tests/forge.test.mjs`
- Modify: `bin/stack-sleuth.js`
- Modify: `src/examples.js`
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/browser-copy.test.mjs`
- Modify: `tests/examples.test.mjs`
- Modify: `tests/readme.test.mjs`

### Task 1: Shared forge engine

**Files:**
- Create: `src/forge.js`
- Test: `tests/forge.test.mjs`

- [ ] **Step 1: Write the failing forge tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCasebookForge,
  renderCasebookForgeTextSummary,
  renderCasebookForgeMarkdownSummary,
} from '../src/forge.js';

test('analyzeCasebookForge deduplicates recurring signatures across packs and reuses known labels when possible', () => {
  const report = analyzeCasebookForge(portfolioFixture);
  assert.equal(report.summary.caseCount, 3);
  assert.equal(report.cases[0].label, 'release-2026-04-15');
  assert.ok(report.cases[0].sourcePacks.length >= 2);
  assert.match(report.exportText, /^=== release-2026-04-15 ===/m);
});

test('analyzeCasebookForge creates deterministic fallback labels and disambiguates collisions', () => {
  const report = analyzeCasebookForge(collisionFixture);
  assert.equal(report.cases[0].label, 'profile-js-nullish-data');
  assert.equal(report.cases[1].label, 'profile-js-nullish-data-2');
});

test('render helpers return copy-ready summaries', () => {
  const report = analyzeCasebookForge(portfolioFixture);
  assert.match(renderCasebookForgeTextSummary(report), /Stack Sleuth Casebook Forge/);
  assert.match(renderCasebookForgeMarkdownSummary(report), /^# Stack Sleuth Casebook Forge/m);
});
```

- [ ] **Step 2: Run the targeted tests and confirm they fail for the expected missing-module reason**

Run: `npm test -- tests/forge.test.mjs`
Expected: FAIL because `src/forge.js` does not exist yet.

- [ ] **Step 3: Implement the minimal forge engine**

```js
export function analyzeCasebookForge(input) {
  const portfolioReport = input?.priorityQueue ? input : analyzeIncidentPortfolio(input);
  const forgedCases = buildForgedCases(portfolioReport);
  return {
    portfolio: portfolioReport.portfolio,
    priorityQueue: portfolioReport.priorityQueue,
    cases: forgedCases,
    exportText: renderForgedExport(forgedCases),
    summary: buildForgeSummary(portfolioReport, forgedCases),
  };
}
```

Implementation requirements:
- Reuse portfolio analysis instead of reparsing everything manually.
- Deduplicate by incident signature.
- Prefer matched historical case labels when available.
- Fall back to deterministic slug labels derived from culprit file + diagnosis tags.
- Add stable numeric suffixes for duplicate labels.
- Preserve one representative trace per forged case for export.

- [ ] **Step 4: Run the targeted tests and confirm they pass**

Run: `npm test -- tests/forge.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit the engine slice**

```bash
git add src/forge.js tests/forge.test.mjs
git commit -m "feat: add stack sleuth casebook forge engine"
```

### Task 2: CLI, examples, and docs

**Files:**
- Modify: `bin/stack-sleuth.js`
- Modify: `src/examples.js`
- Modify: `README.md`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/examples.test.mjs`
- Modify: `tests/readme.test.mjs`

- [ ] **Step 1: Write the failing CLI and docs tests first**

```js
test('CLI reads a portfolio with --forge and prints a forged casebook export', () => {
  const result = runCli(['--forge', '-'], { input: portfolioInput });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Forge/);
  assert.match(result.stdout, /=== release-2026-04-15 ===/);
});

test('CLI forge mode supports --json and --markdown output', () => {
  const jsonResult = runCli(['--forge', '-', '--json'], { input: portfolioInput });
  assert.equal(JSON.parse(jsonResult.stdout).summary.caseCount, 3);
});

test('README documents Casebook Forge workflows for browser and CLI reuse', () => {
  assert.match(readmeText, /Casebook Forge/i);
  assert.match(readmeText, /--forge/);
  assert.match(readmeText, /=== label ===/);
});
```

- [ ] **Step 2: Run the targeted tests and confirm they fail for missing forge behavior**

Run: `npm test -- tests/cli.test.mjs tests/examples.test.mjs tests/readme.test.mjs`
Expected: FAIL because `--forge` and the new documentation do not exist yet.

- [ ] **Step 3: Implement the CLI and documentation slice**

```js
const forgePath = readOptionValue(args, '--forge');

if (forgePath) {
  const forgeInput = forgePath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(forgePath, 'forge');
  const report = analyzeCasebookForge(forgeInput);
  if (report.summary.runnablePackCount === 0) {
    fail('Casebook Forge requires at least one runnable labeled incident pack.');
  }
  writeOutput(report, mode, renderCasebookForgeTextSummary, renderCasebookForgeMarkdownSummary);
  process.exit(0);
}
```

Also:
- Add one portfolio example that clearly produces reusable forged cases.
- Document that the forged export can be saved and reused with `--history` or `@@ history @@` sections.
- Keep workflow argument validation mutually exclusive with existing modes.

- [ ] **Step 4: Run the targeted tests and then the full suite**

Run: `npm test -- tests/cli.test.mjs tests/examples.test.mjs tests/readme.test.mjs`
Expected: PASS

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit the CLI/docs slice**

```bash
git add bin/stack-sleuth.js src/examples.js README.md tests/cli.test.mjs tests/examples.test.mjs tests/readme.test.mjs
git commit -m "feat: ship casebook forge cli workflows"
```

### Task 3: Browser integration and copy flow

**Files:**
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `tests/browser-copy.test.mjs`

- [ ] **Step 1: Write the failing browser tests first**

```js
test('browser portfolio flow renders Casebook Forge summary and export cards', async () => {
  const harness = await loadBrowserHarness();
  try {
    await harness.input('trace-input', portfolioInput);
    await harness.click('explain-button');
    assert.equal(harness.get('runtime-value').textContent, 'casebook forge');
    assert.match(harness.get('summary-value').textContent, /forged .* reusable case/i);
    assert.match(harness.get('forge-summary-value').textContent, /reusable casebook/i);
    assert.match(harness.get('forge-export-value').textContent, /=== release-2026-04-15 ===/);
  } finally {
    harness.restore();
  }
});

test('browser portfolio copy support writes the forged casebook export to the clipboard', async () => {
  const harness = await loadBrowserHarness();
  try {
    await harness.input('trace-input', portfolioInput);
    await harness.click('copy-button');
    assert.match(harness.clipboard.text, /Stack Sleuth Casebook Forge/);
    assert.match(harness.clipboard.text, /=== release-2026-04-15 ===/);
  } finally {
    harness.restore();
  }
});
```

- [ ] **Step 2: Run the browser test file and confirm it fails for the expected missing forge elements**

Run: `npm test -- tests/browser-copy.test.mjs`
Expected: FAIL because the forge cards and portfolio-aware copy behavior do not exist yet.

- [ ] **Step 3: Implement the browser slice with minimal UI changes**

```js
const forge = analyzeCasebookForge(portfolio);
runtimeValue.textContent = 'casebook forge';
summaryValue.textContent = forge.summary.headline;
forgeSummaryValue.textContent = buildForgeSummaryText(forge);
forgeExportValue.textContent = forge.exportText;
```

UI requirements:
- Add dedicated Casebook Forge result cards without hiding Portfolio Radar value.
- Ensure copy behavior prefers forged export when portfolio input is active.
- Reset forge-specific cards when switching to non-portfolio workflows.
- Keep the shared workspace demo understandable on mobile.

- [ ] **Step 4: Run the targeted browser tests and the full suite**

Run: `npm test -- tests/browser-copy.test.mjs`
Expected: PASS

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit the browser slice**

```bash
git add src/main.js index.html tests/browser-copy.test.mjs
git commit -m "feat: surface casebook forge in the browser demo"
```
