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
