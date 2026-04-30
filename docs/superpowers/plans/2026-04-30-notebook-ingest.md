# Stack Sleuth Incident Notebook Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Stack Sleuth ingest markdown incident notebooks, normalize them into existing incident-pack or portfolio shapes, and run the existing briefing and ranking engines without forcing manual `@@` or `@@@` rewrites first.

**Architecture:** Add one shared `src/notebook.js` parser that recognizes markdown heading aliases and optional pack groupings, then routes normalized output into the existing Incident Pack Briefing and Portfolio Radar paths. Keep analysis logic unchanged where possible by reusing `parseIncidentPack`, `parseIncidentPortfolio`, `analyzeIncidentPack`, `analyzeIncidentPortfolio`, and `analyzeCasebookForge`, while exposing notebook mode through the CLI, browser, examples, and copy flow.

**Tech Stack:** Node.js ESM, built-in `node:test`, existing Stack Sleuth browser UI, deterministic markdown-style parsing.

---

## File structure map

**Create**
- `src/notebook.js` - parse markdown incident notebooks, normalize to pack/portfolio text, and provide routing metadata.
- `tests/notebook.test.mjs` - unit coverage for notebook parsing, alias handling, normalization, and routing.
- `docs/notebook-ingest-plan.md` - public-facing concise plan note for the repo.

**Modify**
- `bin/stack-sleuth.js` - add `--notebook <path|->` workflow, validation, and output serialization.
- `src/main.js` - detect notebook input in the shared textarea, route it through notebook mode, and update copy behavior.
- `src/examples.js` - add notebook examples for single-pack and portfolio-shaped notes.
- `index.html` - mention notebook input and add a notebook example button.
- `README.md` - document notebook ingest for browser and CLI usage.
- `tests/cli.test.mjs` - add notebook CLI success and error coverage.
- `tests/browser-copy.test.mjs` - add notebook browser routing and copy assertions.
- `tests/examples.test.mjs` - assert notebook examples are shipped and runnable.
- `tests/readme.test.mjs` - assert README documents notebook workflows.

---

### Task 1: Build the shared notebook parser and routing core

**Files:**
- Create: `src/notebook.js`
- Test: `tests/notebook.test.mjs`
- Modify: `src/main.js`

- [ ] **Step 1: Write the failing notebook parser tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIncidentNotebook,
  renderNotebookNormalizedText,
} from '../src/notebook.js';

test('parseIncidentNotebook normalizes one markdown incident note into an incident pack', () => {
  const notebook = [
    '# Checkout prod handoff',
    '',
    '## Current incident',
    '```text',
    "TypeError: Cannot read properties of undefined (reading 'name')",
    '    at renderProfile (/app/src/profile.js:88:17)',
    '```',
    '',
    '## Prior incidents',
    '```text',
    '=== release-2026-04-15 ===',
    "TypeError: Cannot read properties of undefined (reading 'name')",
    '    at renderProfile (/app/src/profile.js:88:17)',
    '```',
  ].join('\n');

  const parsed = parseIncidentNotebook(notebook);

  assert.equal(parsed.kind, 'pack');
  assert.deepEqual(parsed.sectionOrder, ['current', 'history']);
  assert.match(parsed.normalizedText, /@@ current @@/);
  assert.match(parsed.normalizedText, /@@ history @@/);
  assert.match(renderNotebookNormalizedText(parsed), /@@ current @@/);
});

test('parseIncidentNotebook normalizes grouped markdown notes into a portfolio', () => {
  const notebook = [
    '# Pack: checkout-prod',
    '## Current',
    '```text',
    "TypeError: Cannot read properties of undefined (reading 'name')",
    '    at renderProfile (/app/src/profile.js:88:17)',
    '```',
    '',
    '# Pack: billing-canary',
    '## Baseline',
    '```text',
    "TypeError: Cannot read properties of undefined (reading 'name')",
    '    at renderProfile (/app/src/profile.js:88:17)',
    '```',
    '## Candidate',
    '```text',
    "TypeError: Cannot read properties of undefined (reading 'email')",
    '    at renderInvoice (/app/src/invoice.js:19:7)',
    '```',
  ].join('\n');

  const parsed = parseIncidentNotebook(notebook);

  assert.equal(parsed.kind, 'portfolio');
  assert.deepEqual(parsed.packOrder, ['checkout-prod', 'billing-canary']);
  assert.match(parsed.normalizedText, /@@@ checkout-prod @@@/);
  assert.match(parsed.normalizedText, /@@ candidate @@/);
});

test('parseIncidentNotebook records missing runnable sections when headings exist but no supported content is present', () => {
  const notebook = ['# Incident note', '## Notes', 'No traces here yet.'].join('\n');
  const parsed = parseIncidentNotebook(notebook);

  assert.equal(parsed.kind, 'unsupported');
  assert.match(parsed.reason, /supported notebook headings/i);
});
```

- [ ] **Step 2: Run the notebook parser test to verify RED**

Run: `node --test tests/notebook.test.mjs`
Expected: FAIL with `Cannot find module '../src/notebook.js'` or missing export errors.

- [ ] **Step 3: Write the minimal notebook parser implementation**

```js
const HEADING_RE = /^(#{1,3})\s+(.+)$/gm;

export function parseIncidentNotebook(input) {
  const source = String(input ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) {
    return emptyNotebook('unsupported', 'Notebook input is empty.');
  }

  const headings = collectHeadings(source);
  const groupedPacks = buildNotebookPacks(source, headings);

  if (groupedPacks.length >= 2) {
    const normalizedText = groupedPacks
      .map((pack) => `@@@ ${pack.label} @@@\n${renderPackSections(pack.sections)}`)
      .join('\n\n')
      .trim();

    return {
      kind: 'portfolio',
      source,
      packOrder: groupedPacks.map((pack) => pack.label),
      packs: groupedPacks,
      normalizedText,
    };
  }

  const singlePack = groupedPacks[0] ?? buildSingleNotebookPack(source, headings);
  if (!singlePack.sectionOrder.length) {
    return emptyNotebook('unsupported', 'Notebook mode requires supported headings like Current, Prior incidents, Baseline, Candidate, or Timeline.');
  }

  return {
    kind: 'pack',
    source,
    sectionOrder: singlePack.sectionOrder,
    sections: singlePack.sections,
    normalizedText: renderPackSections(singlePack.sections),
  };
}

export function renderNotebookNormalizedText(parsed) {
  return parsed?.normalizedText ?? '';
}
```

- [ ] **Step 4: Run the notebook parser test to verify GREEN**

Run: `node --test tests/notebook.test.mjs`
Expected: PASS.

- [ ] **Step 5: Refactor and add routing helpers for later integration**

```js
export function analyzeIncidentNotebook(input, dependencies) {
  const parsed = input?.kind ? input : parseIncidentNotebook(input);
  if (parsed.kind === 'portfolio') {
    const report = dependencies.analyzeIncidentPortfolio(parsed.normalizedText);
    return { mode: 'portfolio', parsed, report };
  }
  if (parsed.kind === 'pack') {
    const report = dependencies.analyzeIncidentPack(parsed.normalizedText);
    return { mode: 'pack', parsed, report };
  }
  return { mode: 'unsupported', parsed, report: null };
}
```

- [ ] **Step 6: Commit Task 1**

```bash
git add src/notebook.js tests/notebook.test.mjs
git commit -m "feat: add notebook normalization core"
```

### Task 2: Add CLI notebook mode with JSON serialization and guardrails

**Files:**
- Modify: `bin/stack-sleuth.js`
- Modify: `tests/cli.test.mjs`
- Modify: `src/notebook.js`

- [ ] **Step 1: Write the failing CLI notebook tests**

```js
test('CLI reads a markdown incident notebook with --notebook and routes it into an incident pack briefing', () => {
  const result = runCli(['--notebook', '-'], { input: notebookPackInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Incident Pack Briefing/);
  assert.match(result.stdout, /Notebook normalization/i);
  assert.match(result.stdout, /@@ current @@/);
});

test('CLI reads a grouped markdown notebook with --notebook --json and routes it into portfolio radar', () => {
  const result = runCli(['--notebook', '-', '--json'], { input: notebookPortfolioInput });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.notebook.kind, 'portfolio');
  assert.equal(parsed.summary.runnablePackCount, 2);
  assert.match(parsed.notebook.normalizedText, /@@@ checkout-prod @@@/);
});

test('CLI notebook mode exits non-zero when no supported notebook headings are present', () => {
  const result = runCli(['--notebook', '-'], { input: '# notes\n\nNothing actionable yet.' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Notebook mode requires supported headings/i);
});
```

- [ ] **Step 2: Run the targeted CLI tests to verify RED**

Run: `node --test tests/cli.test.mjs`
Expected: FAIL with unknown `--notebook` behavior or missing serialization fields.

- [ ] **Step 3: Implement CLI notebook mode using existing renderers**

```js
import {
  analyzeIncidentNotebook,
  parseIncidentNotebook,
  renderNotebookNormalizedText,
} from '../src/notebook.js';

const notebookArgumentError = validateOptionValue(args, '--notebook');
const notebookPath = readOptionValue(args, '--notebook');

if (notebookPath) {
  const notebookInput = notebookPath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(notebookPath, 'notebook');
  const notebook = parseIncidentNotebook(notebookInput);
  const routed = analyzeIncidentNotebook(notebook, { analyzeIncidentPack, analyzeIncidentPortfolio });

  if (routed.mode === 'unsupported') {
    fail(notebook.reason ?? 'Notebook mode requires supported headings like Current, Prior incidents, Baseline, Candidate, or Timeline.');
  }

  writeOutput(
    { notebook, routed },
    mode,
    renderNotebookCliTextSummary,
    renderNotebookCliMarkdownSummary
  );
  process.exit(0);
}
```

- [ ] **Step 4: Implement serializer and text/markdown wrappers**

```js
function renderNotebookCliTextSummary(payload) {
  const routedText = payload.routed.mode === 'portfolio'
    ? renderIncidentPortfolioTextSummary(payload.routed.report)
    : renderIncidentPackTextSummary(payload.routed.report);

  return [
    'Notebook normalization',
    payload.notebook.kind === 'portfolio' ? `Kind: portfolio (${payload.notebook.packOrder.length} packs)` : `Kind: pack (${payload.notebook.sectionOrder.length} sections)`,
    '',
    payload.notebook.normalizedText,
    '',
    routedText,
  ].join('\n').trim();
}
```

- [ ] **Step 5: Run the targeted CLI tests to verify GREEN**

Run: `node --test tests/cli.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add bin/stack-sleuth.js src/notebook.js tests/cli.test.mjs
git commit -m "feat: add notebook CLI workflow"
```

### Task 3: Expose notebook ingest in the browser, examples, and public docs

**Files:**
- Modify: `src/main.js`
- Modify: `src/examples.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `tests/browser-copy.test.mjs`
- Modify: `tests/examples.test.mjs`
- Modify: `tests/readme.test.mjs`
- Create: `docs/notebook-ingest-plan.md`

- [ ] **Step 1: Write the failing browser, examples, and README tests**

```js
test('browser notebook flow routes markdown incident notes into notebook mode and copies the normalized bundle plus briefing', async () => {
  const harness = await loadBrowserHarness();
  try {
    await harness.input('trace-input', notebookPackInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Notebook normalization/);
    assert.match(harness.clipboard.text, /@@ current @@/);
    assert.match(harness.clipboard.text, /Stack Sleuth Incident Pack Briefing/);
  } finally {
    harness.restore();
  }
});

test('examples ship a notebook ingest demo', () => {
  const notebookExample = examples.find((item) => item.label === 'Notebook ingest');
  assert.ok(notebookExample);
  assert.match(notebookExample.notebook, /^# /m);
  assert.match(notebookExample.caption, /markdown|notebook|handoff/i);
});

test('README documents notebook ingest workflows for browser and CLI', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Notebook ingest/i);
  assert.match(readme, /--notebook/);
  assert.match(readme, /## Current incident/i);
});
```

- [ ] **Step 2: Run the affected tests to verify RED**

Run: `node --test tests/browser-copy.test.mjs tests/examples.test.mjs tests/readme.test.mjs`
Expected: FAIL because notebook UI/docs/examples are missing.

- [ ] **Step 3: Implement browser notebook routing and copy behavior**

```js
const loadNotebookButton = document.querySelector('#load-notebook-button');
const notebookExample = examples.find((item) => item.label === 'Notebook ingest');

const notebook = parseIncidentNotebook(traceText);
if (notebook.kind !== 'unsupported') {
  renderNotebookWorkflow(notebook);
  return;
}

async function copyDiagnosis() {
  const notebook = parseIncidentNotebook(traceInput.value.trim());
  if (notebook.kind !== 'unsupported') {
    const routed = analyzeIncidentNotebook(notebook, { analyzeIncidentPack, analyzeIncidentPortfolio });
    const summary = routed.mode === 'portfolio'
      ? renderIncidentPortfolioTextSummary(routed.report)
      : renderIncidentPackTextSummary(routed.report);
    await navigator.clipboard.writeText(['Notebook normalization', notebook.normalizedText, '', summary].join('\n').trim());
    caption.textContent = 'Notebook briefing copied to clipboard.';
    return;
  }
}
```

- [ ] **Step 4: Add notebook example content, button copy, README section, and public plan note**

```md
## Notebook ingest

Paste a markdown handoff note with headings like `## Current incident`, `## Prior incidents`, `## Baseline`, `## Candidate`, and `## Timeline`, then run:

```bash
node ./bin/stack-sleuth.js --notebook ./incident-note.md
```

Stack Sleuth will normalize the note into an incident pack or multi-pack portfolio and then reuse the existing briefing or portfolio engines.
```

- [ ] **Step 5: Run the full suite to verify GREEN**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/main.js src/examples.js index.html README.md docs/notebook-ingest-plan.md tests/browser-copy.test.mjs tests/examples.test.mjs tests/readme.test.mjs
git commit -m "feat: ship notebook ingest workflow"
```

---

## Self-review checklist

- Notebook mode must stay deterministic, with explicit supported heading aliases and no source-specific heuristics.
- Pack and portfolio notebook paths must normalize into existing `@@` and `@@@` formats instead of reimplementing the analyzers.
- CLI text, markdown, and JSON output must all expose notebook metadata plus the routed result.
- Browser copy must produce something useful to paste into chat or docs, not just raw normalized text.
- README, examples, and the public plan note must make the notebook workflow legible to an outsider in under 30 seconds.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-30-notebook-ingest.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints