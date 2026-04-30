# Stack Sleuth Handoff Briefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a labeled incident portfolio into copy-ready owner and gap handoff packets for Slack, docs, or tickets.

**Architecture:** Add a shared handoff engine on top of the existing portfolio report, then wire it through a dedicated CLI mode and the browser portfolio cards. Keep the portfolio input contract unchanged and reuse response queue plus routing-gap signals instead of inventing new state.

**Tech Stack:** Node.js, built-in `node:test`, ES modules, static browser UI.

---

## File map

- Create: `src/handoff.js`
- Modify: `src/main.js`
- Modify: `src/examples.js`
- Modify: `bin/stack-sleuth.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `README.md`
- Create: `tests/handoff.test.mjs`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/browser-copy.test.mjs`
- Modify: `tests/readme.test.mjs`

### Task 1: Build the shared handoff engine with TDD

**Files:**
- Create: `tests/handoff.test.mjs`
- Create: `src/handoff.js`

- [ ] **Step 1: Write the failing handoff engine tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHandoffBriefing,
  renderHandoffTextSummary,
  renderHandoffMarkdownSummary,
} from '../src/handoff.js';

test('buildHandoffBriefing merges owner packets and emits gap packets', () => {
  const report = buildHandoffBriefing(samplePortfolioInput);
  assert.equal(report.summary.packetCount, 3);
  assert.equal(report.ownerPackets[0].owner, 'web-platform');
  assert.equal(report.gapPackets[0].kind, 'ownership-gap');
  assert.match(report.exportText, /Owner: web-platform/);
  assert.match(report.exportText, /Gap: ownership/);
});

test('handoff renderers stay copy ready in text and markdown', () => {
  const report = buildHandoffBriefing(samplePortfolioInput);
  assert.match(renderHandoffTextSummary(report), /Stack Sleuth Handoff Briefing/);
  assert.match(renderHandoffMarkdownSummary(report), /^# Stack Sleuth Handoff Briefing/m);
});
```

- [ ] **Step 2: Run the new test file and verify it fails for the expected reason**

Run: `node --test tests/handoff.test.mjs`
Expected: FAIL with a module or export error for `src/handoff.js`.

- [ ] **Step 3: Write the minimal shared handoff engine**

```js
import { analyzeIncidentPortfolio } from './portfolio.js';

export function buildHandoffBriefing(input) {
  const portfolioReport = input?.priorityQueue ? input : analyzeIncidentPortfolio(input);
  const ownerPackets = portfolioReport.responseQueue.map((entry) => ({
    kind: 'owner',
    owner: entry.owner,
    labels: entry.labels,
    reasons: entry.labels.map((label) => {
      const pack = portfolioReport.priorityQueue.find((item) => item.label === label);
      return `${label}: ${pack?.priorityReasons?.[0] ?? 'needs triage'}`;
    }),
    summaries: [...new Set(entry.guidance.map((item) => item.summary).filter(Boolean))],
    fixes: [...new Set(entry.guidance.map((item) => item.fix).filter(Boolean))],
    runbooks: [...new Set(entry.guidance.map((item) => item.runbook).filter(Boolean))],
    ask: `Have ${entry.owner} review ${entry.labels.join(', ')} first.`,
  }));

  const gapPackets = [
    ...portfolioReport.unownedPacks.map((item) => ({
      kind: 'ownership-gap',
      labels: [item.label],
      reasons: item.priorityReasons,
      ask: `Assign an owner for ${item.label} before the next handoff.`,
    })),
    ...portfolioReport.runbookGaps.map((item) => ({
      kind: 'runbook-gap',
      labels: [item.label],
      reasons: item.priorityReasons,
      ask: `Capture or link a runbook for ${item.label}.`,
    })),
  ];

  const packets = [...ownerPackets, ...gapPackets];
  return {
    portfolio: { packOrder: portfolioReport.portfolio.packOrder },
    ownerPackets,
    gapPackets,
    packets,
    summary: {
      packCount: portfolioReport.summary.packCount,
      runnablePackCount: portfolioReport.summary.runnablePackCount,
      ownerPacketCount: ownerPackets.length,
      gapPacketCount: gapPackets.length,
      packetCount: packets.length,
      headline: ownerPackets.length
        ? `Prepared ${packets.length} handoff packets from ${portfolioReport.summary.runnablePackCount} runnable packs.`
        : 'Prepared gap-first handoff guidance because no recalled owners were found.',
    },
    exportText: renderPacketExport(ownerPackets, gapPackets),
  };
}
```

- [ ] **Step 4: Re-run the focused test file and verify it passes**

Run: `node --test tests/handoff.test.mjs`
Expected: PASS

- [ ] **Step 5: Refactor only if needed, then commit the engine slice**

```bash
git add tests/handoff.test.mjs src/handoff.js
git commit -m "feat: add stack sleuth handoff engine"
```

### Task 2: Wire the CLI mode with TDD

**Files:**
- Modify: `tests/cli.test.mjs`
- Modify: `bin/stack-sleuth.js`
- Modify: `src/examples.js`

- [ ] **Step 1: Add failing CLI tests for `--handoff`**

```js
test('CLI reads a portfolio with --handoff and prints a handoff briefing', () => {
  const result = runCli(['--handoff', '-'], { input: portfolioInput });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Handoff Briefing/);
  assert.match(result.stdout, /Owner: web-platform/);
  assert.match(result.stdout, /Gap: ownership/);
});

test('CLI handoff mode supports --json and --markdown output', () => {
  const jsonResult = runCli(['--handoff', '-', '--json'], { input: portfolioInput });
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.summary.packetCount, 4);
  assert.equal(parsed.ownerPackets[0].owner, 'web-platform');

  const markdownResult = runCli(['--handoff', '-', '--markdown'], { input: portfolioInput });
  assert.match(markdownResult.stdout, /^# Stack Sleuth Handoff Briefing/m);
});
```

- [ ] **Step 2: Run the focused CLI test selection and verify it fails because `--handoff` is unsupported**

Run: `node --test tests/cli.test.mjs --test-name-pattern="handoff"`
Expected: FAIL with argument handling or missing renderer support.

- [ ] **Step 3: Add the minimal CLI plumbing**

```js
import {
  buildHandoffBriefing,
  renderHandoffTextSummary,
  renderHandoffMarkdownSummary,
} from '../src/handoff.js';

const handoffArgumentError = validateOptionValue(args, '--handoff');
const handoffPath = readOptionValue(args, '--handoff');

if (handoffArgumentError) {
  fail(handoffArgumentError);
}

if (handoffPath) {
  const handoffInput = handoffPath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(handoffPath, 'handoff');
  const portfolio = parseIncidentPortfolio(handoffInput);
  if (!portfolio.packOrder.length) {
    fail('Handoff mode requires @@@ label @@@ blocks around one or more incident packs.');
  }

  const report = buildHandoffBriefing(portfolio);
  if (!report.summary.runnablePackCount) {
    fail('Handoff mode requires at least one runnable labeled incident pack.');
  }

  writeOutput(report, mode, renderHandoffTextSummary, renderHandoffMarkdownSummary);
  process.exit(0);
}
```

- [ ] **Step 4: Update the example catalog so the browser can advertise the handoff story**

```js
{
  label: 'Handoff Briefing',
  caption: 'A labeled incident portfolio turns into owner-specific handoff packets plus explicit routing and runbook gaps that are ready to paste into chat or tickets.',
  portfolio: portfolioTrace,
}
```

- [ ] **Step 5: Re-run the focused CLI tests and then the full CLI suite**

Run: `node --test tests/cli.test.mjs --test-name-pattern="handoff"`
Expected: PASS

Run: `node --test tests/cli.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit the CLI slice**

```bash
git add tests/cli.test.mjs bin/stack-sleuth.js src/examples.js
git commit -m "feat: add stack sleuth handoff cli"
```

### Task 3: Add browser cards and export copy with TDD

**Files:**
- Modify: `tests/browser-copy.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main.js`

- [ ] **Step 1: Add failing browser tests for the new handoff cards**

```js
assert.match(indexHtml, /Handoff Briefing/i);
assert.match(indexHtml, />Load Handoff Briefing example</i);

await harness.input('trace-input', portfolioInput);
await harness.click('explain-button');
assert.match(harness.get('handoff-summary-value').textContent, /Prepared .* handoff packets/i);
assert.match(harness.get('handoff-export-value').textContent, /Owner: web-platform/);
```

- [ ] **Step 2: Run the focused browser test selection and verify it fails because the DOM ids or rendering do not exist yet**

Run: `node --test tests/browser-copy.test.mjs --test-name-pattern="handoff|portfolio flow keeps"`
Expected: FAIL with missing ids or missing rendered text.

- [ ] **Step 3: Add the browser card markup and multiline styling**

```html
<article class="result-card">
  <span class="result-label">Handoff Briefing summary</span>
  <p id="handoff-summary-value">Paste several labeled incident packs to prepare owner and gap handoff packets.</p>
</article>
<article class="result-card result-card--wide">
  <span class="result-label">Handoff Briefing export</span>
  <p id="handoff-export-value">Handoff packet export text will appear here after Handoff Briefing runs.</p>
</article>
```

```css
#forge-export-value,
#dataset-export-value,
#merge-export-value,
#handoff-export-value {
  white-space: pre-wrap;
}
```

- [ ] **Step 4: Wire portfolio rendering and reset behavior in `src/main.js`**

```js
import { buildHandoffBriefing } from './handoff.js';

const handoffSummaryValue = document.querySelector('#handoff-summary-value');
const handoffExportValue = document.querySelector('#handoff-export-value');
const loadHandoffButton = document.querySelector('#load-handoff-button');

const handoff = buildHandoffBriefing(report);
handoffSummaryValue.textContent = handoff.summary.headline;
handoffExportValue.textContent = handoff.exportText || 'No handoff export available yet.';
```

- [ ] **Step 5: Re-run the focused browser tests and then the full browser suite**

Run: `node --test tests/browser-copy.test.mjs --test-name-pattern="handoff|portfolio flow keeps|portfolio Casebook"`
Expected: PASS

Run: `node --test tests/browser-copy.test.mjs`
Expected: PASS

- [ ] **Step 6: Commit the browser slice**

```bash
git add tests/browser-copy.test.mjs index.html styles.css src/main.js
git commit -m "feat: surface stack sleuth handoff packets in browser"
```

### Task 4: Refresh docs and regression coverage with TDD

**Files:**
- Modify: `tests/readme.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Add failing README assertions for Handoff Briefing**

```js
assert.match(readme, /Handoff Briefing/i);
assert.match(readme, /--handoff/);
assert.match(readme, /owner-specific handoff packets|owner packets/i);
assert.match(readme, /routing gaps|runbook gaps/i);
```

- [ ] **Step 2: Run the focused README test selection and verify it fails because the docs do not mention the workflow yet**

Run: `node --test tests/readme.test.mjs --test-name-pattern="Handoff"`
Expected: FAIL with missing README text.

- [ ] **Step 3: Document the workflow in the public README**

```md
## Handoff Briefing

Handoff Briefing turns the same labeled portfolio used by Portfolio Radar into copy-ready owner packets and explicit gap packets. Use it when you want something you can paste into Slack, an incident doc, or a ticket queue.

```bash
node ./bin/stack-sleuth.js --handoff ./portfolio.txt
```
```

- [ ] **Step 4: Run the README suite and then the full project suite**

Run: `node --test tests/readme.test.mjs`
Expected: PASS

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit the docs slice**

```bash
git add tests/readme.test.mjs README.md
git commit -m "docs: add stack sleuth handoff workflow"
```
