import { formatFrame } from './analyze.js';
import { analyzeIncidentPack } from './briefing.js';

const PACK_MARKER = /^@@@\s*(.+?)\s*@@@$/gm;

export function parseIncidentPortfolio(input) {
  const source = String(input ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) {
    return emptyPortfolio();
  }

  const matches = [...source.matchAll(PACK_MARKER)];
  if (!matches.length) {
    return emptyPortfolio(source);
  }

  const packs = [];
  const packOrder = [];

  for (const [index, match] of matches.entries()) {
    const label = String(match[1] ?? '').trim();
    if (!label) {
      continue;
    }

    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    const content = source.slice(start, end).trim();

    packs.push({ label, content });
    packOrder.push(label);
  }

  return {
    source,
    packOrder,
    packs,
  };
}

export function analyzeIncidentPortfolio(input) {
  const portfolio = input?.packs ? input : parseIncidentPortfolio(input);
  const packReports = portfolio.packs.map((pack, index) => buildPackReport(pack, index));
  const priorityQueue = [...packReports]
    .filter((item) => item.runnable)
    .sort(comparePackReports);
  const recurringIncidents = collectRecurringIncidents(packReports);
  const recurringHotspots = collectRecurringHotspots(packReports);
  const topPack = priorityQueue[0] ?? null;

  return {
    portfolio,
    packReports,
    priorityQueue,
    recurringIncidents,
    recurringHotspots,
    summary: {
      packCount: packReports.length,
      runnablePackCount: priorityQueue.length,
      unrunnablePackCount: packReports.length - priorityQueue.length,
      totalNovelIncidents: sumBy(packReports, (item) => item.report.casebook?.summary.novelCount ?? 0),
      totalRegressionNew: sumBy(packReports, (item) => item.report.regression?.summary.newCount ?? 0),
      totalRegressionVolumeUp: sumBy(packReports, (item) => item.report.regression?.summary.volumeUpCount ?? 0),
      totalTimelineNew: sumBy(packReports, (item) => item.report.timeline?.summary.newCount ?? 0),
      totalTimelineRising: sumBy(packReports, (item) => item.report.timeline?.summary.risingCount ?? 0),
      headline: topPack
        ? `Prioritize ${topPack.label} first because ${topPack.priorityReasons[0]}.`
        : 'No runnable incident packs were found in this portfolio.',
      checklist: buildChecklist({ priorityQueue, recurringIncidents, recurringHotspots, packReports }),
    },
  };
}

export function renderIncidentPortfolioTextSummary(report) {
  const lines = [
    'Stack Sleuth Portfolio Radar',
    `Packs: ${report.summary.packCount}`,
    `Runnable packs: ${report.summary.runnablePackCount}`,
    `Unrunnable packs: ${report.summary.unrunnablePackCount}`,
    `Headline: ${report.summary.headline}`,
    `Portfolio signals: ${report.summary.totalNovelIncidents} novel, ${report.summary.totalRegressionNew} regression-new, ${report.summary.totalRegressionVolumeUp} regression-volume-up, ${report.summary.totalTimelineNew} timeline-new, ${report.summary.totalTimelineRising} timeline-rising`,
    '',
    'Priority queue',
    ...formatPriorityQueue(report.priorityQueue),
    '',
    'Recurring incidents',
    ...formatRecurringIncidents(report.recurringIncidents),
    '',
    'Recurring hotspots',
    ...formatRecurringHotspots(report.recurringHotspots),
    '',
    'Checklist',
    ...report.summary.checklist.map((item) => `- ${item}`),
  ];

  return lines.join('\n').trim();
}

export function renderIncidentPortfolioMarkdownSummary(report) {
  const lines = [
    '# Stack Sleuth Portfolio Radar',
    '',
    `- **Packs:** ${report.summary.packCount}`,
    `- **Runnable packs:** ${report.summary.runnablePackCount}`,
    `- **Unrunnable packs:** ${report.summary.unrunnablePackCount}`,
    `- **Headline:** ${escapeMarkdownText(report.summary.headline)}`,
    `- **Portfolio signals:** ${escapeMarkdownText(`${report.summary.totalNovelIncidents} novel, ${report.summary.totalRegressionNew} regression-new, ${report.summary.totalRegressionVolumeUp} regression-volume-up, ${report.summary.totalTimelineNew} timeline-new, ${report.summary.totalTimelineRising} timeline-rising`)}`,
    '',
    '## Priority queue',
    ...formatPriorityQueue(report.priorityQueue).map((item) => escapeMarkdownListItem(item)),
    '',
    '## Recurring incidents',
    ...formatRecurringIncidents(report.recurringIncidents).map((item) => escapeMarkdownListItem(item)),
    '',
    '## Recurring hotspots',
    ...formatRecurringHotspots(report.recurringHotspots).map((item) => escapeMarkdownListItem(item)),
    '',
    '## Checklist',
    ...report.summary.checklist.map((item) => `- ${escapeMarkdownText(item)}`),
  ];

  return lines.join('\n').trim();
}

function buildPackReport(pack, index) {
  const report = analyzeIncidentPack(pack.content);
  const runnable = report.availableAnalyses.length > 0;
  const priorityReasons = runnable ? buildRunnableReasons(report) : buildUnrunnableReasons(report);

  return {
    ...pack,
    index,
    report,
    runnable,
    priorityScore: runnable ? scorePack(report) : -1,
    priorityReasons,
    summary: report.summary,
  };
}

function comparePackReports(left, right) {
  return right.priorityScore - left.priorityScore
    || compareSignalCounts(right.report.casebook?.summary.novelCount ?? 0, left.report.casebook?.summary.novelCount ?? 0)
    || compareSignalCounts(right.report.regression?.summary.newCount ?? 0, left.report.regression?.summary.newCount ?? 0)
    || compareSignalCounts(right.report.regression?.summary.volumeUpCount ?? 0, left.report.regression?.summary.volumeUpCount ?? 0)
    || compareSignalCounts(right.report.timeline?.summary.newCount ?? 0, left.report.timeline?.summary.newCount ?? 0)
    || compareSignalCounts(right.report.timeline?.summary.risingCount ?? 0, left.report.timeline?.summary.risingCount ?? 0)
    || left.index - right.index
    || left.label.localeCompare(right.label);
}

function compareSignalCounts(left, right) {
  return left - right;
}

function scorePack(report) {
  return (report.casebook?.summary.novelCount ?? 0) * 1000
    + (report.regression?.summary.newCount ?? 0) * 300
    + (report.regression?.summary.volumeUpCount ?? 0) * 225
    + (report.timeline?.summary.newCount ?? 0) * 200
    + (report.timeline?.summary.risingCount ?? 0) * 150
    + (report.currentDigest?.groupCount ?? 0) * 25
    + (report.currentDigest?.totalTraces ?? 0) * 10
    + report.availableAnalyses.length;
}

function buildRunnableReasons(report) {
  const reasons = [];

  if ((report.casebook?.summary.novelCount ?? 0) > 0) {
    reasons.push(`it contains ${report.casebook.summary.novelCount} novel casebook incident${report.casebook.summary.novelCount === 1 ? '' : 's'}`);
  }

  if ((report.regression?.summary.newCount ?? 0) > 0) {
    reasons.push(`it introduces ${report.regression.summary.newCount} new regression incident${report.regression.summary.newCount === 1 ? '' : 's'}`);
  }

  if ((report.regression?.summary.volumeUpCount ?? 0) > 0) {
    reasons.push(`it shows ${report.regression.summary.volumeUpCount} volume-up regression incident${report.regression.summary.volumeUpCount === 1 ? '' : 's'}`);
  }

  if ((report.timeline?.summary.newCount ?? 0) > 0) {
    reasons.push(`it surfaces ${report.timeline.summary.newCount} new timeline incident${report.timeline.summary.newCount === 1 ? '' : 's'}`);
  }

  if ((report.timeline?.summary.risingCount ?? 0) > 0) {
    reasons.push(`it has ${report.timeline.summary.risingCount} rising timeline incident${report.timeline.summary.risingCount === 1 ? '' : 's'}`);
  }

  if (report.currentDigest) {
    reasons.push(`its current digest has ${report.currentDigest.groupCount} incident group${report.currentDigest.groupCount === 1 ? '' : 's'} across ${report.currentDigest.totalTraces} trace${report.currentDigest.totalTraces === 1 ? '' : 's'}`);
  }

  return reasons.length ? reasons : ['it has runnable incident-pack analyses'];
}

function buildUnrunnableReasons(report) {
  if (report.omissions.length) {
    return [...report.omissions];
  }

  return ['it does not contain any supported runnable incident-pack sections yet'];
}

function buildChecklist({ priorityQueue, recurringIncidents, recurringHotspots, packReports }) {
  const checklist = [];
  const topPack = priorityQueue[0] ?? null;

  if (topPack) {
    checklist.push(`Start with ${topPack.label} because it ranks first in the portfolio queue.`);
  }

  if (recurringIncidents.length) {
    checklist.push('Check the recurring cross-pack signatures next so one shared failure does not fragment the triage effort.');
  }

  if (recurringHotspots.length) {
    checklist.push('Inspect the shared hotspot files because they may explain several packs at once.');
  }

  if (sumBy(packReports, (item) => item.report.casebook?.summary.novelCount ?? 0) > 0) {
    checklist.push('Confirm novel casebook incidents before assuming every pack is just a repeat of known failures.');
  }

  if (sumBy(packReports, (item) => item.report.regression?.summary.newCount ?? 0) > 0) {
    checklist.push('Review candidate-only regression incidents before widening the rollout or release exposure.');
  }

  if (sumBy(packReports, (item) => item.report.timeline?.summary.risingCount ?? 0) > 0) {
    checklist.push('Compare early and late rollout snapshots for incidents that climbed across labeled timeline steps.');
  }

  if (!checklist.length && packReports.some((item) => !item.runnable)) {
    checklist.push('Fill the missing incident-pack sections called out in unrunnable packs, then rerun Portfolio Radar.');
  }

  return [...new Set(checklist)].slice(0, 5);
}

function collectRecurringIncidents(packReports) {
  const signatures = new Map();

  for (const packReport of packReports) {
    if (!packReport.runnable || !packReport.report.currentDigest?.groups?.length) {
      continue;
    }

    const packSignatures = new Set(packReport.report.currentDigest.groups.map((group) => group.signature).filter(Boolean));
    for (const signature of packSignatures) {
      const entry = signatures.get(signature) ?? { signature, labels: [] };
      entry.labels.push(packReport.label);
      signatures.set(signature, entry);
    }
  }

  return [...signatures.values()]
    .map((entry) => ({
      signature: entry.signature,
      labels: entry.labels,
      packCount: entry.labels.length,
    }))
    .filter((entry) => entry.packCount >= 2)
    .sort((left, right) => right.packCount - left.packCount || left.signature.localeCompare(right.signature));
}

function collectRecurringHotspots(packReports) {
  const hotspots = new Map();

  for (const packReport of packReports) {
    if (!packReport.runnable) {
      continue;
    }

    const packHotspots = new Map();
    for (const hotspot of collectPackHotspots(packReport.report)) {
      const existing = packHotspots.get(hotspot.label) ?? { label: hotspot.label, score: 0 };
      existing.score = Math.max(existing.score, hotspot.score ?? 0);
      packHotspots.set(hotspot.label, existing);
    }

    for (const hotspot of packHotspots.values()) {
      const entry = hotspots.get(hotspot.label) ?? { label: hotspot.label, labels: [], maxScore: 0 };
      entry.labels.push(packReport.label);
      entry.maxScore = Math.max(entry.maxScore, hotspot.score ?? 0);
      hotspots.set(hotspot.label, entry);
    }
  }

  return [...hotspots.values()]
    .map((entry) => ({
      label: entry.label,
      labels: entry.labels,
      packCount: entry.labels.length,
      maxScore: entry.maxScore,
    }))
    .filter((entry) => entry.packCount >= 2)
    .sort((left, right) => right.packCount - left.packCount || right.maxScore - left.maxScore || left.label.localeCompare(right.label));
}

function collectPackHotspots(report) {
  return [
    ...(report.currentDigest?.hotspots ?? []),
    ...(report.regression?.candidateDigest?.hotspots ?? []),
    ...(report.timeline?.snapshots?.at(-1)?.digest?.hotspots ?? []),
  ].filter((hotspot) => hotspot?.label);
}

function formatPriorityQueue(priorityQueue) {
  if (!priorityQueue.length) {
    return ['- None'];
  }

  return priorityQueue.slice(0, 5).map((item, index) => `- ${index + 1}. ${item.label}: ${item.priorityReasons.join('; ')}`);
}

function formatRecurringIncidents(recurringIncidents) {
  if (!recurringIncidents.length) {
    return ['- None'];
  }

  return recurringIncidents.map((item) => `- ${item.packCount} packs: ${item.labels.join(', ')} (${item.signature})`);
}

function formatRecurringHotspots(recurringHotspots) {
  if (!recurringHotspots.length) {
    return ['- None'];
  }

  return recurringHotspots.map((item) => `- ${item.packCount} packs: ${item.label} (${item.labels.join(', ')})`);
}

function emptyPortfolio(source = '') {
  return {
    source,
    packOrder: [],
    packs: [],
  };
}

function sumBy(items, mapper) {
  return items.reduce((total, item) => total + mapper(item), 0);
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}

function escapeMarkdownListItem(value) {
  return value.startsWith('- ')
    ? `- ${escapeMarkdownText(value.slice(2))}`
    : `- ${escapeMarkdownText(value)}`;
}

export function summarizePortfolioPrimaryCulprit(report) {
  const topPack = report?.priorityQueue?.[0] ?? null;
  const primaryIncident = selectPrimaryPortfolioIncident(topPack);
  return formatFrame(primaryIncident?.representative?.culpritFrame ?? null);
}

export function selectPrimaryPortfolioIncident(packReport) {
  if (!packReport?.report) {
    return null;
  }

  const briefing = packReport.report;
  if ((briefing.casebook?.summary.novelCount ?? 0) > 0) {
    return briefing.casebook?.incidents[0] ?? null;
  }
  if ((briefing.regression?.summary.newCount ?? 0) > 0 || (briefing.regression?.summary.volumeUpCount ?? 0) > 0) {
    return briefing.regression?.incidents[0] ?? null;
  }
  if ((briefing.timeline?.summary.newCount ?? 0) > 0 || (briefing.timeline?.summary.risingCount ?? 0) > 0) {
    return briefing.timeline?.incidents[0] ?? null;
  }
  if (briefing.currentDigest?.groups?.length) {
    return briefing.currentDigest.groups[0];
  }
  return briefing.casebook?.incidents[0] ?? briefing.regression?.incidents[0] ?? briefing.timeline?.incidents[0] ?? null;
}
