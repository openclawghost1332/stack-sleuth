import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadIncidentWorkspace } from '../src/workspace.js';

const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)`;

const comparisonTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)`;

const timelineTrace = `=== before ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

=== after ===
TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)`;

const notebookInput = [
  '# Checkout incident notebook',
  '',
  '## Current incident',
  sampleTrace,
].join('\n');

async function makeTempDir(t) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-workspace-'));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));
  return tempDir;
}

test('loadIncidentWorkspace normalizes a single incident folder into a deterministic incident pack', async (t) => {
  const tempDir = await makeTempDir(t);
  await fs.writeFile(path.join(tempDir, 'candidate.log'), comparisonTrace, 'utf8');
  await fs.writeFile(path.join(tempDir, 'notebook.md'), notebookInput, 'utf8');
  await fs.writeFile(path.join(tempDir, 'timeline.txt'), timelineTrace, 'utf8');
  await fs.writeFile(path.join(tempDir, 'current.trace'), sampleTrace, 'utf8');
  await fs.writeFile(path.join(tempDir, 'baseline.log'), sampleTrace, 'utf8');
  await fs.writeFile(path.join(tempDir, 'history.casebook'), `=== release-2026-04-15 ===\n${sampleTrace}`, 'utf8');

  const workspace = loadIncidentWorkspace(tempDir);

  assert.equal(workspace.kind, 'pack');
  assert.deepEqual(workspace.recognizedFiles, [
    'current.trace',
    'history.casebook',
    'baseline.log',
    'candidate.log',
    'timeline.txt',
  ]);
  assert.equal(workspace.normalizedText, [
    '@@ current @@',
    sampleTrace,
    '',
    '@@ history @@',
    `=== release-2026-04-15 ===\n${sampleTrace}`,
    '',
    '@@ baseline @@',
    sampleTrace,
    '',
    '@@ candidate @@',
    comparisonTrace,
    '',
    '@@ timeline @@',
    timelineTrace,
  ].join('\n'));
  assert.doesNotMatch(workspace.normalizedText, /Checkout incident notebook/);
});

test('loadIncidentWorkspace detects packs subdirectories and builds a sorted portfolio', async (t) => {
  const tempDir = await makeTempDir(t);
  await fs.mkdir(path.join(tempDir, 'packs', 'checkout-prod'), { recursive: true });
  await fs.mkdir(path.join(tempDir, 'packs', 'billing-canary'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'packs', 'checkout-prod', 'current.log'), sampleTrace, 'utf8');
  await fs.writeFile(path.join(tempDir, 'packs', 'billing-canary', 'baseline.log'), sampleTrace, 'utf8');
  await fs.writeFile(path.join(tempDir, 'packs', 'billing-canary', 'candidate.log'), comparisonTrace, 'utf8');

  const workspace = loadIncidentWorkspace(tempDir);

  assert.equal(workspace.kind, 'portfolio');
  assert.deepEqual(workspace.packOrder, ['billing-canary', 'checkout-prod']);
  assert.equal(workspace.normalizedText, [
    '@@@ billing-canary @@@',
    '@@ baseline @@',
    sampleTrace,
    '',
    '@@ candidate @@',
    comparisonTrace,
    '',
    '@@@ checkout-prod @@@',
    '@@ current @@',
    sampleTrace,
  ].join('\n'));
  assert.deepEqual(
    workspace.packs.map((pack) => ({ label: pack.label, recognizedFiles: pack.recognizedFiles })),
    [
      { label: 'billing-canary', recognizedFiles: ['baseline.log', 'candidate.log'] },
      { label: 'checkout-prod', recognizedFiles: ['current.log'] },
    ],
  );
});

test('loadIncidentWorkspace keeps notebook-only folders in notebook mode', async (t) => {
  const tempDir = await makeTempDir(t);
  await fs.writeFile(path.join(tempDir, 'notebook.md'), notebookInput, 'utf8');

  const workspace = loadIncidentWorkspace(tempDir);

  assert.equal(workspace.kind, 'notebook');
  assert.deepEqual(workspace.recognizedFiles, ['notebook.md']);
  assert.equal(workspace.input, notebookInput);
});

test('loadIncidentWorkspace rejects folders without supported incident workspace files', async (t) => {
  const tempDir = await makeTempDir(t);
  await fs.writeFile(path.join(tempDir, 'notes.txt'), 'nothing useful yet', 'utf8');

  assert.throws(
    () => loadIncidentWorkspace(tempDir),
    /supported filenames.*current\.log.*history\.casebook.*notebook\.md/is,
  );
});
