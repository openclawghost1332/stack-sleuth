import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import {
  buildResponseBundle,
  RESPONSE_BUNDLE_KIND,
  RESPONSE_BUNDLE_VERSION,
} from '../src/bundle.js';

const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const comparisonTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const profileHydrationTrace = `ProfileHydrationError: Profile payload missing account metadata
    at renderProfileState (/app/src/profile.js:102:9)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const annotatedHistory = [
  '=== release-2026-04-15 ===',
  '>>> summary: Checkout profile payload dropped account metadata before render',
  '>>> fix: Guard renderProfile before reading account.name',
  '>>> owner: web-platform',
  '>>> runbook: https://example.com/runbooks/profile-null',
  sampleTrace,
  '',
  '=== billing-outage ===',
  comparisonTrace,
].join('\n');

const portfolioFixture = [
  '@@@ checkout-prod @@@',
  '@@ current @@',
  [sampleTrace, sampleTrace].join('\n\n'),
  '',
  '@@@ profile-rollout @@@',
  '@@ current @@',
  [sampleTrace, profileHydrationTrace].join('\n\n'),
  '',
  '@@ history @@',
  annotatedHistory,
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  sampleTrace,
  '',
  '@@ candidate @@',
  [sampleTrace, comparisonTrace].join('\n\n'),
].join('\n');

test('buildResponseBundle composes a deterministic portfolio response bundle', () => {
  const report = analyzeIncidentPortfolio(portfolioFixture);

  const bundle = buildResponseBundle({
    report,
    sourceMode: 'portfolio',
    sourceLabel: 'Portfolio Radar',
  });

  assert.equal(bundle.kind, RESPONSE_BUNDLE_KIND);
  assert.equal(bundle.version, RESPONSE_BUNDLE_VERSION);
  assert.equal(bundle.manifest.kind, RESPONSE_BUNDLE_KIND);
  assert.equal(bundle.manifest.version, RESPONSE_BUNDLE_VERSION);
  assert.match(bundle.manifest.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(bundle.manifest.source, {
    mode: 'portfolio',
    label: 'Portfolio Radar',
  });
  assert.deepEqual(bundle.manifest.summary, {
    headline: report.summary.headline,
    releaseGateVerdict: report.gate.verdict,
    packCount: report.summary.packCount,
    runnablePackCount: report.summary.runnablePackCount,
    ownerCount: report.responseQueue.length,
    recurringIncidentCount: report.recurringIncidents.length,
    recurringHotspotCount: report.recurringHotspots.length,
  });

  const expectedFiles = [
    'manifest.json',
    'incident-dossier.html',
    'portfolio-summary.md',
    'handoff.md',
    'casebook.txt',
    'casebook-dataset.json',
    'merge-review.md',
    'response-bundle.json',
  ];

  assert.deepEqual(Object.keys(bundle.files), expectedFiles);
  assert.deepEqual(bundle.manifest.files, expectedFiles);
  assert.deepEqual(JSON.parse(bundle.files['manifest.json']), bundle.manifest);

  const replayPayload = JSON.parse(bundle.files['response-bundle.json']);
  assert.equal(replayPayload.kind, RESPONSE_BUNDLE_KIND);
  assert.equal(replayPayload.version, RESPONSE_BUNDLE_VERSION);
  assert.deepEqual(replayPayload.manifest, bundle.manifest);
  assert.deepEqual(Object.keys(replayPayload.artifacts), expectedFiles.filter((name) => name !== 'response-bundle.json'));
  assert.equal(replayPayload.artifacts['response-bundle.json'], undefined);
  assert.equal(replayPayload.artifacts['manifest.json'], bundle.files['manifest.json']);
  assert.equal(replayPayload.artifacts['casebook-dataset.json'], bundle.files['casebook-dataset.json']);

  assert.match(bundle.files['incident-dossier.html'], /<!doctype html>/i);
  assert.match(bundle.files['incident-dossier.html'], /Stack Sleuth Incident Dossier/);
  assert.match(bundle.files['portfolio-summary.md'], /^# Stack Sleuth Portfolio Radar/m);
  assert.match(bundle.files['handoff.md'], /^# Stack Sleuth Handoff Briefing/m);
  assert.match(bundle.files['merge-review.md'], /^# Stack Sleuth Casebook Merge/m);
  assert.match(bundle.files['casebook.txt'], /^=== release-2026-04-15 ===/m);
  assert.match(bundle.files['casebook.txt'], /^=== billing-outage ===/m);

  const dataset = JSON.parse(bundle.files['casebook-dataset.json']);
  assert.equal(dataset.kind, 'stack-sleuth-casebook-dataset');
  assert.equal(dataset.version, 1);
  assert.match(dataset.exportText, /^=== release-2026-04-15 ===/m);
});
