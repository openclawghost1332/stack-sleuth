import { inspectReplayDatasetInput } from './dataset.js';
import { compareGateSnapshots } from './gate.js';
import { compareStewardSnapshots, describeCasebookStewardHeadline } from './steward.js';

const LABEL_MARKER = /^===\s*(.+?)\s*===$/gm;
const TREND_PRIORITY = {
  new: 0,
  rising: 1,
  flapping: 2,
  steady: 3,
  falling: 4,
  resolved: 5,
};

export function parseCasebookChronicleSnapshots(input) {
  const source = String(input ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) {
    return [];
  }

  const matches = [...source.matchAll(LABEL_MARKER)];
  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? source.length;
      return {
        label: String(match[1] ?? '').trim(),
        source: source.slice(start, end).trim(),
      };
    })
    .filter((snapshot) => snapshot.label && snapshot.source);
}

export function inspectCasebookChronicleInput(input) {
  const snapshots = Array.isArray(input) ? input : parseCasebookChronicleSnapshots(input);

  if (!snapshots.length) {
    return { valid: false, reason: 'not-chronicle', snapshots: [] };
  }

  if (snapshots.length < 2) {
    return { valid: false, reason: 'too-few-snapshots', snapshots };
  }

  const validatedSnapshots = [];

  for (const [snapshotIndex, snapshot] of snapshots.entries()) {
    const replay = inspectReplayDatasetInput(snapshot.source ?? snapshot.dataset ?? snapshot);
    if (!replay.valid) {
      return {
        valid: false,
        reason: replay.reason,
        replay,
        snapshotIndex,
        snapshotLabel: snapshot.label ?? `snapshot-${snapshotIndex + 1}`,
        snapshots,
      };
    }

    validatedSnapshots.push({
      label: snapshot.label,
      source: snapshot.source,
      parsed: replay.parsed,
      dataset: replay.dataset,
    });
  }

  return {
    valid: true,
    snapshots: validatedSnapshots,
    labels: validatedSnapshots.map((snapshot) => snapshot.label),
  };
}

export function analyzeCasebookChronicle(input) {
  const inspected = input?.valid === true && Array.isArray(input.snapshots)
    ? input
    : inspectCasebookChronicleInput(input);

  if (!inspected.valid) {
    throw createChronicleError(inspected);
  }

  const snapshots = inspected.snapshots.map((snapshot) => ({
    label: snapshot.label,
    dataset: snapshot.dataset,
  }));
  const labels = snapshots.map((snapshot) => snapshot.label);
  const ownerTrends = buildOwnerTrends(snapshots);
  const hotspotTrends = buildHotspotTrends(snapshots);
  const caseTrends = buildCaseTrends(snapshots);
  const summary = summarizeChronicle(snapshots, ownerTrends, hotspotTrends, caseTrends);

  return {
    snapshots,
    labels,
    ownerTrends,
    hotspotTrends,
    caseTrends,
    summary,
  };
}

export function renderCasebookChronicleTextSummary(report) {
  const summary = report.summary;
  const sections = [
    'Stack Sleuth Casebook Chronicle',
    `Snapshots: ${report.labels.join(' → ')}`,
    `Latest snapshot: ${summary.latestLabel} (${summary.latestPackCount} packs, ${summary.latestOwnerCount} owners, ${summary.latestHotspotCount} hotspots, ${summary.latestCaseCount} cases)`,
    `Headline: ${summary.headline}`,
    `Release gate: ${summary.latestGateVerdict}`,
    `Gate drift: ${summary.gateDrift.summary}`,
    `Steward drift: ${summary.stewardDrift.summary}`,
    `Latest steward: ${summary.latestStewardHeadline}`,
    `Owner movement: new ${summary.newOwnerCount}, rising ${summary.risingOwnerCount}, flapping ${summary.flappingOwnerCount}, steady ${summary.steadyOwnerCount}, falling ${summary.fallingOwnerCount}, resolved ${summary.resolvedOwnerCount}`,
    `Hotspot movement: new ${summary.newHotspotCount}, rising ${summary.risingHotspotCount}, flapping ${summary.flappingHotspotCount}, steady ${summary.steadyHotspotCount}, falling ${summary.fallingHotspotCount}, resolved ${summary.resolvedHotspotCount}`,
    `Case movement: new ${summary.newCaseCount}, rising ${summary.risingCaseCount}, flapping ${summary.flappingCaseCount}, steady ${summary.steadyCaseCount}, falling ${summary.fallingCaseCount}, resolved ${summary.resolvedCaseCount}`,
    'Saved-artifact note: Chronicle uses preserved dataset signals only, not raw trace frames, support frames, or blast radius detail.',
    '',
    'Owner trends',
    ...formatTrendLines(report.ownerTrends, (item) => item.owner),
    '',
    'Hotspot trends',
    ...formatTrendLines(report.hotspotTrends, (item) => item.label),
    '',
    'Case trends',
    ...formatTrendLines(report.caseTrends, (item) => item.signature),
  ];

  return sections.join('\n').trim();
}

export function renderCasebookChronicleMarkdownSummary(report) {
  const summary = report.summary;
  const lines = [
    '# Stack Sleuth Casebook Chronicle',
    '',
    `- **Snapshots:** ${escapeMarkdownText(report.labels.join(' → '))}`,
    `- **Latest snapshot:** ${escapeMarkdownText(summary.latestLabel)} (${summary.latestPackCount} packs, ${summary.latestOwnerCount} owners, ${summary.latestHotspotCount} hotspots, ${summary.latestCaseCount} cases)`,
    `- **Headline:** ${escapeMarkdownText(summary.headline)}`,
    `- **Release gate:** ${escapeMarkdownText(summary.latestGateVerdict)}`,
    `- **Gate drift:** ${escapeMarkdownText(summary.gateDrift.summary)}`,
    `- **Steward drift:** ${escapeMarkdownText(summary.stewardDrift.summary)}`,
    `- **Latest steward:** ${escapeMarkdownText(summary.latestStewardHeadline)}`,
    `- **Owner movement:** new ${summary.newOwnerCount}, rising ${summary.risingOwnerCount}, flapping ${summary.flappingOwnerCount}, steady ${summary.steadyOwnerCount}, falling ${summary.fallingOwnerCount}, resolved ${summary.resolvedOwnerCount}`,
    `- **Hotspot movement:** new ${summary.newHotspotCount}, rising ${summary.risingHotspotCount}, flapping ${summary.flappingHotspotCount}, steady ${summary.steadyHotspotCount}, falling ${summary.fallingHotspotCount}, resolved ${summary.resolvedHotspotCount}`,
    `- **Case movement:** new ${summary.newCaseCount}, rising ${summary.risingCaseCount}, flapping ${summary.flappingCaseCount}, steady ${summary.steadyCaseCount}, falling ${summary.fallingCaseCount}, resolved ${summary.resolvedCaseCount}`,
    `- **Saved-artifact note:** ${escapeMarkdownText('Chronicle uses preserved dataset signals only, not raw trace frames, support frames, or blast radius detail.')}`,
    '',
    '## Owner trends',
    formatMarkdownTrendLines(report.ownerTrends, (item) => item.owner),
    '',
    '## Hotspot trends',
    formatMarkdownTrendLines(report.hotspotTrends, (item) => item.label),
    '',
    '## Case trends',
    formatMarkdownTrendLines(report.caseTrends, (item) => item.signature),
  ];

  return lines.join('\n').trim();
}

function buildOwnerTrends(snapshots) {
  const ownersBySnapshot = snapshots.map((snapshot) => new Map((snapshot.dataset.responseQueue ?? []).map((entry) => [entry.owner, entry])));
  const owners = [...new Set(ownersBySnapshot.flatMap((entries) => [...entries.keys()]).filter(Boolean))];

  return owners
    .map((owner) => {
      const entries = ownersBySnapshot.map((items) => items.get(owner) ?? null);
      const series = entries.map((entry) => toCount(entry?.packCount));
      const latest = selectLatest(entries);
      return {
        owner,
        series,
        trend: classifyTrend(series),
        latestCount: series.at(-1) ?? 0,
        peakCount: Math.max(...series, 0),
        labels: snapshots.map((snapshot) => snapshot.label),
        latestLabels: latest?.labels ?? [],
        guidance: latest?.guidance ?? [],
      };
    })
    .sort(compareTrendEntries);
}

function buildHotspotTrends(snapshots) {
  const hotspotsBySnapshot = snapshots.map((snapshot) => new Map((snapshot.dataset.recurringHotspots ?? []).map((entry) => [entry.label, entry])));
  const labels = [...new Set(hotspotsBySnapshot.flatMap((entries) => [...entries.keys()]).filter(Boolean))];

  return labels
    .map((label) => {
      const entries = hotspotsBySnapshot.map((items) => items.get(label) ?? null);
      const series = entries.map((entry) => toCount(entry?.packCount));
      return {
        label,
        series,
        trend: classifyTrend(series),
        latestCount: series.at(-1) ?? 0,
        peakCount: Math.max(...series, 0),
        maxScore: Math.max(...entries.map((entry) => toCount(entry?.maxScore)), 0),
        labels: snapshots.map((snapshot) => snapshot.label),
      };
    })
    .sort(compareTrendEntries);
}

function buildCaseTrends(snapshots) {
  const casesBySnapshot = snapshots.map((snapshot) => new Map((snapshot.dataset.cases ?? []).map((entry) => [entry.signature || entry.label, entry])));
  const signatures = [...new Set(casesBySnapshot.flatMap((entries) => [...entries.keys()]).filter(Boolean))];

  return signatures
    .map((signature) => {
      const entries = casesBySnapshot.map((items) => items.get(signature) ?? null);
      const series = entries.map((entry) => (entry ? 1 : 0));
      const latest = selectLatest(entries);
      return {
        signature,
        label: latest?.label ?? signature,
        series,
        trend: classifyTrend(series),
        latestCount: series.at(-1) ?? 0,
        peakCount: Math.max(...series, 0),
        labels: snapshots.map((snapshot) => snapshot.label),
      };
    })
    .sort(compareTrendEntries);
}

function summarizeChronicle(snapshots, ownerTrends, hotspotTrends, caseTrends) {
  const latestSnapshot = snapshots.at(-1)?.dataset ?? {};
  const previousSnapshot = snapshots.at(-2)?.dataset ?? null;
  const latestGate = latestSnapshot.gate ?? null;
  const previousGate = previousSnapshot?.gate ?? null;

  const summary = {
    snapshotCount: snapshots.length,
    latestLabel: snapshots.at(-1)?.label ?? '-',
    latestPackCount: toCount(latestSnapshot.summary?.packCount),
    latestOwnerCount: (latestSnapshot.responseQueue ?? []).length,
    latestHotspotCount: (latestSnapshot.recurringHotspots ?? []).length,
    latestCaseCount: (latestSnapshot.cases ?? []).length,
    latestGateVerdict: latestGate?.verdict ?? 'needs-input',
    gateDrift: compareGateSnapshots(previousGate, latestGate),
    stewardDrift: compareStewardSnapshots(previousSnapshot?.steward, latestSnapshot.steward),
    latestStewardHeadline: describeCasebookStewardHeadline(latestSnapshot.steward),
    newOwnerCount: countTrend(ownerTrends, 'new'),
    risingOwnerCount: countTrend(ownerTrends, 'rising'),
    flappingOwnerCount: countTrend(ownerTrends, 'flapping'),
    steadyOwnerCount: countTrend(ownerTrends, 'steady'),
    fallingOwnerCount: countTrend(ownerTrends, 'falling'),
    resolvedOwnerCount: countTrend(ownerTrends, 'resolved'),
    newHotspotCount: countTrend(hotspotTrends, 'new'),
    risingHotspotCount: countTrend(hotspotTrends, 'rising'),
    flappingHotspotCount: countTrend(hotspotTrends, 'flapping'),
    steadyHotspotCount: countTrend(hotspotTrends, 'steady'),
    fallingHotspotCount: countTrend(hotspotTrends, 'falling'),
    resolvedHotspotCount: countTrend(hotspotTrends, 'resolved'),
    newCaseCount: countTrend(caseTrends, 'new'),
    risingCaseCount: countTrend(caseTrends, 'rising'),
    flappingCaseCount: countTrend(caseTrends, 'flapping'),
    steadyCaseCount: countTrend(caseTrends, 'steady'),
    fallingCaseCount: countTrend(caseTrends, 'falling'),
    resolvedCaseCount: countTrend(caseTrends, 'resolved'),
  };

  summary.headline = `Chronicle compared ${summary.snapshotCount} saved datasets and the latest snapshot ${summary.latestLabel} shows ${summary.newOwnerCount} new owner${summary.newOwnerCount === 1 ? '' : 's'}, ${summary.risingOwnerCount} rising owner${summary.risingOwnerCount === 1 ? '' : 's'}, ${summary.newHotspotCount} new hotspot${summary.newHotspotCount === 1 ? '' : 's'}, and ${summary.newCaseCount} new case${summary.newCaseCount === 1 ? '' : 's'}.`;

  return summary;
}

function classifyTrend(series) {
  const latest = series.at(-1) ?? 0;
  const previous = series.at(-2) ?? 0;
  const deltas = series.slice(1).map((count, index) => count - series[index]);
  const hasIncrease = deltas.some((delta) => delta > 0);
  const hasDecrease = deltas.some((delta) => delta < 0);

  if (previous === 0 && latest > 0) {
    return 'new';
  }

  if (previous > 0 && latest === 0) {
    return 'resolved';
  }

  if (hasIncrease && hasDecrease) {
    return 'flapping';
  }

  if (latest > previous) {
    return 'rising';
  }

  if (latest < previous) {
    return 'falling';
  }

  return 'steady';
}

function compareTrendEntries(left, right) {
  return (TREND_PRIORITY[left.trend] ?? Number.MAX_SAFE_INTEGER) - (TREND_PRIORITY[right.trend] ?? Number.MAX_SAFE_INTEGER)
    || (right.latestCount ?? 0) - (left.latestCount ?? 0)
    || (right.peakCount ?? 0) - (left.peakCount ?? 0)
    || String(left.owner ?? left.label ?? left.signature).localeCompare(String(right.owner ?? right.label ?? right.signature));
}

function formatTrendLines(items, keySelector) {
  if (!items.length) {
    return ['None'];
  }

  return items.map((item) => `${item.trend}: ${formatSeries(item.series)} ${keySelector(item)}`);
}

function formatMarkdownTrendLines(items, keySelector) {
  if (!items.length) {
    return '- None';
  }

  return items
    .map((item) => `- **${escapeMarkdownText(item.trend)}:** ${escapeMarkdownText(formatSeries(item.series))} ${formatMarkdownCode(keySelector(item))}`)
    .join('\n');
}

function formatSeries(series) {
  return series.join(' → ');
}

function countTrend(items, trend) {
  return items.filter((item) => item.trend === trend).length;
}

function selectLatest(items) {
  return [...items].reverse().find(Boolean) ?? null;
}

function toCount(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
}

function createChronicleError(details) {
  const error = new Error(describeChronicleInputError(details));
  error.code = 'STACK_SLEUTH_CHRONICLE_INPUT_ERROR';
  error.details = details;
  return error;
}

export function describeChronicleInputError(details) {
  if (details.reason === 'too-few-snapshots') {
    return 'Casebook Chronicle needs at least two labeled saved dataset snapshots.';
  }

  if (details.reason === 'unsupported-version') {
    return `Casebook Chronicle snapshot ${details.snapshotLabel ?? 'unknown'} uses unsupported dataset version ${details.replay?.parsed?.version ?? 'unknown'}. Supported version: ${details.replay?.supportedVersion ?? 'unknown'}.`;
  }

  if (details.reason === 'wrong-kind') {
    return `Casebook Chronicle snapshot ${details.snapshotLabel ?? 'unknown'} uses unsupported kind ${details.replay?.parsed?.kind ?? 'unknown'}.`;
  }

  if (details.reason === 'invalid-json') {
    return `Casebook Chronicle snapshot ${details.snapshotLabel ?? 'unknown'} could not parse saved dataset JSON.`;
  }

  return 'Casebook Chronicle requires labeled saved Stack Sleuth Casebook Dataset snapshots.';
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}

function formatMarkdownCode(value) {
  return `\`${String(value ?? '').replace(/`/g, '&#96;')}\``;
}
