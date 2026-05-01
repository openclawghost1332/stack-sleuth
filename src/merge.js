import { analyzeIncidentPortfolio } from './portfolio.js';
import { analyzeCasebookForge } from './forge.js';
import {
  buildCasebookSteward,
  renderCasebookStewardMarkdown,
  renderCasebookStewardText,
} from './steward.js';

const GUIDANCE_KEYS = ['summary', 'fix', 'owner', 'runbook'];
const EXPORT_METADATA_KEYS = [...GUIDANCE_KEYS, 'seen-count', 'source-packs'];

export function analyzeCasebookMerge(input) {
  const portfolioReport = input?.priorityQueue ? input : analyzeIncidentPortfolio(input);
  const forgeReport = analyzeCasebookForge(portfolioReport);
  const historicalBySignature = collectHistoricalCasesBySignature(portfolioReport.packReports ?? []);
  const mergedBySignature = new Map();

  for (const [signature, historicalMatches] of historicalBySignature.entries()) {
    mergedBySignature.set(signature, {
      signature,
      forgedCase: null,
      historicalMatches,
    });
  }

  for (const forgedCase of forgeReport.cases ?? []) {
    const existing = mergedBySignature.get(forgedCase.signature) ?? {
      signature: forgedCase.signature,
      forgedCase: null,
      historicalMatches: [],
    };
    existing.forgedCase = forgedCase;
    mergedBySignature.set(forgedCase.signature, existing);
  }

  const labels = new Set();
  const cases = [...mergedBySignature.values()]
    .map((entry) => buildMergedCase(entry))
    .sort(compareMergedCases)
    .map((entry) => ({
      ...entry,
      label: assignUniqueLabel(entry.label, labels),
    }));

  const summary = buildSummary(cases, portfolioReport.summary?.runnablePackCount ?? 0);
  const steward = buildCasebookSteward({ cases });

  return {
    portfolio: portfolioReport.portfolio,
    priorityQueue: portfolioReport.priorityQueue,
    cases,
    steward,
    summary,
    exportText: renderMergedExport(cases),
  };
}

export function renderCasebookMergeTextSummary(report) {
  const lines = [
    'Stack Sleuth Casebook Merge',
    `Merged cases: ${report.summary.mergedCaseCount}`,
    `Existing cases: ${report.summary.existingCaseCount}`,
    `New cases: ${report.summary.newCaseCount}`,
    `Updated cases: ${report.summary.updatedCaseCount}`,
    `Historical-only cases: ${report.summary.historicalOnlyCaseCount}`,
    `Conflicts: ${report.summary.conflictCount}`,
    `Headline: ${report.summary.headline}`,
    `Review: ${report.summary.reviewHeadline}`,
    '',
    'Merge review',
  ];

  if (!report.cases.some((entry) => entry.conflicts.length)) {
    lines.push('- No conflicts detected.');
  } else {
    for (const entry of report.cases.filter((item) => item.conflicts.length)) {
      lines.push(`- ${entry.label}: ${entry.conflicts.join('; ')}`);
    }
  }

  lines.push('', ...renderCasebookStewardText(report.steward ?? buildCasebookSteward({ cases: report.cases })).split('\n'));

  return lines.join('\n').trim();
}

export function renderCasebookMergeMarkdownSummary(report) {
  const lines = [
    '# Stack Sleuth Casebook Merge',
    '',
    `- **Merged cases:** ${report.summary.mergedCaseCount}`,
    `- **Existing cases:** ${report.summary.existingCaseCount}`,
    `- **New cases:** ${report.summary.newCaseCount}`,
    `- **Updated cases:** ${report.summary.updatedCaseCount}`,
    `- **Historical-only cases:** ${report.summary.historicalOnlyCaseCount}`,
    `- **Conflicts:** ${report.summary.conflictCount}`,
    `- **Headline:** ${escapeMarkdownText(report.summary.headline)}`,
    `- **Review:** ${escapeMarkdownText(report.summary.reviewHeadline)}`,
    '',
    '## Merge review',
  ];

  if (!report.cases.some((entry) => entry.conflicts.length)) {
    lines.push('- No conflicts detected.');
  } else {
    for (const entry of report.cases.filter((item) => item.conflicts.length)) {
      lines.push(`- **${escapeMarkdownText(entry.label)}:** ${escapeMarkdownText(entry.conflicts.join('; '))}`);
    }
  }

  lines.push('', renderCasebookStewardMarkdown(report.steward ?? buildCasebookSteward({ cases: report.cases })));

  return lines.join('\n').trim();
}

function collectHistoricalCasesBySignature(packReports) {
  const historicalBySignature = new Map();

  for (const packReport of packReports) {
    for (const historicalCase of packReport.report.casebook?.historicalCases ?? []) {
      for (const group of historicalCase.digest?.groups ?? []) {
        const existing = historicalBySignature.get(group.signature) ?? [];
        existing.push({
          label: historicalCase.label,
          metadata: historicalCase.metadata ?? {},
          representative: group.representative,
          historyIndex: historicalCase.historyIndex ?? Number.MAX_SAFE_INTEGER,
        });
        historicalBySignature.set(group.signature, existing);
      }
    }
  }

  for (const matches of historicalBySignature.values()) {
    matches.sort((left, right) => left.historyIndex - right.historyIndex || left.label.localeCompare(right.label));
  }

  return historicalBySignature;
}

function buildMergedCase({ signature, forgedCase, historicalMatches }) {
  const conflicts = [];
  const labelChoices = [...new Set(historicalMatches.map((item) => item.label).filter(Boolean))];
  if (labelChoices.length > 1) {
    conflicts.push(`label conflict: ${labelChoices.join(', ')}`);
  }

  const metadata = {};
  for (const key of GUIDANCE_KEYS) {
    const values = [...new Set(historicalMatches.map((item) => String(item.metadata?.[key] ?? '').trim()).filter(Boolean))];
    if (values.length > 1) {
      conflicts.push(`${key} conflict: ${values.join(' vs ')}`);
    }
    if (values[0]) {
      metadata[key] = values[0];
    }
  }

  const representative = forgedCase?.representative ?? historicalMatches[0]?.representative ?? null;
  if (!metadata.summary) {
    const generatedSummary = representative?.diagnosis?.summary?.trim();
    if (generatedSummary) {
      metadata.summary = generatedSummary;
    }
  }

  const sourcePacks = [...new Set(forgedCase?.sourcePacks ?? [])];
  if (sourcePacks.length) {
    metadata['seen-count'] = String(sourcePacks.length);
    metadata['source-packs'] = sourcePacks.join(', ');
  }

  return {
    signature,
    label: labelChoices[0] ?? forgedCase?.label ?? 'merged-case',
    representative,
    sourcePacks,
    metadata,
    conflicts,
    isExisting: historicalMatches.length > 0,
    isUpdated: historicalMatches.length > 0 && sourcePacks.length > 0,
    isNew: historicalMatches.length === 0 && sourcePacks.length > 0,
    isHistoricalOnly: historicalMatches.length > 0 && sourcePacks.length === 0,
  };
}

function compareMergedCases(left, right) {
  return Number(right.isUpdated) - Number(left.isUpdated)
    || Number(right.isExisting) - Number(left.isExisting)
    || right.sourcePacks.length - left.sourcePacks.length
    || right.conflicts.length - left.conflicts.length
    || left.label.localeCompare(right.label)
    || left.signature.localeCompare(right.signature);
}

function buildSummary(cases, runnablePackCount) {
  const mergedCaseCount = cases.length;
  const existingCaseCount = cases.filter((entry) => entry.isExisting).length;
  const newCaseCount = cases.filter((entry) => entry.isNew).length;
  const updatedCaseCount = cases.filter((entry) => entry.isUpdated).length;
  const historicalOnlyCaseCount = cases.filter((entry) => entry.isHistoricalOnly).length;
  const conflictCount = cases.filter((entry) => entry.conflicts.length).length;

  return {
    mergedCaseCount,
    existingCaseCount,
    newCaseCount,
    updatedCaseCount,
    historicalOnlyCaseCount,
    conflictCount,
    headline: `Merged ${mergedCaseCount} casebook entr${mergedCaseCount === 1 ? 'y' : 'ies'} from ${runnablePackCount} runnable pack${runnablePackCount === 1 ? '' : 's'}, including ${newCaseCount} new case${newCaseCount === 1 ? '' : 's'} and ${updatedCaseCount} refreshed known case${updatedCaseCount === 1 ? '' : 's'}.`,
    reviewHeadline: conflictCount
      ? `${conflictCount} conflicted case${conflictCount === 1 ? '' : 's'} requires review.`
      : 'No merge conflicts detected.',
  };
}

function renderMergedExport(cases) {
  return cases
    .map((entry) => {
      const metadataLines = EXPORT_METADATA_KEYS
        .filter((key) => entry.metadata[key])
        .map((key) => `>>> ${key}: ${entry.metadata[key]}`);
      return [
        `=== ${entry.label} ===`,
        ...metadataLines,
        renderRepresentativeTrace(entry.representative),
      ].join('\n');
    })
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

function assignUniqueLabel(baseLabel, labels) {
  const normalized = slugify(baseLabel) || 'merged-case';
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
