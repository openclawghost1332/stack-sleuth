import test from 'node:test';
import assert from 'node:assert/strict';

import { inspectCapsuleInput, normalizeCapsuleToWorkflow } from '../src/capsule.js';
import { analyzeIncidentPack } from '../src/briefing.js';

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
  const version1 = inspectCapsuleInput(JSON.stringify({ kind: 'incident-capsule', version: '1', artifacts: [] }));
  assert.equal(version1.valid, true);

  const version2 = inspectCapsuleInput(JSON.stringify({ kind: 'incident-capsule', version: '2', artifacts: [] }));
  assert.equal(version2.valid, true);

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

test('normalizeCapsuleToWorkflow prefers artifact content over excerpt when reconstructing workflow files', () => {
  const capsule = buildFixtureCapsule({
    'current.log': sampleTrace,
  }, { version: '2' });
  capsule.artifacts[0].excerpt = comparisonTrace;
  capsule.artifacts[0].content = sampleTrace;

  const workflow = normalizeCapsuleToWorkflow(capsule);
  assert.equal(workflow.kind, 'pack');
  assert.match(workflow.normalizedText, /renderProfile/);
  assert.doesNotMatch(workflow.normalizedText, /renderInvoice/);
});

test('normalizeCapsuleToWorkflow keeps v1 excerpt fallback behavior intact', () => {
  const capsule = buildFixtureCapsule({
    'current.log': sampleTrace,
  }, { version: '1' });
  delete capsule.artifacts[0].content;

  const workflow = normalizeCapsuleToWorkflow(capsule);
  assert.equal(workflow.kind, 'pack');
  assert.match(workflow.normalizedText, /renderProfile/);
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

test('normalizeCapsuleToWorkflow preserves long casebook history from v2 capsule content beyond excerpt windows', () => {
  const currentTrace = sampleTrace;
  const fullHistory = buildLongCasebookHistory(6, sampleTrace, comparisonTrace);
  const truncatedHistory = fullHistory.split('\n\n').slice(0, 2).join('\n\n');
  const capsule = buildFixtureCapsule({
    'current.log': currentTrace,
    'history.casebook': truncatedHistory,
  }, { version: '2' });
  const historyArtifact = capsule.artifacts.find((artifact) => artifact.relativePath === 'history.casebook');
  historyArtifact.content = fullHistory;

  const workflow = normalizeCapsuleToWorkflow(capsule);
  const report = analyzeIncidentPack(workflow.normalizedText);

  assert.equal(report.summary.counts.knownIncidents, 1);
  assert.equal(report.casebook.summary.historicalCaseCount, 6);
  assert.match(report.casebook.historicalCases[0].label, /release-2026-04-15/);
  assert.match(workflow.normalizedText, /release-2026-04-20/);
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

function buildFixtureCapsule(entries, options = {}) {
  const version = options.version ?? '1';
  return {
    kind: 'incident-capsule',
    version,
    source: { inputPath: 'fixture' },
    artifacts: Object.entries(entries).map(([relativePath, excerpt]) => buildArtifact(relativePath, excerpt, version)),
  };
}

function buildArtifact(relativePath, excerpt, version = '1') {
  return {
    relativePath,
    kind: relativePath.endsWith('.md') ? 'markdown' : relativePath.endsWith('.json') ? 'json' : 'log',
    supported: true,
    size: excerpt.length,
    modifiedAt: '2026-05-01T07:14:00.000Z',
    contentLength: excerpt.length,
    ...(version === '2' ? { content: excerpt } : {}),
    excerpt,
    warnings: [],
  };
}

function buildLongCasebookHistory(caseCount, repeatedTrace, novelTrace) {
  return Array.from({ length: caseCount }, (_, index) => {
    const label = `release-2026-04-${String(15 + index).padStart(2, '0')}`;
    const traceBody = index === 0
      ? repeatedTrace
      : index === caseCount - 1
        ? novelTrace
        : `${repeatedTrace}\n\n${novelTrace}`;
    return [`=== ${label} ===`, traceBody].join('\n');
  }).join('\n\n');
}
