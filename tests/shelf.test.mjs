import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHELF_KIND,
  SHELF_VERSION,
  buildCasebookShelf,
  inspectReplayShelfInput,
  renderShelfMarkdownSummary,
  renderShelfTextSummary,
} from '../src/shelf.js';

const validDatasetA = buildDataset({
  label: 'release-a',
  packCount: 2,
  owners: [{ owner: 'web-platform', packCount: 1 }],
  hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
  cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
});

const validDatasetB = buildDataset({
  label: 'release-b',
  packCount: 3,
  owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
  hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
  cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
});

test('buildCasebookShelf packages valid and invalid saved dataset snapshots into a portable artifact', () => {
  const shelf = buildCasebookShelf([
    { label: '2026-04-30-release-a', filename: '2026-04-30-release-a.json', source: JSON.stringify(validDatasetA) },
    { label: '2026-05-01-release-b', filename: '2026-05-01-release-b.json', source: JSON.stringify(validDatasetB) },
    { label: 'broken', filename: 'broken.json', source: '{"kind":"stack-sleuth-casebook-dataset","version":1' },
  ]);

  assert.equal(shelf.kind, SHELF_KIND);
  assert.equal(shelf.version, SHELF_VERSION);
  assert.equal(shelf.summary.snapshotCount, 3);
  assert.equal(shelf.summary.validSnapshotCount, 2);
  assert.equal(shelf.summary.invalidSnapshotCount, 1);
  assert.equal(shelf.summary.chronicleAvailable, true);
  assert.equal(shelf.chronicle.summary.snapshotCount, 2);
  assert.equal(shelf.snapshots[0].status, 'valid');
  assert.equal(shelf.snapshots[2].status, 'invalid');
  assert.equal(shelf.snapshots[2].reason, 'invalid-json');
});

test('buildCasebookShelf preserves invalid dataset warnings without failing when valid snapshots remain', () => {
  const shelf = buildCasebookShelf([
    { label: 'release-a', filename: 'release-a.json', source: JSON.stringify(validDatasetA) },
    { label: 'wrong-kind', filename: 'wrong-kind.json', source: JSON.stringify({ kind: 'not-a-dataset', version: 1 }) },
  ]);

  assert.equal(shelf.summary.validSnapshotCount, 1);
  assert.equal(shelf.summary.invalidSnapshotCount, 1);
  assert.equal(shelf.summary.chronicleAvailable, false);
  assert.equal(shelf.chronicle, null);
  assert.equal(shelf.snapshots[1].status, 'invalid');
  assert.equal(shelf.snapshots[1].reason, 'wrong-kind');
});

test('inspectReplayShelfInput validates and normalizes saved shelf json', () => {
  const built = buildCasebookShelf([
    { label: 'release-a', filename: 'release-a.json', source: JSON.stringify(validDatasetA) },
    { label: 'release-b', filename: 'release-b.json', source: JSON.stringify(validDatasetB) },
  ]);

  const replay = inspectReplayShelfInput(JSON.stringify(built));

  assert.equal(replay.valid, true);
  assert.equal(replay.shelf.kind, SHELF_KIND);
  assert.equal(replay.shelf.version, SHELF_VERSION);
  assert.equal(replay.shelf.summary.validSnapshotCount, 2);
  assert.equal(replay.shelf.chronicle.summary.latestLabel, 'release-b');
});

test('inspectReplayShelfInput rejects unsupported shelf versions with the supported version number', () => {
  const replay = inspectReplayShelfInput(JSON.stringify({
    kind: SHELF_KIND,
    version: 99,
    summary: {},
    snapshots: [],
    chronicle: null,
  }));

  assert.equal(replay.valid, false);
  assert.equal(replay.reason, 'unsupported-version');
  assert.equal(replay.supportedVersion, SHELF_VERSION);
});

test('shared shelf renderers include chronicle context and invalid snapshot warnings without implying raw-trace recovery', () => {
  const shelf = buildCasebookShelf([
    { label: 'release-a', filename: 'release-a.json', source: JSON.stringify(validDatasetA) },
    { label: 'release-b', filename: 'release-b.json', source: JSON.stringify(validDatasetB) },
    { label: 'broken', filename: 'broken.json', source: '{"kind":"stack-sleuth-casebook-dataset","version":1' },
  ]);

  const text = renderShelfTextSummary(shelf);
  const markdown = renderShelfMarkdownSummary(shelf);

  assert.match(text, /Stack Sleuth Casebook Shelf/);
  assert.match(text, /Valid snapshots: 2/);
  assert.match(text, /Invalid snapshots: 1/);
  assert.match(text, /Chronicle summary: Chronicle compared 2 saved datasets/i);
  assert.match(text, /broken\.json: invalid-json/);
  assert.match(text, /saved-artifact note/i);
  assert.doesNotMatch(text, /raw trace recovery/i);

  assert.match(markdown, /^# Stack Sleuth Casebook Shelf/m);
  assert.match(markdown, /- \*\*Valid snapshots:\*\* 2/);
  assert.match(markdown, /## Snapshot warnings/);
  assert.match(markdown, /broken\.json/);
});

function buildDataset({
  label = 'release-a',
  packCount = 2,
  owners = [],
  hotspots = [],
  cases = [],
} = {}) {
  return {
    kind: 'stack-sleuth-casebook-dataset',
    version: 1,
    summary: {
      headline: `Dataset ${label} captured ${cases.length} merged case${cases.length === 1 ? '' : 's'}.`,
      packCount,
      runnablePackCount: packCount,
      mergedCaseCount: cases.length,
      conflictCount: 0,
      portfolioHeadline: `${label} portfolio headline`,
      mergeHeadline: `${label} merge headline`,
      ownerCount: owners.length,
    },
    portfolio: {
      packOrder: Array.from({ length: packCount }, (_, index) => `${label}-pack-${index + 1}`),
    },
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
      sourcePacks: [`${label}-pack-1`],
      metadata: {},
      conflicts: [],
    })),
    exportText: `=== ${label}-saved-case ===\nTypeError: replay me`,
  };
}
