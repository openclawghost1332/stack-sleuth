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
    .sort((left, right) => right.priorityScore - left.priorityScore || left.index - right.index || left.label.localeCompare(right.label));
  const recurringIncidents = collectRecurringIncidents(packReports);
  const topPack = priorityQueue[0] ?? null;

  return {
    portfolio,
    packReports,
    priorityQueue,
    recurringIncidents,
    summary: {
      packCount: packReports.length,
      runnablePackCount: priorityQueue.length,
      unrunnablePackCount: packReports.length - priorityQueue.length,
      headline: topPack
        ? `Prioritize ${topPack.label} first because ${topPack.priorityReasons[0]}.`
        : 'No runnable incident packs were found in this portfolio.',
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
    '',
    'Priority queue',
    ...formatPriorityQueue(report.priorityQueue),
    '',
    'Recurring incidents',
    ...formatRecurringIncidents(report.recurringIncidents),
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

function scorePack(report) {
  return (report.casebook?.summary.novelCount ?? 0) * 400
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

function collectRecurringIncidents(packReports) {
  const signatures = new Map();

  for (const packReport of packReports) {
    if (!packReport.runnable) {
      continue;
    }

    const packSignatures = new Set(collectPackSignatures(packReport.report));
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

function collectPackSignatures(report) {
  return [
    ...(report.currentDigest?.groups ?? []).map((group) => group.signature),
    ...(report.casebook?.incidents ?? []).map((incident) => incident.signature),
    ...(report.regression?.incidents ?? []).map((incident) => incident.signature),
    ...(report.timeline?.incidents ?? []).map((incident) => incident.signature),
  ].filter(Boolean);
}

function formatPriorityQueue(priorityQueue) {
  if (!priorityQueue.length) {
    return ['- None'];
  }

  return priorityQueue.map((item, index) => `- ${index + 1}. ${item.label}: ${item.priorityReasons.join('; ')}`);
}

function formatRecurringIncidents(recurringIncidents) {
  if (!recurringIncidents.length) {
    return ['- None'];
  }

  return recurringIncidents.map((item) => `- ${item.packCount} packs: ${item.labels.join(', ')} (${item.signature})`);
}

function emptyPortfolio(source = '') {
  return {
    source,
    packOrder: [],
    packs: [],
  };
}
