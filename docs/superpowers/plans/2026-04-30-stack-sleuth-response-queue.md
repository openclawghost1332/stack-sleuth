# Stack Sleuth Response Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Portfolio Radar so a labeled portfolio produces a deterministic owner-aware response queue, runbook coverage view, and explicit routing gaps.

**Architecture:** Keep the existing labeled portfolio input format and existing per-pack briefing engine. Add aggregation helpers inside `src/portfolio.js` that derive owner, runbook, fix, and gap data from casebook guidance already attached to pack reports, then expose the new structure through the existing CLI, renderers, browser cards, examples, and README.

**Tech Stack:** plain JavaScript ES modules, Node test runner, static browser UI

---

## File Structure

- Modify: `src/portfolio.js` for queue aggregation, summary metrics, and text/markdown rendering
- Modify: `tests/portfolio.test.mjs` for aggregation and rendering coverage
- Modify: `tests/cli.test.mjs` for portfolio CLI output coverage
- Modify: `src/examples.js` for a portfolio example with owner and runbook metadata plus one gap
- Modify: `src/main.js` for browser rendering of queue and gap cards
- Modify: `index.html` if new portfolio cards or labels are needed
- Modify: `styles.css` only if the new cards need layout support
- Modify: `README.md` for public workflow docs
- Modify: `tests/examples.test.mjs`, `tests/browser-copy.test.mjs`, and `tests/readme.test.mjs` if copy, examples, or docs expectations change

### Task 1: Add shared response-queue aggregation to Portfolio Radar

**Files:**
- Modify: `src/portfolio.js`
- Test: `tests/portfolio.test.mjs`

- [ ] **Step 1: Write the failing portfolio tests for owner routing, runbook gaps, and rendering**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeIncidentPortfolio,
  renderIncidentPortfolioTextSummary,
  renderIncidentPortfolioMarkdownSummary,
} from '../src/portfolio.js';

test('analyzeIncidentPortfolio builds a response queue from recalled casebook guidance', () => {
  const report = analyzeIncidentPortfolio(portfolioFixtureWithOwners);

  assert.equal(report.summary.ownedPackCount, 1);
  assert.equal(report.summary.unownedPackCount, 1);
  assert.equal(report.summary.runbookCoveredPackCount, 1);
  assert.equal(report.summary.runbookGapCount, 1);
  assert.equal(report.responseQueue[0].owner, 'web-platform');
  assert.deepEqual(report.responseQueue[0].labels, ['profile-rollout']);
  assert.match(report.responseQueue[0].guidance[0].fix, /Guard renderProfile/);
  assert.deepEqual(report.runbookGaps.map((item) => item.label), ['profile-rollout']);
  assert.deepEqual(report.unownedPacks.map((item) => item.label), ['checkout-prod']);
});

test('portfolio renderers include response queue and routing gaps', () => {
  const report = analyzeIncidentPortfolio(portfolioFixtureWithOwners);
  const text = renderIncidentPortfolioTextSummary(report);
  const markdown = renderIncidentPortfolioMarkdownSummary(report);

  assert.match(text, /Response queue/);
  assert.match(text, /web-platform/);
  assert.match(text, /Routing gaps/);
  assert.match(markdown, /## Response queue/);
  assert.match(markdown, /## Routing gaps/);
});
```

- [ ] **Step 2: Run the focused portfolio tests to verify they fail for the expected missing fields**

Run: `node --test tests/portfolio.test.mjs`
Expected: FAIL with missing `responseQueue`, `runbookGaps`, `ownedPackCount`, or missing queue section render output.

- [ ] **Step 3: Implement the minimal aggregation helpers and summary fields in `src/portfolio.js`**

```js
function collectResponseSignals(packReports) {
  const ownerEntries = new Map();
  const runbookGaps = [];
  const unownedPacks = [];

  for (const packReport of packReports) {
    if (!packReport.runnable) continue;

    const guidance = collectPackGuidance(packReport.report);
    const owners = new Map();
    let hasRunbook = false;

    for (const item of guidance) {
      if (item.runbook) hasRunbook = true;
      if (!item.owner) continue;
      const entry = owners.get(item.owner) ?? { owner: item.owner, labels: [], guidance: [] };
      entry.labels.push(packReport.label);
      entry.guidance.push(item);
      owners.set(item.owner, entry);
    }

    if (!owners.size) {
      unownedPacks.push({ label: packReport.label, priorityScore: packReport.priorityScore, reasons: packReport.priorityReasons });
    }

    if (!hasRunbook) {
      runbookGaps.push({ label: packReport.label, priorityScore: packReport.priorityScore, reasons: packReport.priorityReasons });
    }

    for (const entry of owners.values()) {
      const bucket = ownerEntries.get(entry.owner) ?? { owner: entry.owner, labels: [], guidance: [], highestPriorityScore: -1 };
      bucket.labels.push(...entry.labels);
      bucket.guidance.push(...entry.guidance);
      bucket.highestPriorityScore = Math.max(bucket.highestPriorityScore, packReport.priorityScore);
      ownerEntries.set(entry.owner, bucket);
    }
  }

  return { responseQueue, runbookGaps, unownedPacks };
}
```

- [ ] **Step 4: Extend text and markdown rendering with queue and gap sections**

```js
const lines = [
  'Stack Sleuth Portfolio Radar',
  `Owned packs: ${report.summary.ownedPackCount}`,
  `Unowned packs: ${report.summary.unownedPackCount}`,
  `Runbook-covered packs: ${report.summary.runbookCoveredPackCount}`,
  `Runbook gaps: ${report.summary.runbookGapCount}`,
  '',
  'Response queue',
  ...formatResponseQueue(report.responseQueue),
  '',
  'Routing gaps',
  ...formatRoutingGaps(report.unownedPacks, report.runbookGaps),
];
```

- [ ] **Step 5: Run the focused portfolio tests to verify they pass**

Run: `node --test tests/portfolio.test.mjs`
Expected: PASS with the new aggregation and rendering checks green.

- [ ] **Step 6: Commit the aggregation slice**

```bash
git add src/portfolio.js tests/portfolio.test.mjs
git commit -m "feat: add stack sleuth response queue"
```

### Task 2: Expose the response queue through CLI-facing outputs and public fixtures

**Files:**
- Modify: `tests/cli.test.mjs`
- Modify: `src/examples.js`
- Modify: `README.md`
- Modify: `tests/examples.test.mjs`
- Modify: `tests/readme.test.mjs`

- [ ] **Step 1: Write failing tests for portfolio CLI output and example text**

```js
test('CLI portfolio output includes response queue and routing gaps', () => {
  const result = runCli(['--portfolio', '-', '--markdown'], { input: portfolioInputWithOwners });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Response queue/);
  assert.match(result.stdout, /web-platform/);
  assert.match(result.stdout, /Routing gaps/);
});

test('portfolio example advertises owner-aware routing and runbook gaps', () => {
  const example = examples.find((item) => item.label === 'Portfolio radar');
  assert.match(example.caption, /owner-aware queue/i);
  assert.match(example.portfolio, />>> owner:/);
});
```

- [ ] **Step 2: Run the focused CLI, example, and README tests to verify they fail**

Run: `node --test tests/cli.test.mjs tests/examples.test.mjs tests/readme.test.mjs`
Expected: FAIL because the portfolio output, example caption, or README text has not been updated yet.

- [ ] **Step 3: Update the portfolio fixture, example copy, and README workflow docs**

```md
Portfolio Radar now adds a deterministic response queue:
- recalled owners grouped by impacted pack labels
- known fixes and runbook links surfaced from casebook metadata
- explicit routing gaps for packs with no owner or no runbook
```

- [ ] **Step 4: Re-run the focused CLI, example, and README tests**

Run: `node --test tests/cli.test.mjs tests/examples.test.mjs tests/readme.test.mjs`
Expected: PASS with queue and routing-gap coverage in the public interfaces.

- [ ] **Step 5: Commit the CLI and documentation slice**

```bash
git add tests/cli.test.mjs src/examples.js README.md tests/examples.test.mjs tests/readme.test.mjs
git commit -m "feat: document stack sleuth response queue"
```

### Task 3: Surface the response queue in the browser demo and copy flow

**Files:**
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `styles.css` (only if needed)
- Modify: `tests/browser-copy.test.mjs`

- [ ] **Step 1: Write the failing browser-copy test for response queue rendering**

```js
test('portfolio browser workflow surfaces response queue and routing gaps', () => {
  renderPortfolioWorkflow(portfolioWithOwners);

  assert.match(portfolioSummaryValue.textContent, /owner-aware/i);
  assert.match(portfolioPriorityValue.textContent, /profile-rollout/i);
  assert.match(responseQueueValue.textContent, /web-platform/i);
  assert.match(routingGapsValue.textContent, /checkout-prod/i);
});
```

- [ ] **Step 2: Run the focused browser test to verify it fails**

Run: `node --test tests/browser-copy.test.mjs`
Expected: FAIL because the browser DOM does not yet expose response queue or routing-gap nodes.

- [ ] **Step 3: Add the minimal browser cards and rendering helpers**

```js
const portfolioResponseQueueValue = document.querySelector('#portfolio-response-queue-value');
const portfolioRoutingGapsValue = document.querySelector('#portfolio-routing-gaps-value');

portfolioResponseQueueValue.replaceChildren(...buildListItems(buildPortfolioResponseQueueItems(report.responseQueue)));
portfolioRoutingGapsValue.replaceChildren(...buildListItems(buildPortfolioRoutingGapItems(report.unownedPacks, report.runbookGaps)));
```

- [ ] **Step 4: Re-run the browser test and then the full suite**

Run: `node --test tests/browser-copy.test.mjs`
Expected: PASS

Run: `npm test`
Expected: PASS with the full suite green.

- [ ] **Step 5: Commit the browser slice**

```bash
git add src/main.js index.html styles.css tests/browser-copy.test.mjs
git commit -m "feat: add portfolio response queue browser view"
```

### Task 4: Final verification and branch handoff

**Files:**
- Review only: `git status`, changed files above

- [ ] **Step 1: Review the final diff for accidental scope creep**

Run: `git diff --stat HEAD~3..HEAD`
Expected: only portfolio, browser, example, docs, and related tests changed.

- [ ] **Step 2: Run the full suite one more time from the repo root**

Run: `npm test`
Expected: PASS, no failures.

- [ ] **Step 3: Capture final branch status**

Run: `git status --short && git log --oneline -n 5`
Expected: clean working tree and the response-queue commits on top.
