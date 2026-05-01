import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { analyzeTrace } from '../src/analyze.js';

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
  }), null, 2),
  '',
  '=== release-b ===',
  JSON.stringify(buildChronicleDataset({
    packCount: 3,
    owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
    hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
    cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
  }), null, 2),
  '',
  '=== release-c ===',
  JSON.stringify(buildChronicleDataset({
    packCount: 4,
    owners: [{ owner: 'web-platform', packCount: 3 }, { owner: 'billing', packCount: 2 }],
    hotspots: [{ label: 'profile.js', packCount: 3, maxScore: 4 }, { label: 'billing.js', packCount: 2, maxScore: 3 }],
    cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
  }), null, 2),
].join('\n');

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
  assert.equal(parsed.version, 1);
  assert.equal(parsed.summary.ownerCount, 1);
  assert.equal(parsed.gate.verdict, 'hold');
});

test('CLI reads labeled saved datasets with --chronicle and prints a chronicle summary', () => {
  const result = runCli(['--chronicle', '-'], { input: chronicleInput });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Casebook Chronicle/);
  assert.match(result.stdout, /Release gate: hold/i);
  assert.match(result.stdout, /Latest snapshot: release-c/i);
  assert.match(result.stdout, /Owner trends/);
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

  const markdownResult = runCli(['--chronicle', '-', '--markdown'], { input: chronicleInput });
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Casebook Chronicle/m);
  assert.match(markdownResult.stdout, /## Owner trends/);
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
  assert.match(result.stderr, /Casebook Chronicle snapshot release-a uses unsupported dataset version 99\. Supported version: 1\./i);
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
  assert.match(result.stderr, /Casebook Dataset replay uses unsupported version 99\. Supported version: 1\./i);
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
  assert.match(result.stderr, /Casebook Dataset history uses unsupported version 99\. Supported version: 1\./i);
});

test('CLI dataset mode supports --json and --markdown output', () => {
  const jsonResult = runCli(['--dataset', '-', '--json'], { input: portfolioInput });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const parsed = JSON.parse(jsonResult.stdout);
  assert.equal(parsed.kind, 'stack-sleuth-casebook-dataset');
  assert.equal(parsed.version, 1);
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

import { buildReleaseGate } from '../src/gate.js';

function buildCapsuleArtifact(relativePath, excerpt) {
  return {
    relativePath,
    kind: relativePath.endsWith('.md') ? 'markdown' : 'log',
    supported: true,
    size: excerpt.length,
    modifiedAt: '2026-05-01T07:14:00.000Z',
    contentLength: excerpt.length,
    excerpt,
    warnings: [],
  };
}

function buildChronicleDataset({
  packCount = 2,
  owners = [],
  hotspots = [],
  cases = [],
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
    exportText: '=== saved-case ===\nTypeError: replay me',
  };
}
