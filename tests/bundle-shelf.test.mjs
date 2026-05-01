import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { buildResponseBundle } from '../src/bundle.js';
import {
  RESPONSE_BUNDLE_SHELF_KIND,
  RESPONSE_BUNDLE_SHELF_VERSION,
  buildResponseBundleShelf,
  describeResponseBundleShelfInputError,
  inspectReplayBundleShelfInput,
  renderResponseBundleShelfMarkdownSummary,
  renderResponseBundleShelfTextSummary,
} from '../src/bundle-shelf.js';

const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;
const comparisonTrace = `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;
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
  [
    '=== release-2026-04-15 ===',
    '>>> summary: Checkout profile payload dropped account metadata before render',
    '>>> fix: Guard renderProfile before reading account.name',
    '>>> owner: web-platform',
    '>>> runbook: https://example.com/runbooks/profile-null',
    [sampleTrace, comparisonTrace].join('\n\n'),
  ].join('\n'),
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  sampleTrace,
  '',
  '@@ candidate @@',
  [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
].join('\n');

function buildBundle({ sourceMode, sourceLabel }) {
  return buildResponseBundle({
    report: analyzeIncidentPortfolio(portfolioInput),
    sourceMode,
    sourceLabel,
  }).files['response-bundle.json'];
}

test('buildResponseBundleShelf preserves invalid warnings and reuses Response Bundle Chronicle when 2+ bundles are valid', () => {
  const report = buildResponseBundleShelf([
    {
      label: 'release-a',
      sourceName: 'release-a/response-bundle.json',
      source: buildBundle({ sourceMode: 'portfolio', sourceLabel: 'release-a fixture' }),
    },
    {
      label: 'release-b',
      sourceName: 'release-b/response-bundle.json',
      source: buildBundle({ sourceMode: 'workspace', sourceLabel: 'release-b fixture' }),
    },
    {
      label: 'broken',
      sourceName: 'broken.json',
      source: '{"kind":"stack-sleuth-response-bundle","version":3',
    },
  ]);

  assert.equal(report.kind, RESPONSE_BUNDLE_SHELF_KIND);
  assert.equal(report.version, RESPONSE_BUNDLE_SHELF_VERSION);
  assert.equal(report.summary.snapshotCount, 3);
  assert.equal(report.summary.validSnapshotCount, 2);
  assert.equal(report.summary.invalidSnapshotCount, 1);
  assert.equal(report.summary.latestLabel, 'release-b');
  assert.equal(report.summary.latestReleaseGateVerdict, 'hold');
  assert.equal(report.summary.latestSourceMode, 'workspace');
  assert.equal(report.summary.latestSourceLabel, 'release-b fixture');
  assert.match(report.summary.latestStewardHeadline, /steward/i);
  assert.ok(report.summary.latestActionBoardCardCount >= 1);
  assert.equal(report.chronicle.summary.snapshotCount, 2);
  assert.equal(report.chronicle.summary.latestSourceMode, 'workspace');
  assert.deepEqual(
    report.snapshots.map((snapshot) => [snapshot.label, snapshot.status]),
    [
      ['release-a', 'valid'],
      ['release-b', 'valid'],
      ['broken', 'invalid'],
    ]
  );
  assert.equal(report.snapshots[2].reason, 'invalid-json');
});

test('inspectReplayBundleShelfInput normalizes stored shelves and reports dedicated errors', () => {
  const shelf = buildResponseBundleShelf([
    {
      label: 'release-a',
      sourceName: 'release-a.json',
      source: buildBundle({ sourceMode: 'portfolio', sourceLabel: 'release-a fixture' }),
    },
  ]);

  const replay = inspectReplayBundleShelfInput(JSON.stringify(shelf, null, 2));
  assert.equal(replay.valid, true);
  assert.equal(replay.shelf.summary.validSnapshotCount, 1);
  assert.equal(replay.shelf.summary.latestSourceMode, 'portfolio');

  const wrongKind = inspectReplayBundleShelfInput(JSON.stringify({ kind: 'stack-sleuth-casebook-shelf', version: 1 }));
  assert.equal(wrongKind.valid, false);
  assert.equal(wrongKind.reason, 'wrong-kind');
  assert.match(describeResponseBundleShelfInputError(wrongKind), /unsupported kind/i);

  const unsupportedVersion = inspectReplayBundleShelfInput(JSON.stringify({
    kind: RESPONSE_BUNDLE_SHELF_KIND,
    version: 99,
    snapshots: [],
  }));
  assert.equal(unsupportedVersion.valid, false);
  assert.equal(unsupportedVersion.reason, 'unsupported-version');
  assert.match(describeResponseBundleShelfInputError(unsupportedVersion), /supported version: 1/i);

  const invalidJson = inspectReplayBundleShelfInput('{"kind":"stack-sleuth-response-bundle-shelf","version":1');
  assert.equal(invalidJson.valid, false);
  assert.equal(invalidJson.reason, 'invalid-json');
  assert.match(describeResponseBundleShelfInputError(invalidJson), /could not parse/i);
});

test('response bundle shelf renderers stay honest about saved-artifact limits', () => {
  const report = buildResponseBundleShelf([
    {
      label: 'release-a',
      sourceName: 'release-a/response-bundle.json',
      source: buildBundle({ sourceMode: 'portfolio', sourceLabel: 'release-a fixture' }),
    },
    {
      label: 'broken',
      sourceName: 'broken.json',
      source: '{"kind":"stack-sleuth-response-bundle","version":3',
    },
  ]);

  const text = renderResponseBundleShelfTextSummary(report);
  assert.match(text, /Stack Sleuth Response Bundle Shelf/);
  assert.match(text, /Latest source workflow: portfolio \(release-a fixture\)/i);
  assert.match(text, /Saved-artifact note: Response Bundle Shelf replays preserved bundle inventory and embedded dataset fields only/i);
  assert.match(text, /broken\.json: invalid-json/i);
  assert.match(text, /add one more valid saved response bundle snapshot to unlock drift analysis/i);

  const markdown = renderResponseBundleShelfMarkdownSummary(report);
  assert.match(markdown, /^# Stack Sleuth Response Bundle Shelf/m);
  assert.match(markdown, /\*\*Latest source workflow:\*\* portfolio/i);
  assert.match(markdown, /Saved-artifact note/i);
  assert.match(markdown, /## Snapshot warnings/);
});
