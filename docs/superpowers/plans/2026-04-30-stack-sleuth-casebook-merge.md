# Stack Sleuth Casebook Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Casebook Merge workflow that turns a labeled incident portfolio into an updated living casebook with preserved guidance, merge metadata, and conflict warnings.

**Architecture:** Add a dedicated merge engine on top of the existing portfolio and forge workflows, then wire it into the CLI, browser portfolio view, docs, and examples. Preserve trusted historical guidance, synthesize lightweight merge metadata for reusable exports, and surface conflicts instead of silently hiding them.

**Tech Stack:** Node.js, built-in `node:test`, static HTML/CSS/JS, existing Stack Sleuth analysis modules

---

## File map
- Create: `src/merge.js`
- Create: `tests/merge.test.mjs`
- Modify: `bin/stack-sleuth.js`
- Modify: `src/main.js`
- Modify: `src/examples.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/browser-copy.test.mjs`
- Modify: `tests/readme.test.mjs`

### Task 1: Build the merge engine with failing tests first

**Files:**
- Create: `tests/merge.test.mjs`
- Create: `src/merge.js`

- [ ] **Step 1: Write the failing merge engine tests**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCasebookMerge,
  renderCasebookMergeTextSummary,
  renderCasebookMergeMarkdownSummary,
} from '../src/merge.js';

test('analyzeCasebookMerge preserves existing guidance, adds merge metadata, and creates new cases from portfolio evidence', () => {
  const report = analyzeCasebookMerge(portfolioFixture);
  assert.equal(report.summary.existingCaseCount, 2);
  assert.equal(report.summary.newCaseCount, 1);
  assert.equal(report.summary.updatedCaseCount, 1);
  assert.match(report.exportText, /^=== release-2026-04-15 ===/m);
  assert.match(report.exportText, /^>>> seen-count: 2$/m);
  assert.match(report.exportText, /^>>> source-packs: checkout-prod, profile-rollout$/m);
});

test('analyzeCasebookMerge flags duplicate signature conflicts without dropping the merged export', () => {
  const report = analyzeCasebookMerge(conflictFixture);
  assert.equal(report.summary.conflictCount, 1);
  assert.match(report.summary.reviewHeadline, /1 conflicted case/);
  assert.match(report.exportText, /^=== release-2026-04-15 ===/m);
});

test('renderCasebookMerge summaries are copy-ready', () => {
  const report = analyzeCasebookMerge(portfolioFixture);
  assert.match(renderCasebookMergeTextSummary(report), /Stack Sleuth Casebook Merge/);
  assert.match(renderCasebookMergeMarkdownSummary(report), /^# Stack Sleuth Casebook Merge/m);
});
```

- [ ] **Step 2: Run the merge engine tests to verify they fail**

Run: `node --test tests/merge.test.mjs`
Expected: FAIL because `src/merge.js` does not exist yet or does not export the requested functions.

- [ ] **Step 3: Write the minimal merge engine implementation**

```javascript
export function analyzeCasebookMerge(input) {
  // Build portfolio report, collect historical cases and forged cases,
  // merge by exact signature, preserve trusted metadata, and render export text.
}

export function renderCasebookMergeTextSummary(report) {
  return ['Stack Sleuth Casebook Merge'].join('\n');
}

export function renderCasebookMergeMarkdownSummary(report) {
  return ['# Stack Sleuth Casebook Merge'].join('\n');
}
```

- [ ] **Step 4: Run the merge engine tests to verify they pass**

Run: `node --test tests/merge.test.mjs`
Expected: PASS with all merge tests green.

- [ ] **Step 5: Commit the merge engine slice**

```bash
git add tests/merge.test.mjs src/merge.js
git commit -m "feat: add casebook merge engine"
```

### Task 2: Wire the CLI workflow and workflow-level tests

**Files:**
- Modify: `bin/stack-sleuth.js`
- Modify: `tests/cli.test.mjs`
- Modify: `README.md`
- Modify: `tests/readme.test.mjs`

- [ ] **Step 1: Write the failing CLI and README tests**

```javascript
test('CLI supports merge-casebook workflow in text mode', async () => {
  const result = await runCli(['--merge-casebook', fixturePath]);
  assert.match(result.stdout, /Stack Sleuth Casebook Merge/);
  assert.match(result.stdout, /Merged export/);
});

test('README documents Casebook Merge for browser and CLI users', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Casebook Merge/);
  assert.match(readme, /--merge-casebook/);
});
```

- [ ] **Step 2: Run the workflow tests to verify they fail**

Run: `node --test tests/cli.test.mjs tests/readme.test.mjs`
Expected: FAIL because the new CLI mode and docs do not exist yet.

- [ ] **Step 3: Implement the CLI workflow and docs**

```javascript
import {
  analyzeCasebookMerge,
  renderCasebookMergeTextSummary,
  renderCasebookMergeMarkdownSummary,
} from '../src/merge.js';

const mergeCasebookPath = readOptionValue(args, '--merge-casebook');
```

```markdown
## Casebook Merge

```bash
node ./bin/stack-sleuth.js --merge-casebook ./portfolio.txt
```
```

- [ ] **Step 4: Run the workflow tests to verify they pass**

Run: `node --test tests/cli.test.mjs tests/readme.test.mjs`
Expected: PASS with the new workflow covered.

- [ ] **Step 5: Commit the CLI and docs slice**

```bash
git add bin/stack-sleuth.js README.md tests/cli.test.mjs tests/readme.test.mjs
git commit -m "feat: add casebook merge cli workflow"
```

### Task 3: Add browser portfolio rendering and example coverage

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `src/examples.js`
- Modify: `tests/browser-copy.test.mjs`

- [ ] **Step 1: Write the failing browser copy tests**

```javascript
test('browser copy highlights Casebook Merge in the portfolio workflow', async () => {
  const copy = await renderPortfolioCopy();
  assert.match(copy, /Casebook Merge/);
  assert.match(copy, /living casebook/);
});
```

- [ ] **Step 2: Run the browser tests to verify they fail**

Run: `node --test tests/browser-copy.test.mjs`
Expected: FAIL because the browser does not mention Casebook Merge yet.

- [ ] **Step 3: Implement the browser cards and example wiring**

```html
<article class="card result-card wide">
  <span class="result-label">Casebook Merge summary</span>
  <p id="merge-summary-value">Paste several labeled incident packs to merge them into a living casebook.</p>
</article>
```

```javascript
const merge = analyzeCasebookMerge(report);
mergeSummaryValue.textContent = merge.summary.headline;
mergeExportValue.textContent = merge.exportText;
```

- [ ] **Step 4: Run the browser tests to verify they pass**

Run: `node --test tests/browser-copy.test.mjs`
Expected: PASS with Casebook Merge visible in portfolio flows.

- [ ] **Step 5: Commit the browser slice**

```bash
git add index.html src/main.js src/examples.js tests/browser-copy.test.mjs
git commit -m "feat: add casebook merge browser workflow"
```

### Task 4: Run the full suite and do the final polish pass

**Files:**
- Verify all files above

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`
Expected: PASS with all project tests green.

- [ ] **Step 2: Smoke-test the new CLI mode**

Run: `node ./bin/stack-sleuth.js --merge-casebook ./tests/fixtures/portfolio.txt`
Expected: text summary plus merged labeled export.

- [ ] **Step 3: Review the README and browser copy for outsider clarity**

```markdown
Make sure the docs clearly say that Stack Sleuth can now turn a portfolio into an updated living casebook, not only a one-shot forge export.
```

- [ ] **Step 4: Commit final polish**

```bash
git add README.md index.html src/main.js src/merge.js src/examples.js tests
git commit -m "docs: polish casebook merge story"
```
