# Stack Sleuth response bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deterministic response bundle export so Stack Sleuth can turn one portfolio-shaped incident workflow into a shareable incident command package.

**Architecture:** Reuse the existing portfolio, dossier, handoff, dataset, and merge engines to build a small file map in `src/bundle.js`, then let the CLI write that map into a deterministic directory when `--bundle <dir>` is requested. Keep the bundle portfolio-first, and fail clearly when routed inputs normalize into a single pack instead of a portfolio.

**Tech Stack:** Node.js, built-in `node:test`, filesystem writes via `node:fs`, existing Stack Sleuth renderers and analyzers.

---

## File map
- Create: `src/bundle.js`
- Create: `tests/bundle.test.mjs`
- Modify: `bin/stack-sleuth.js`
- Modify: `tests/cli.test.mjs`
- Modify: `README.md`
- Modify: `tests/readme.test.mjs`
- Create: `sample/response-bundle/manifest.json`
- Create: `sample/response-bundle/incident-dossier.html`
- Create: `sample/response-bundle/portfolio-summary.md`
- Create: `sample/response-bundle/handoff.md`
- Create: `sample/response-bundle/casebook.txt`
- Create: `sample/response-bundle/casebook-dataset.json`
- Create: `sample/response-bundle/merge-review.md`

### Task 1: Build the response-bundle file map

**Files:**
- Create: `tests/bundle.test.mjs`
- Create: `src/bundle.js`

- [ ] **Step 1: Write the failing bundle builder tests**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { buildResponseBundle } from '../src/bundle.js';

const portfolioInput = `@@@ checkout-prod @@@\n@@ current @@\nTypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n@@ history @@\n=== release-2026-04-15 ===\nTypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n\n@@@ billing-canary @@@\n@@ baseline @@\nTypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n@@ candidate @@\nTypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)`;

test('buildResponseBundle returns deterministic files and manifest metadata', () => {
  const report = analyzeIncidentPortfolio(portfolioInput);
  const bundle = buildResponseBundle({ report, sourceMode: 'portfolio', sourceLabel: 'sample/portfolio.txt' });

  assert.equal(bundle.kind, 'stack-sleuth-response-bundle');
  assert.equal(bundle.version, 1);
  assert.deepEqual(Object.keys(bundle.files).sort(), [
    'casebook-dataset.json',
    'casebook.txt',
    'handoff.md',
    'incident-dossier.html',
    'manifest.json',
    'merge-review.md',
    'portfolio-summary.md',
  ]);
  const manifest = JSON.parse(bundle.files['manifest.json']);
  assert.equal(manifest.source.mode, 'portfolio');
  assert.equal(manifest.files.length, 7);
  assert.equal(manifest.summary.runnablePackCount, report.summary.runnablePackCount);
  assert.match(bundle.files['incident-dossier.html'], /<!doctype html>/i);
  assert.match(bundle.files['portfolio-summary.md'], /Portfolio Radar/i);
  assert.match(bundle.files['handoff.md'], /Handoff Briefing/i);
  assert.match(bundle.files['casebook.txt'], /===/);
  assert.match(bundle.files['merge-review.md'], /Casebook Merge/i);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/bundle.test.mjs`
Expected: FAIL because `src/bundle.js` does not exist or `buildResponseBundle` is not exported yet.

- [ ] **Step 3: Write the minimal bundle builder**

```javascript
import { renderIncidentPortfolioMarkdownSummary } from './portfolio.js';
import { renderIncidentDossierHtml } from './report.js';
import { buildHandoffBriefing, renderHandoffMarkdownSummary } from './handoff.js';
import { buildCasebookDataset } from './dataset.js';
import { analyzeCasebookMerge, renderCasebookMergeMarkdownSummary } from './merge.js';

export const RESPONSE_BUNDLE_KIND = 'stack-sleuth-response-bundle';
export const RESPONSE_BUNDLE_VERSION = 1;

export function buildResponseBundle({ report, sourceMode = 'portfolio', sourceLabel = null } = {}) {
  const handoff = buildHandoffBriefing(report);
  const dataset = buildCasebookDataset(report);
  const merge = analyzeCasebookMerge(report);

  const files = {
    'incident-dossier.html': renderIncidentDossierHtml({ mode: 'portfolio', report, originLabel: sourceLabel ? `Bundle source: ${sourceLabel}` : 'Response Bundle' }),
    'portfolio-summary.md': renderIncidentPortfolioMarkdownSummary(report),
    'handoff.md': renderHandoffMarkdownSummary(handoff),
    'casebook.txt': merge.exportText,
    'casebook-dataset.json': JSON.stringify(dataset, null, 2),
    'merge-review.md': renderCasebookMergeMarkdownSummary(merge),
  };

  const manifest = {
    kind: RESPONSE_BUNDLE_KIND,
    version: RESPONSE_BUNDLE_VERSION,
    generatedAt: new Date().toISOString(),
    source: { mode: sourceMode, label: sourceLabel },
    summary: {
      headline: report.summary?.headline ?? 'No portfolio headline available.',
      releaseGateVerdict: report.gate?.verdict ?? 'unknown',
      packCount: report.summary?.packCount ?? 0,
      runnablePackCount: report.summary?.runnablePackCount ?? 0,
      ownerCount: report.responseQueue?.length ?? 0,
      recurringIncidentCount: report.recurringIncidents?.length ?? 0,
      recurringHotspotCount: report.recurringHotspots?.length ?? 0,
    },
    files: Object.keys(files).sort(),
  };

  files['manifest.json'] = JSON.stringify({ ...manifest, files: [...manifest.files, 'manifest.json'].sort() }, null, 2);

  return {
    kind: RESPONSE_BUNDLE_KIND,
    version: RESPONSE_BUNDLE_VERSION,
    manifest: JSON.parse(files['manifest.json']),
    files,
  };
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- tests/bundle.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit the bundle builder**

```bash
git add tests/bundle.test.mjs src/bundle.js
git commit -m "feat: add response bundle builder"
```

### Task 2: Add CLI `--bundle` export support

**Files:**
- Modify: `tests/cli.test.mjs`
- Modify: `bin/stack-sleuth.js`

- [ ] **Step 1: Write failing CLI tests for bundle export**

```javascript
test('CLI writes a response bundle for portfolio input', async (t) => {
  const outputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-'));
  t.after(() => fs.promises.rm(outputDir, { recursive: true, force: true }));

  const result = runCli(['--portfolio', '-', '--bundle', outputDir], { input: samplePortfolioInput });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  const files = (await fs.promises.readdir(outputDir)).sort();
  assert.deepEqual(files, [
    'casebook-dataset.json',
    'casebook.txt',
    'handoff.md',
    'incident-dossier.html',
    'manifest.json',
    'merge-review.md',
    'portfolio-summary.md',
  ]);
});

test('CLI rejects --bundle for non-portfolio workflows', () => {
  const result = runCli(['--pack', '-', '--bundle', '/tmp/nowhere'], { input: samplePackInput });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Bundle output is currently supported only for portfolio-shaped workflows/i);
});
```

- [ ] **Step 2: Run the focused CLI test selection and verify it fails**

Run: `npm test -- tests/cli.test.mjs`
Expected: FAIL because `--bundle` is unknown or ignored.

- [ ] **Step 3: Wire `--bundle` parsing, validation, and directory writes**

```javascript
const bundleArgumentError = validateOptionValue(args, '--bundle');
const bundlePath = readOptionValue(args, '--bundle');

function validateBundleArguments({ mode, bundlePath, packPath, portfolioPath, notebookPath, workspacePath, capsulePath }) {
  if (!bundlePath) {
    return null;
  }

  if (mode !== 'text') {
    return 'Bundle output cannot be combined with --json, --markdown, or --html.';
  }

  if (packPath || (!portfolioPath && !notebookPath && !workspacePath && !capsulePath)) {
    return 'Bundle output is currently supported only for portfolio-shaped workflows: --portfolio, --notebook, --workspace, and --capsule when they normalize into a portfolio.';
  }

  return null;
}

function writeBundleOutput(targetDir, bundle) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const [relativePath, content] of Object.entries(bundle.files)) {
    fs.writeFileSync(`${targetDir}/${relativePath}`, content, 'utf8');
  }
}
```

Use `buildResponseBundle(...)` in the portfolio, notebook, workspace, and capsule branches when the routed mode is `portfolio`. If routing lands on `pack`, fail with the portfolio-only bundle guidance.

- [ ] **Step 4: Run the focused CLI test selection and verify it passes**

Run: `npm test -- tests/cli.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit the CLI bundle support**

```bash
git add tests/cli.test.mjs bin/stack-sleuth.js
git commit -m "feat: add response bundle cli export"
```

### Task 3: Document and commit the public sample bundle

**Files:**
- Modify: `tests/readme.test.mjs`
- Modify: `README.md`
- Create: `sample/response-bundle/manifest.json`
- Create: `sample/response-bundle/incident-dossier.html`
- Create: `sample/response-bundle/portfolio-summary.md`
- Create: `sample/response-bundle/handoff.md`
- Create: `sample/response-bundle/casebook.txt`
- Create: `sample/response-bundle/casebook-dataset.json`
- Create: `sample/response-bundle/merge-review.md`

- [ ] **Step 1: Write the failing README and sample-artifact tests**

```javascript
test('README documents response bundle export and committed sample bundle', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /response bundle/i);
  assert.match(readme, /--bundle/);
  assert.match(readme, /sample\/response-bundle/i);
  assert.match(readme, /manifest\.json/i);
  assert.match(readme, /incident-dossier\.html/i);
});

test('sample response bundle is committed with manifest and dossier', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../sample/response-bundle/manifest.json', import.meta.url), 'utf8'));
  const dossier = fs.readFileSync(new URL('../sample/response-bundle/incident-dossier.html', import.meta.url), 'utf8');

  assert.equal(manifest.kind, 'stack-sleuth-response-bundle');
  assert.match(dossier, /<!doctype html>/i);
});
```

- [ ] **Step 2: Run the focused README test selection and verify it fails**

Run: `npm test -- tests/readme.test.mjs`
Expected: FAIL because bundle docs or sample files are missing.

- [ ] **Step 3: Update docs and generate the committed sample bundle**

Add a README section like:

```markdown
## Response bundle export

Stack Sleuth can export a deterministic response bundle for portfolio-shaped workflows. The bundle packages one standalone dossier, one markdown portfolio summary, one handoff packet file, one merged reusable casebook export, one replay-ready dataset JSON artifact, one merge review, and one manifest for downstream tooling.

```bash
node ./bin/stack-sleuth.js --portfolio ./sample/portfolio.txt --bundle ./sample/response-bundle
```
```

Then generate the sample bundle with:

```bash
rm -rf sample/response-bundle
node ./bin/stack-sleuth.js --portfolio ./sample/portfolio.txt --bundle ./sample/response-bundle
```

- [ ] **Step 4: Run the focused README tests and then the full suite**

Run: `npm test -- tests/readme.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit the docs and public sample bundle**

```bash
git add README.md tests/readme.test.mjs sample/response-bundle
git commit -m "docs: add response bundle sample"
```

## Self-review
- Spec coverage: builder, CLI export, routing rules, error handling, docs, and committed sample artifact are all covered.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: `buildResponseBundle`, `--bundle`, and the deterministic filenames are used consistently across tasks.

## Execution handoff
Plan complete and saved to `docs/superpowers/plans/2026-05-01-stack-sleuth-response-bundle.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

For this autonomous cycle, use option 1 unless a blocker forces inline cleanup.
