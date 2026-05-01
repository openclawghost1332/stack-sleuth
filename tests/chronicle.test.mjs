import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCasebookChronicle,
  inspectCasebookChronicleInput,
  parseCasebookChronicleSnapshots,
  renderCasebookChronicleMarkdownSummary,
  renderCasebookChronicleTextSummary,
} from '../src/chronicle.js';

const chronicleInput = [
  '=== release-a ===',
  JSON.stringify(buildDataset({
    headline: 'Release A casebook dataset.',
    packCount: 3,
    owners: [
      { owner: 'owner-rising', packCount: 1 },
      { owner: 'owner-flapping', packCount: 1 },
      { owner: 'owner-steady', packCount: 2 },
      { owner: 'owner-falling', packCount: 3 },
      { owner: 'owner-resolved', packCount: 2 },
    ],
    hotspots: [
      { label: 'profile.js', packCount: 1, maxScore: 2 },
      { label: 'flapping.js', packCount: 1, maxScore: 2 },
      { label: 'steady.js', packCount: 2, maxScore: 2 },
      { label: 'falling.js', packCount: 3, maxScore: 3 },
      { label: 'resolved.js', packCount: 2, maxScore: 2 },
    ],
    cases: [
      { label: 'case-rising', signature: 'sig-rising' },
      { label: 'case-flapping', signature: 'sig-flapping' },
      { label: 'case-steady', signature: 'sig-steady' },
      { label: 'case-falling', signature: 'sig-falling' },
      { label: 'case-resolved', signature: 'sig-resolved' },
    ],
  }), null, 2),
  '',
  '=== release-b ===',
  JSON.stringify(buildDataset({
    headline: 'Release B casebook dataset.',
    packCount: 4,
    owners: [
      { owner: 'owner-rising', packCount: 2 },
      { owner: 'owner-flapping', packCount: 3 },
      { owner: 'owner-steady', packCount: 2 },
      { owner: 'owner-falling', packCount: 2 },
      { owner: 'owner-resolved', packCount: 1 },
    ],
    hotspots: [
      { label: 'profile.js', packCount: 2, maxScore: 3 },
      { label: 'flapping.js', packCount: 3, maxScore: 3 },
      { label: 'steady.js', packCount: 2, maxScore: 2 },
      { label: 'falling.js', packCount: 2, maxScore: 3 },
      { label: 'resolved.js', packCount: 1, maxScore: 2 },
    ],
    cases: [
      { label: 'case-rising', signature: 'sig-rising' },
      { label: 'case-flapping', signature: 'sig-flapping' },
      { label: 'case-steady', signature: 'sig-steady' },
      { label: 'case-falling', signature: 'sig-falling' },
      { label: 'case-resolved', signature: 'sig-resolved' },
    ],
  }), null, 2),
  '',
  '=== release-c ===',
  JSON.stringify(buildDataset({
    headline: 'Release C casebook dataset.',
    packCount: 5,
    owners: [
      { owner: 'owner-new', packCount: 4 },
      { owner: 'owner-rising', packCount: 3 },
      { owner: 'owner-flapping', packCount: 1 },
      { owner: 'owner-steady', packCount: 2 },
      { owner: 'owner-falling', packCount: 1 },
    ],
    hotspots: [
      { label: 'checkout.js', packCount: 4, maxScore: 5 },
      { label: 'profile.js', packCount: 3, maxScore: 4 },
      { label: 'flapping.js', packCount: 1, maxScore: 3 },
      { label: 'steady.js', packCount: 2, maxScore: 2 },
      { label: 'falling.js', packCount: 1, maxScore: 3 },
    ],
    cases: [
      { label: 'case-new', signature: 'sig-new' },
      { label: 'case-rising', signature: 'sig-rising' },
      { label: 'case-flapping', signature: 'sig-flapping' },
      { label: 'case-steady', signature: 'sig-steady' },
      { label: 'case-falling', signature: 'sig-falling' },
    ],
  }), null, 2),
].join('\n');

test('parseCasebookChronicleSnapshots keeps labeled dataset snapshots in order', () => {
  const snapshots = parseCasebookChronicleSnapshots(chronicleInput);

  assert.deepEqual(snapshots.map((item) => item.label), ['release-a', 'release-b', 'release-c']);
  assert.match(snapshots[0].source, /stack-sleuth-casebook-dataset/);
});

test('inspectCasebookChronicleInput validates snapshot datasets and surfaces snapshot-level failures', () => {
  const valid = inspectCasebookChronicleInput(chronicleInput);
  assert.equal(valid.valid, true);
  assert.equal(valid.snapshots.length, 3);
  assert.equal(valid.snapshots[2].dataset.summary.packCount, 5);

  const invalid = inspectCasebookChronicleInput([
    '=== release-a ===',
    JSON.stringify({ kind: 'stack-sleuth-casebook-dataset', version: 99 }),
    '',
    '=== release-b ===',
    JSON.stringify(buildDataset({ headline: 'ok' })),
  ].join('\n'));

  assert.equal(invalid.valid, false);
  assert.equal(invalid.reason, 'unsupported-version');
  assert.equal(invalid.snapshotLabel, 'release-a');
});

test('analyzeCasebookChronicle classifies owner, hotspot, and case trends across snapshots', () => {
  const chronicle = analyzeCasebookChronicle(chronicleInput);

  assert.deepEqual(chronicle.labels, ['release-a', 'release-b', 'release-c']);
  assert.equal(chronicle.summary.snapshotCount, 3);
  assert.equal(chronicle.summary.latestLabel, 'release-c');
  assert.equal(chronicle.summary.newOwnerCount, 1);
  assert.equal(chronicle.summary.risingOwnerCount, 1);
  assert.equal(chronicle.summary.flappingOwnerCount, 1);
  assert.equal(chronicle.summary.steadyOwnerCount, 1);
  assert.equal(chronicle.summary.fallingOwnerCount, 1);
  assert.equal(chronicle.summary.resolvedOwnerCount, 1);
  assert.equal(chronicle.summary.newHotspotCount, 1);
  assert.equal(chronicle.summary.resolvedHotspotCount, 1);
  assert.equal(chronicle.summary.newCaseCount, 1);
  assert.equal(chronicle.summary.resolvedCaseCount, 1);
  assert.equal(chronicle.summary.latestGateVerdict, 'hold');
  assert.equal(chronicle.summary.gateDrift.direction, 'regressed');
  assert.equal(chronicle.summary.stewardDrift.direction, 'regressed');

  assert.deepEqual(findTrendSeries(chronicle.ownerTrends, 'owner-new'), { trend: 'new', series: [0, 0, 4] });
  assert.deepEqual(findTrendSeries(chronicle.ownerTrends, 'owner-rising'), { trend: 'rising', series: [1, 2, 3] });
  assert.deepEqual(findTrendSeries(chronicle.ownerTrends, 'owner-flapping'), { trend: 'flapping', series: [1, 3, 1] });
  assert.deepEqual(findTrendSeries(chronicle.ownerTrends, 'owner-steady'), { trend: 'steady', series: [2, 2, 2] });
  assert.deepEqual(findTrendSeries(chronicle.ownerTrends, 'owner-falling'), { trend: 'falling', series: [3, 2, 1] });
  assert.deepEqual(findTrendSeries(chronicle.ownerTrends, 'owner-resolved'), { trend: 'resolved', series: [2, 1, 0] });

  assert.deepEqual(findTrendSeries(chronicle.hotspotTrends, 'checkout.js'), { trend: 'new', series: [0, 0, 4] });
  assert.deepEqual(findTrendSeries(chronicle.hotspotTrends, 'resolved.js'), { trend: 'resolved', series: [2, 1, 0] });
  assert.deepEqual(findTrendSeries(chronicle.caseTrends, 'sig-new'), { trend: 'new', series: [0, 0, 1] });
  assert.deepEqual(findTrendSeries(chronicle.caseTrends, 'sig-resolved'), { trend: 'resolved', series: [1, 1, 0] });
});

test('chronicle renderers describe saved-artifact chronology without pretending to have trace detail', () => {
  const chronicle = analyzeCasebookChronicle(chronicleInput);
  const text = renderCasebookChronicleTextSummary(chronicle);
  const markdown = renderCasebookChronicleMarkdownSummary(chronicle);

  assert.match(text, /Stack Sleuth Casebook Chronicle/);
  assert.match(text, /Snapshots: release-a → release-b → release-c/);
  assert.match(text, /Owner trends/);
  assert.match(text, /Release gate: hold/i);
  assert.match(text, /Gate drift: regressed from watch to hold/i);
  assert.match(text, /Steward drift:/);
  assert.match(text, /Saved-artifact note: Chronicle uses preserved dataset signals only/);
  assert.match(text, /new: 0 → 0 → 4 owner-new/);

  assert.match(markdown, /^# Stack Sleuth Casebook Chronicle/m);
  assert.match(markdown, /- \*\*Latest snapshot:\*\* release\\-c/);
  assert.match(markdown, /## Owner trends/);
  assert.match(markdown, /Steward drift/i);
  assert.match(markdown, /preserved dataset signals only/i);
  assert.match(markdown, /`owner-rising`/);
});

test('chronicle latest steward copy discloses reconstructed stewardship', () => {
  const reconstructedChronicleInput = [
    '=== release-a ===',
    JSON.stringify(buildDataset({ cases: [{ label: 'case-a', signature: 'sig-a' }], stewardActionCount: 1 }), null, 2),
    '',
    '=== release-b ===',
    JSON.stringify({
      ...buildDataset({ cases: [{ label: 'case-b', signature: 'sig-b' }], stewardActionCount: 2 }),
      steward: {
        ...buildDataset({ cases: [{ label: 'case-b', signature: 'sig-b' }], stewardActionCount: 2 }).steward,
        preserved: false,
      },
    }, null, 2),
  ].join('\n');

  const chronicle = analyzeCasebookChronicle(reconstructedChronicleInput);
  const text = renderCasebookChronicleTextSummary(chronicle);

  assert.match(chronicle.summary.latestStewardHeadline, /^Reconstructed Casebook Steward/i);
  assert.match(text, /Latest steward: Reconstructed Casebook Steward/i);
  assert.equal(chronicle.summary.stewardDrift.direction, 'unavailable');
});

function findTrendSeries(items, key) {
  const item = items.find((entry) => entry.owner === key || entry.label === key || entry.signature === key);
  return item ? { trend: item.trend, series: item.series } : null;
}

function buildDataset({
  headline = 'Dataset headline',
  packCount = 2,
  owners = [],
  hotspots = [],
  cases = [],
  stewardActionCount = packCount,
} = {}) {
  return {
    kind: 'stack-sleuth-casebook-dataset',
    version: 1,
    summary: {
      headline,
      packCount,
      runnablePackCount: packCount,
      mergedCaseCount: cases.length,
      conflictCount: 0,
      portfolioHeadline: 'portfolio headline',
      mergeHeadline: 'merge headline',
      ownerCount: owners.length,
    },
    gate: {
      verdict: packCount >= 5 ? 'hold' : 'watch',
      blockers: packCount >= 5 ? [{ key: 'totalNovelIncidents', count: 1, label: 'novel incidents' }] : [],
      warnings: packCount < 5 ? [{ key: 'runbookGapCount', count: 1, label: 'runbook gaps' }] : [],
      summary: packCount >= 5 ? 'Release gate is hold with 1 blocker and 0 warnings.' : 'Release gate is watch with 0 blockers and 1 warning.',
      nextAction: packCount >= 5 ? 'Stop the release and inspect the blocking packs first.' : 'Proceed carefully and inspect the warning signals before widening the rollout.',
      sources: {
        runnablePackCount: packCount,
        unrunnablePackCount: 0,
      },
    },
    portfolio: {
      packOrder: Array.from({ length: packCount }, (_, index) => `pack-${index + 1}`),
    },
    responseQueue: owners.map((entry) => ({
      owner: entry.owner,
      labels: Array.from({ length: entry.packCount }, (_, index) => `${entry.owner}-pack-${index + 1}`),
      guidance: [{ summary: `${entry.owner} summary`, fix: `${entry.owner} fix`, runbook: `https://example.com/${entry.owner}` }],
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
      actions: Array.from({ length: stewardActionCount }, (_, index) => ({
        kind: index === 0 ? 'conflict' : 'missing-runbook',
        label: cases[index]?.label ?? `case-${index + 1}`,
        signature: cases[index]?.signature ?? `sig-${index + 1}`,
        seenCount: 1,
        sourcePacks: ['pack-1'],
        priority: 100 - index,
        headline: `Action ${index + 1}`,
        ask: `Do action ${index + 1}`,
      })),
      summary: {
        caseCount: cases.length,
        conflictCount: stewardActionCount ? 1 : 0,
        ownerCoveredCount: 0,
        fixCoveredCount: 0,
        runbookCoveredCount: 0,
        actionCount: stewardActionCount,
        urgentActionCount: stewardActionCount ? 1 : 0,
        headline: `Casebook Steward found ${stewardActionCount} actions across ${cases.length} cases.`,
      },
      nextAction: stewardActionCount ? 'Do action 1' : 'No stewardship gaps detected in the current casebook state.',
    },
    exportText: '=== saved-case ===\nTypeError: replay me',
  };
}
