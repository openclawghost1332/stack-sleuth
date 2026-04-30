import { analyzeTraceDigest, createEmptyBlastRadius, mergeBlastRadius } from './digest.js';
import { formatFrame } from './analyze.js';
import { formatExtractionMarkdown, formatExtractionText } from './extract.js';
import { parseLabeledTraceBatches } from './labeled.js';

const TREND_PRIORITY = {
  new: 0,
  rising: 1,
  flapping: 2,
  steady: 3,
  falling: 4,
  resolved: 5,
};

export function parseTimelineSnapshots(input) {
  return parseLabeledTraceBatches(input);
}

export function analyzeTimeline(input) {
  const snapshots = Array.isArray(input) ? input : parseTimelineSnapshots(input);
  const analyzedSnapshots = snapshots.map((snapshot) => ({
    label: snapshot.label,
    traces: snapshot.traces,
    digest: analyzeTraceDigest(snapshot.traces),
  }));
  const labels = analyzedSnapshots.map((snapshot) => snapshot.label);
  const incidents = buildIncidentTimeline(analyzedSnapshots);
  const hotspots = buildHotspotTimeline(analyzedSnapshots);

  return {
    snapshots: analyzedSnapshots,
    incidents,
    hotspots,
    summary: summarizeTimeline(analyzedSnapshots, incidents),
    labels,
  };
}

export function renderTimelineTextSummary(timeline) {
  const summary = timeline.summary;
  const sections = [
    'Stack Sleuth Timeline Radar',
    `Snapshots: ${timeline.labels.join(' → ')}`,
    `Excavation: ${formatTimelineExtractionText(timeline.snapshots)}`,
    `Latest snapshot: ${summary.latestLabel} (${summary.latestTotalTraces} traces)`,
    `new: ${summary.newCount}`,
    `rising: ${summary.risingCount}`,
    `flapping: ${summary.flappingCount}`,
    `steady: ${summary.steadyCount}`,
    `falling: ${summary.fallingCount}`,
    `resolved: ${summary.resolvedCount}`,
    `Hotspot movement: ${formatTextHotspots(timeline.hotspots)}`,
    '',
    'Incident trends',
  ];

  for (const incident of timeline.incidents) {
    sections.push(`${incident.trend}: ${formatSeries(incident.series)} ${incident.signature}`);
    sections.push(`  Culprit: ${formatFrame(incident.representative?.culpritFrame ?? null)}`);
    for (const detail of formatBlastRadiusTextLines(incident.blastRadius)) {
      sections.push(`  ${detail}`);
    }
  }

  return sections.join('\n').trim();
}

export function renderTimelineMarkdownSummary(timeline) {
  const summary = timeline.summary;
  const lines = [
    '# Stack Sleuth Timeline Radar',
    '',
    `- **Snapshots:** ${escapeMarkdownText(timeline.labels.join(' → '))}`,
    formatTimelineExtractionMarkdown(timeline.snapshots),
    `- **Latest snapshot:** ${escapeMarkdownText(summary.latestLabel)} (${summary.latestTotalTraces} traces)`,
    `- **New incidents:** ${summary.newCount}`,
    `- **Rising incidents:** ${summary.risingCount}`,
    `- **Flapping incidents:** ${summary.flappingCount}`,
    `- **Steady incidents:** ${summary.steadyCount}`,
    `- **Falling incidents:** ${summary.fallingCount}`,
    `- **Resolved incidents:** ${summary.resolvedCount}`,
    '',
    '## Hotspot movement',
    formatMarkdownHotspots(timeline.hotspots),
    '',
    '## Incident trends',
    '',
  ];

  for (const incident of timeline.incidents) {
    lines.push(`- **Trend:** ${escapeMarkdownText(incident.trend)}`);
    lines.push(`- **Series:** ${escapeMarkdownText(formatSeries(incident.series))}`);
    lines.push(`- **Signature:** ${formatMarkdownCode(incident.signature)}`);
    lines.push(`- **Culprit:** ${formatMarkdownCode(formatFrame(incident.representative?.culpritFrame ?? null))}`);
    for (const detail of formatBlastRadiusMarkdownLines(incident.blastRadius)) {
      lines.push(detail);
    }
    lines.push(`- **Summary:** ${escapeMarkdownText(incident.representative?.diagnosis?.summary ?? 'No summary available yet.')}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function buildIncidentTimeline(snapshots) {
  const groupsBySnapshot = snapshots.map((snapshot) => new Map(snapshot.digest.groups.map((group) => [group.signature, group])));
  const signatures = [...new Set(groupsBySnapshot.flatMap((groups) => [...groups.keys()]))];

  return signatures
    .map((signature) => {
      const groups = groupsBySnapshot.map((map) => map.get(signature) ?? null);
      const series = groups.map((group) => group?.count ?? 0);
      const trend = classifyTrend(series);
      return {
        signature,
        series,
        trend,
        latestCount: series.at(-1) ?? 0,
        peakCount: Math.max(...series, 0),
        labels: snapshots.map((snapshot) => snapshot.label),
        representative: selectRepresentative(groups),
        blastRadius: groups
          .filter(Boolean)
          .map((group) => group.blastRadius)
          .reduce((aggregate, blastRadius) => mergeBlastRadius(aggregate, blastRadius), createEmptyBlastRadius('direct')),
      };
    })
    .sort(compareTimelineEntries);
}

function buildHotspotTimeline(snapshots) {
  const hotspotsBySnapshot = snapshots.map((snapshot) => new Map(snapshot.digest.hotspots.map((hotspot) => [hotspot.path, hotspot])));
  const paths = [...new Set(hotspotsBySnapshot.flatMap((hotspots) => [...hotspots.keys()]))];

  return paths
    .map((path) => {
      const hotspots = hotspotsBySnapshot.map((map) => map.get(path) ?? null);
      const series = hotspots.map((hotspot) => hotspot?.score ?? 0);
      const trend = classifyTrend(series);
      return {
        path,
        label: selectHotspotLabel(hotspots, path),
        series,
        trend,
        latestScore: series.at(-1) ?? 0,
        peakScore: Math.max(...series, 0),
        peakCulpritCount: Math.max(...hotspots.map((hotspot) => hotspot?.culpritCount ?? 0), 0),
      };
    })
    .filter((hotspot) => hotspot.peakScore >= 3 && hotspot.peakCulpritCount > 0)
    .sort(compareTimelineEntries);
}

function summarizeTimeline(snapshots, incidents) {
  const latestSnapshot = snapshots.at(-1);
  return {
    snapshotCount: snapshots.length,
    latestLabel: latestSnapshot?.label ?? '-',
    latestTotalTraces: latestSnapshot?.digest?.totalTraces ?? 0,
    activeLatestCount: incidents.filter((incident) => incident.latestCount > 0).length,
    newCount: incidents.filter((incident) => incident.trend === 'new').length,
    risingCount: incidents.filter((incident) => incident.trend === 'rising').length,
    flappingCount: incidents.filter((incident) => incident.trend === 'flapping').length,
    steadyCount: incidents.filter((incident) => incident.trend === 'steady').length,
    fallingCount: incidents.filter((incident) => incident.trend === 'falling').length,
    resolvedCount: incidents.filter((incident) => incident.trend === 'resolved').length,
  };
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

function selectRepresentative(groups) {
  return [...groups].reverse().find((group) => group?.representative)?.representative
    ?? groups.find((group) => group?.representative)?.representative
    ?? null;
}

function selectHotspotLabel(hotspots, path) {
  return [...hotspots].reverse().find((hotspot) => hotspot?.label)?.label
    ?? hotspots.find((hotspot) => hotspot?.label)?.label
    ?? path;
}

function compareTimelineEntries(left, right) {
  return (TREND_PRIORITY[left.trend] ?? Number.MAX_SAFE_INTEGER) - (TREND_PRIORITY[right.trend] ?? Number.MAX_SAFE_INTEGER)
    || (right.latestCount ?? right.latestScore ?? 0) - (left.latestCount ?? left.latestScore ?? 0)
    || (right.peakCount ?? right.peakScore ?? 0) - (left.peakCount ?? left.peakScore ?? 0)
    || String(left.signature ?? left.path).localeCompare(String(right.signature ?? right.path));
}

function formatSeries(series) {
  return series.join(' → ');
}

function formatBlastRadiusTextLines(blastRadius) {
  const lines = [];
  const services = blastRadius?.services?.map((service) => `${service.name} ${service.count}x`).join(', ');
  if (services) {
    lines.push(`Blast radius: ${services}`);
  }

  if (blastRadius?.firstSeen || blastRadius?.lastSeen) {
    lines.push(`Window: ${formatWindow(blastRadius.firstSeen, blastRadius.lastSeen)}`);
  }

  return lines;
}

function formatBlastRadiusMarkdownLines(blastRadius) {
  const lines = [];
  const services = blastRadius?.services?.map((service) => `${service.name} ${service.count}x`).join(', ');
  if (services) {
    lines.push(`- **Blast radius:** ${escapeMarkdownText(services)}`);
  }

  if (blastRadius?.firstSeen || blastRadius?.lastSeen) {
    lines.push(`- **Window:** ${escapeMarkdownText(formatWindow(blastRadius.firstSeen, blastRadius.lastSeen))}`);
  }

  return lines;
}

function formatWindow(firstSeen, lastSeen) {
  if (firstSeen && lastSeen) {
    return `${firstSeen} → ${lastSeen}`;
  }

  return firstSeen ?? lastSeen ?? 'Unavailable';
}

function formatTextHotspots(hotspots) {
  if (!(hotspots?.length)) {
    return 'None';
  }

  return hotspots
    .slice(0, 3)
    .map((hotspot) => `${hotspot.label} [${formatSeries(hotspot.series)}]`)
    .join(', ');
}

function formatMarkdownHotspots(hotspots) {
  if (!(hotspots?.length)) {
    return '- `None`';
  }

  return hotspots
    .slice(0, 5)
    .map((hotspot) => `- ${formatMarkdownCode(hotspot.label)} (${escapeMarkdownText(hotspot.trend)}, ${escapeMarkdownText(formatSeries(hotspot.series))})`)
    .join('\n');
}

function formatTimelineExtractionText(snapshots) {
  return snapshots
    .map((snapshot) => `${snapshot.label}: ${formatExtractionText(snapshot.digest.extraction, 'input').replace(/^input:\s*/i, '').replace(/\.$/, '')}`)
    .join('; ');
}

function formatTimelineExtractionMarkdown(snapshots) {
  const combined = snapshots
    .map((snapshot) => `${snapshot.label}: ${formatExtractionText(snapshot.digest.extraction, 'input').replace(/^input:\s*/i, '').replace(/\.$/, '')}`)
    .join('; ');
  return formatExtractionMarkdown({ mode: 'extracted', traceCount: 0, ignoredLineCount: 0 }, 'Excavation').replace('excavated 0 traces from raw logs, ignored 0 non-trace lines', escapeMarkdownText(combined));
}

function escapeMarkdownText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}

function formatMarkdownCode(value) {
  return `\`${escapeMarkdownText(value)}\``;
}
