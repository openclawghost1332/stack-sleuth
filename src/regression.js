import { analyzeTraceDigest } from './digest.js';
import { formatFrame } from './analyze.js';

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
    summary: summarizeRegression(incidents, baselineDigest, candidateDigest),
  };
}

export function renderRegressionTextSummary(regression) {
  const sections = [
    'Stack Sleuth Regression Radar',
    `Baseline traces: ${regression.summary.totalBaselineTraces}`,
    `Candidate traces: ${regression.summary.totalCandidateTraces}`,
    `new: ${regression.summary.newCount}`,
    `volume-up: ${regression.summary.volumeUpCount}`,
    `recurring: ${regression.summary.recurringCount}`,
    `volume-down: ${regression.summary.volumeDownCount}`,
    `resolved: ${regression.summary.resolvedCount}`,
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
    });
    sections.push('');
  }

  return sections.join('\n').trim();
}

export function renderRegressionMarkdownSummary(regression) {
  const lines = [
    '# Stack Sleuth Regression Radar',
    '',
    `- **Baseline traces:** ${regression.summary.totalBaselineTraces}`,
    `- **Candidate traces:** ${regression.summary.totalCandidateTraces}`,
    `- **New incidents:** ${regression.summary.newCount}`,
    `- **Volume-up incidents:** ${regression.summary.volumeUpCount}`,
    `- **Recurring incidents:** ${regression.summary.recurringCount}`,
    `- **Volume-down incidents:** ${regression.summary.volumeDownCount}`,
    `- **Resolved incidents:** ${regression.summary.resolvedCount}`,
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
