import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { analyzeTrace } from '../src/analyze.js';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { buildResponseBundle } from '../src/bundle.js';

const cliPath = new URL('../bin/stack-sleuth.js', import.meta.url);
const packageJsonPath = new URL('../package.json', import.meta.url);
const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;
const comparisonTrace = `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;
const multiTraceInput = [sampleTrace, sampleTrace, `Traceback (most recent call last):
  File "app.py", line 42, in <module>
    run()
  File "service.py", line 17, in run
    return user["email"]
KeyError: 'email'`].join('\n\n');
const timelineInput = [
  '=== canary ===',
  sampleTrace,
  '',
  '=== partial ===',
  [sampleTrace, sampleTrace].join('\n\n'),
  '',
  '=== full-rollout ===',
  [sampleTrace, comparisonTrace].join('\n\n'),
].join('\n');

const casebookHistoryInput = [
  '=== release-2026-04-15 ===',
  [sampleTrace, comparisonTrace].join('\n\n'),
  '',
  '=== profile-rewrite ===',
  sampleTrace,
].join('\n');

const annotatedCasebookHistoryInput = [
  '=== release-2026-04-15 ===',
  '>>> summary: Checkout profile payload dropped account metadata before render',
  '>>> fix: Guard renderProfile before reading account.name',
  '>>> owner: web-platform',
  '>>> runbook: https://example.com/runbooks/profile-null',
  [sampleTrace, comparisonTrace].join('\n\n'),
  '',
  '=== profile-rewrite ===',
  sampleTrace,
].join('\n');

const casebookCurrentInput = [
  sampleTrace,
  `ProfileHydrationError: Profile payload missing account metadata\n    at renderProfileState (/app/src/profile.js:102:9)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
].join('\n\n');

const incidentPackInput = [
  '@@ current @@',
  casebookCurrentInput,
  '',
  '@@ history @@',
  casebookHistoryInput,
  '',
  '@@ baseline @@',
  sampleTrace,
  '',
  '@@ candidate @@',
  [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
  '',
  '@@ timeline @@',
  timelineInput,
].join('\n');

const portfolioInput = [
  '@@@ checkout-prod @@@',
  '@@ current @@',
  [sampleTrace, sampleTrace].join('\n\n'),
  '',
  '@@@ profile-rollout @@@',
  '@@ current @@',
  [sampleTrace, `ProfileHydrationError: Profile payload missing account metadata\n    at renderProfileState (/app/src/profile.js:102:9)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`].join('\n\n'),
  '',
  '@@ history @@',
  annotatedCasebookHistoryInput,
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  sampleTrace,
  '',
  '@@ candidate @@',
  [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
].join('\n');

const notebookPackInput = [
  '# Checkout incident notebook',
  '',
  '## Current incident',
  casebookCurrentInput,
  '',
  '## Prior incidents',
  casebookHistoryInput,
  '',
  '## Baseline',
  sampleTrace,
  '',
  '## Candidate',
  [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
  '',
  '## Timeline',
  timelineInput,
].join('\n');

const notebookPortfolioInput = [
  '# Pack: checkout-prod',
  '',
  '## Current incident',
  [sampleTrace, sampleTrace].join('\n\n'),
  '',
  '# Pack: billing-canary',
  '',
  '## Baseline',
  sampleTrace,
  '',
  '## Candidate',
  [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
].join('\n');

const notebookHistoryOnlyInput = [
  '# Incident notes',
  '',
  '## Prior incidents',
  casebookHistoryInput,
].join('\n');

const notebookUnrunnablePortfolioInput = [
  '# Pack: archive-a',
  '',
  '## Prior incidents',
  casebookHistoryInput,
  '',
  '# Pack: archive-b',
  '',
  '## Prior incidents',
  casebookHistoryInput,
].join('\n');

const capsulePortfolioInput = JSON.stringify({
  kind: 'incident-capsule',
  version: '1',
  source: { inputPath: 'fixture' },
  artifacts: [
    buildCapsuleArtifact('packs/checkout-prod/current.log', sampleTrace),
    buildCapsuleArtifact('packs/billing-canary/baseline.log', sampleTrace),
    buildCapsuleArtifact('packs/billing-canary/candidate.log', comparisonTrace),
  ],
}, null, 2);

const capsuleLongHistory = buildLongCasebookHistory(6);
const capsuleLongHistoryExcerpt = capsuleLongHistory.split('\n\n').slice(0, 2).join('\n\n');
const capsuleV2LongHistoryInput = JSON.stringify({
  kind: 'incident-capsule',
  version: '2',
  source: { inputPath: 'fixture' },
  artifacts: [
    buildCapsuleArtifact('current.log', sampleTrace, { version: '2' }),
    buildCapsuleArtifact('history.casebook', capsuleLongHistoryExcerpt, { version: '2', content: capsuleLongHistory }),
  ],
}, null, 2);

const noisySingleTraceLog = [
  '2026-04-30T01:50:00Z INFO api boot complete',
  `2026-04-30T01:50:01Z ERROR web ${sampleTrace.split('\n').join('\n2026-04-30T01:50:01Z ERROR web ')}`,
  '2026-04-30T01:50:02Z INFO request complete',
].join('\n');

const noisyDigestLog = [
  '2026-04-30T03:00:00Z INFO api boot complete',
  `2026-04-30T03:00:01Z ERROR web ${sampleTrace.split('\n').join('\n2026-04-30T03:00:01Z ERROR web ')}`,
  `2026-04-30T03:00:04Z ERROR billing ${comparisonTrace.split('\n').join('\n2026-04-30T03:00:04Z ERROR billing ')}`,
].join('\n');

const chronicleInput = [
  '=== release-a ===',
  JSON.stringify(buildChronicleDataset({
    packCount: 2,
    owners: [{ owner: 'web-platform', packCount: 1 }],
    hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
    cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
    stewardActions: [
      buildStewardAction('missing-runbook', 'profile-js', 'sig-profile-js', 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.'),
      buildStewardAction('missing-owner', 'billing-js', 'sig-billing-js', 'Assign an owner for billing-js.', 'Capture an owner for billing-js.'),
    ],
  }), null, 2),
  '',
  '=== release-b ===',
  JSON.stringify(buildChronicleDataset({
    packCount: 3,
    owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
    hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
    cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
    stewardActions: [
      buildStewardAction('missing-runbook', 'profile-js', 'sig-profile-js', 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.'),
      buildStewardAction('missing-fix', 'search-js', 'sig-search-js', 'Document the fix for search-js.', 'Capture the fix for search-js.'),
    ],
  }), null, 2),
  '',
  '=== release-c ===',
  JSON.stringify(buildChronicleDataset({
    packCount: 4,
    owners: [{ owner: 'web-platform', packCount: 3 }, { owner: 'billing', packCount: 2 }],
    hotspots: [{ label: 'profile.js', packCount: 3, maxScore: 4 }, { label: 'billing.js', packCount: 2, maxScore: 3 }],
    cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
    stewardActions: [
      buildStewardAction('missing-owner', 'billing-js', 'sig-billing-js', 'Assign an owner for billing-js.', 'Capture an owner for billing-js.'),
      buildStewardAction('missing-fix', 'search-js', 'sig-search-js', 'Document the fix for search-js.', 'Capture the fix for search-js.'),
    ],
  }), null, 2),
].join('\n');

const bundleChronicleInput = [
  '=== release-a ===',
  buildChronicleBundle({
    sourceMode: 'portfolio',
    sourceLabel: 'release-a-fixture',
    dataset: buildChronicleDataset({
      packCount: 2,
      owners: [{ owner: 'web-platform', packCount: 1 }],
      hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
      stewardActions: [
        buildStewardAction('missing-runbook', 'profile-js', 'sig-profile-js', 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.'),
        buildStewardAction('missing-owner', 'billing-js', 'sig-billing-js', 'Assign an owner for billing-js.', 'Capture an owner for billing-js.'),
      ],
    }),
    files: ['manifest.json', 'incident-dossier.html', 'portfolio-summary.md', 'handoff.md', 'casebook.txt', 'casebook-dataset.json', 'merge-review.md'],
  }),
  '',
  '=== release-b ===',
  buildChronicleBundle({
    sourceMode: 'portfolio',
    sourceLabel: 'release-b-fixture',
    dataset: buildChronicleDataset({
      packCount: 3,
      owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
      hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
      stewardActions: [
        buildStewardAction('missing-runbook', 'profile-js', 'sig-profile-js', 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.'),
        buildStewardAction('missing-fix', 'search-js', 'sig-search-js', 'Document the fix for search-js.', 'Capture the fix for search-js.'),
      ],
    }),
  }),
  '',
  '=== release-c ===',
  buildChronicleBundle({
    sourceMode: 'workspace',
    sourceLabel: 'release-c-fixture',
    dataset: buildChronicleDataset({
      packCount: 4,
      owners: [{ owner: 'web-platform', packCount: 3 }, { owner: 'billing', packCount: 2 }],
      hotspots: [{ label: 'profile.js', packCount: 3, maxScore: 4 }, { label: 'billing.js', packCount: 2, maxScore: 3 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
      stewardActions: [
        buildStewardAction('missing-owner', 'billing-js', 'sig-billing-js', 'Assign an owner for billing-js.', 'Capture an owner for billing-js.'),
        buildStewardAction('missing-fix', 'search-js', 'sig-search-js', 'Document the fix for search-js.', 'Capture the fix for search-js.'),
      ],
    }),
  }),
].join('\n');
const bundleShelfSnapshotReleaseA = buildChronicleBundle({
  sourceMode: 'portfolio',
  sourceLabel: 'release-a-fixture',
  dataset: buildChronicleDataset({
    packCount: 2,
    owners: [{ owner: 'web-platform', packCount: 1 }],
    hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
    cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
  }),
});
const bundleShelfSnapshotReleaseB = buildChronicleBundle({
  sourceMode: 'workspace',
  sourceLabel: 'release-b-fixture',
  dataset: buildChronicleDataset({
    packCount: 3,
    owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
    hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
    cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
  }),
});

const shelfSnapshotReleaseA = JSON.stringify(buildChronicleDataset({
  packCount: 2,
  owners: [{ owner: 'web-platform', packCount: 1 }],
  hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
  cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
}), null, 2);
const shelfSnapshotReleaseB = JSON.stringify(buildChronicleDataset({
  packCount: 3,
  owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
  hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
  cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
}), null, 2);

function runCli(args = [], options = {}) {
  return spawnSync(process.execPath, [cliPath.pathname, ...args], {
    encoding: 'utf8',
    input: options.input,
    cwd: path.dirname(cliPath.pathname),
  });
}

test('package.json exposes the CLI entry point', () => {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  assert.equal(pkg.bin['stack-sleuth'], './bin/stack-sleuth.js');
});

test('CLI reads a stack trace from stdin and prints the default text summary', () => {
  const result = runCli([], { input: sampleTrace });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Report/);
  assert.match(result.stdout, /Runtime: javascript/);
  assert.match(result.stdout, /Signature: javascript\|TypeError\|app\/src\/profile\.js:88\|nullish-data,undefined-property-access/);
  assert.equal(result.stderr, '');
});

test('CLI reads a stack trace from a file path argument', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-cli-'));
  const tracePath = path.join(tempDir, 'trace.txt');
  await fs.promises.writeFile(tracePath, sampleTrace, 'utf8');

  const result = runCli([tracePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Culprit: renderProfile \(\/app\/src\/profile\.js:88\)/);
});

test('CLI supports --json output', () => {
  const result = runCli(['--json'], { input: sampleTrace });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), analyzeTrace(sampleTrace));
});

test('CLI excavates a single trace from noisy logs in text mode', () => {
  const result = runCli([], { input: noisySingleTraceLog });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Input: excavated 1 trace from raw logs, ignored 2 non-trace lines\./i);
  assert.match(result.stdout, /Stack Sleuth Report/);
  assert.match(result.stdout, /Runtime: javascript/);
});

test('CLI exposes extraction metadata in json mode for noisy single-trace logs', () => {
  const result = runCli(['--json'], { input: noisySingleTraceLog });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.extraction.mode, 'extracted');
  assert.equal(parsed.extraction.traceCount, 1);
});

test('CLI supports --markdown output', () => {
  const result = runCli(['--markdown'], { input: sampleTrace });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^# Stack Sleuth Report/m);
  assert.match(result.stdout, /- \*\*Runtime:\*\* javascript/);
});

test('CLI supports --digest output', () => {
  const result = runCli(['--digest'], { input: multiTraceInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Incident Digest/);
  assert.match(result.stdout, /Total traces: 3/);
  assert.match(result.stdout, /Incident 1: 2x javascript TypeError/);
});

test('CLI auto-promotes multi-trace stdin into digest output', () => {
  const result = runCli([], { input: multiTraceInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Incident Digest/);
});

test('CLI supports --digest --json output', () => {
  const result = runCli(['--digest', '--json'], { input: multiTraceInput });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.groupCount, 2);
  assert.equal(parsed.hotspots[0].label, 'profile.js');
});

test('CLI text output includes blast radius details for noisy digests', () => {
  const result = runCli(['--digest'], { input: noisyDigestLog });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Blast radius: web 1x, billing 1x/);
  assert.match(result.stdout, /Window: 2026-04-30T03:00:01.000Z → 2026-04-30T03:00:04.000Z/);
});

test('CLI json output preserves additive blast radius metadata', () => {
  const result = runCli(['--digest', '--json'], { input: noisyDigestLog });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.blastRadius.services, [
    { name: 'web', count: 1 },
    { name: 'billing', count: 1 }
  ]);
  assert.equal(parsed.blastRadius.origin, 'extracted');
});

test('CLI exits non-zero for empty stdin input', () => {
  const result = runCli([], { input: '   \n\t  ' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No trace provided/i);
  assert.equal(result.stdout, '');
});

test('CLI exits non-zero for an unreadable file path', () => {
  const result = runCli(['/definitely/missing/trace.txt']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Could not read trace file/i);
  assert.equal(result.stdout, '');
});

test('CLI compares baseline and candidate files in text mode', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-radar-'));
  const baselinePath = path.join(tempDir, 'baseline.txt');
  const candidatePath = path.join(tempDir, 'candidate.txt');
  await fs.promises.writeFile(baselinePath, sampleTrace, 'utf8');
  await fs.promises.writeFile(candidatePath, [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'), 'utf8');

  const result = runCli(['--baseline', baselinePath, '--candidate', candidatePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Regression Radar/);
  assert.match(result.stdout, /volume-up: 1/i);
  assert.match(result.stdout, /new: 1/i);
});

test('CLI supports --baseline file plus --candidate - from stdin in json mode', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-radar-'));
  const baselinePath = path.join(tempDir, 'baseline.txt');
  await fs.promises.writeFile(baselinePath, sampleTrace, 'utf8');

  const result = runCli(['--baseline', baselinePath, '--candidate', '-', '--json'], {
    input: [sampleTrace, sampleTrace, comparisonTrace].join('\n\n')
  });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.summary.volumeUpCount, 1);
  assert.equal(parsed.summary.newCount, 1);
  assert.equal(parsed.hotspotShifts[0].label, 'profile.js');
});

test('CLI supports compare mode markdown output', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-radar-'));
  const baselinePath = path.join(tempDir, 'baseline.txt');
  const candidatePath = path.join(tempDir, 'candidate.txt');
  await fs.promises.writeFile(baselinePath, sampleTrace, 'utf8');
  await fs.promises.writeFile(candidatePath, [sampleTrace, sampleTrace].join('\n\n'), 'utf8');

  const result = runCli(['--baseline', baselinePath, '--candidate', candidatePath, '--markdown']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^# Stack Sleuth Regression Radar/m);
  assert.match(result.stdout, /## Volume-up incidents/);
});

test('CLI compare mode exits non-zero when a side is empty', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-radar-'));
  const baselinePath = path.join(tempDir, 'baseline.txt');
  const candidatePath = path.join(tempDir, 'candidate.txt');
  await fs.promises.writeFile(baselinePath, sampleTrace, 'utf8');
  await fs.promises.writeFile(candidatePath, '   \n', 'utf8');

  const result = runCli(['--baseline', baselinePath, '--candidate', candidatePath]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires non-empty baseline and candidate/i);
  assert.equal(result.stdout, '');
});

test('CLI compare mode exits non-zero when a compare flag is missing its value', async () => {
  const result = runCli(['--baseline', '--candidate', 'candidate.txt']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing value for --baseline/i);
  assert.equal(result.stdout, '');
});

test('CLI reads an incident pack with --pack and prints the composed briefing', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-pack-'));
  const packPath = path.join(tempDir, 'incident-pack.txt');
  await fs.promises.writeFile(packPath, incidentPackInput, 'utf8');

  const result = runCli(['--pack', packPath]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Incident Pack Briefing/);
  assert.match(result.stdout, /Available analyses: current, casebook, regression, timeline/);
  assert.match(result.stdout, /Primary headline: Casebook Radar flagged 1 novel incident in the current batch\./);
});

test('CLI incident-pack mode supports --json output', () => {
  const result = runCli(['--pack', '-', '--json'], { input: incidentPackInput });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.availableAnalyses, ['current', 'casebook', 'regression', 'timeline']);
  assert.equal(parsed.summary.counts.novelIncidents, 1);
  assert.equal(parsed.summary.counts.regressionNew, 1);
});

test('CLI incident-pack mode exits non-zero when no runnable analysis can be produced', () => {
  const result = runCli(['--pack', '-'], { input: '@@ history @@\n=== release-2026-04-15 ===\n' + sampleTrace });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Incident Pack mode did not find any runnable analyses/i);
  assert.equal(result.stdout, '');
});

test('CLI reads a multi-pack portfolio with --portfolio and prints a ranked portfolio briefing', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-portfolio-'));
  const portfolioPath = path.join(tempDir, 'portfolio.txt');
  await fs.promises.writeFile(portfolioPath, portfolioInput, 'utf8');

  const result = runCli(['--portfolio', portfolioPath]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Portfolio Radar/);
  assert.match(result.stdout, /Release gate: hold/i);
  assert.match(result.stdout, /Prioritize profile-rollout first/i);
  assert.match(result.stdout, /Recurring hotspots/i);
});

test('CLI portfolio mode supports --json and --markdown output', () => {
  const jsonResult = runCli(['--portfolio', '-', '--json'], { input: portfolioInput });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.summary.runnablePackCount, 3);
  assert.equal(parsed.summary.ownedPackCount, 1);
  assert.equal(parsed.summary.runbookGapCount, 2);
  assert.equal(parsed.gate.verdict, 'hold');
  assert.equal(parsed.priorityQueue[0].label, 'profile-rollout');
  assert.equal(parsed.responseQueue[0].owner, 'web-platform');
  assert.deepEqual(parsed.responseQueue[0].labels, ['profile-rollout']);
  assert.deepEqual(parsed.unownedPacks.map((item) => item.label).sort(), ['billing-canary', 'checkout-prod']);
  assert.ok(parsed.recurringHotspots.some((item) => item.packCount >= 2));

  const markdownResult = runCli(['--portfolio', '-', '--markdown'], { input: portfolioInput });
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Portfolio Radar/m);
  assert.match(markdownResult.stdout, /## Release gate/);
  assert.match(markdownResult.stdout, /## Response queue/);
  assert.match(markdownResult.stdout, /web\\-platform/);
  assert.match(markdownResult.stdout, /## Routing gaps/);
});

test('CLI handoff mode reads a portfolio and prints a copy-ready handoff briefing', () => {
  const result = runCli(['--handoff', '-'], { input: portfolioInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Handoff Briefing/);
  assert.match(result.stdout, /Owner: web-platform/);
  assert.match(result.stdout, /Gap: ownership/);
  assert.match(result.stdout, /Gap: runbook/);
});

test('CLI handoff mode supports --json and --markdown output', () => {
  const jsonResult = runCli(['--handoff', '-', '--json'], { input: portfolioInput });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.summary.packetCount, 5);
  assert.equal(parsed.ownerPackets[0].owner, 'web-platform');
  assert.equal(parsed.gapPackets[0].kind, 'ownership-gap');
  assert.match(parsed.exportText, /Owner: web-platform/);

  const markdownResult = runCli(['--handoff', '-', '--markdown'], { input: portfolioInput });
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Handoff Briefing/m);
  assert.match(markdownResult.stdout, /## Handoff packet export/);
});

test('CLI handoff mode exits non-zero when no labeled packs or runnable analyses are present', () => {
  const unlabeled = runCli(['--handoff', '-'], { input: incidentPackInput });
  assert.notEqual(unlabeled.status, 0);
  assert.match(unlabeled.stderr, /Handoff mode requires @@@ label @@@ blocks/i);

  const unrunnable = runCli(['--handoff', '-'], { input: '@@@ missing-current @@@\n@@ history @@\n=== release ===\n' + sampleTrace });
  assert.notEqual(unrunnable.status, 0);
  assert.match(unrunnable.stderr, /Handoff mode requires at least one runnable labeled incident pack/i);
});

test('CLI reads a portfolio with --board and prints a Stack Sleuth Action Board summary', () => {
  const result = runCli(['--board', '-'], { input: portfolioInput });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Stack Sleuth Action Board/);
  assert.match(result.stdout, /Owner work/);
  assert.match(result.stdout, /Ownership gaps/);
  assert.match(result.stdout, /Runbook gaps/);

  const jsonResult = runCli(['--board', '-', '--json'], { input: portfolioInput });
  assert.equal(jsonResult.status, 0);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.kind, 'stack-sleuth-action-board');
  assert.equal(parsed.summary.sourceKind, 'portfolio');
  assert.ok(parsed.summary.totalCards >= 1);
});

test('CLI reads a portfolio with --dataset and prints a Casebook Dataset summary', () => {
  const result = runCli(['--dataset', '-'], { input: portfolioInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Dataset/);
  assert.match(result.stdout, /Release gate: hold/i);
  assert.match(result.stdout, /Runnable packs: 3/);
  assert.match(result.stdout, /Merged cases: 3/);
  assert.match(result.stdout, /Reusable casebook export/);
});

test('CLI replays a saved dataset from stdin in text mode', () => {
  const datasetResult = runCli(['--dataset', '-', '--json'], { input: portfolioInput });
  assert.equal(datasetResult.status, 0, datasetResult.stderr);

  const result = runCli(['--replay-dataset', '-'], { input: datasetResult.stdout });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Dataset/);
  assert.match(result.stdout, /Release gate: hold/i);
  assert.match(result.stdout, /Response owners: 1/);
  assert.match(result.stdout, /Reusable casebook export/);
});

test('CLI replays a saved dataset in markdown mode', () => {
  const datasetResult = runCli(['--dataset', '-', '--json'], { input: portfolioInput });
  assert.equal(datasetResult.status, 0, datasetResult.stderr);

  const result = runCli(['--replay-dataset', '-', '--markdown'], { input: datasetResult.stdout });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^# Stack Sleuth Casebook Dataset/m);
  assert.match(result.stdout, /## Reusable casebook export/);
});

test('CLI replays a saved dataset in json mode', () => {
  const datasetResult = runCli(['--dataset', '-', '--json'], { input: portfolioInput });
  assert.equal(datasetResult.status, 0, datasetResult.stderr);

  const result = runCli(['--replay-dataset', '-', '--json'], { input: datasetResult.stdout });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.kind, 'stack-sleuth-casebook-dataset');
  assert.equal(parsed.version, 2);
  assert.equal(parsed.summary.ownerCount, 1);
  assert.equal(parsed.gate.verdict, 'hold');
});

test('CLI dataset json preserves full coordination state for saved artifact replay', () => {
  const result = runCli(['--dataset', '-', '--json'], { input: portfolioInput });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.kind, 'stack-sleuth-casebook-dataset');
  assert.ok(Array.isArray(parsed.routingGaps));
  assert.ok(parsed.routingGaps.length >= 1);
  assert.ok(Array.isArray(parsed.runbookGaps));
  assert.ok(parsed.runbookGaps.length >= 1);
  assert.equal(parsed.board?.kind, 'stack-sleuth-action-board');
  assert.ok(parsed.board?.summary?.totalCards >= 4);
  assert.ok(Array.isArray(parsed.steward?.actions));
  assert.ok(parsed.steward?.summary?.actionCount >= 1);
});

test('CLI builds an Action Board directly from a saved response bundle replay artifact', () => {
  const responseBundle = JSON.parse(buildResponseBundle({
    report: analyzeIncidentPortfolio(portfolioInput),
    sourceMode: 'portfolio',
    sourceLabel: 'cli fixture',
  }).files['response-bundle.json']);

  const result = runCli(['--board', '-', '--markdown'], {
    input: JSON.stringify(responseBundle, null, 2),
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^# Stack Sleuth Action Board/m);
  assert.match(result.stdout, /saved response bundle/i);
  assert.match(result.stdout, /## Steward backlog/m);
});

test('CLI builds an Action Board directly from a saved response bundle directory path', async () => {
  const outputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-board-bundle-dir-'));
  const writeResult = runCli(['--portfolio', '-', '--bundle', outputDir], { input: portfolioInput });
  assert.equal(writeResult.status, 0, writeResult.stderr);

  const result = runCli(['--board', outputDir, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.kind, 'stack-sleuth-action-board');
  assert.equal(parsed.summary.sourceKind, 'bundle');
  assert.ok(parsed.summary.totalCards >= 4);
});

test('CLI replays a self-contained response bundle json from stdin', () => {
  const report = analyzeIncidentPortfolio(portfolioInput);
  const bundle = buildResponseBundle({ report, sourceMode: 'portfolio', sourceLabel: 'stdin replay fixture' });

  const result = runCli(['--replay-bundle', '-'], { input: bundle.files['response-bundle.json'] });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Response Bundle Replay/);
  assert.match(result.stdout, /Source workflow: portfolio \(stdin replay fixture\)/i);
  assert.match(result.stdout, /Response owners: 1/);
  assert.match(result.stdout, /Saved-artifact note:/i);
  assert.doesNotMatch(result.stdout, /raw trace recovery/i);
});

test('CLI replays a self-contained response bundle json file path in markdown mode', async () => {
  const report = analyzeIncidentPortfolio(portfolioInput);
  const bundle = buildResponseBundle({ report, sourceMode: 'portfolio', sourceLabel: 'file replay fixture' });
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-replay-bundle-'));
  const bundlePath = path.join(tempDir, 'response-bundle.json');
  await fs.promises.writeFile(bundlePath, bundle.files['response-bundle.json'], 'utf8');

  const result = runCli(['--replay-bundle', bundlePath, '--markdown']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^# Stack Sleuth Response Bundle Replay/m);
  assert.match(result.stdout, /- \*\*Source workflow:\*\* portfolio \(file replay fixture\)/i);
  assert.match(result.stdout, /## Bundle inventory/);
});

test('CLI replays a saved response bundle directory path', async () => {
  const outputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-replay-bundle-dir-'));
  const writeResult = runCli(['--portfolio', '-', '--bundle', outputDir], { input: portfolioInput });
  assert.equal(writeResult.status, 0, writeResult.stderr);

  const result = runCli(['--replay-bundle', outputDir]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Response Bundle Replay/);
  assert.match(result.stdout, /Bundle files: 9/);
  assert.match(result.stdout, /casebook-dataset\.json/);
  assert.match(result.stdout, /response-bundle\.json/);
});

test('CLI replays a legacy version-1 response bundle directory when manifest and dataset exist', async () => {
  const report = analyzeIncidentPortfolio(portfolioInput);
  const bundle = buildResponseBundle({ report, sourceMode: 'portfolio', sourceLabel: 'legacy directory fixture' });
  const outputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-replay-bundle-v1-'));
  const manifest = JSON.parse(bundle.files['manifest.json']);
  manifest.version = 1;
  manifest.files = manifest.files.filter((name) => name !== 'response-bundle.json');
  await fs.promises.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fs.promises.writeFile(path.join(outputDir, 'casebook-dataset.json'), bundle.files['casebook-dataset.json'], 'utf8');
  await fs.promises.writeFile(path.join(outputDir, 'portfolio-summary.md'), bundle.files['portfolio-summary.md'], 'utf8');

  const result = runCli(['--replay-bundle', outputDir, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.kind, 'stack-sleuth-response-bundle');
  assert.equal(parsed.version, 3);
  assert.equal(parsed.sourceVersion, 1);
  assert.equal(parsed.dataset.summary.ownerCount, 1);
  assert.equal(parsed.summary.fileCount, 8);
});

test('CLI replay-bundle reports specific errors for wrong kind, unsupported version, malformed input, and missing dataset in saved bundle', async () => {
  const wrongKind = runCli(['--replay-bundle', '-'], {
    input: JSON.stringify({ kind: 'stack-sleuth-casebook-dataset', version: 1 }),
  });
  assert.equal(wrongKind.status, 1);
  assert.match(wrongKind.stderr, /Response Bundle replay uses unsupported kind: stack-sleuth-casebook-dataset\./i);

  const unsupportedVersion = runCli(['--replay-bundle', '-'], {
    input: JSON.stringify({ kind: 'stack-sleuth-response-bundle', version: 99, manifest: { files: [] }, artifacts: {} }),
  });
  assert.equal(unsupportedVersion.status, 1);
  assert.match(unsupportedVersion.stderr, /Response Bundle replay uses unsupported version 99\. Supported versions: 1, 2, 3\./i);

  const malformed = runCli(['--replay-bundle', '-'], {
    input: '{"kind":"stack-sleuth-response-bundle","version":2',
  });
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /Response Bundle replay could not parse the saved bundle JSON\./i);

  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-replay-bundle-missing-dataset-'));
  await fs.promises.writeFile(path.join(tempDir, 'manifest.json'), JSON.stringify({
    kind: 'stack-sleuth-response-bundle',
    version: 1,
    generatedAt: '2026-05-01T00:00:00.000Z',
    source: { mode: 'portfolio', label: 'missing dataset fixture' },
    summary: { headline: 'missing dataset' },
    files: ['manifest.json', 'portfolio-summary.md'],
  }, null, 2), 'utf8');

  const missingDataset = runCli(['--replay-bundle', tempDir]);
  assert.equal(missingDataset.status, 1);
  assert.match(missingDataset.stderr, /Response Bundle replay requires casebook-dataset\.json in saved bundle directories\./i);
});

test('CLI reads labeled saved datasets with --chronicle and prints a chronicle summary', () => {
  const result = runCli(['--chronicle', '-'], { input: chronicleInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Chronicle/);
  assert.match(result.stdout, /Release gate: hold/i);
  assert.match(result.stdout, /Latest snapshot: release-c/i);
  assert.match(result.stdout, /Stack Sleuth Steward Ledger/);
  assert.match(result.stdout, /Current stewardship backlog/i);
  assert.match(result.stdout, /Owner trends/);
});

test('CLI reads labeled saved response bundles with --bundle-chronicle and prints a chronicle summary', () => {
  const result = runCli(['--bundle-chronicle', '-'], { input: bundleChronicleInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Response Bundle Chronicle/);
  assert.match(result.stdout, /Release gate: hold/i);
  assert.match(result.stdout, /Latest source workflow: workspace/i);
  assert.match(result.stdout, /Stack Sleuth Steward Ledger/);
  assert.match(result.stdout, /Bundle inventory trends/i);
});

test('CLI chronicle mode supports --json and --markdown output', () => {
  const jsonResult = runCli(['--chronicle', '-', '--json'], { input: chronicleInput });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.summary.snapshotCount, 3);
  assert.equal(parsed.summary.latestLabel, 'release-c');
  assert.equal(parsed.summary.latestGateVerdict, 'hold');
  assert.equal(parsed.summary.gateDrift.direction, 'regressed');
  assert.equal(parsed.summary.risingOwnerCount, 2);
  assert.equal(parsed.stewardLedger.summary.activeActionCount, 2);
  assert.equal(parsed.stewardLedger.summary.resurfacedActionCount, 1);

  const markdownResult = runCli(['--chronicle', '-', '--markdown'], { input: chronicleInput });
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Casebook Chronicle/m);
  assert.match(markdownResult.stdout, /## Steward Ledger/);
  assert.match(markdownResult.stdout, /## Owner trends/);
});

test('CLI bundle chronicle mode supports --json and --markdown output', () => {
  const jsonResult = runCli(['--bundle-chronicle', '-', '--json'], { input: bundleChronicleInput });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.summary.snapshotCount, 3);
  assert.equal(parsed.summary.latestLabel, 'release-c');
  assert.equal(parsed.summary.latestGateVerdict, 'hold');
  assert.equal(parsed.summary.latestSourceMode, 'workspace');
  assert.equal(parsed.summary.gateDrift.direction, 'regressed');
  assert.equal(parsed.stewardLedger.summary.activeActionCount, 2);
  assert.equal(parsed.stewardLedger.summary.resurfacedActionCount, 1);
  assert.ok(parsed.inventoryTrends.length >= 1);

  const markdownResult = runCli(['--bundle-chronicle', '-', '--markdown'], { input: bundleChronicleInput });
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Response Bundle Chronicle/m);
  assert.match(markdownResult.stdout, /## Steward Ledger/);
  assert.match(markdownResult.stdout, /## Bundle inventory trends/);
});

test('CLI shelf mode builds a portable shelf from top-level json files and preserves invalid snapshot warnings', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-shelf-'));
  await fs.promises.writeFile(path.join(tempDir, '2026-04-30-release-a.json'), shelfSnapshotReleaseA, 'utf8');
  await fs.promises.writeFile(path.join(tempDir, '2026-05-01-release-b.json'), shelfSnapshotReleaseB, 'utf8');
  await fs.promises.writeFile(path.join(tempDir, 'broken.json'), '{"kind":"stack-sleuth-casebook-dataset","version":1', 'utf8');
  await fs.promises.mkdir(path.join(tempDir, 'nested'));
  await fs.promises.writeFile(path.join(tempDir, 'nested', 'ignored.json'), shelfSnapshotReleaseA, 'utf8');

  const result = runCli(['--shelf', tempDir]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Shelf/);
  assert.match(result.stdout, /Latest release gate: watch/i);
  assert.match(result.stdout, /Valid snapshots: 2/);
  assert.match(result.stdout, /Invalid snapshots: 1/);
  assert.match(result.stdout, /Chronicle summary: Chronicle compared 2 saved datasets/i);
  assert.match(result.stdout, /broken\.json: invalid-json/);
});

test('CLI shelf mode supports --json and --markdown output', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-shelf-'));
  await fs.promises.writeFile(path.join(tempDir, 'release-a.json'), shelfSnapshotReleaseA, 'utf8');
  await fs.promises.writeFile(path.join(tempDir, 'release-b.json'), shelfSnapshotReleaseB, 'utf8');

  const jsonResult = runCli(['--shelf', tempDir, '--json']);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.kind, 'stack-sleuth-casebook-shelf');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.summary.validSnapshotCount, 2);
  assert.equal(parsed.summary.latestGateVerdict, 'watch');
  assert.equal(parsed.summary.invalidSnapshotCount, 0);
  assert.equal(parsed.chronicle.summary.snapshotCount, 2);

  const markdownResult = runCli(['--shelf', tempDir, '--markdown']);
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Casebook Shelf/m);
  assert.match(markdownResult.stdout, /## Chronicle summary/);
});

test('CLI replay-shelf mode replays saved shelf json from stdin', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-shelf-'));
  await fs.promises.writeFile(path.join(tempDir, 'release-a.json'), shelfSnapshotReleaseA, 'utf8');
  await fs.promises.writeFile(path.join(tempDir, 'release-b.json'), shelfSnapshotReleaseB, 'utf8');

  const shelfResult = runCli(['--shelf', tempDir, '--json']);
  assert.equal(shelfResult.status, 0, shelfResult.stderr);

  const replayResult = runCli(['--replay-shelf', '-'], { input: shelfResult.stdout });
  assert.equal(replayResult.status, 0, replayResult.stderr);
  assert.match(replayResult.stdout, /Stack Sleuth Casebook Shelf/);
  assert.match(replayResult.stdout, /Latest release gate: watch/i);
  assert.match(replayResult.stdout, /Chronicle summary: Chronicle compared 2 saved datasets/i);
});

test('CLI shelf mode exits non-zero for non-directory input and when zero valid snapshots remain', async () => {
  const tempFile = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-shelf-')), 'not-a-dir.json');
  await fs.promises.writeFile(tempFile, shelfSnapshotReleaseA, 'utf8');

  const wrongType = runCli(['--shelf', tempFile]);
  assert.notEqual(wrongType.status, 0);
  assert.match(wrongType.stderr, /Casebook Shelf requires a directory of top-level \.json files/i);

  const emptyDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-shelf-empty-'));
  await fs.promises.writeFile(path.join(emptyDir, 'broken.json'), '{"kind":"stack-sleuth-casebook-dataset","version":1', 'utf8');
  const noValid = runCli(['--shelf', emptyDir]);
  assert.notEqual(noValid.status, 0);
  assert.match(noValid.stderr, /Casebook Shelf requires at least one valid saved Casebook Dataset snapshot/i);
});

test('CLI replay-shelf mode reports unsupported shelf versions clearly', () => {
  const result = runCli(['--replay-shelf', '-'], {
    input: JSON.stringify({
      kind: 'stack-sleuth-casebook-shelf',
      version: 99,
      summary: {},
      snapshots: [],
      chronicle: null,
    }),
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Casebook Shelf replay uses unsupported version 99\. Supported version: 1\./i);
});

test('CLI bundle-shelf mode scans top-level bundle directories and json files deterministically, preserving warnings', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-shelf-'));
  await fs.promises.mkdir(path.join(tempDir, 'release-b'));
  await fs.promises.writeFile(path.join(tempDir, 'release-b', 'response-bundle.json'), bundleShelfSnapshotReleaseB, 'utf8');
  await fs.promises.mkdir(path.join(tempDir, 'release-a'));
  await fs.promises.writeFile(path.join(tempDir, 'release-a', 'manifest.json'), JSON.stringify(JSON.parse(bundleShelfSnapshotReleaseA).manifest, null, 2), 'utf8');
  await fs.promises.writeFile(path.join(tempDir, 'release-a', 'casebook-dataset.json'), JSON.parse(bundleShelfSnapshotReleaseA).artifacts['casebook-dataset.json'], 'utf8');
  await fs.promises.writeFile(path.join(tempDir, 'broken.json'), '{"kind":"stack-sleuth-response-bundle","version":3', 'utf8');
  await fs.promises.writeFile(path.join(tempDir, 'ignored.txt'), bundleShelfSnapshotReleaseA, 'utf8');
  await fs.promises.mkdir(path.join(tempDir, 'nested'));
  await fs.promises.writeFile(path.join(tempDir, 'nested', 'response-bundle.json'), bundleShelfSnapshotReleaseA, 'utf8');

  const result = runCli(['--bundle-shelf', tempDir]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Response Bundle Shelf/);
  assert.match(result.stdout, /Valid snapshots: 3/);
  assert.match(result.stdout, /Invalid snapshots: 1/);
  assert.match(result.stdout, /Latest release gate: watch/i);
  assert.match(result.stdout, /Latest source workflow: workspace \(release-b-fixture\)/i);
  assert.match(result.stdout, /Chronicle summary: Bundle Chronicle compared 3 saved response bundles/i);
  assert.match(result.stdout, /broken\.json: invalid-json/);
  assert.match(result.stdout, /nested: valid \(nested\)/i);
  assert.match(result.stdout, /release-a: valid \(release-a\)/i);
  assert.match(result.stdout, /release-b: valid \(release-b\)/i);
});

test('CLI bundle-shelf mode supports --json and --markdown output', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-shelf-'));
  await fs.promises.mkdir(path.join(tempDir, 'release-a'));
  await fs.promises.writeFile(path.join(tempDir, 'release-a', 'response-bundle.json'), bundleShelfSnapshotReleaseA, 'utf8');
  await fs.promises.mkdir(path.join(tempDir, 'release-b'));
  await fs.promises.writeFile(path.join(tempDir, 'release-b', 'response-bundle.json'), bundleShelfSnapshotReleaseB, 'utf8');

  const jsonResult = runCli(['--bundle-shelf', tempDir, '--json']);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.kind, 'stack-sleuth-response-bundle-shelf');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.summary.validSnapshotCount, 2);
  assert.equal(parsed.summary.latestReleaseGateVerdict, 'watch');
  assert.equal(parsed.summary.latestSourceMode, 'workspace');
  assert.equal(parsed.chronicle.summary.snapshotCount, 2);

  const markdownResult = runCli(['--bundle-shelf', tempDir, '--markdown']);
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Response Bundle Shelf/m);
  assert.match(markdownResult.stdout, /## Chronicle summary/);
});

test('CLI replay-bundle-shelf mode replays saved shelf json from stdin', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-shelf-'));
  await fs.promises.mkdir(path.join(tempDir, 'release-a'));
  await fs.promises.writeFile(path.join(tempDir, 'release-a', 'response-bundle.json'), bundleShelfSnapshotReleaseA, 'utf8');
  await fs.promises.mkdir(path.join(tempDir, 'release-b'));
  await fs.promises.writeFile(path.join(tempDir, 'release-b', 'response-bundle.json'), bundleShelfSnapshotReleaseB, 'utf8');

  const shelfResult = runCli(['--bundle-shelf', tempDir, '--json']);
  assert.equal(shelfResult.status, 0, shelfResult.stderr);

  const replayResult = runCli(['--replay-bundle-shelf', '-'], { input: shelfResult.stdout });
  assert.equal(replayResult.status, 0, replayResult.stderr);
  assert.match(replayResult.stdout, /Stack Sleuth Response Bundle Shelf/);
  assert.match(replayResult.stdout, /Latest source workflow: workspace \(release-b-fixture\)/i);
});

test('CLI bundle-shelf mode exits non-zero for non-directory input and when zero valid snapshots remain', async () => {
  const tempFile = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-shelf-')), 'not-a-dir.json');
  await fs.promises.writeFile(tempFile, bundleShelfSnapshotReleaseA, 'utf8');

  const wrongType = runCli(['--bundle-shelf', tempFile]);
  assert.notEqual(wrongType.status, 0);
  assert.match(wrongType.stderr, /Response Bundle Shelf requires a directory of top-level bundle entries/i);

  const emptyDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-shelf-empty-'));
  await fs.promises.writeFile(path.join(emptyDir, 'broken.json'), '{"kind":"stack-sleuth-response-bundle","version":3', 'utf8');
  const noValid = runCli(['--bundle-shelf', emptyDir]);
  assert.notEqual(noValid.status, 0);
  assert.match(noValid.stderr, /Response Bundle Shelf requires at least one valid saved response bundle snapshot/i);
});

test('CLI replay-bundle-shelf mode reports unsupported shelf versions clearly', () => {
  const result = runCli(['--replay-bundle-shelf', '-'], {
    input: JSON.stringify({
      kind: 'stack-sleuth-response-bundle-shelf',
      version: 99,
      summary: {},
      snapshots: [],
      chronicle: null,
    }),
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Response Bundle Shelf replay uses unsupported version 99\. Supported version: 1\./i);
});

test('CLI chronicle mode reports unsupported dataset versions clearly', () => {
  const invalidChronicleInput = [
    '=== release-a ===',
    JSON.stringify({ ...buildChronicleDataset({ packCount: 2 }), version: 99 }, null, 2),
    '',
    '=== release-b ===',
    JSON.stringify(buildChronicleDataset({ packCount: 3 }), null, 2),
  ].join('\n');

  const result = runCli(['--chronicle', '-'], { input: invalidChronicleInput });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Casebook Chronicle snapshot release-a uses unsupported dataset version 99\. Supported version: 2\./i);
});

test('CLI bundle chronicle mode reports unsupported bundle versions clearly', () => {
  const invalidChronicleInput = [
    '=== release-a ===',
    buildChronicleBundle({ version: 99 }),
    '',
    '=== release-b ===',
    buildChronicleBundle(),
  ].join('\n');

  const result = runCli(['--bundle-chronicle', '-'], { input: invalidChronicleInput });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Response Bundle Chronicle snapshot release-a uses unsupported bundle version 99\. Supported versions: 1, 2, 3\./i);
});

test('CLI Casebook Radar accepts a saved dataset JSON file through --history', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-dataset-'));
  const datasetPath = path.join(tempDir, 'history.json');
  const datasetResult = runCli(['--dataset', '-', '--json'], { input: portfolioInput });
  await fs.promises.writeFile(datasetPath, datasetResult.stdout, 'utf8');

  const result = runCli(['--history', datasetPath], { input: casebookCurrentInput });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Radar/);
  assert.match(result.stdout, /Known incidents: 2/);
  assert.match(result.stdout, /Known in: profile-js-generic-runtime-error/);
});

test('CLI Casebook Radar reports a dataset-specific error for malformed saved dataset JSON', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bad-dataset-'));
  const datasetPath = path.join(tempDir, 'history.json');
  await fs.promises.writeFile(datasetPath, JSON.stringify({
    kind: 'stack-sleuth-casebook-dataset',
    version: 1,
    exportText: '',
  }), 'utf8');

  const result = runCli(['--history', datasetPath], { input: casebookCurrentInput });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Casebook Dataset history must include a non-empty exportText payload/i);
});

test('CLI replay mode reports unsupported dataset versions clearly', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bad-dataset-'));
  const datasetPath = path.join(tempDir, 'history.json');
  const datasetResult = runCli(['--dataset', '-', '--json'], { input: portfolioInput });
  assert.equal(datasetResult.status, 0, datasetResult.stderr);
  const dataset = JSON.parse(datasetResult.stdout);
  dataset.version = 99;
  await fs.promises.writeFile(datasetPath, JSON.stringify(dataset), 'utf8');

  const result = runCli(['--replay-dataset', datasetPath]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Casebook Dataset replay uses unsupported version 99\. Supported version: 2\./i);
});

test('CLI Casebook Radar reports unsupported dataset versions clearly', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bad-dataset-'));
  const datasetPath = path.join(tempDir, 'history.json');
  const datasetResult = runCli(['--dataset', '-', '--json'], { input: portfolioInput });
  assert.equal(datasetResult.status, 0, datasetResult.stderr);
  const dataset = JSON.parse(datasetResult.stdout);
  dataset.version = 99;
  await fs.promises.writeFile(datasetPath, JSON.stringify(dataset), 'utf8');

  const result = runCli(['--history', datasetPath], { input: casebookCurrentInput });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Casebook Dataset history uses unsupported version 99\. Supported version: 2\./i);
});

test('CLI dataset mode supports --json and --markdown output', () => {
  const jsonResult = runCli(['--dataset', '-', '--json'], { input: portfolioInput });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.kind, 'stack-sleuth-casebook-dataset');
  assert.equal(parsed.version, 2);
  assert.equal(parsed.gate.verdict, 'hold');
  assert.equal(parsed.summary.packCount, 3);
  assert.equal(parsed.summary.runnablePackCount, 3);
  assert.equal(parsed.summary.mergedCaseCount, 3);
  assert.match(parsed.exportText, /=== profile-js-generic-runtime-error ===/);

  const markdownResult = runCli(['--dataset', '-', '--markdown'], { input: portfolioInput });
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Casebook Dataset/m);
  assert.match(markdownResult.stdout, /## Release gate/);
  assert.match(markdownResult.stdout, /## Reusable casebook export/);
});

test('CLI reads a portfolio with --forge and prints a forged casebook export', () => {
  const result = runCli(['--forge', '-'], { input: portfolioInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Forge/);
  assert.match(result.stdout, /=== release-2026-04-15 ===/);
  assert.match(result.stdout, /=== profile-js-generic-runtime-error ===/);
});

test('CLI forge mode supports --json and --markdown output', () => {
  const jsonResult = runCli(['--forge', '-', '--json'], { input: portfolioInput });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.summary.caseCount, 3);
  assert.equal(parsed.cases[0].label, 'release-2026-04-15');

  const markdownResult = runCli(['--forge', '-', '--markdown'], { input: portfolioInput });
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Casebook Forge/m);
});

test('CLI reads a portfolio with --merge-casebook and prints a merged casebook export', () => {
  const result = runCli(['--merge-casebook', '-'], { input: portfolioInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Merge/);
  assert.match(result.stdout, /Merged casebook export/);
  assert.match(result.stdout, /=== release-2026-04-15 ===/);
  assert.match(result.stdout, />>> seen-count: 3/);
});

test('CLI merge-casebook mode supports --json and --markdown output', () => {
  const jsonResult = runCli(['--merge-casebook', '-', '--json'], { input: portfolioInput });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.summary.mergedCaseCount, 3);
  assert.equal(parsed.summary.updatedCaseCount, 2);
  assert.equal(parsed.cases[0].label, 'release-2026-04-15');
  assert.equal(parsed.cases[0].metadata['seen-count'], '3');

  const markdownResult = runCli(['--merge-casebook', '-', '--markdown'], { input: portfolioInput });
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Casebook Merge/m);
});

test('CLI merge-casebook mode exits non-zero when no labeled packs or runnable analyses are present', () => {
  const unlabeled = runCli(['--merge-casebook', '-'], { input: incidentPackInput });
  assert.notEqual(unlabeled.status, 0);
  assert.match(unlabeled.stderr, /Casebook Merge requires @@@ label @@@ blocks/i);

  const unrunnable = runCli(['--merge-casebook', '-'], { input: '@@@ missing-current @@@\n@@ history @@\n=== release ===\n' + sampleTrace });
  assert.notEqual(unrunnable.status, 0);
  assert.match(unrunnable.stderr, /Casebook Merge requires at least one runnable labeled incident pack/i);
});

test('CLI forge mode exits non-zero when no labeled packs or runnable analyses are present', () => {
  const unlabeled = runCli(['--forge', '-'], { input: incidentPackInput });
  assert.notEqual(unlabeled.status, 0);
  assert.match(unlabeled.stderr, /Casebook Forge requires @@@ label @@@ blocks/i);

  const unrunnable = runCli(['--forge', '-'], { input: '@@@ missing-current @@@\n@@ history @@\n=== release ===\n' + sampleTrace });
  assert.notEqual(unrunnable.status, 0);
  assert.match(unrunnable.stderr, /Casebook Forge requires at least one runnable labeled incident pack/i);
});

test('CLI portfolio mode exits non-zero when no labeled packs or runnable analyses are present', () => {
  const unlabeled = runCli(['--portfolio', '-'], { input: incidentPackInput });
  assert.notEqual(unlabeled.status, 0);
  assert.match(unlabeled.stderr, /Portfolio mode requires @@@ label @@@ blocks/i);

  const unrunnable = runCli(['--portfolio', '-'], { input: '@@@ missing-current @@@\n@@ history @@\n=== release ===\n' + sampleTrace });
  assert.notEqual(unrunnable.status, 0);
  assert.match(unrunnable.stderr, /Portfolio mode did not find any runnable analyses/i);
});

test('CLI reads a labeled timeline file and prints the timeline radar summary', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-timeline-'));
  const timelinePath = path.join(tempDir, 'timeline.txt');
  await fs.promises.writeFile(timelinePath, timelineInput, 'utf8');

  const result = runCli(['--timeline', timelinePath]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Timeline Radar/);
  assert.match(result.stdout, /Latest snapshot: full-rollout/i);
});

test('CLI supports --timeline - from stdin in json mode', () => {
  const result = runCli(['--timeline', '-', '--json'], { input: timelineInput });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.summary.snapshotCount, 3);
  assert.equal(parsed.summary.latestLabel, 'full-rollout');
  assert.equal(parsed.summary.newCount, 1);
});

test('CLI timeline mode exits non-zero for a document with fewer than two labeled snapshots', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-timeline-'));
  const timelinePath = path.join(tempDir, 'timeline.txt');
  await fs.promises.writeFile(timelinePath, ['=== only ===', sampleTrace].join('\n'), 'utf8');

  const result = runCli(['--timeline', timelinePath]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /at least two labeled snapshots/i);
  assert.equal(result.stdout, '');
});

test('CLI reads current stdin plus labeled history file and prints a Casebook Radar summary', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-casebook-'));
  const historyPath = path.join(tempDir, 'history.txt');
  await fs.promises.writeFile(historyPath, casebookHistoryInput, 'utf8');

  const result = runCli(['--history', historyPath], { input: casebookCurrentInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Radar/);
  assert.match(result.stdout, /Known incidents: 1/);
  assert.match(result.stdout, /Novel incidents: 1/);
  assert.match(result.stdout, /Closest historical cases: release-2026-04-15/i);
});

test('CLI Casebook Radar surfaces matched runbook recall from annotated history', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-casebook-'));
  const historyPath = path.join(tempDir, 'history.txt');
  await fs.promises.writeFile(historyPath, annotatedCasebookHistoryInput, 'utf8');

  const result = runCli(['--history', historyPath], { input: casebookCurrentInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Known in: release-2026-04-15/);
  assert.match(result.stdout, /Fix: Guard renderProfile before reading account\.name/);
  assert.match(result.stdout, /Owner: web-platform/);
  assert.match(result.stdout, /Runbook: https:\/\/example\.com\/runbooks\/profile-null/);
});

test('CLI supports --history with --current file input in json mode', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-casebook-'));
  const historyPath = path.join(tempDir, 'history.txt');
  const currentPath = path.join(tempDir, 'current.txt');
  await fs.promises.writeFile(historyPath, casebookHistoryInput, 'utf8');
  await fs.promises.writeFile(currentPath, casebookCurrentInput, 'utf8');

  const result = runCli(['--history', historyPath, '--current', currentPath, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.summary.currentTraceCount, 2);
  assert.equal(parsed.summary.historicalCaseCount, 2);
  assert.equal(parsed.summary.knownCount, 1);
  assert.equal(parsed.summary.novelCount, 1);
  assert.equal(parsed.summary.topCaseLabel, 'release-2026-04-15');
});

test('CLI supports --history with --current - in markdown mode', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-casebook-'));
  const historyPath = path.join(tempDir, 'history.txt');
  await fs.promises.writeFile(historyPath, casebookHistoryInput, 'utf8');

  const result = runCli(['--history', historyPath, '--current', '-', '--markdown'], {
    input: casebookCurrentInput,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^# Stack Sleuth Casebook Radar/m);
  assert.match(result.stdout, /## Closest historical cases/);
  assert.match(result.stdout, /- \*\*Known incidents:\*\* 1/);
  assert.match(result.stdout, /- \*\*Classification:\*\* novel/);
});

test('CLI treats --current without --history as a Casebook Radar invocation error', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-casebook-'));
  const currentPath = path.join(tempDir, 'current.txt');
  await fs.promises.writeFile(currentPath, casebookCurrentInput, 'utf8');

  const result = runCli(['--current', currentPath], { input: sampleTrace });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Casebook Radar requires --history when using --current/i);
  assert.equal(result.stdout, '');
});

test('CLI casebook mode exits non-zero when current input is empty', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-casebook-'));
  const historyPath = path.join(tempDir, 'history.txt');
  await fs.promises.writeFile(historyPath, casebookHistoryInput, 'utf8');

  const result = runCli(['--history', historyPath], { input: '   \n' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Casebook Radar requires non-empty current input/i);
  assert.equal(result.stdout, '');
});

test('CLI casebook mode exits non-zero when the history file cannot be read', () => {
  const result = runCli(['--history', '/definitely/missing/history.txt'], { input: casebookCurrentInput });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Could not read history trace file/i);
  assert.equal(result.stdout, '');
});

test('CLI casebook mode exits non-zero when history contains no labeled cases', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-casebook-'));
  const historyPath = path.join(tempDir, 'history.txt');
  await fs.promises.writeFile(historyPath, [sampleTrace, comparisonTrace].join('\n\n'), 'utf8');

  const result = runCli(['--history', historyPath], { input: casebookCurrentInput });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Casebook Radar requires labeled historical cases/i);
  assert.equal(result.stdout, '');
});

test('CLI casebook mode exits non-zero when labeled history contains no usable traces', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-casebook-'));
  const historyPath = path.join(tempDir, 'history.txt');
  await fs.promises.writeFile(historyPath, ['=== empty noisy label ===', 'INFO 2026-04-30 all green'].join('\n'), 'utf8');

  const result = runCli(['--history', historyPath], { input: casebookCurrentInput });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires at least one usable historical case/i);
  assert.equal(result.stdout, '');
});

test('CLI reads a markdown incident notebook with --notebook and routes it into an incident pack briefing', () => {
  const result = runCli(['--notebook', '-'], { input: notebookPackInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Notebook normalization/i);
  assert.match(result.stdout, /Kind: pack \(5 sections\)/i);
  assert.match(result.stdout, /@@ current @@/);
  assert.match(result.stdout, /Stack Sleuth Incident Pack Briefing/);
});

test('CLI reads a grouped markdown notebook with --notebook --json and routes it into portfolio radar', () => {
  const result = runCli(['--notebook', '-', '--json'], { input: notebookPortfolioInput });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.notebook.kind, 'portfolio');
  assert.equal(parsed.summary.runnablePackCount, 2);
  assert.match(parsed.notebook.normalizedText, /@@@ checkout-prod @@@/);
  assert.equal(parsed.routed.mode, 'portfolio');
});

test('CLI notebook mode exits non-zero when no supported notebook headings are present', () => {
  const result = runCli(['--notebook', '-'], { input: '# notes\n\nNothing actionable yet.' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Notebook mode requires supported headings|supported incident sections|did not contain any supported incident headings/i);
  assert.equal(result.stdout, '');
});

test('CLI notebook pack mode exits non-zero when normalization produces no runnable analyses', () => {
  const result = runCli(['--notebook', '-'], { input: notebookHistoryOnlyInput });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Notebook mode did not find any runnable analyses/i);
  assert.equal(result.stdout, '');
});

test('CLI notebook portfolio mode exits non-zero when every normalized pack is unrunnable', () => {
  const result = runCli(['--notebook', '-', '--json'], { input: notebookUnrunnablePortfolioInput });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Notebook mode did not find any runnable analyses/i);
  assert.equal(result.stdout, '');
});

test('CLI reads a raw incident capsule with --capsule and prints the routed briefing', () => {
  const result = runCli(['--capsule', '-'], { input: capsulePortfolioInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Portfolio Radar/);
  assert.match(result.stdout, /billing-canary/);
});

test('CLI capsule mode replays long v2 casebook history from content instead of truncated excerpt', () => {
  const result = runCli(['--capsule', '-', '--json'], { input: capsuleV2LongHistoryInput });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.capsule.kind, 'pack');
  assert.equal(parsed.casebook.summary.historicalCaseCount, 6);
  assert.equal(parsed.casebook.summary.knownCount, 1);
  assert.equal(parsed.casebook.summary.topCaseLabel, 'release-2026-04-15');
});

test('CLI capsule mode reports supported incident capsule versions 1 and 2', () => {
  const result = runCli(['--capsule', '-'], {
    input: JSON.stringify({ kind: 'incident-capsule', version: '9', artifacts: [] }),
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Incident Capsule input uses unsupported version 9\. Supported versions: 1, 2\./i);
});

test('CLI reads --workspace for a single incident folder and prints an incident pack briefing', async (t) => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-cli-workspace-'));
  t.after(() => fs.promises.rm(tempDir, { recursive: true, force: true }));
  await fs.promises.writeFile(path.join(tempDir, 'current.log'), casebookCurrentInput, 'utf8');
  await fs.promises.writeFile(path.join(tempDir, 'history.casebook'), annotatedCasebookHistoryInput, 'utf8');

  const result = runCli(['--workspace', tempDir]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Incident Pack Briefing/);
  assert.match(result.stdout, /Casebook Radar/);
});

test('CLI reads notebook-only --workspace folders and routes them through notebook normalization', async (t) => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-cli-workspace-'));
  t.after(() => fs.promises.rm(tempDir, { recursive: true, force: true }));
  await fs.promises.writeFile(path.join(tempDir, 'notebook.md'), notebookPackInput, 'utf8');

  const result = runCli(['--workspace', tempDir]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Notebook normalization/i);
  assert.match(result.stdout, /Stack Sleuth Incident Pack Briefing/);
});

test('CLI reads --workspace for a portfolio folder and prints Portfolio Radar json with workspace metadata', async (t) => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-cli-workspace-'));
  t.after(() => fs.promises.rm(tempDir, { recursive: true, force: true }));
  await fs.promises.mkdir(path.join(tempDir, 'packs', 'checkout-prod'), { recursive: true });
  await fs.promises.mkdir(path.join(tempDir, 'packs', 'billing-canary'), { recursive: true });
  await fs.promises.writeFile(path.join(tempDir, 'packs', 'checkout-prod', 'current.log'), sampleTrace, 'utf8');
  await fs.promises.writeFile(path.join(tempDir, 'packs', 'billing-canary', 'baseline.log'), sampleTrace, 'utf8');
  await fs.promises.writeFile(path.join(tempDir, 'packs', 'billing-canary', 'candidate.log'), comparisonTrace, 'utf8');

  const result = runCli(['--workspace', tempDir, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.workspace.kind, 'portfolio');
  assert.equal(parsed.workspace.packOrder.join(','), 'billing-canary,checkout-prod');
  assert.equal(parsed.summary.runnablePackCount, 2);
  assert.equal(parsed.priorityQueue[0].label, 'billing-canary');
});

test('CLI workspace mode exits non-zero for unsupported folders', async (t) => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-cli-workspace-'));
  t.after(() => fs.promises.rm(tempDir, { recursive: true, force: true }));
  await fs.promises.writeFile(path.join(tempDir, 'notes.txt'), 'nothing useful yet', 'utf8');

  const result = runCli(['--workspace', tempDir]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /supported filenames/i);
  assert.equal(result.stdout, '');
});

test('CLI scans --workspace-fleet top-level directories deterministically, reuses notebook routing, and preserves warnings in json output', async (t) => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-cli-workspace-fleet-'));
  t.after(() => fs.promises.rm(tempDir, { recursive: true, force: true }));

  await fs.promises.mkdir(path.join(tempDir, 'zeta-pack'), { recursive: true });
  await fs.promises.writeFile(path.join(tempDir, 'zeta-pack', 'current.log'), sampleTrace, 'utf8');

  await fs.promises.mkdir(path.join(tempDir, 'alpha-notebook'), { recursive: true });
  await fs.promises.writeFile(path.join(tempDir, 'alpha-notebook', 'notebook.md'), notebookPortfolioInput, 'utf8');

  await fs.promises.mkdir(path.join(tempDir, 'broken'), { recursive: true });
  await fs.promises.writeFile(path.join(tempDir, 'broken', 'notes.txt'), 'nothing useful yet', 'utf8');

  await fs.promises.mkdir(path.join(tempDir, 'nested', 'child'), { recursive: true });
  await fs.promises.writeFile(path.join(tempDir, 'nested', 'child', 'current.log'), sampleTrace, 'utf8');

  const result = runCli(['--workspace-fleet', tempDir, '--json']);

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.kind, 'stack-sleuth-workspace-fleet');
  assert.equal(parsed.version, 1);
  assert.equal(parsed.summary.validWorkspaceCount, 2);
  assert.deepEqual(parsed.rankings.map((entry) => entry.label), ['alpha-notebook', 'zeta-pack']);
  assert.equal(parsed.rankings[0].workspace.kind, 'notebook');
  assert.equal(parsed.rankings[0].routed.mode, 'portfolio');
  assert.equal(parsed.rankings[0].coordination.runnablePackCount, 2);
  assert.deepEqual(parsed.warnings.map((entry) => entry.label), ['broken', 'nested']);
});

test('CLI workspace-fleet mode supports markdown output and honest replay from stdin', async (t) => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-cli-workspace-fleet-'));
  t.after(() => fs.promises.rm(tempDir, { recursive: true, force: true }));

  await fs.promises.mkdir(path.join(tempDir, 'alpha-notebook'), { recursive: true });
  await fs.promises.writeFile(path.join(tempDir, 'alpha-notebook', 'notebook.md'), notebookPortfolioInput, 'utf8');
  await fs.promises.mkdir(path.join(tempDir, 'zeta-pack'), { recursive: true });
  await fs.promises.writeFile(path.join(tempDir, 'zeta-pack', 'current.log'), sampleTrace, 'utf8');

  const markdownResult = runCli(['--workspace-fleet', tempDir, '--markdown']);
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Workspace Fleet/m);
  assert.match(markdownResult.stdout, /saved-artifact note/i);

  const jsonResult = runCli(['--workspace-fleet', tempDir, '--json']);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);

  const replayResult = runCli(['--replay-workspace-fleet', '-'], { input: jsonResult.stdout });
  assert.equal(replayResult.status, 0, replayResult.stderr);
  assert.match(replayResult.stdout, /Stack Sleuth Workspace Fleet/);
  assert.match(replayResult.stdout, /saved-artifact note: Workspace Fleet replay preserves normalized summaries and coordination signals only/i);
  assert.doesNotMatch(replayResult.stdout, /raw trace recovery/i);
});

test('CLI workspace-fleet mode exits non-zero for wrong-type input and when zero valid workspaces remain', async (t) => {
  const tempFile = path.join(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-cli-workspace-fleet-')), 'not-a-dir.txt');
  await fs.promises.writeFile(tempFile, 'nope', 'utf8');
  t.after(() => fs.promises.rm(path.dirname(tempFile), { recursive: true, force: true }));

  const wrongType = runCli(['--workspace-fleet', tempFile]);
  assert.notEqual(wrongType.status, 0);
  assert.match(wrongType.stderr, /workspace fleet target must be a directory/i);

  const emptyDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-cli-workspace-fleet-empty-'));
  t.after(() => fs.promises.rm(emptyDir, { recursive: true, force: true }));
  await fs.promises.mkdir(path.join(emptyDir, 'broken'), { recursive: true });
  await fs.promises.writeFile(path.join(emptyDir, 'broken', 'notes.txt'), 'nothing useful yet', 'utf8');

  const noValid = runCli(['--workspace-fleet', emptyDir]);
  assert.notEqual(noValid.status, 0);
  assert.match(noValid.stderr, /workspace fleet did not find any valid workspaces/i);
});

test('CLI exits non-zero when multiple workflow modes are requested together', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-mode-clash-'));
  const historyPath = path.join(tempDir, 'history.txt');
  const timelinePath = path.join(tempDir, 'timeline.txt');
  await fs.promises.writeFile(historyPath, casebookHistoryInput, 'utf8');
  await fs.promises.writeFile(timelinePath, timelineInput, 'utf8');

  const result = runCli(['--notebook', '-', '--timeline', timelinePath], { input: notebookPackInput });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /choose one workflow mode at a time/i);
  assert.equal(result.stdout, '');
});

test('CLI supports --pack --html output', () => {
  const result = runCli(['--pack', '-', '--html'], { input: incidentPackInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<!doctype html>/i);
  assert.match(result.stdout, /Stack Sleuth Incident Dossier/i);
  assert.match(result.stdout, /Incident Pack/i);
  assert.match(result.stdout, /Checklist/i);
  assert.equal(result.stderr, '');
});

test('CLI supports --portfolio --html output', () => {
  const result = runCli(['--portfolio', '-', '--html'], { input: portfolioInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<!doctype html>/i);
  assert.match(result.stdout, /Portfolio Radar/i);
  assert.match(result.stdout, /Release gate/i);
  assert.match(result.stdout, /Handoff Briefing export/i);
});

test('CLI routes notebook, workspace, and capsule workflows into HTML dossiers', async (t) => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-html-workspace-'));
  t.after(() => fs.promises.rm(tempDir, { recursive: true, force: true }));

  await fs.promises.writeFile(path.join(tempDir, 'notebook.md'), notebookPackInput, 'utf8');

  const notebookResult = runCli(['--notebook', '-', '--html'], { input: notebookPackInput });
  const workspaceResult = runCli(['--workspace', tempDir, '--html']);
  const capsuleResult = runCli(['--capsule', '-', '--html'], { input: capsulePortfolioInput });

  assert.equal(notebookResult.status, 0, notebookResult.stderr);
  assert.equal(workspaceResult.status, 0, workspaceResult.stderr);
  assert.equal(capsuleResult.status, 0, capsuleResult.stderr);

  assert.match(notebookResult.stdout, /<!doctype html>/i);
  assert.match(notebookResult.stdout, /Notebook normalization/i);
  assert.match(workspaceResult.stdout, /<!doctype html>/i);
  assert.match(workspaceResult.stdout, /Workspace/i);
  assert.match(capsuleResult.stdout, /<!doctype html>/i);
  assert.match(capsuleResult.stdout, /Capsule/i);
});

test('CLI rejects --html for unsupported workflows', () => {
  const result = runCli(['--html'], { input: sampleTrace });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /HTML output is currently supported only for --pack, --portfolio, --notebook, --workspace, and --capsule workflows/i);
  assert.equal(result.stdout, '');
});

test('CLI writes a response bundle for --portfolio input', async (t) => {
  const outputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-'));
  t.after(() => fs.promises.rm(outputDir, { recursive: true, force: true }));

  const result = runCli(['--portfolio', '-', '--bundle', outputDir], { input: portfolioInput });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  await assertResponseBundle(outputDir, 'portfolio');
});

test('CLI routes notebook, workspace, and capsule portfolio workflows into response bundles', async (t) => {
  const notebookBundleDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-notebook-'));
  const workspaceRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-workspace-'));
  const workspaceBundleDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-workspace-out-'));
  const capsuleBundleDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-bundle-capsule-'));
  t.after(() => Promise.all([
    fs.promises.rm(notebookBundleDir, { recursive: true, force: true }),
    fs.promises.rm(workspaceRoot, { recursive: true, force: true }),
    fs.promises.rm(workspaceBundleDir, { recursive: true, force: true }),
    fs.promises.rm(capsuleBundleDir, { recursive: true, force: true }),
  ]));

  await fs.promises.mkdir(path.join(workspaceRoot, 'packs', 'checkout-prod'), { recursive: true });
  await fs.promises.mkdir(path.join(workspaceRoot, 'packs', 'billing-canary'), { recursive: true });
  await fs.promises.writeFile(path.join(workspaceRoot, 'packs', 'checkout-prod', 'current.log'), sampleTrace, 'utf8');
  await fs.promises.writeFile(path.join(workspaceRoot, 'packs', 'billing-canary', 'baseline.log'), sampleTrace, 'utf8');
  await fs.promises.writeFile(path.join(workspaceRoot, 'packs', 'billing-canary', 'candidate.log'), comparisonTrace, 'utf8');

  const notebookResult = runCli(['--notebook', '-', '--bundle', notebookBundleDir], { input: notebookPortfolioInput });
  const workspaceResult = runCli(['--workspace', workspaceRoot, '--bundle', workspaceBundleDir]);
  const capsuleResult = runCli(['--capsule', '-', '--bundle', capsuleBundleDir], { input: capsulePortfolioInput });

  assert.equal(notebookResult.status, 0, notebookResult.stderr);
  assert.equal(workspaceResult.status, 0, workspaceResult.stderr);
  assert.equal(capsuleResult.status, 0, capsuleResult.stderr);
  assert.equal(notebookResult.stdout, '');
  assert.equal(workspaceResult.stdout, '');
  assert.equal(capsuleResult.stdout, '');

  await assertResponseBundle(notebookBundleDir, 'notebook');
  await assertResponseBundle(workspaceBundleDir, 'workspace');
  await assertResponseBundle(capsuleBundleDir, 'capsule');
});

test('CLI rejects --bundle for pack-shaped workflows and alternate output modes', () => {
  const packResult = runCli(['--pack', '-', '--bundle', '/tmp/stack-sleuth-invalid-bundle'], { input: incidentPackInput });
  const notebookPackResult = runCli(['--notebook', '-', '--bundle', '/tmp/stack-sleuth-invalid-notebook-bundle'], { input: notebookPackInput });
  const jsonResult = runCli(['--portfolio', '-', '--bundle', '/tmp/stack-sleuth-invalid-json-bundle', '--json'], { input: portfolioInput });

  assert.notEqual(packResult.status, 0);
  assert.match(packResult.stderr, /Bundle output is currently supported only for portfolio-shaped workflows/i);
  assert.equal(packResult.stdout, '');

  assert.notEqual(notebookPackResult.status, 0);
  assert.match(notebookPackResult.stderr, /Bundle output is currently supported only when notebook routing normalizes into a portfolio/i);
  assert.equal(notebookPackResult.stdout, '');

  assert.notEqual(jsonResult.status, 0);
  assert.match(jsonResult.stderr, /Bundle output cannot be combined with --json, --markdown, or --html/i);
  assert.equal(jsonResult.stdout, '');
});

import { buildReleaseGate } from '../src/gate.js';

async function assertResponseBundle(outputDir, expectedSourceMode) {
  const expectedFiles = [
    'action-board.md',
    'casebook-dataset.json',
    'casebook.txt',
    'handoff.md',
    'incident-dossier.html',
    'manifest.json',
    'merge-review.md',
    'portfolio-summary.md',
    'response-bundle.json',
  ];
  const files = (await fs.promises.readdir(outputDir)).sort();
  assert.deepEqual(files, expectedFiles);

  const manifest = JSON.parse(await fs.promises.readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.kind, 'stack-sleuth-response-bundle');
  assert.equal(manifest.version, 3);
  assert.equal(manifest.source.mode, expectedSourceMode);
  assert.deepEqual([...manifest.files].sort(), expectedFiles);
  assert.match(await fs.promises.readFile(path.join(outputDir, 'action-board.md'), 'utf8'), /Stack Sleuth Action Board/i);
  assert.match(await fs.promises.readFile(path.join(outputDir, 'incident-dossier.html'), 'utf8'), /<!doctype html>/i);
  assert.match(await fs.promises.readFile(path.join(outputDir, 'portfolio-summary.md'), 'utf8'), /Stack Sleuth Portfolio Radar/i);
  assert.match(await fs.promises.readFile(path.join(outputDir, 'handoff.md'), 'utf8'), /Stack Sleuth Handoff Briefing/i);
  assert.match(await fs.promises.readFile(path.join(outputDir, 'casebook.txt'), 'utf8'), /^=== /m);
  assert.match(await fs.promises.readFile(path.join(outputDir, 'merge-review.md'), 'utf8'), /Stack Sleuth Casebook Merge/i);
}

function buildCapsuleArtifact(relativePath, excerpt, options = {}) {
  const version = options.version ?? '1';
  return {
    relativePath,
    kind: relativePath.endsWith('.md') ? 'markdown' : 'log',
    supported: true,
    size: excerpt.length,
    modifiedAt: '2026-05-01T07:14:00.000Z',
    contentLength: excerpt.length,
    ...(version === '2' ? { content: options.content ?? excerpt } : {}),
    excerpt,
    warnings: [],
  };
}

function buildLongCasebookHistory(caseCount) {
  return Array.from({ length: caseCount }, (_, index) => {
    const label = `release-2026-04-${String(15 + index).padStart(2, '0')}`;
    const traceBody = index === 0
      ? sampleTrace
      : index === caseCount - 1
        ? comparisonTrace
        : `${sampleTrace}\n\n${comparisonTrace}`;
    return [`=== ${label} ===`, traceBody].join('\n');
  }).join('\n\n');
}

function buildChronicleDataset({
  packCount = 2,
  owners = [],
  hotspots = [],
  cases = [],
  stewardActionCount = Math.max(0, 4 - packCount),
  stewardPreserved = true,
  stewardActions = null,
} = {}) {
  return {
    kind: 'stack-sleuth-casebook-dataset',
    version: 1,
    summary: {
      headline: `Dataset captured ${packCount} pack${packCount === 1 ? '' : 's'}.`,
      packCount,
      runnablePackCount: packCount,
      mergedCaseCount: cases.length,
      conflictCount: 0,
      portfolioHeadline: 'portfolio headline',
      mergeHeadline: 'merge headline',
      ownerCount: owners.length,
    },
    portfolio: {
      packOrder: Array.from({ length: packCount }, (_, index) => `pack-${index + 1}`),
    },
    gate: buildReleaseGate({
      runnablePackCount: packCount,
      totalNovelIncidents: packCount >= 4 ? 1 : 0,
      runbookGapCount: 1,
      recurringHotspotCount: hotspots.length,
      recurringIncidentCount: Math.max(0, cases.length - 1),
    }),
    responseQueue: owners.map((entry) => ({
      owner: entry.owner,
      labels: Array.from({ length: entry.packCount }, (_, index) => `${entry.owner}-pack-${index + 1}`),
      guidance: [],
      highestPriorityScore: entry.packCount * 100,
      novelIncidentCount: entry.packCount,
      bestQueueIndex: 0,
      packCount: entry.packCount,
    })),
    recurringIncidents: [],
    recurringHotspots: hotspots.map((entry) => ({
      label: entry.label,
      labels: Array.from({ length: entry.packCount }, (_, index) => `${entry.label}-pack-${index + 1}`),
      packCount: entry.packCount,
      maxScore: entry.maxScore ?? entry.packCount,
    })),
    cases: cases.map((entry) => ({
      label: entry.label,
      signature: entry.signature,
      sourcePacks: ['pack-1'],
      metadata: {},
      conflicts: [],
    })),
    steward: {
      preserved: stewardPreserved,
      cases: cases.map((entry) => ({
        label: entry.label,
        signature: entry.signature,
        sourcePacks: ['pack-1'],
        metadata: {},
        conflicts: [],
      })),
      actions: stewardActions ?? Array.from({ length: stewardActionCount }, (_, index) => ({
        kind: index === 0 ? 'missing-owner' : 'missing-runbook',
        label: cases[index]?.label ?? `case-${index + 1}`,
        signature: cases[index]?.signature ?? `sig-${index + 1}`,
        seenCount: 1,
        sourcePacks: ['pack-1'],
        priority: 1000 - index,
        headline: `Do steward action ${index + 1}`,
        ask: `Handle steward action ${index + 1}`,
      })),
      summary: {
        caseCount: cases.length,
        conflictCount: 0,
        ownerCoveredCount: 0,
        fixCoveredCount: 0,
        runbookCoveredCount: 0,
        actionCount: stewardActions?.length ?? stewardActionCount,
        urgentActionCount: stewardActions
          ? stewardActions.filter((entry) => entry.kind === 'conflict' || entry.kind === 'missing-owner').length
          : stewardActionCount ? 1 : 0,
        headline: `Casebook Steward found ${(stewardActions?.length ?? stewardActionCount)} action${(stewardActions?.length ?? stewardActionCount) === 1 ? '' : 's'} across ${cases.length} case${cases.length === 1 ? '' : 's'}.`,
      },
      nextAction: stewardActions?.[0]?.ask ?? (stewardActionCount ? 'Handle steward action 1' : 'No stewardship gaps detected in the current casebook state.'),
    },
    exportText: '=== saved-case ===\nTypeError: replay me',
  };
}

function buildChronicleBundle({
  dataset = buildChronicleDataset({ packCount: 2 }),
  sourceMode = 'portfolio',
  sourceLabel = 'bundle chronicle fixture',
  files = null,
  version = 2,
} = {}) {
  const baseBundle = JSON.parse(buildResponseBundle({
    report: analyzeIncidentPortfolio(portfolioInput),
    sourceMode,
    sourceLabel,
  }).files['response-bundle.json']);

  baseBundle.version = version;
  baseBundle.manifest.version = version === 1 ? 1 : 2;
  baseBundle.manifest.source = { mode: sourceMode, label: sourceLabel };
  baseBundle.manifest.summary.headline = dataset.summary.headline;
  baseBundle.manifest.summary.releaseGateVerdict = dataset.gate.verdict;
  baseBundle.manifest.summary.packCount = dataset.summary.packCount;
  baseBundle.manifest.summary.runnablePackCount = dataset.summary.runnablePackCount;
  baseBundle.manifest.summary.ownerCount = dataset.summary.ownerCount;
  baseBundle.manifest.summary.recurringHotspotCount = dataset.recurringHotspots.length;
  baseBundle.manifest.summary.recurringIncidentCount = dataset.recurringIncidents.length;
  baseBundle.manifest.summary.stewardActionCount = dataset.steward?.summary?.actionCount ?? 0;
  baseBundle.manifest.summary.stewardHeadline = dataset.steward?.summary?.headline ?? 'No steward summary available.';
  baseBundle.manifest.files = files ?? baseBundle.manifest.files;
  baseBundle.artifacts['casebook-dataset.json'] = JSON.stringify(dataset, null, 2);

  return JSON.stringify(baseBundle, null, 2);
}

function buildStewardAction(kind, label, signature, headline, ask) {
  return {
    kind,
    label,
    signature,
    seenCount: 1,
    sourcePacks: ['pack-1'],
    priority: 1000,
    headline,
    ask,
  };
}
