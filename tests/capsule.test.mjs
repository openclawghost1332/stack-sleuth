import test from 'node:test';
import assert from 'node:assert/strict';

import { inspectCapsuleInput, normalizeCapsuleToWorkflow } from '../src/capsule.js';

const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const comparisonTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const notebookPackInput = [
  '# Checkout incident notebook',
  '',
  '## Current incident',
  sampleTrace,
  '',
  '## Baseline',
  sampleTrace,
  '',
  '## Candidate',
  comparisonTrace,
].join('\n');

test('inspectCapsuleInput validates JSON capsules and surfaces capsule-specific failures', () => {
  const invalidJson = inspectCapsuleInput('{not valid json');
  assert.equal(invalidJson.valid, false);
  assert.equal(invalidJson.reason, 'invalid-json');

  const wrongKind = inspectCapsuleInput(JSON.stringify({ kind: 'incident-capsule-report', version: '1', artifacts: [] }));
  assert.equal(wrongKind.valid, false);
  assert.equal(wrongKind.reason, 'wrong-kind');

  const unsupportedVersion = inspectCapsuleInput(JSON.stringify({ kind: 'incident-capsule', version: '9', artifacts: [] }));
  assert.equal(unsupportedVersion.valid, false);
  assert.equal(unsupportedVersion.reason, 'unsupported-version');
});

test('normalizeCapsuleToWorkflow maps single-pack capsule files into incident-pack text', () => {
  const capsule = buildFixtureCapsule({
    'current.log': sampleTrace,
    'history.casebook': '=== release-2026-04-15 ===\n' + sampleTrace,
  });

  const inspection = inspectCapsuleInput(JSON.stringify(capsule));
  assert.equal(inspection.valid, true);
  const workflow = normalizeCapsuleToWorkflow(inspection.capsule);
  assert.equal(workflow.kind, 'pack');
  assert.match(workflow.normalizedText, /@@ current @@/);
  assert.match(workflow.normalizedText, /@@ history @@/);
});

test('normalizeCapsuleToWorkflow uses the last matching artifact for duplicate paths deterministically', () => {
  const capsule = buildFixtureCapsule({
    'current.log': sampleTrace,
  });
  capsule.artifacts.push(buildArtifact('current.log', comparisonTrace));

  const workflow = normalizeCapsuleToWorkflow(capsule);
  assert.equal(workflow.kind, 'pack');
  assert.match(workflow.normalizedText, /renderInvoice/);
  assert.doesNotMatch(workflow.normalizedText, /renderProfile/);
});

test('normalizeCapsuleToWorkflow maps packs/<label>/ artifacts into a portfolio and routes notebook-only packs', () => {
  const capsule = buildFixtureCapsule({
    'current.log': sampleTrace,
    'packs/checkout-prod/current.log': sampleTrace,
    'packs/billing-canary/notebook.md': notebookPackInput,
  });

  const workflow = normalizeCapsuleToWorkflow(capsule);
  assert.equal(workflow.kind, 'portfolio');
  assert.deepEqual(workflow.packOrder, ['billing-canary', 'checkout-prod']);
  assert.equal(workflow.warnings.length, 1);
  assert.match(workflow.warnings[0], /Ignoring recognized root capsule files/i);
  assert.match(workflow.normalizedText, /@@@ billing-canary @@@/);
  assert.match(workflow.normalizedText, /@@ current @@/);
  assert.match(workflow.normalizedText, /@@ candidate @@/);
});

test('normalizeCapsuleToWorkflow fails clearly when a valid capsule has zero runnable workflows', () => {
  const capsule = buildFixtureCapsule({
    'packs/archive/history.casebook': '=== release-2026-04-15 ===\n' + sampleTrace,
  });

  assert.throws(
    () => normalizeCapsuleToWorkflow(capsule),
    /no runnable capsule workflow/i,
  );
});

function buildFixtureCapsule(entries) {
  return {
    kind: 'incident-capsule',
    version: '1',
    source: { inputPath: 'fixture' },
    artifacts: Object.entries(entries).map(([relativePath, excerpt]) => buildArtifact(relativePath, excerpt)),
  };
}

function buildArtifact(relativePath, excerpt) {
  return {
    relativePath,
    kind: relativePath.endsWith('.md') ? 'markdown' : relativePath.endsWith('.json') ? 'json' : 'log',
    supported: true,
    size: excerpt.length,
    modifiedAt: '2026-05-01T07:14:00.000Z',
    contentLength: excerpt.length,
    excerpt,
    warnings: [],
  };
}
