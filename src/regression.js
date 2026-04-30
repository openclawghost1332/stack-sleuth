import { analyzeTraceDigest, createEmptyBlastRadius, mergeBlastRadius } from './digest.js';
import { formatFrame } from './analyze.js';
import { buildHotspotShifts } from './hotspots.js';
import { formatExtractionMarkdown, formatExtractionText } from './extract.js';

const STATUS_PRIORITY = {
  new: 0,
  'volume-up': 1,
  recurring: 2,
  'volume-down': 3,
  resolved: 4,
};

export function analyzeRegression({ baseline, candidate }) {
  const baselineDigest = analyzeTraceDigest(baseline);
  const candidateDigest = analyzeTraceDigest(candidate);
  const baselineBySignature = new Map(baselineDigest.groups.map((group) => [group.signature, group]));
  const candidateBySignature = new Map(candidateDigest.groups.map((group) => [group.signature, group]));
  const incidents = [...new Set([...baselineBySignature.keys(), ...candidateBySignature.keys()])]
    .map((signature) => buildIncident(signature, baselineBySignature.get(signature), candidateBySignature.get(signature)))
    .sort(compareIncidents);

  return {
    baselineDigest,
    candidateDigest,
    incidents,
    hotspotShifts: buildHotspotShifts({
      baseline: baselineDigest.hotspots,
      candidate: candidateDigest.hotspots,
    }),
    summary: summarizeRegression(incidents, baselineDigest, candidateDigest),
  };
}

export function renderRegressionTextSummary(regression) {
  const sections = [
    'Stack Sleuth Regression Radar',
    formatExtractionText(regression.baselineDigest.extraction, 'Baseline input'),
    formatExtractionText(regression.candidateDigest.extraction, 'Candidate input'),
    `Baseline traces: ${regression.summary.totalBaselineTraces}`,
    `Candidate traces: ${regression.summary.totalCandidateTraces}`,
    `new: ${regression.summary.newCount}`,
    `volume-up: ${regression.summary.volumeUpCount}`,
    `recurring: ${regression.summary.recurringCount}`,
    `volume-down: ${regression.summary.volumeDownCount}`,
    `resolved: ${regression.summary.resolvedCount}`,
    `Hotspot shifts: ${formatTextHotspotShifts(regression.hotspotShifts)}`,
    '',
  ];

  const grouped = groupIncidentsByStatus(regression.incidents);
  for (const [status, incidents] of grouped) {
    if (!incidents.length) {
      continue;
    }

    sections.push(`${formatStatusLabel(status)} incidents`);
    incidents.forEach((incident) => {
      sections.push(
        `${incident.status}: ${incident.candidateCount} vs ${incident.baselineCount} (delta ${formatDelta(incident.delta)}) ${incident.signature}`,
      );
      sections.push(`  Culprit: ${formatFrame(incident.representative?.culpritFrame ?? null)}`);
      for (const detail of formatBlastRadiusTextLines(incident.blastRadius)) {
        sections.push(`  ${detail}`);
      }
    });
    sections.push('');
  }

  return sections.join('\n').trim();
}

export function renderRegressionMarkdownSummary(regression) {
  const lines = [
    '# Stack Sleuth Regression Radar',
    '',
    formatExtractionMarkdown(regression.baselineDigest.extraction, 'Baseline input'),
    formatExtractionMarkdown(regression.candidateDigest.extraction, 'Candidate input'),
    `- **Baseline traces:** ${regression.summary.totalBaselineTraces}`,
    `- **Candidate traces:** ${regression.summary.totalCandidateTraces}`,
    `- **New incidents:** ${regression.summary.newCount}`,
    `- **Volume-up incidents:** ${regression.summary.volumeUpCount}`,
    `- **Recurring incidents:** ${regression.summary.recurringCount}`,
    `- **Volume-down incidents:** ${regression.summary.volumeDownCount}`,
    `- **Resolved incidents:** ${regression.summary.resolvedCount}`,
    '',
    '## Hotspot shifts',
    formatMarkdownHotspotShifts(regression.hotspotShifts),
    '',
  ];

  const grouped = groupIncidentsByStatus(regression.incidents);
  for (const [status, incidents] of grouped) {
    if (!incidents.length) {
      continue;
    }

    lines.push(`## ${formatStatusLabel(status)} incidents`, '');
    incidents.forEach((incident) => {
      lines.push(`- **Signature:** \`${escapeMarkdownCode(incident.signature)}\``);
      lines.push(`- **Counts:** candidate ${incident.candidateCount}, baseline ${incident.baselineCount}, delta ${escapeMarkdownText(formatDelta(incident.delta))}`);
      lines.push(`- **Culprit:** \`${escapeMarkdownCode(formatFrame(incident.representative?.culpritFrame ?? null))}\``);
      for (const detail of formatBlastRadiusMarkdownLines(incident.blastRadius)) {
        lines.push(detail);
      }
      lines.push(`- **Summary:** ${escapeMarkdownText(incident.representative?.diagnosis?.summary ?? 'No summary available yet.')}`);
      lines.push('');
    });
  }

  return lines.join('\n').trim();
}

function buildIncident(signature, baselineGroup, candidateGroup) {
  const baselineCount = baselineGroup?.count ?? 0;
  const candidateCount = candidateGroup?.count ?? 0;
  const delta = candidateCount - baselineCount;

  return {
    signature,
    baselineCount,
    candidateCount,
    delta,
    status: classifyIncident(baselineCount, candidateCount),
    representative: candidateGroup?.representative ?? baselineGroup?.representative ?? null,
    firstSeenIndex: Math.min(
      baselineGroup?.firstSeenIndex ?? Number.POSITIVE_INFINITY,
      candidateGroup?.firstSeenIndex ?? Number.POSITIVE_INFINITY,
    ),
    blastRadius: [baselineGroup?.blastRadius, candidateGroup?.blastRadius]
      .filter(Boolean)
      .reduce((aggregate, blastRadius) => mergeBlastRadius(aggregate, blastRadius), createEmptyBlastRadius('direct')),
  };
}

function classifyIncident(baselineCount, candidateCount) {
  if (baselineCount === 0 && candidateCount > 0) {
    return 'new';
  }

  if (baselineCount > 0 && candidateCount === 0) {
    return 'resolved';
  }

  if (candidateCount > baselineCount) {
    return 'volume-up';
  }

  if (candidateCount < baselineCount) {
    return 'volume-down';
  }

  return 'recurring';
}

function compareIncidents(left, right) {
  const statusDelta = STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status];
  if (statusDelta !== 0) {
    return statusDelta;
  }

  const magnitudeDelta = Math.abs(right.delta) - Math.abs(left.delta);
  if (magnitudeDelta !== 0) {
    return magnitudeDelta;
  }

  return left.firstSeenIndex - right.firstSeenIndex;
}

function summarizeRegression(incidents, baselineDigest, candidateDigest) {
  return {
    newCount: incidents.filter((incident) => incident.status === 'new').length,
    resolvedCount: incidents.filter((incident) => incident.status === 'resolved').length,
    recurringCount: incidents.filter((incident) => incident.status === 'recurring').length,
    volumeUpCount: incidents.filter((incident) => incident.status === 'volume-up').length,
    volumeDownCount: incidents.filter((incident) => incident.status === 'volume-down').length,
    totalBaselineTraces: baselineDigest.totalTraces,
    totalCandidateTraces: candidateDigest.totalTraces,
  };
}

function groupIncidentsByStatus(incidents) {
  return [
    ['new', incidents.filter((incident) => incident.status === 'new')],
    ['volume-up', incidents.filter((incident) => incident.status === 'volume-up')],
    ['recurring', incidents.filter((incident) => incident.status === 'recurring')],
    ['volume-down', incidents.filter((incident) => incident.status === 'volume-down')],
    ['resolved', incidents.filter((incident) => incident.status === 'resolved')],
  ];
}

function formatStatusLabel(status) {
  return status[0].toUpperCase() + status.slice(1);
}

function formatDelta(delta) {
  return delta > 0 ? `+${delta}` : String(delta);
}

function formatTextHotspotShifts(hotspotShifts) {
  if (!(hotspotShifts?.length)) {
    return 'None';
  }

  return hotspotShifts
    .slice(0, 3)
    .map((shift) => `${shift.label} (${formatDelta(shift.delta)})`)
    .join(', ');
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

function formatMarkdownHotspotShifts(hotspotShifts) {
  if (!(hotspotShifts?.length)) {
    return '- `None`';
  }

  return hotspotShifts
    .slice(0, 3)
    .map((shift) => `- ${formatMarkdownCode(shift.label)} (${shift.status}, baseline ${shift.baselineScore}, candidate ${shift.candidateScore}, delta ${formatDelta(shift.delta)})`)
    .join('\n');
}

function escapeMarkdownText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}

function escapeMarkdownCode(value) {
  return escapeMarkdownText(value);
}

function formatMarkdownCode(value) {
  return `\`${escapeMarkdownCode(value)}\``;
}
