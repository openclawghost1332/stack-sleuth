import { analyzeIncidentPortfolio } from './portfolio.js';

export function analyzeCasebookForge(input) {
  const portfolioReport = input?.priorityQueue ? input : analyzeIncidentPortfolio(input);
  const forgedCases = buildForgedCases(portfolioReport);

  return {
    portfolio: portfolioReport.portfolio,
    priorityQueue: portfolioReport.priorityQueue,
    cases: forgedCases,
    exportText: renderForgedExport(forgedCases),
    summary: buildForgeSummary(portfolioReport, forgedCases),
  };
}

export function renderCasebookForgeTextSummary(report) {
  return [
    'Stack Sleuth Casebook Forge',
    `Runnable packs: ${report.summary.runnablePackCount}`,
    `Reusable cases: ${report.summary.caseCount}`,
    `Headline: ${report.summary.headline}`,
    '',
    'Forged cases',
    ...report.cases.map((entry) => `- ${entry.label}: ${entry.sourcePacks.length} pack${entry.sourcePacks.length === 1 ? '' : 's'}, signature ${entry.signature}`),
  ].join('\n').trim();
}

export function renderCasebookForgeMarkdownSummary(report) {
  return [
    '# Stack Sleuth Casebook Forge',
    '',
    `- **Runnable packs:** ${report.summary.runnablePackCount}`,
    `- **Reusable cases:** ${report.summary.caseCount}`,
    `- **Headline:** ${escapeMarkdownText(report.summary.headline)}`,
    '',
    '## Forged cases',
    ...report.cases.map((entry) => `- **${escapeMarkdownText(entry.label)}:** ${entry.sourcePacks.length} pack${entry.sourcePacks.length === 1 ? '' : 's'}, signature \`${escapeMarkdownText(entry.signature)}\``),
  ].join('\n').trim();
}

function buildForgedCases(portfolioReport) {
  const casesBySignature = new Map();
  const packOrder = new Map((portfolioReport.portfolio?.packOrder ?? []).map((label, index) => [label, index]));

  for (const pack of portfolioReport.priorityQueue ?? []) {
    collectCurrentDigestCases(casesBySignature, pack);
    collectRegressionCases(casesBySignature, pack);
    collectTimelineCases(casesBySignature, pack);
  }

  const labels = new Set();
  return [...casesBySignature.values()]
    .sort(compareForgedCases)
    .map((entry) => ({
      ...entry,
      sourcePacks: [...entry.sourcePacks].sort((left, right) => (packOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (packOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right)),
      matchedHistoryLabels: [...entry.matchedHistoryLabels],
      label: assignUniqueLabel(selectPreferredLabel(entry), labels),
    }));
}

function collectCurrentDigestCases(casesBySignature, pack) {
  for (const group of pack.report.currentDigest?.groups ?? []) {
    const matchingCases = pack.report.casebook?.incidents.find((incident) => incident.signature === group.signature)?.matchingCases ?? [];
    upsertForgedCase(casesBySignature, {
      pack,
      signature: group.signature,
      representative: group.representative,
      matchedHistoryLabels: matchingCases,
      firstSeenIndex: group.firstSeenIndex,
    });
  }
}

function collectRegressionCases(casesBySignature, pack) {
  for (const incident of pack.report.regression?.incidents ?? []) {
    if (incident.candidateCount <= 0 || !incident.representative) {
      continue;
    }

    upsertForgedCase(casesBySignature, {
      pack,
      signature: incident.signature,
      representative: incident.representative,
      matchedHistoryLabels: [],
      firstSeenIndex: incident.firstSeenIndex,
    });
  }
}

function collectTimelineCases(casesBySignature, pack) {
  for (const incident of pack.report.timeline?.incidents ?? []) {
    if (incident.latestCount <= 0 || !incident.representative) {
      continue;
    }

    upsertForgedCase(casesBySignature, {
      pack,
      signature: incident.signature,
      representative: incident.representative,
      matchedHistoryLabels: [],
      firstSeenIndex: Number.MAX_SAFE_INTEGER,
    });
  }
}

function upsertForgedCase(casesBySignature, candidate) {
  const existing = casesBySignature.get(candidate.signature);
  if (existing) {
    existing.sourcePacks.add(candidate.pack.label);
    for (const label of candidate.matchedHistoryLabels) {
      existing.matchedHistoryLabels.add(label);
    }
    if (candidate.firstSeenIndex < existing.firstSeenIndex) {
      existing.firstSeenIndex = candidate.firstSeenIndex;
    }
    return;
  }

  casesBySignature.set(candidate.signature, {
    signature: candidate.signature,
    representative: candidate.representative,
    sourcePacks: new Set([candidate.pack.label]),
    matchedHistoryLabels: new Set(candidate.matchedHistoryLabels),
    firstSeenIndex: candidate.firstSeenIndex,
  });
}

function compareForgedCases(left, right) {
  return right.sourcePacks.size - left.sourcePacks.size
    || right.matchedHistoryLabels.size - left.matchedHistoryLabels.size
    || left.firstSeenIndex - right.firstSeenIndex
    || left.signature.localeCompare(right.signature);
}

function selectPreferredLabel(entry) {
  const knownLabel = [...entry.matchedHistoryLabels][0];
  if (knownLabel) {
    return knownLabel;
  }

  return buildFallbackLabel(entry.representative);
}

function buildFallbackLabel(representative) {
  const culpritFile = String(representative?.culpritFrame?.file ?? 'unknown-path')
    .split('/')
    .filter(Boolean)
    .at(-1) ?? 'unknown-path';
  const tag = representative?.diagnosis?.tags?.[0] ?? 'generic-runtime-error';
  return slugify(`${culpritFile.replace(/\./g, '-')}-${tag}`);
}

function assignUniqueLabel(baseLabel, labels) {
  const normalized = slugify(baseLabel) || 'forged-case';
  if (!labels.has(normalized)) {
    labels.add(normalized);
    return normalized;
  }

  let suffix = 2;
  while (labels.has(`${normalized}-${suffix}`)) {
    suffix += 1;
  }

  const unique = `${normalized}-${suffix}`;
  labels.add(unique);
  return unique;
}

function buildForgeSummary(portfolioReport, forgedCases) {
  return {
    runnablePackCount: portfolioReport.summary?.runnablePackCount ?? 0,
    caseCount: forgedCases.length,
    headline: forgedCases.length
      ? `Forged ${forgedCases.length} reusable case${forgedCases.length === 1 ? '' : 's'} from ${portfolioReport.summary?.runnablePackCount ?? 0} runnable pack${(portfolioReport.summary?.runnablePackCount ?? 0) === 1 ? '' : 's'}.`
      : 'No reusable cases could be forged from this portfolio.',
  };
}

function renderForgedExport(forgedCases) {
  return forgedCases
    .map((entry) => `=== ${entry.label} ===\n${renderRepresentativeTrace(entry.representative)}`)
    .join('\n\n')
    .trim();
}

function renderRepresentativeTrace(report) {
  const frames = report?.frames ?? [];
  if (report?.runtime === 'python') {
    return [
      'Traceback (most recent call last):',
      ...[...frames].reverse().map((frame) => `  File "${frame.file}", line ${frame.line}, in ${frame.functionName ?? '<module>'}`),
      `${report.errorName}: ${report.message}`,
    ].join('\n');
  }

  if (report?.runtime === 'ruby') {
    return frames
      .map((frame, index) => `${index === 0 ? '' : '\tfrom '}${frame.file}:${frame.line}:in \
\`${frame.functionName ?? '<main>'}\`${index === 0 ? `: ${report.message} (${report.errorName})` : ''}`)
      .join('\n');
  }

  return [
    `${report?.errorName ?? 'Error'}: ${report?.message ?? ''}`,
    ...frames.map((frame) => `    at ${frame.functionName ? `${frame.functionName} ` : ''}(${frame.file}:${frame.line}:${frame.column ?? 1})`),
  ].join('\n');
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeMarkdownText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}
