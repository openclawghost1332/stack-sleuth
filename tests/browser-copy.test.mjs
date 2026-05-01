import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { buildCasebookDataset } from '../src/dataset.js';
import { buildResponseBundle } from '../src/bundle.js';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesCss = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const casebookHistoryInput = [
  '=== release-2026-04-15 ===',
  '>>> summary: Checkout profile payload dropped account metadata before render',
  '>>> fix: Guard renderProfile before reading account.name',
  '>>> owner: web-platform',
  '>>> runbook: https://example.com/runbooks/profile-null',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
  '',
  '=== profile-rewrite ===',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
].join('\n');

const casebookCurrentInput = [
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
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
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  '',
  '@@ candidate @@',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
  '',
  '@@ timeline @@',
  [
    '=== canary ===',
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    '',
    '=== partial ===',
    [
      `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
      `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
    ].join('\n\n'),
    '',
    '=== full-rollout ===',
    [
      `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
      `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
    ].join('\n\n')
  ].join('\n'),
].join('\n');

const incidentPackRegressionPriorityInput = [
  '@@ current @@',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  '',
  '@@ history @@',
  [
    '=== known-profile ===',
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n'),
  '',
  '@@ baseline @@',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  '',
  '@@ candidate @@',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
].join('\n');

const regressionBaselineInput = `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const regressionCandidateInput = [
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
].join('\n\n');

const dedicatedTimelineInput = [
  '=== canary ===',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  '',
  '=== full-rollout ===',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n')
].join('\n');

const portfolioInput = [
  '@@@ checkout-prod @@@',
  '@@ current @@',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
  '',
  '@@@ profile-rollout @@@',
  '@@ current @@',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `ProfileHydrationError: Profile payload missing account metadata\n    at renderProfileState (/app/src/profile.js:102:9)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
  '',
  '@@ history @@',
  [
    '=== release-2026-04-15 ===',
    '>>> summary: Checkout profile payload dropped account metadata before render',
    '>>> fix: Guard renderProfile before reading account.name',
    '>>> owner: web-platform',
    '>>> runbook: https://example.com/runbooks/profile-null',
    [
      `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
      `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
    ].join('\n\n'),
  ].join('\n'),
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  '',
  '@@ candidate @@',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
].join('\n');

const datasetReplayObject = buildCasebookDataset(portfolioInput);
const datasetReplayInput = JSON.stringify(datasetReplayObject, null, 2);
const reconstructedDatasetReplayObject = structuredClone(datasetReplayObject);
delete reconstructedDatasetReplayObject.steward;
const reconstructedDatasetReplayInput = JSON.stringify(reconstructedDatasetReplayObject, null, 2);
const unsupportedDatasetReplayInput = JSON.stringify({
  ...buildCasebookDataset(portfolioInput),
  version: 99,
}, null, 2);
const responseBundleReplayObject = JSON.parse(buildResponseBundle({
  report: analyzeIncidentPortfolio(portfolioInput),
  sourceMode: 'portfolio',
  sourceLabel: 'browser replay fixture',
}).files['response-bundle.json']);
const responseBundleReplayInput = JSON.stringify(responseBundleReplayObject, null, 2);
const reconstructedResponseBundleReplayObject = structuredClone(responseBundleReplayObject);
const reconstructedBundleDataset = JSON.parse(reconstructedResponseBundleReplayObject.artifacts['casebook-dataset.json']);
delete reconstructedBundleDataset.steward;
reconstructedResponseBundleReplayObject.artifacts['casebook-dataset.json'] = JSON.stringify(reconstructedBundleDataset, null, 2);
const reconstructedResponseBundleReplayInput = JSON.stringify(reconstructedResponseBundleReplayObject, null, 2);
const unsupportedResponseBundleReplayInput = JSON.stringify({
  kind: 'stack-sleuth-response-bundle',
  version: 99,
  manifest: {
    kind: 'stack-sleuth-response-bundle',
    version: 99,
    generatedAt: '2026-05-01T00:00:00.000Z',
    source: { mode: 'portfolio', label: 'browser replay fixture' },
    summary: { headline: 'unsupported bundle' },
    files: ['manifest.json', 'casebook-dataset.json'],
  },
  artifacts: {
    'manifest.json': '{"kind":"stack-sleuth-response-bundle"}',
    'casebook-dataset.json': datasetReplayInput,
  },
}, null, 2);
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

const responseBundleChronicleInput = [
  '=== release-a ===',
  buildChronicleBundle({
    sourceMode: 'portfolio',
    sourceLabel: 'browser release-a fixture',
    dataset: buildChronicleDataset({
      packCount: 2,
      owners: [{ owner: 'web-platform', packCount: 1 }],
      hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
    }),
    files: ['manifest.json', 'incident-dossier.html', 'portfolio-summary.md', 'handoff.md', 'casebook.txt', 'casebook-dataset.json', 'merge-review.md'],
  }),
  '',
  '=== release-b ===',
  buildChronicleBundle({
    sourceMode: 'portfolio',
    sourceLabel: 'browser release-b fixture',
    dataset: buildChronicleDataset({
      packCount: 3,
      owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
      hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
    }),
  }),
  '',
  '=== release-c ===',
  buildChronicleBundle({
    sourceMode: 'workspace',
    sourceLabel: 'browser release-c fixture',
    dataset: buildChronicleDataset({
      packCount: 4,
      owners: [{ owner: 'web-platform', packCount: 3 }, { owner: 'billing', packCount: 2 }],
      hotspots: [{ label: 'profile.js', packCount: 3, maxScore: 4 }, { label: 'billing.js', packCount: 2, maxScore: 3 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
    }),
  }),
].join('\n');
const reconstructedResponseBundleChronicleInput = [
  '=== release-a ===',
  buildChronicleBundle({
    sourceMode: 'portfolio',
    sourceLabel: 'browser release-a fixture',
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
    sourceMode: 'workspace',
    sourceLabel: 'browser release-b reconstructed fixture',
    dataset: reconstructedDatasetReplayObject,
  }),
].join('\n');
const shelfReplayInput = JSON.stringify({
  kind: 'stack-sleuth-casebook-shelf',
  version: 1,
  summary: {
    headline: 'Casebook Shelf replayed 2 valid snapshots and 1 warning entry.',
    snapshotCount: 3,
    validSnapshotCount: 2,
    invalidSnapshotCount: 1,
    chronicleAvailable: true,
    latestLabel: 'release-b',
  },
  snapshots: [
    {
      label: 'release-a',
      filename: 'release-a.json',
      status: 'valid',
      dataset: buildChronicleDataset({
        packCount: 2,
        owners: [{ owner: 'web-platform', packCount: 1 }],
        hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
        cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
      }),
    },
    {
      label: 'release-b',
      filename: 'release-b.json',
      status: 'valid',
      dataset: buildChronicleDataset({
        packCount: 3,
        owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
        hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
        cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
      }),
    },
    {
      label: 'broken',
      filename: 'broken.json',
      status: 'invalid',
      reason: 'invalid-json',
      message: 'Could not parse saved dataset JSON.',
    },
  ],
  chronicle: {
    snapshots: [],
    labels: ['release-a', 'release-b'],
    ownerTrends: [{ owner: 'web-platform', series: [1, 2], trend: 'rising', latestCount: 2, peakCount: 2, labels: ['release-a', 'release-b'], latestLabels: ['web-platform-pack-1'], guidance: [] }],
    hotspotTrends: [{ label: 'profile.js', series: [1, 2], trend: 'rising', latestCount: 2, peakCount: 2, maxScore: 3, labels: ['release-a', 'release-b'] }],
    caseTrends: [{ signature: 'sig-profile-js', label: 'profile-js', series: [1, 1], trend: 'steady', latestCount: 1, peakCount: 1, labels: ['release-a', 'release-b'] }],
    summary: {
      snapshotCount: 2,
      latestLabel: 'release-b',
      latestPackCount: 3,
      latestOwnerCount: 2,
      latestHotspotCount: 2,
      latestCaseCount: 2,
      newOwnerCount: 1,
      risingOwnerCount: 1,
      flappingOwnerCount: 0,
      steadyOwnerCount: 0,
      fallingOwnerCount: 0,
      resolvedOwnerCount: 0,
      newHotspotCount: 1,
      risingHotspotCount: 1,
      flappingHotspotCount: 0,
      steadyHotspotCount: 0,
      fallingHotspotCount: 0,
      resolvedHotspotCount: 0,
      newCaseCount: 1,
      risingCaseCount: 0,
      flappingCaseCount: 0,
      steadyCaseCount: 1,
      fallingCaseCount: 0,
      resolvedCaseCount: 0,
      headline: 'Chronicle compared 2 saved datasets and the latest snapshot release-b shows 1 new owner, 1 rising owner, 1 new hotspot, and 1 new case.',
    },
  },
}, null, 2);

const notebookPackInput = [
  '# Checkout incident notebook',
  '',
  '## Current incident',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `ProfileHydrationError: Profile payload missing account metadata\n    at renderProfileState (/app/src/profile.js:102:9)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
  '',
  '## Prior incidents',
  casebookHistoryInput,
  '',
  '## Baseline',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  '',
  '## Candidate',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
  '',
  '## Timeline',
  dedicatedTimelineInput,
].join('\n');

const notebookPortfolioInput = [
  '# Pack: checkout-prod',
  '',
  '## Current incident',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
  '',
  '# Pack: profile-rollout',
  '',
  '## Current incident',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `ProfileHydrationError: Profile payload missing account metadata\n    at renderProfileState (/app/src/profile.js:102:9)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
  '',
  '## Prior incidents',
  [
    '=== release-2026-04-15 ===',
    [
      `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
      `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
    ].join('\n\n'),
  ].join('\n'),
  '',
  '# Pack: billing-canary',
  '',
  '## Baseline',
  `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
  '',
  '## Candidate',
  [
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`,
    `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
  ].join('\n\n'),
].join('\n');

const requiredIds = [
  'trace-input',
  'explain-button',
  'load-js-button',
  'load-python-button',
  'load-raw-log-button',
  'load-digest-button',
  'load-notebook-button',
  'load-pack-button',
  'load-portfolio-button',
  'load-handoff-button',
  'load-dataset-button',
  'load-chronicle-button',
  'load-shelf-button',
  'load-merge-button',
  'copy-button',
  'example-caption',
  'compare-baseline-input',
  'compare-candidate-input',
  'compare-button',
  'load-regression-button',
  'compare-caption',
  'casebook-current-input',
  'casebook-history-input',
  'casebook-button',
  'load-casebook-button',
  'copy-casebook-button',
  'casebook-caption',
  'timeline-input',
  'timeline-button',
  'load-timeline-button',
  'copy-timeline-button',
  'timeline-caption',
  'excavation-value',
  'runtime-value',
  'headline-value',
  'culprit-value',
  'confidence-value',
  'tags-value',
  'signature-value',
  'support-frames-value',
  'hotspots-value',
  'summary-value',
  'blast-radius-value',
  'digest-groups-value',
  'checklist-value',
  'regression-summary-value',
  'regression-incidents-value',
  'hotspot-shifts-value',
  'casebook-summary-value',
  'known-count-value',
  'novel-count-value',
  'closest-matches-value',
  'timeline-summary-value',
  'timeline-incidents-value',
  'timeline-hotspots-value',
  'portfolio-summary-value',
  'portfolio-pack-count-value',
  'portfolio-priority-value',
  'portfolio-recurring-incidents-value',
  'portfolio-recurring-hotspots-value',
  'portfolio-response-queue-value',
  'portfolio-routing-gaps-value',
  'handoff-summary-value',
  'handoff-export-value',
  'forge-summary-value',
  'forge-export-value',
  'dataset-summary-value',
  'dataset-pack-count-value',
  'dataset-export-value',
  'merge-summary-value',
  'merge-conflicts-value',
  'merge-export-value',
];

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.value = '';
    this.children = [];
    this.listeners = new Map();
    this._textContent = '';
  }

  get textContent() {
    return this.children.length ? this.children.map((child) => child.textContent).join('') : this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  replaceChildren(...children) {
    this.children = children;
    this._textContent = '';
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  async dispatch(type) {
    const handlers = this.listeners.get(type) ?? [];
    for (const handler of handlers) {
      await handler({ target: this, currentTarget: this, type });
    }
  }
}

class FakeDocument {
  constructor(ids) {
    this.elements = new Map(ids.map((id) => [id, new FakeElement('div', id)]));
  }

  querySelector(selector) {
    if (!selector.startsWith('#')) {
      return null;
    }

    return this.elements.get(selector.slice(1)) ?? null;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

async function loadBrowserHarness() {
  const document = new FakeDocument(requiredIds);
  const clipboard = { text: '' };
  const navigator = {
    clipboard: {
      writeText: async (value) => {
        clipboard.text = String(value);
      }
    }
  };

  const priorDocument = globalThis.document;
  const priorNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'document', {
    value: document,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: navigator,
    configurable: true,
    writable: true,
  });

  await import(new URL(`../src/main.js?browser-test=${Date.now()}-${Math.random()}`, import.meta.url));

  return {
    document,
    clipboard,
    get: (id) => document.elements.get(id),
    async click(id) {
      await document.elements.get(id).dispatch('click');
    },
    async input(id, value) {
      const element = document.elements.get(id);
      element.value = value;
      await element.dispatch('input');
    },
    restore() {
      if (priorDocument === undefined) {
        delete globalThis.document;
      } else {
        Object.defineProperty(globalThis, 'document', {
          value: priorDocument,
          configurable: true,
          writable: true,
        });
      }

      if (priorNavigator === undefined) {
        delete globalThis.navigator;
      } else {
        Object.defineProperty(globalThis, 'navigator', {
          value: priorNavigator,
          configurable: true,
          writable: true,
        });
      }
    }
  };
}

test('browser copy invites pasting one or more traces for digesting, comparing, casebook lookup, and timeline analysis', () => {
  assert.match(indexHtml, /Paste one or more stack traces or raw logs/i);
  assert.match(indexHtml, /notebook/i);
  assert.match(indexHtml, /incident pack/i);
  assert.match(indexHtml, /Stack trace, raw log, or incident bundle/i);
  assert.match(indexHtml, /Paste one or more JavaScript, Python, or Ruby traces or raw logs here/i);
  assert.match(indexHtml, />Explain trace\(s\)<\/button>/i);
  assert.match(indexHtml, />Load notebook example</i);
  assert.match(indexHtml, />Load incident pack example</i);
  assert.match(indexHtml, />Load raw log example</i);
  assert.match(indexHtml, /Regression Radar/i);
  assert.match(indexHtml, /Casebook Radar/i);
  assert.match(indexHtml, /Current incident batch/i);
  assert.match(indexHtml, /Labeled history casebook/i);
  assert.match(indexHtml, /known versus novel/i);
  assert.match(indexHtml, /Timeline Radar/i);
  assert.match(indexHtml, /Incident Pack Briefing/i);
  assert.match(indexHtml, /Portfolio Radar/i);
  assert.match(indexHtml, />Analyze casebook</i);
  assert.match(indexHtml, />Copy casebook summary</i);
  assert.match(indexHtml, />Load portfolio example</i);
  assert.match(indexHtml, />Load Handoff Briefing example</i);
  assert.match(indexHtml, /Handoff Briefing/i);
  assert.match(indexHtml, />Load Casebook Dataset example</i);
  assert.match(indexHtml, />Load Casebook Chronicle example</i);
  assert.match(indexHtml, />Load Casebook Shelf example</i);
  assert.match(indexHtml, />Load Casebook Merge example</i);
  assert.match(indexHtml, />Copy result</i);
});

test('browser Handoff Briefing example button loads the shared portfolio example and surfaces copy-ready packets', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.click('load-handoff-button');

    assert.match(harness.get('trace-input').value, /@@@ checkout-prod @@@/);
    assert.equal(harness.get('runtime-value').textContent, 'portfolio radar');
    assert.match(harness.get('handoff-summary-value').textContent, /Prepared 5 handoff packets from 3 runnable packs/i);
    assert.match(harness.get('handoff-export-value').textContent, /Owner: web-platform/);
    assert.match(harness.get('handoff-export-value').textContent, /Gap: ownership/);
    assert.match(harness.get('example-caption').textContent, /owner-specific handoff packets/i);
  } finally {
    harness.restore();
  }
});

test('browser Casebook Dataset example button loads saved dataset JSON and replays the preserved dataset view', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.click('load-dataset-button');

    assert.match(harness.get('trace-input').value, /"kind": "stack-sleuth-casebook-dataset"/);
    assert.equal(harness.get('runtime-value').textContent, 'dataset replay');
    assert.match(harness.get('dataset-summary-value').textContent, /Casebook Dataset captured 3 merged cases/i);
    assert.match(harness.get('dataset-summary-value').textContent, /Release Gate HOLD|Release gate: hold/i);
    assert.match(harness.get('portfolio-response-queue-value').children[0].textContent, /web-platform/);
    assert.match(harness.get('dataset-export-value').textContent, /=== profile-js-generic-runtime-error ===/);
    assert.match(harness.get('example-caption').textContent, /saved dataset|replay/i);
  } finally {
    harness.restore();
  }
});

test('browser Casebook Shelf example button loads saved shelf JSON before dataset replay detection and reuses the trend cards', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.click('load-shelf-button');

    assert.match(harness.get('trace-input').value, /"kind": "stack-sleuth-casebook-shelf"/);
    assert.equal(harness.get('runtime-value').textContent, 'casebook shelf');
    assert.match(harness.get('headline-value').textContent, /2 valid snapshots, 1 invalid snapshot/i);
    assert.match(harness.get('summary-value').textContent, /warning entry|saved dataset shelf/i);
    assert.match(harness.get('summary-value').textContent, /Release Gate WATCH|release gate watch/i);
    assert.match(harness.get('timeline-summary-value').textContent, /release-b/i);
    assert.match(harness.get('timeline-incidents-value').children[0].textContent, /web-platform|owner/i);
    assert.match(harness.get('checklist-value').children[0].textContent, /saved artifact/i);
    assert.match(harness.get('example-caption').textContent, /shelf|warning/i);
  } finally {
    harness.restore();
  }
});

test('browser Casebook Shelf copy support writes the saved shelf summary to the clipboard', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', shelfReplayInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Stack Sleuth Casebook Shelf/);
    assert.match(harness.clipboard.text, /Valid snapshots: 2/);
    assert.match(harness.clipboard.text, /broken\.json: invalid-json/);
    assert.equal(harness.get('example-caption').textContent, 'Casebook Shelf summary copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser dataset replay copy support writes the saved dataset summary to the clipboard', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', datasetReplayInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Stack Sleuth Casebook Dataset/);
    assert.match(harness.clipboard.text, /Response owners: 1/);
    assert.match(harness.clipboard.text, /Release gate: hold/i);
    assert.match(harness.clipboard.text, /Reusable casebook export/);
    assert.equal(harness.get('example-caption').textContent, 'Casebook Dataset replay copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser response bundle replay detection runs before dataset replay and renders a saved bundle surface', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', responseBundleReplayInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'response bundle replay');
    assert.match(harness.get('headline-value').textContent, /Stack Sleuth Response Bundle Replay/i);
    assert.match(harness.get('summary-value').textContent, /preserved bundle and dataset fields only/i);
    assert.match(harness.get('summary-value').textContent, /stewardship/i);
    assert.match(harness.get('portfolio-summary-value').textContent, /Response bundle replay restored 1 owner-routed entr/i);
    assert.match(harness.get('portfolio-summary-value').textContent, /steward/i);
    assert.match(harness.get('dataset-summary-value').textContent, /Saved bundle replay is using the portable response bundle artifact directly/i);
    assert.match(harness.get('dataset-export-value').textContent, /=== profile-js-generic-runtime-error ===/);
    assert.match(harness.get('portfolio-priority-value').children[0].textContent, /saved bundle file: manifest\.json/i);
    assert.match(harness.get('example-caption').textContent, /response bundle/i);
  } finally {
    harness.restore();
  }
});

test('browser response bundle replay copy support writes the saved bundle summary to the clipboard', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', responseBundleReplayInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Stack Sleuth Response Bundle Replay/);
    assert.match(harness.clipboard.text, /Source workflow: portfolio \(browser replay fixture\)/i);
    assert.match(harness.clipboard.text, /Steward actions: [1-9]/i);
    assert.match(harness.clipboard.text, /Next steward action:/i);
    assert.match(harness.clipboard.text, /Saved-artifact note:/i);
    assert.equal(harness.get('example-caption').textContent, 'Response Bundle replay copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser dataset replay discloses reconstructed stewardship honestly', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', reconstructedDatasetReplayInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'dataset replay');
    assert.match(harness.get('summary-value').textContent, /Stewardship was reconstructed from older dataset fields for replay\./i);
    assert.match(harness.get('dataset-summary-value').textContent, /Reconstructed Casebook Steward/i);
    assert.match(harness.get('checklist-value').children[0].textContent, /reconstruct steward state from older fields/i);
  } finally {
    harness.restore();
  }
});

test('browser response bundle replay discloses reconstructed stewardship honestly', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', reconstructedResponseBundleReplayInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'response bundle replay');
    assert.match(harness.get('summary-value').textContent, /Stewardship was reconstructed from older dataset fields for replay\./i);
    assert.match(harness.get('dataset-summary-value').textContent, /embedded Casebook Dataset reconstructed from older fields for replay/i);
    assert.match(harness.get('dataset-summary-value').textContent, /Reconstructed Casebook Steward/i);
  } finally {
    harness.restore();
  }
});

test('browser response bundle chronicle detection runs before single-bundle replay and renders a saved bundle trend surface', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', responseBundleChronicleInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'response bundle chronicle');
    assert.match(harness.get('headline-value').textContent, /Bundle Chronicle compared 3 saved response bundles/i);
    assert.match(harness.get('summary-value').textContent, /Release Gate HOLD|release gate hold/i);
    assert.match(harness.get('summary-value').textContent, /steward/i);
    assert.match(harness.get('timeline-summary-value').textContent, /workspace/i);
    assert.match(harness.get('checklist-value').children[1].textContent, /steward/i);
    assert.match(harness.get('timeline-hotspots-value').children[0].textContent, /saved bundle file|bundle inventory/i);
  } finally {
    harness.restore();
  }
});

test('browser response bundle chronicle copy support writes the saved bundle trend summary to the clipboard', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', responseBundleChronicleInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Stack Sleuth Response Bundle Chronicle/);
    assert.match(harness.clipboard.text, /Latest source workflow: workspace/i);
    assert.match(harness.clipboard.text, /Steward drift:/i);
    assert.match(harness.clipboard.text, /Latest steward:/i);
    assert.match(harness.clipboard.text, /Bundle inventory trends/);
    assert.equal(harness.get('example-caption').textContent, 'Response Bundle Chronicle summary copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser response bundle chronicle discloses unavailable steward drift for reconstructed snapshots', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', reconstructedResponseBundleChronicleInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'response bundle chronicle');
    assert.match(harness.get('timeline-summary-value').textContent, /Reconstructed Casebook Steward/i);
    assert.match(harness.get('checklist-value').children[1].textContent, /one of the compared snapshots had to reconstruct stewardship detail/i);
  } finally {
    harness.restore();
  }
});

test('browser Casebook Chronicle example button loads labeled saved datasets and reuses the trend cards', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.click('load-chronicle-button');

    assert.match(harness.get('trace-input').value, /=== release-a ===/);
    assert.equal(harness.get('runtime-value').textContent, 'casebook chronicle');
    assert.match(harness.get('headline-value').textContent, /Chronicle compared 3 saved datasets/i);
    assert.match(harness.get('summary-value').textContent, /Release Gate HOLD|release gate hold/i);
    assert.match(harness.get('timeline-summary-value').textContent, /release-c/i);
    assert.match(harness.get('timeline-summary-value').textContent, /Regressed from watch to hold|gate drift/i);
    assert.match(harness.get('timeline-incidents-value').children[0].textContent, /owner|case|hotspot/i);
    assert.match(harness.get('example-caption').textContent, /saved datasets|drift|chronicle/i);
  } finally {
    harness.restore();
  }
});

test('browser chronicle copy support writes the saved dataset trend summary to the clipboard', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', chronicleInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Stack Sleuth Casebook Chronicle/);
    assert.match(harness.clipboard.text, /Release gate: hold/i);
    assert.match(harness.clipboard.text, /Saved-artifact note:/);
    assert.match(harness.clipboard.text, /Owner trends/);
    assert.equal(harness.get('example-caption').textContent, 'Casebook Chronicle summary copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser dataset replay reports unsupported dataset versions clearly', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', unsupportedDatasetReplayInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'dataset replay error');
    assert.match(harness.get('headline-value').textContent, /unsupported version 99/i);
    assert.match(harness.get('summary-value').textContent, /supported version: 1/i);
    assert.match(harness.get('example-caption').textContent, /unsupported version 99/i);
  } finally {
    harness.restore();
  }
});

test('browser response bundle replay reports unsupported bundle versions clearly', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', unsupportedResponseBundleReplayInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'response bundle replay error');
    assert.match(harness.get('headline-value').textContent, /unsupported version 99/i);
    assert.match(harness.get('summary-value').textContent, /Supported versions: 1, 2/i);
    assert.match(harness.get('example-caption').textContent, /unsupported version 99/i);
  } finally {
    harness.restore();
  }
});

test('browser notebook flow routes markdown incident notes into notebook mode and copies the normalized bundle plus briefing', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', notebookPackInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Notebook normalization/);
    assert.match(harness.clipboard.text, /@@ current @@/);
    assert.match(harness.clipboard.text, /Stack Sleuth Incident Pack Briefing/);
    assert.equal(harness.get('example-caption').textContent, 'Notebook briefing copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser notebook analyze flow renders the routed incident pack briefing instead of re-analyzing an analyzed report', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', notebookPackInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'incident pack briefing');
    assert.equal(harness.get('headline-value').textContent, 'Casebook Radar flagged 1 novel incident in the current batch.');
    assert.match(harness.get('summary-value').textContent, /Casebook Radar matched 1 known incident and flagged 1 novel incident/i);
    assert.match(harness.get('casebook-summary-value').textContent, /matched 1 known incident and flagged 1 novel incident/i);
  } finally {
    harness.restore();
  }
});

test('browser notebook example button loads a markdown notebook and renders its routed briefing', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.click('load-notebook-button');

    assert.match(harness.get('trace-input').value, /## Current incident/);
    assert.equal(harness.get('runtime-value').textContent, 'incident pack briefing');
    assert.match(harness.get('headline-value').textContent, /Casebook Radar flagged 1 novel incident/i);
    assert.match(harness.get('example-caption').textContent, /markdown handoff note/i);
  } finally {
    harness.restore();
  }
});

test('browser multi-pack notebook analyze flow routes # Pack headings into portfolio radar cards', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', notebookPortfolioInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'portfolio radar');
    assert.match(harness.get('headline-value').textContent, /Portfolio Radar ranked 3 runnable packs/i);
    assert.match(harness.get('summary-value').textContent, /Release Gate HOLD|Release gate: hold/i);
    assert.match(harness.get('portfolio-summary-value').textContent, /3 runnable pack/i);
    assert.match(harness.get('portfolio-priority-value').children[0].textContent, /profile-rollout/);
    assert.match(harness.get('forge-export-value').textContent, /=== release-2026-04-15 ===/);
    assert.match(harness.get('dataset-export-value').textContent, /=== profile-js-generic-runtime-error ===/);
    assert.match(harness.get('merge-export-value').textContent, />>> seen-count: 3/);
  } finally {
    harness.restore();
  }
});

test('browser multi-pack notebook copy flow includes normalization plus portfolio summary', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', notebookPortfolioInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Notebook normalization/);
    assert.match(harness.clipboard.text, /@@@ checkout-prod @@@/);
    assert.match(harness.clipboard.text, /Stack Sleuth Portfolio Radar/);
    assert.equal(harness.get('example-caption').textContent, 'Notebook briefing copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser Handoff and Casebook export styling preserves multiline formatting for manual copy', () => {
  assert.match(stylesCss, /#forge-export-value,\s*#dataset-export-value,\s*#merge-export-value,\s*#handoff-export-value\s*\{[^}]*white-space:\s*pre-wrap/i);
});

test('browser portfolio flow keeps Portfolio Radar as the primary runtime while surfacing Handoff Briefing, Casebook Forge, Dataset, and Merge cards', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', portfolioInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'portfolio radar');
    assert.match(harness.get('headline-value').textContent, /Portfolio Radar ranked 3 runnable packs/i);
    assert.match(harness.get('summary-value').textContent, /Release Gate HOLD|Release gate: hold/i);
    assert.match(harness.get('summary-value').textContent, /Top priority: profile-rollout/i);
    assert.match(harness.get('portfolio-summary-value').textContent, /3 runnable pack/i);
    assert.match(harness.get('portfolio-priority-value').children[0].textContent, /profile-rollout/);
    assert.match(harness.get('portfolio-recurring-incidents-value').children[0].textContent, /packs:/i);
    assert.match(harness.get('portfolio-recurring-hotspots-value').children[0].textContent, /profile\.js/i);
    assert.match(harness.get('portfolio-response-queue-value').children[0].textContent, /web-platform/i);
    assert.match(harness.get('portfolio-routing-gaps-value').children[0].textContent, /billing-canary|checkout-prod/i);
    assert.match(harness.get('handoff-summary-value').textContent, /Prepared 5 handoff packets/i);
    assert.match(harness.get('handoff-export-value').textContent, /Owner: web-platform/);
    assert.match(harness.get('forge-summary-value').textContent, /Forged \d+ reusable case/i);
    assert.match(harness.get('forge-export-value').textContent, /=== release-2026-04-15 ===/);
    assert.match(harness.get('dataset-summary-value').textContent, /Casebook Dataset captured 3 merged cases from 3 packs/i);
    assert.equal(harness.get('dataset-pack-count-value').textContent, '3 / 3');
    assert.match(harness.get('dataset-export-value').textContent, /=== profile-js-generic-runtime-error ===/);
    assert.match(harness.get('merge-summary-value').textContent, /Merged 3 casebook entries/i);
    assert.match(harness.get('merge-conflicts-value').children[0].textContent, /No merge conflicts detected/i);
    assert.match(harness.get('merge-export-value').textContent, />>> seen-count: 3/);
  } finally {
    harness.restore();
  }
});

test('browser portfolio copy support keeps Portfolio Radar as the clipboard artifact even when merge data is available', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', portfolioInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Stack Sleuth Portfolio Radar/);
    assert.match(harness.clipboard.text, /Release gate: hold/i);
    assert.match(harness.clipboard.text, /Response queue/);
    assert.doesNotMatch(harness.clipboard.text, /Stack Sleuth Casebook Merge/);
    assert.equal(harness.get('example-caption').textContent, 'Portfolio Radar summary copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser portfolio Casebook Forge, Dataset, and Merge cards reset when switching back to a non-portfolio workflow', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', portfolioInput);
    await harness.click('explain-button');
    assert.match(harness.get('forge-summary-value').textContent, /Forged \d+ reusable case/i);
    assert.match(harness.get('dataset-summary-value').textContent, /Casebook Dataset captured 3 merged cases/i);
    assert.match(harness.get('merge-summary-value').textContent, /Merged 3 casebook entries/i);

    await harness.input('trace-input', casebookCurrentInput);
    await harness.click('explain-button');

    assert.notEqual(harness.get('runtime-value').textContent, 'casebook merge');
    assert.equal(harness.get('handoff-summary-value').textContent, 'Paste several labeled incident packs to prepare owner and gap handoff packets.');
    assert.equal(harness.get('handoff-export-value').textContent, 'Handoff packet export text will appear here after Handoff Briefing runs.');
    assert.equal(harness.get('forge-summary-value').textContent, 'Paste several labeled incident packs to forge reusable casebook entries from a portfolio.');
    assert.equal(harness.get('forge-export-value').textContent, 'Forged Casebook export text will appear here after Casebook Forge runs.');
    assert.equal(harness.get('dataset-summary-value').textContent, 'Paste several labeled incident packs to package a reusable Casebook Dataset from the portfolio flow.');
    assert.equal(harness.get('dataset-pack-count-value').textContent, '-');
    assert.equal(harness.get('dataset-export-value').textContent, 'Dataset export text will appear here after Casebook Dataset runs.');
    assert.equal(harness.get('merge-summary-value').textContent, 'Paste several labeled incident packs with embedded history to update a living casebook.');
    assert.equal(harness.get('merge-export-value').textContent, 'Merged Casebook export text will appear here after Casebook Merge runs.');
  } finally {
    harness.restore();
  }
});

test('browser dedicated radar controls clear stale portfolio, forge, and merge cards after a portfolio result', async () => {
  const harness = await loadBrowserHarness();
  const assertPortfolioCardsReset = () => {
    assert.equal(harness.get('portfolio-summary-value').textContent, 'Paste several labeled incident packs to rank the release-level triage queue.');
    assert.equal(harness.get('portfolio-pack-count-value').textContent, '-');
    assert.equal(harness.get('portfolio-response-queue-value').children[0].textContent, 'Owner-routed response queue entries will appear here after Portfolio Radar runs.');
    assert.equal(harness.get('portfolio-routing-gaps-value').children[0].textContent, 'Routing gaps and missing runbooks will appear here after Portfolio Radar runs.');
    assert.equal(harness.get('handoff-summary-value').textContent, 'Paste several labeled incident packs to prepare owner and gap handoff packets.');
    assert.equal(harness.get('handoff-export-value').textContent, 'Handoff packet export text will appear here after Handoff Briefing runs.');
    assert.equal(harness.get('forge-summary-value').textContent, 'Paste several labeled incident packs to forge reusable casebook entries from a portfolio.');
    assert.equal(harness.get('forge-export-value').textContent, 'Forged Casebook export text will appear here after Casebook Forge runs.');
    assert.equal(harness.get('dataset-summary-value').textContent, 'Paste several labeled incident packs to package a reusable Casebook Dataset from the portfolio flow.');
    assert.equal(harness.get('dataset-pack-count-value').textContent, '-');
    assert.equal(harness.get('dataset-export-value').textContent, 'Dataset export text will appear here after Casebook Dataset runs.');
    assert.equal(harness.get('merge-summary-value').textContent, 'Paste several labeled incident packs with embedded history to update a living casebook.');
    assert.equal(harness.get('merge-export-value').textContent, 'Merged Casebook export text will appear here after Casebook Merge runs.');
  };

  try {
    await harness.input('trace-input', portfolioInput);
    await harness.click('explain-button');
    assert.match(harness.get('portfolio-summary-value').textContent, /3 runnable pack/i);
    assert.match(harness.get('forge-summary-value').textContent, /Forged \d+ reusable case/i);
    assert.match(harness.get('dataset-summary-value').textContent, /Casebook Dataset captured 3 merged cases/i);
    assert.match(harness.get('merge-summary-value').textContent, /Merged 3 casebook entries/i);

    await harness.input('casebook-current-input', casebookCurrentInput);
    await harness.input('casebook-history-input', casebookHistoryInput);
    await harness.click('casebook-button');

    assert.equal(harness.get('runtime-value').textContent, 'casebook radar');
    assertPortfolioCardsReset();

    await harness.input('trace-input', portfolioInput);
    await harness.click('explain-button');
    await harness.input('compare-baseline-input', regressionBaselineInput);
    await harness.input('compare-candidate-input', regressionCandidateInput);
    await harness.click('compare-button');

    assert.equal(harness.get('runtime-value').textContent, 'comparison');
    assertPortfolioCardsReset();

    await harness.input('trace-input', portfolioInput);
    await harness.click('explain-button');
    await harness.input('timeline-input', dedicatedTimelineInput);
    await harness.click('timeline-button');

    assert.equal(harness.get('runtime-value').textContent, '2 snapshots');
    assertPortfolioCardsReset();
  } finally {
    harness.restore();
  }
});

test('browser incident pack flow composes the briefing across current, casebook, regression, and timeline analyses', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', incidentPackInput);
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'incident pack briefing');
    assert.equal(harness.get('headline-value').textContent, 'Casebook Radar flagged 1 novel incident in the current batch.');
    assert.match(harness.get('summary-value').textContent, /Casebook Radar matched 1 known incident and flagged 1 novel incident/i);
    assert.match(harness.get('casebook-summary-value').textContent, /matched 1 known incident and flagged 1 novel incident/i);
    assert.match(harness.get('regression-summary-value').textContent, /1 new, 1 volume-up/i);
    assert.match(harness.get('timeline-summary-value').textContent, /1 new/i);
    assert.match(harness.get('checklist-value').children[0].textContent, /Reuse the recorded fix from release-2026-04-15/i);
  } finally {
    harness.restore();
  }
});

test('browser incident pack copy support writes the rendered briefing to the clipboard', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', incidentPackInput);
    await harness.click('copy-button');

    assert.match(harness.clipboard.text, /Stack Sleuth Incident Pack Briefing/);
    assert.match(harness.clipboard.text, /Available analyses: current, casebook, regression, timeline/);
    assert.equal(harness.get('example-caption').textContent, 'Incident Pack Briefing copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser incident pack shared cards follow the same regression-first priority as the briefing headline', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', incidentPackRegressionPriorityInput);
    await harness.click('explain-button');

    assert.equal(harness.get('headline-value').textContent, 'Regression Radar found 1 new incident and 0 volume-up incidents in the candidate batch.');
    assert.match(harness.get('culprit-value').textContent, /renderInvoice/);
    assert.match(harness.get('signature-value').textContent, /invoice\.js:19/);
    assert.match(harness.get('summary-value').textContent, /Regression Radar found 1 new incident, 0 volume-up incidents, and 0 resolved incidents/i);
    assert.match(harness.get('blast-radius-value').textContent, /Source: direct\./i);
  } finally {
    harness.restore();
  }
});

test('browser incident pack guidance explains supported @@ section @@ headers when the pack markers are malformed', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('trace-input', '@@ notes @@\nfoo');
    await harness.click('explain-button');

    assert.equal(harness.get('runtime-value').textContent, 'incident pack guidance');
    assert.match(harness.get('headline-value').textContent, /did not find any supported incident-pack sections/i);
    assert.match(harness.get('summary-value').textContent, /Use @@ current @@, @@ history @@, @@ baseline @@, @@ candidate @@, or @@ timeline @@/i);
    assert.match(harness.get('checklist-value').children[0].textContent, /Rename the section headers to supported incident-pack names/i);
  } finally {
    harness.restore();
  }
});

test('browser Casebook Radar analyze flow renders known and novel counts plus the closest historical match', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('casebook-current-input', casebookCurrentInput);
    await harness.input('casebook-history-input', casebookHistoryInput);
    await harness.click('casebook-button');

    assert.equal(harness.get('runtime-value').textContent, 'casebook radar');
    assert.equal(harness.get('known-count-value').textContent, '1');
    assert.equal(harness.get('novel-count-value').textContent, '1');
    assert.match(harness.get('headline-value').textContent, /1 known matches, 1 novel incidents/i);
    assert.match(harness.get('summary-value').textContent, /Closest prior incident: release-2026-04-15\./i);
    assert.match(harness.get('casebook-summary-value').textContent, /matched 1 known incident and flagged 1 novel incident/i);
    const closestMatches = harness.get('closest-matches-value').children.map((child) => child.textContent);
    assert.equal(closestMatches.length, 2);
    assert.match(closestMatches[0], /^release-2026-04-15: 1 exact matches, 1 shared culprit paths, 2 shared diagnosis tags, owner web-platform, fix Guard renderProfile before reading account\.name$/);
    assert.match(closestMatches[1], /^profile-rewrite: 1 exact matches, 1 shared culprit paths, 2 shared diagnosis tags$/);
    assert.equal(harness.get('casebook-caption').textContent, 'Closest prior incident match: release-2026-04-15.');
  } finally {
    harness.restore();
  }
});

test('browser Casebook Radar copy support writes the rendered summary to the clipboard', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('casebook-current-input', casebookCurrentInput);
    await harness.input('casebook-history-input', casebookHistoryInput);
    await harness.click('copy-casebook-button');

    assert.match(harness.clipboard.text, /Stack Sleuth Casebook Radar/);
    assert.match(harness.clipboard.text, /Known incidents: 1/);
    assert.match(harness.clipboard.text, /Novel incidents: 1/);
    assert.match(harness.clipboard.text, /Known in: release-2026-04-15/);
    assert.match(harness.clipboard.text, /Fix: Guard renderProfile before reading account\.name/);
    assert.match(harness.clipboard.text, /Owner: web-platform/);
    assert.equal(harness.get('casebook-caption').textContent, 'Casebook Radar summary copied to clipboard.');
  } finally {
    harness.restore();
  }
});

test('browser Casebook Radar clears shared result cards when one casebook input becomes incomplete', async () => {
  const harness = await loadBrowserHarness();

  try {
    await harness.input('casebook-current-input', casebookCurrentInput);
    await harness.input('casebook-history-input', casebookHistoryInput);
    await harness.click('casebook-button');
    assert.match(harness.get('headline-value').textContent, /1 known matches, 1 novel incidents/i);

    await harness.input('casebook-current-input', '');

    assert.equal(harness.get('casebook-summary-value').textContent, 'Paste a current incident batch plus labeled prior incidents to see known versus novel matches.');
    assert.equal(harness.get('known-count-value').textContent, '-');
    assert.equal(harness.get('novel-count-value').textContent, '-');
    assert.equal(harness.get('headline-value').textContent, 'Paste one or more traces or raw logs to get started');
    assert.equal(harness.get('culprit-value').textContent, 'No frame selected yet');
    assert.equal(harness.get('signature-value').textContent, '-');
    assert.deepEqual(
      harness.get('checklist-value').children.map((child) => child.textContent),
      ['Run an example or paste one or more real traces to see actionable next steps.']
    );
    assert.deepEqual(
      harness.get('closest-matches-value').children.map((child) => child.textContent),
      ['Closest prior incidents will appear here after a Casebook Radar lookup.']
    );
  } finally {
    harness.restore();
  }
});

import { buildReleaseGate } from '../src/gate.js';

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
    steward: {
      preserved: true,
      cases: cases.map((entry) => ({
        label: entry.label,
        signature: entry.signature,
        sourcePacks: ['pack-1'],
        metadata: {},
        conflicts: [],
      })),
      actions: Array.from({ length: Math.max(0, 4 - packCount) }, (_, index) => ({
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
        actionCount: Math.max(0, 4 - packCount),
        urgentActionCount: Math.max(0, 4 - packCount) ? 1 : 0,
        headline: `Casebook Steward found ${Math.max(0, 4 - packCount)} action${Math.max(0, 4 - packCount) === 1 ? '' : 's'} across ${cases.length} case${cases.length === 1 ? '' : 's'}.`,
      },
      nextAction: Math.max(0, 4 - packCount) ? 'Handle steward action 1' : 'No stewardship gaps detected in the current casebook state.',
    },
    exportText: '=== saved-case ===\nTypeError: replay me',
  };
}

function buildChronicleBundle({
  dataset = buildChronicleDataset({ packCount: 2 }),
  sourceMode = 'portfolio',
  sourceLabel = 'browser bundle chronicle fixture',
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
