import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { buildResponseBundle } from '../src/bundle.js';
import {
  analyzeResponseBundleChronicle,
  inspectResponseBundleChronicleInput,
  parseResponseBundleChronicleSnapshots,
  renderResponseBundleChronicleMarkdownSummary,
  renderResponseBundleChronicleTextSummary,
} from '../src/bundle-chronicle.js';
import { buildReleaseGate } from '../src/gate.js';

const portfolioInput = [
  '@@@ checkout-prod @@@',
  '@@ current @@',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
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
      stewardActionCount: 4,
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
      stewardActionCount: 3,
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
      stewardActionCount: 2,
    }),
  }),
].join('\n');

test('parseResponseBundleChronicleSnapshots keeps labeled bundle snapshots in order', () => {
  const snapshots = parseResponseBundleChronicleSnapshots(bundleChronicleInput);

  assert.deepEqual(snapshots.map((item) => item.label), ['release-a', 'release-b', 'release-c']);
  assert.match(snapshots[0].source, /stack-sleuth-response-bundle/);
});

test('inspectResponseBundleChronicleInput validates snapshot bundles and surfaces snapshot-level failures', () => {
  const valid = inspectResponseBundleChronicleInput(bundleChronicleInput);
  assert.equal(valid.valid, true);
  assert.equal(valid.snapshots.length, 3);
  assert.equal(valid.snapshots[2].bundle.manifest.source.mode, 'workspace');

  const invalid = inspectResponseBundleChronicleInput([
    '=== release-a ===',
    buildChronicleBundle({ version: 99 }),
    '',
    '=== release-b ===',
    buildChronicleBundle(),
  ].join('\n'));
  assert.equal(invalid.valid, false);
  assert.equal(invalid.reason, 'unsupported-version');
  assert.equal(invalid.snapshotLabel, 'release-a');
});

test('analyzeResponseBundleChronicle classifies owner, hotspot, case, inventory, and steward drift across snapshots', () => {
  const report = analyzeResponseBundleChronicle(bundleChronicleInput);

  assert.equal(report.summary.snapshotCount, 3);
  assert.equal(report.summary.latestLabel, 'release-c');
  assert.equal(report.summary.latestGateVerdict, 'hold');
  assert.equal(report.summary.latestSourceMode, 'workspace');
  assert.equal(report.summary.gateDrift.direction, 'regressed');
  assert.equal(report.summary.stewardDrift.direction, 'improved');
  assert.match(report.summary.latestStewardHeadline, /Casebook Steward found 2 actions across 2 cases\./i);
  assert.equal(report.summary.newOwnerCount, 0);
  assert.equal(report.summary.risingOwnerCount, 2);
  assert.ok(report.inventoryTrends.some((entry) => entry.filename === 'response-bundle.json' && entry.trend === 'new'));
  assert.ok(report.inventoryTrends.some((entry) => entry.filename === 'manifest.json' && entry.trend === 'steady'));
});

test('bundle chronicle renderers include steward drift, source workflow, and bundle inventory drift without implying raw trace recovery', () => {
  const report = analyzeResponseBundleChronicle(bundleChronicleInput);
  const text = renderResponseBundleChronicleTextSummary(report);
  const markdown = renderResponseBundleChronicleMarkdownSummary(report);

  assert.match(text, /Stack Sleuth Response Bundle Chronicle/);
  assert.match(text, /Latest source workflow: workspace/i);
  assert.match(text, /Steward drift: Improved from 3 stewardship actions to 2\./i);
  assert.match(text, /Latest steward: Casebook Steward found 2 actions across 2 cases\./i);
  assert.match(text, /Bundle inventory trends/);
  assert.match(text, /Saved-artifact note:/);

  assert.match(markdown, /^# Stack Sleuth Response Bundle Chronicle/m);
  assert.match(markdown, /Steward drift/i);
  assert.match(markdown, /Latest steward/i);
  assert.match(markdown, /## Bundle inventory trends/);
  assert.match(markdown, /Saved-artifact note/);
});

test('bundle chronicle marks steward drift unavailable when a saved snapshot had to reconstruct stewardship', () => {
  const reconstructedChronicleInput = [
    '=== release-a ===',
    buildChronicleBundle({
      dataset: buildChronicleDataset({
        packCount: 2,
        owners: [{ owner: 'web-platform', packCount: 1 }],
        hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
        cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
      }),
    }),
    '',
    '=== release-b ===',
    buildChronicleBundle({
      dataset: buildChronicleDataset({
        packCount: 3,
        owners: [{ owner: 'web-platform', packCount: 2 }],
        hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }],
        cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
        stewardPreserved: false,
      }),
    }),
  ].join('\n');

  const report = analyzeResponseBundleChronicle(reconstructedChronicleInput);
  const text = renderResponseBundleChronicleTextSummary(report);

  assert.equal(report.summary.stewardDrift.direction, 'unavailable');
  assert.match(report.summary.latestStewardHeadline, /^Reconstructed Casebook Steward/i);
  assert.match(text, /Steward drift unavailable because one of the compared snapshots had to reconstruct stewardship detail from older dataset fields\./i);
});

function buildChronicleDataset({
  packCount = 2,
  owners = [],
  hotspots = [],
  cases = [],
  stewardActionCount = Math.max(0, 4 - packCount),
  stewardPreserved = true,
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
      actions: Array.from({ length: stewardActionCount }, (_, index) => ({
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
        actionCount: stewardActionCount,
        urgentActionCount: stewardActionCount ? 1 : 0,
        headline: `Casebook Steward found ${stewardActionCount} action${stewardActionCount === 1 ? '' : 's'} across ${cases.length} case${cases.length === 1 ? '' : 's'}.`,
      },
      nextAction: stewardActionCount ? 'Handle steward action 1' : 'No stewardship gaps detected in the current casebook state.',
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
