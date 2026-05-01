import { inspectResponseBundleReplayInput } from './bundle-replay.js';
import { compareGateSnapshots } from './gate.js';

const LABEL_MARKER = /^===\s*(.+?)\s*===$/gm;
const TREND_PRIORITY = {
  new: 0,
  rising: 1,
  flapping: 2,
  steady: 3,
  falling: 4,
  resolved: 5,
};

export function parseResponseBundleChronicleSnapshots(input) {
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

export function inspectResponseBundleChronicleInput(input) {
  const snapshots = Array.isArray(input) ? input : parseResponseBundleChronicleSnapshots(input);

  if (!snapshots.length) {
    return { valid: false, reason: 'not-bundle-chronicle', snapshots: [] };
  }

  if (snapshots.length < 2) {
    return { valid: false, reason: 'too-few-snapshots', snapshots };
  }

  const validatedSnapshots = [];

  for (const [snapshotIndex, snapshot] of snapshots.entries()) {
    const replay = inspectResponseBundleReplayInput(snapshot.source ?? snapshot.bundle ?? snapshot);
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
      bundle: replay.bundle,
    });
  }

  return {
    valid: true,
    snapshots: validatedSnapshots,
    labels: validatedSnapshots.map((snapshot) => snapshot.label),
  };
}

export function analyzeResponseBundleChronicle(input) {
  const inspected = input?.valid === true && Array.isArray(input.snapshots)
    ? input
    : inspectResponseBundleChronicleInput(input);

  if (!inspected.valid) {
    throw createBundleChronicleError(inspected);
  }

  const snapshots = inspected.snapshots.map((snapshot) => ({
    label: snapshot.label,
    bundle: snapshot.bundle,
    dataset: snapshot.bundle.dataset,
  }));
  const labels = snapshots.map((snapshot) => snapshot.label);
  const ownerTrends = buildOwnerTrends(snapshots);
  const hotspotTrends = buildHotspotTrends(snapshots);
  const caseTrends = buildCaseTrends(snapshots);
  const inventoryTrends = buildInventoryTrends(snapshots);
  const summary = summarizeBundleChronicle(snapshots, ownerTrends, hotspotTrends, caseTrends, inventoryTrends);

  return {
    snapshots,
    labels,
    ownerTrends,
    hotspotTrends,
    caseTrends,
    inventoryTrends,
    summary,
  };
}

export function renderResponseBundleChronicleTextSummary(report) {
  const summary = report.summary;
  return [
    'Stack Sleuth Response Bundle Chronicle',
    `Snapshots: ${report.labels.join(' → ')}`,
    `Latest snapshot: ${summary.latestLabel} (${summary.latestPackCount} packs, ${summary.latestOwnerCount} owners, ${summary.latestHotspotCount} hotspots, ${summary.latestCaseCount} cases, ${summary.latestFileCount} files)`,
    `Headline: ${summary.headline}`,
    `Release gate: ${summary.latestGateVerdict}`,
    `Gate drift: ${summary.gateDrift.summary}`,
    `Latest source workflow: ${formatSource(summary.latestSourceMode, summary.latestSourceLabel)}`,
    `Source drift: ${summary.sourceDrift}`,
    `Owner movement: new ${summary.newOwnerCount}, rising ${summary.risingOwnerCount}, flapping ${summary.flappingOwnerCount}, steady ${summary.steadyOwnerCount}, falling ${summary.fallingOwnerCount}, resolved ${summary.resolvedOwnerCount}`,
    `Hotspot movement: new ${summary.newHotspotCount}, rising ${summary.risingHotspotCount}, flapping ${summary.flappingHotspotCount}, steady ${summary.steadyHotspotCount}, falling ${summary.fallingHotspotCount}, resolved ${summary.resolvedHotspotCount}`,
    `Case movement: new ${summary.newCaseCount}, rising ${summary.risingCaseCount}, flapping ${summary.flappingCaseCount}, steady ${summary.steadyCaseCount}, falling ${summary.fallingCaseCount}, resolved ${summary.resolvedCaseCount}`,
    `Bundle inventory movement: new ${summary.newInventoryCount}, rising ${summary.risingInventoryCount}, flapping ${summary.flappingInventoryCount}, steady ${summary.steadyInventoryCount}, falling ${summary.fallingInventoryCount}, resolved ${summary.resolvedInventoryCount}`,
    'Saved-artifact note: Bundle Chronicle replays preserved bundle inventory and embedded dataset fields only. It does not recover raw traces, support frames, or blast radius detail.',
    '',
    'Owner trends',
    ...formatTrendLines(report.ownerTrends, (item) => item.owner),
    '',
    'Hotspot trends',
    ...formatTrendLines(report.hotspotTrends, (item) => item.label),
    '',
    'Case trends',
    ...formatTrendLines(report.caseTrends, (item) => item.signature),
    '',
    'Bundle inventory trends',
    ...formatTrendLines(report.inventoryTrends, (item) => item.filename),
  ].join('\n').trim();
}

export function renderResponseBundleChronicleMarkdownSummary(report) {
  const summary = report.summary;
  return [
    '# Stack Sleuth Response Bundle Chronicle',
    '',
    `- **Snapshots:** ${escapeMarkdownText(report.labels.join(' → '))}`,
    `- **Latest snapshot:** ${escapeMarkdownText(summary.latestLabel)} (${summary.latestPackCount} packs, ${summary.latestOwnerCount} owners, ${summary.latestHotspotCount} hotspots, ${summary.latestCaseCount} cases, ${summary.latestFileCount} files)`,
    `- **Headline:** ${escapeMarkdownText(summary.headline)}`,
    `- **Release gate:** ${escapeMarkdownText(summary.latestGateVerdict)}`,
    `- **Gate drift:** ${escapeMarkdownText(summary.gateDrift.summary)}`,
    `- **Latest source workflow:** ${escapeMarkdownText(formatSource(summary.latestSourceMode, summary.latestSourceLabel))}`,
    `- **Source drift:** ${escapeMarkdownText(summary.sourceDrift)}`,
    `- **Owner movement:** new ${summary.newOwnerCount}, rising ${summary.risingOwnerCount}, flapping ${summary.flappingOwnerCount}, steady ${summary.steadyOwnerCount}, falling ${summary.fallingOwnerCount}, resolved ${summary.resolvedOwnerCount}`,
    `- **Hotspot movement:** new ${summary.newHotspotCount}, rising ${summary.risingHotspotCount}, flapping ${summary.flappingHotspotCount}, steady ${summary.steadyHotspotCount}, falling ${summary.fallingHotspotCount}, resolved ${summary.resolvedHotspotCount}`,
    `- **Case movement:** new ${summary.newCaseCount}, rising ${summary.risingCaseCount}, flapping ${summary.flappingCaseCount}, steady ${summary.steadyCaseCount}, falling ${summary.fallingCaseCount}, resolved ${summary.resolvedCaseCount}`,
    `- **Bundle inventory movement:** new ${summary.newInventoryCount}, rising ${summary.risingInventoryCount}, flapping ${summary.flappingInventoryCount}, steady ${summary.steadyInventoryCount}, falling ${summary.fallingInventoryCount}, resolved ${summary.resolvedInventoryCount}`,
    `- **Saved-artifact note:** ${escapeMarkdownText('Bundle Chronicle replays preserved bundle inventory and embedded dataset fields only. It does not recover raw traces, support frames, or blast radius detail.')}`,
    '',
    '## Owner trends',
    formatMarkdownTrendLines(report.ownerTrends, (item) => item.owner),
    '',
    '## Hotspot trends',
    formatMarkdownTrendLines(report.hotspotTrends, (item) => item.label),
    '',
    '## Case trends',
    formatMarkdownTrendLines(report.caseTrends, (item) => item.signature),
    '',
    '## Bundle inventory trends',
    formatMarkdownTrendLines(report.inventoryTrends, (item) => item.filename),
  ].join('\n').trim();
}

export function describeResponseBundleChronicleInputError(details) {
  if (details.reason === 'too-few-snapshots') {
    return 'Response Bundle Chronicle needs at least two labeled saved response bundle snapshots.';
  }

  if (details.reason === 'unsupported-version') {
    return `Response Bundle Chronicle snapshot ${details.snapshotLabel ?? 'unknown'} uses unsupported bundle version ${details.replay?.parsed?.version ?? 'unknown'}. Supported versions: ${(details.replay?.supportedVersions ?? []).join(', ')}.`;
  }

  if (details.reason === 'wrong-kind') {
    return `Response Bundle Chronicle snapshot ${details.snapshotLabel ?? 'unknown'} uses unsupported bundle kind ${details.replay?.parsed?.kind ?? 'unknown'}.`;
  }

  if (details.reason === 'invalid-json') {
    return `Response Bundle Chronicle snapshot ${details.snapshotLabel ?? 'unknown'} could not parse saved response bundle JSON.`;
  }

  if (details.reason === 'missing-dataset') {
    return `Response Bundle Chronicle snapshot ${details.snapshotLabel ?? 'unknown'} is missing casebook-dataset.json replay content.`;
  }

  return 'Response Bundle Chronicle requires labeled saved Stack Sleuth response-bundle.json snapshots.';
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
        labels: snapshots.map((snapshot) => snapshot.label),
      };
    })
    .sort(compareTrendEntries);
}

function buildCaseTrends(snapshots) {
  const casesBySnapshot = snapshots.map((snapshot) => new Map((snapshot.dataset.cases ?? []).map((entry) => [entry.signature || entry.label, entry])));
  const signatures = [...new Set(casesBySnapshot.flatMap((entries) => [...entries.keys()]).filter(Boolean))];

  return signatures
    .map((signature) => ({
      signature,
      series: casesBySnapshot.map((items) => items.has(signature) ? 1 : 0),
      trend: classifyTrend(casesBySnapshot.map((items) => items.has(signature) ? 1 : 0)),
      latestCount: casesBySnapshot.at(-1)?.has(signature) ? 1 : 0,
      peakCount: 1,
      labels: snapshots.map((snapshot) => snapshot.label),
    }))
    .sort(compareTrendEntries);
}

function buildInventoryTrends(snapshots) {
  const filesBySnapshot = snapshots.map((snapshot) => new Set(snapshot.bundle.manifest?.files ?? []));
  const filenames = [...new Set(filesBySnapshot.flatMap((items) => [...items]).filter(Boolean))];

  return filenames
    .map((filename) => {
      const series = filesBySnapshot.map((items) => items.has(filename) ? 1 : 0);
      return {
        filename,
        series,
        trend: classifyInventoryTrend(series),
        latestCount: series.at(-1) ?? 0,
        peakCount: 1,
        labels: snapshots.map((snapshot) => snapshot.label),
      };
    })
    .sort(compareTrendEntries);
}

function summarizeBundleChronicle(snapshots, ownerTrends, hotspotTrends, caseTrends, inventoryTrends) {
  const latestSnapshot = snapshots.at(-1) ?? null;
  const previousSnapshot = snapshots.at(-2) ?? null;
  const latestDataset = latestSnapshot?.dataset ?? {};
  const latestBundle = latestSnapshot?.bundle ?? {};
  const latestSource = latestBundle.manifest?.source ?? {};
  const previousSource = previousSnapshot?.bundle?.manifest?.source ?? null;

  const summary = {
    snapshotCount: snapshots.length,
    latestLabel: latestSnapshot?.label ?? '-',
    latestPackCount: toCount(latestDataset.summary?.packCount),
    latestOwnerCount: (latestDataset.responseQueue ?? []).length,
    latestHotspotCount: (latestDataset.recurringHotspots ?? []).length,
    latestCaseCount: (latestDataset.cases ?? []).length,
    latestFileCount: (latestBundle.manifest?.files ?? []).length,
    latestGateVerdict: latestDataset.gate?.verdict ?? latestBundle.summary?.releaseGateVerdict ?? 'needs-input',
    latestSourceMode: String(latestSource.mode ?? 'unknown'),
    latestSourceLabel: latestSource.label == null ? null : String(latestSource.label),
    gateDrift: compareGateSnapshots(previousSnapshot?.dataset?.gate ?? null, latestDataset.gate ?? null),
    sourceDrift: describeSourceDrift(previousSource, latestSource),
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
    newInventoryCount: countTrend(inventoryTrends, 'new'),
    risingInventoryCount: countTrend(inventoryTrends, 'rising'),
    flappingInventoryCount: countTrend(inventoryTrends, 'flapping'),
    steadyInventoryCount: countTrend(inventoryTrends, 'steady'),
    fallingInventoryCount: countTrend(inventoryTrends, 'falling'),
    resolvedInventoryCount: countTrend(inventoryTrends, 'resolved'),
  };

  summary.headline = `Bundle Chronicle compared ${summary.snapshotCount} saved response bundles and the latest snapshot ${summary.latestLabel} shows ${summary.newOwnerCount} new owner${summary.newOwnerCount === 1 ? '' : 's'}, ${summary.risingOwnerCount} rising owner${summary.risingOwnerCount === 1 ? '' : 's'}, ${summary.newHotspotCount} new hotspot${summary.newHotspotCount === 1 ? '' : 's'}, and Release Gate ${String(summary.latestGateVerdict).toUpperCase()}.`;

  return summary;
}

function describeSourceDrift(previousSource, latestSource) {
  const previous = formatSource(previousSource?.mode ?? 'unknown', previousSource?.label ?? null);
  const latest = formatSource(latestSource?.mode ?? 'unknown', latestSource?.label ?? null);
  return previous === latest
    ? `Source workflow stayed ${latest}.`
    : `Source workflow changed from ${previous} to ${latest}.`;
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

function classifyInventoryTrend(series) {
  const latest = series.at(-1) ?? 0;
  const first = series[0] ?? 0;
  const deltas = series.slice(1).map((count, index) => count - series[index]);
  const hasIncrease = deltas.some((delta) => delta > 0);
  const hasDecrease = deltas.some((delta) => delta < 0);

  if (hasIncrease && hasDecrease) {
    return 'flapping';
  }

  if (latest > 0 && first === 0) {
    return 'new';
  }

  if (latest === 0 && first > 0) {
    return 'resolved';
  }

  return 'steady';
}

function compareTrendEntries(left, right) {
  return (TREND_PRIORITY[left.trend] ?? Number.MAX_SAFE_INTEGER) - (TREND_PRIORITY[right.trend] ?? Number.MAX_SAFE_INTEGER)
    || (right.latestCount ?? 0) - (left.latestCount ?? 0)
    || (right.peakCount ?? 0) - (left.peakCount ?? 0)
    || String(left.owner ?? left.label ?? left.signature ?? left.filename).localeCompare(String(right.owner ?? right.label ?? right.signature ?? right.filename));
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

function createBundleChronicleError(details) {
  const error = new Error(describeResponseBundleChronicleInputError(details));
  error.code = 'STACK_SLEUTH_BUNDLE_CHRONICLE_INPUT_ERROR';
  error.details = details;
  return error;
}

function formatSource(mode, label) {
  return label ? `${mode} (${label})` : String(mode ?? 'unknown');
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}

function formatMarkdownCode(value) {
  return `\`${String(value ?? '').replace(/`/g, '&#96;')}\``;
}
