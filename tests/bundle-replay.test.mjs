import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { buildResponseBundle } from '../src/bundle.js';
import {
  inspectResponseBundleReplayInput,
  renderResponseBundleMarkdownSummary,
  renderResponseBundleTextSummary,
} from '../src/bundle-replay.js';

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

test('inspectResponseBundleReplayInput recognizes a self-contained replay artifact and shared summaries', () => {
  const report = analyzeIncidentPortfolio(portfolioFixture);
  const bundlePayload = JSON.parse(buildResponseBundle({
    report,
    sourceMode: 'portfolio',
    sourceLabel: 'Portfolio Radar',
  }).files['response-bundle.json']);

  bundlePayload.manifest.summary.stewardActionCount = 999;
  bundlePayload.manifest.summary.stewardHeadline = 'Manifest steward summary should not win replay.';

  const replay = inspectResponseBundleReplayInput(JSON.stringify(bundlePayload));

  assert.equal(replay.valid, true);
  assert.equal(replay.bundle.kind, 'stack-sleuth-response-bundle');
  assert.equal(replay.bundle.version, 3);
  assert.equal(replay.bundle.sourceVersion, 3);
  assert.equal(replay.bundle.manifest.summary.releaseGateVerdict, report.gate.verdict);
  assert.equal(replay.bundle.dataset.gate.verdict, report.gate.verdict);
  assert.equal(replay.bundle.dataset.summary.ownerCount, report.responseQueue.length);
  assert.equal(replay.bundle.dataset.steward.preserved, true);
  assert.ok(replay.bundle.dataset.steward.summary.actionCount >= 1);
  assert.ok(Array.isArray(replay.bundle.dataset.routingGaps));
  assert.ok(Array.isArray(replay.bundle.dataset.runbookGaps));
  assert.ok(replay.bundle.dataset.board.summary.totalCards >= 1);
  assert.deepEqual(replay.bundle.manifest.source, {
    mode: 'portfolio',
    label: 'Portfolio Radar',
  });
  assert.match(replay.bundle.artifacts['handoff.md'], /^# Stack Sleuth Handoff Briefing/m);
  assert.equal(replay.bundle.artifacts['response-bundle.json'], undefined);

  const text = renderResponseBundleTextSummary(replay.bundle);
  const markdown = renderResponseBundleMarkdownSummary(replay.bundle);

  assert.match(text, /Stack Sleuth Response Bundle Replay/);
  assert.match(text, /Source workflow: portfolio \(Portfolio Radar\)/i);
  assert.match(text, /Release gate: hold/i);
  assert.match(text, /Response owners: 1/);
  assert.match(text, /Steward actions: [1-9]/);
  assert.match(text, /Action Board cards: [1-9]/);
  assert.match(text, /Next steward action: /);
  assert.match(text, /Saved-artifact note:/i);
  assert.match(text, /response-bundle\.json/);
  assert.doesNotMatch(text, /Manifest steward summary should not win replay/i);
  assert.doesNotMatch(text, /raw trace recovery/i);

  assert.match(markdown, /^# Stack Sleuth Response Bundle Replay/m);
  assert.match(markdown, /- \*\*Source workflow:\*\* portfolio \(Portfolio Radar\)/i);
  assert.match(markdown, /- \*\*Release gate:\*\* hold/i);
  assert.match(markdown, /- \*\*Steward actions:\*\* [1-9]/i);
  assert.match(markdown, /- \*\*Action Board cards:\*\* [1-9]/i);
  assert.match(markdown, /- \*\*Next steward action:\*\*/i);
  assert.match(markdown, /## Bundle inventory/);
  assert.match(markdown, /response-bundle\.json/);
});

test('inspectResponseBundleReplayInput normalizes legacy version-1 bundle payloads with preserved dataset fields', () => {
  const report = analyzeIncidentPortfolio(portfolioFixture);
  const bundle = buildResponseBundle({
    report,
    sourceMode: 'portfolio',
    sourceLabel: 'Legacy Portfolio Radar',
  });

  const legacyFiles = { ...bundle.files };
  delete legacyFiles['response-bundle.json'];

  const legacyBundle = {
    kind: bundle.kind,
    version: 1,
    manifest: {
      ...bundle.manifest,
      version: 1,
      files: bundle.manifest.files.filter((name) => name !== 'response-bundle.json'),
    },
    files: legacyFiles,
  };

  const replay = inspectResponseBundleReplayInput(JSON.stringify(legacyBundle));

  assert.equal(replay.valid, true);
  assert.equal(replay.bundle.version, 3);
  assert.equal(replay.bundle.sourceVersion, 1);
  assert.equal(replay.bundle.manifest.version, 1);
  assert.equal(replay.bundle.summary.fileCount, 8);
  assert.equal(replay.bundle.dataset.summary.ownerCount, report.responseQueue.length);
  assert.equal(replay.bundle.dataset.gate.verdict, report.gate.verdict);
  assert.equal(replay.bundle.dataset.steward.preserved, true);
  assert.deepEqual(Object.keys(replay.bundle.artifacts), Object.keys(legacyFiles));
  assert.equal(replay.bundle.artifacts['response-bundle.json'], undefined);
});
