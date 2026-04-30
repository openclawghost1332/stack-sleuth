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
  assert.equal(parsed.priorityQueue[0].label, 'profile-rollout');
  assert.equal(parsed.responseQueue[0].owner, 'web-platform');
  assert.deepEqual(parsed.responseQueue[0].labels, ['profile-rollout']);
  assert.deepEqual(parsed.unownedPacks.map((item) => item.label).sort(), ['billing-canary', 'checkout-prod']);
  assert.ok(parsed.recurringHotspots.some((item) => item.packCount >= 2));

  const markdownResult = runCli(['--portfolio', '-', '--markdown'], { input: portfolioInput });
  assert.equal(markdownResult.status, 0, markdownResult.stderr);
  assert.match(markdownResult.stdout, /^# Stack Sleuth Portfolio Radar/m);
  assert.match(markdownResult.stdout, /## Response queue/);
  assert.match(markdownResult.stdout, /web\\-platform/);
  assert.match(markdownResult.stdout, /## Routing gaps/);
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

test('CLI exits non-zero when multiple workflow modes are requested together', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-mode-clash-'));
  const historyPath = path.join(tempDir, 'history.txt');
  const timelinePath = path.join(tempDir, 'timeline.txt');
  await fs.promises.writeFile(historyPath, casebookHistoryInput, 'utf8');
  await fs.promises.writeFile(timelinePath, timelineInput, 'utf8');

  const result = runCli(['--history', historyPath, '--timeline', timelinePath], { input: casebookCurrentInput });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /choose one workflow mode at a time/i);
  assert.equal(result.stdout, '');
});
