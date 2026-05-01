import { analyzeIncidentPortfolio } from './portfolio.js';
import { analyzeCasebookMerge } from './merge.js';
import { parseLabeledTraceBatches } from './labeled.js';
import { buildActionBoard } from './action-board.js';
import {
  normalizeReleaseGate,
  renderReleaseGateMarkdown,
  renderReleaseGateText,
} from './gate.js';
import {
  normalizeCasebookSteward,
  renderCasebookStewardMarkdown,
  renderCasebookStewardText,
} from './steward.js';

export const DATASET_KIND = 'stack-sleuth-casebook-dataset';
export const DATASET_VERSION = 2;
const SUPPORTED_DATASET_VERSIONS = new Set([1, DATASET_VERSION]);

export function buildCasebookDataset(input) {
  const portfolioReport = input?.priorityQueue ? input : analyzeIncidentPortfolio(input);
  const mergeReport = analyzeCasebookMerge(portfolioReport);

  const dataset = {
    kind: DATASET_KIND,
    version: DATASET_VERSION,
    summary: buildDatasetSummary(portfolioReport, mergeReport),
    gate: normalizeReleaseGate(portfolioReport.gate, {
      ...portfolioReport.summary,
      recurringIncidentCount: portfolioReport.recurringIncidents?.length ?? 0,
      recurringHotspotCount: portfolioReport.recurringHotspots?.length ?? 0,
    }),
    portfolio: {
      packOrder: portfolioReport.portfolio?.packOrder ?? [],
    },
    responseQueue: portfolioReport.responseQueue ?? [],
    routingGaps: portfolioReport.unownedPacks ?? [],
    runbookGaps: portfolioReport.runbookGaps ?? [],
    recurringIncidents: portfolioReport.recurringIncidents ?? [],
    recurringHotspots: portfolioReport.recurringHotspots ?? [],
    cases: (mergeReport.cases ?? []).map((entry) => ({
      label: entry.label,
      signature: entry.signature,
      sourcePacks: entry.sourcePacks,
      metadata: entry.metadata,
      conflicts: entry.conflicts,
    })),
    steward: mergeReport.steward,
    exportText: mergeReport.exportText,
  };

  dataset.board = buildActionBoard(dataset);
  return dataset;
}

export function parseDatasetHistory(input) {
  const result = inspectDatasetHistoryInput(input);
  if (!result.valid) {
    return null;
  }

  return result.history;
}

export function inspectDatasetHistoryInput(input) {
  const result = inspectReplayDatasetInput(input);
  if (!result.valid) {
    return result;
  }

  if (!result.dataset.exportText.trim()) {
    return { valid: false, reason: 'missing-export-text', parsed: result.parsed };
  }

  return {
    valid: true,
    parsed: result.parsed,
    dataset: result.dataset,
    history: parseLabeledTraceBatches(result.dataset.exportText),
  };
}

export function inspectReplayDatasetInput(input) {
  const parsedInput = parseDatasetInput(input);
  if (!parsedInput.valid) {
    return { valid: false, reason: parsedInput.reason };
  }

  const parsed = parsedInput.parsed;

  if (parsed.kind !== DATASET_KIND) {
    return { valid: false, reason: 'wrong-kind', parsed };
  }

  if (!SUPPORTED_DATASET_VERSIONS.has(parsed.version)) {
    return {
      valid: false,
      reason: 'unsupported-version',
      parsed,
      supportedVersions: [...SUPPORTED_DATASET_VERSIONS].sort((a, b) => a - b),
      supportedVersion: DATASET_VERSION,
    };
  }

  return {
    valid: true,
    parsed,
    dataset: normalizeDataset(parsed),
  };
}

export function renderDatasetTextSummary(report) {
  return [
    'Stack Sleuth Casebook Dataset',
    report.summary.headline,
    `Portfolio packs: ${report.summary.packCount}`,
    `Runnable packs: ${report.summary.runnablePackCount}`,
    `Response owners: ${report.summary.ownerCount}`,
    `Merged cases: ${report.summary.mergedCaseCount}`,
    `Conflicts: ${report.summary.conflictCount}`,
    `Action Board cards: ${report.board?.summary?.totalCards ?? 0}`,
    '',
    'Release gate',
    ...renderReleaseGateText(report.gate).split('\n'),
    '',
    ...renderCasebookStewardText(report.steward).split('\n'),
    '',
    'Reusable casebook export',
    report.exportText,
  ].join('\n').trim();
}

export function renderDatasetMarkdownSummary(report) {
  return [
    '# Stack Sleuth Casebook Dataset',
    '',
    `- **Headline:** ${report.summary.headline}`,
    `- **Portfolio packs:** ${report.summary.packCount}`,
    `- **Runnable packs:** ${report.summary.runnablePackCount}`,
    `- **Response owners:** ${report.summary.ownerCount}`,
    `- **Merged cases:** ${report.summary.mergedCaseCount}`,
    `- **Conflicts:** ${report.summary.conflictCount}`,
    `- **Action Board cards:** ${report.board?.summary?.totalCards ?? 0}`,
    '',
    '## Release gate',
    renderReleaseGateMarkdown(report.gate),
    '',
    renderCasebookStewardMarkdown(report.steward),
    '',
    '## Reusable casebook export',
    '```text',
    report.exportText,
    '```',
  ].join('\n').trim();
}

function parseDatasetInput(input) {
  if (!input || typeof input === 'number' || typeof input === 'boolean') {
    return { valid: false, reason: 'not-dataset' };
  }

  if (typeof input === 'string') {
    const source = input.trim();
    if (!source.startsWith('{')) {
      return { valid: false, reason: 'not-dataset' };
    }

    try {
      return { valid: true, parsed: JSON.parse(source) };
    } catch {
      return {
        valid: false,
        reason: source.includes(DATASET_KIND) ? 'invalid-json' : 'not-dataset',
      };
    }
  }

  return typeof input === 'object'
    ? { valid: true, parsed: input }
    : { valid: false, reason: 'not-dataset' };
}

function buildDatasetSummary(portfolioReport, mergeReport) {
  const packCount = portfolioReport.summary?.packCount ?? portfolioReport.packReports?.length ?? 0;
  const runnablePackCount = portfolioReport.summary?.runnablePackCount ?? portfolioReport.priorityQueue?.length ?? 0;
  const mergedCaseCount = mergeReport.summary?.mergedCaseCount ?? mergeReport.cases?.length ?? 0;
  const conflictCount = mergeReport.summary?.conflictCount ?? 0;
  const ownerCount = portfolioReport.responseQueue?.length ?? 0;

  return {
    headline: `Casebook Dataset captured ${mergedCaseCount} merged case${mergedCaseCount === 1 ? '' : 's'} from ${packCount} pack${packCount === 1 ? '' : 's'}.`,
    packCount,
    runnablePackCount,
    mergedCaseCount,
    conflictCount,
    portfolioHeadline: portfolioReport.summary?.headline ?? 'No portfolio headline available.',
    mergeHeadline: mergeReport.summary?.headline ?? 'No merge headline available.',
    ownerCount,
  };
}

function normalizeDataset(parsed) {
  const fallbackSignals = {
    totalNovelIncidents: 0,
    totalRegressionNew: 0,
    totalRegressionVolumeUp: 0,
    unownedPackCount: Math.max(0, toCount(parsed.summary?.runnablePackCount) - toCount(parsed.summary?.ownerCount)),
    runbookGapCount: 0,
    totalTimelineNew: 0,
    totalTimelineRising: 0,
    recurringHotspotCount: Array.isArray(parsed.recurringHotspots) ? parsed.recurringHotspots.length : 0,
    recurringIncidentCount: Array.isArray(parsed.recurringIncidents) ? parsed.recurringIncidents.length : 0,
    runnablePackCount: toCount(parsed.summary?.runnablePackCount),
    unrunnablePackCount: Math.max(0, toCount(parsed.summary?.packCount) - toCount(parsed.summary?.runnablePackCount)),
  };

  const dataset = {
    kind: DATASET_KIND,
    version: toCount(parsed.version) || 1,
    summary: {
      headline: String(parsed.summary?.headline ?? 'No dataset headline available.'),
      packCount: toCount(parsed.summary?.packCount),
      runnablePackCount: toCount(parsed.summary?.runnablePackCount),
      mergedCaseCount: toCount(parsed.summary?.mergedCaseCount),
      conflictCount: toCount(parsed.summary?.conflictCount),
      portfolioHeadline: String(parsed.summary?.portfolioHeadline ?? 'No portfolio headline available.'),
      mergeHeadline: String(parsed.summary?.mergeHeadline ?? 'No merge headline available.'),
      ownerCount: toCount(parsed.summary?.ownerCount),
    },
    portfolio: {
      packOrder: Array.isArray(parsed.portfolio?.packOrder) ? parsed.portfolio.packOrder : [],
    },
    responseQueue: Array.isArray(parsed.responseQueue) ? parsed.responseQueue : [],
    routingGaps: Array.isArray(parsed.routingGaps) ? parsed.routingGaps : [],
    runbookGaps: Array.isArray(parsed.runbookGaps) ? parsed.runbookGaps : [],
    recurringIncidents: Array.isArray(parsed.recurringIncidents) ? parsed.recurringIncidents : [],
    recurringHotspots: Array.isArray(parsed.recurringHotspots) ? parsed.recurringHotspots : [],
    cases: Array.isArray(parsed.cases) ? parsed.cases : [],
    gate: normalizeReleaseGate(parsed.gate, fallbackSignals),
    steward: normalizeCasebookSteward(parsed.steward, {
      cases: Array.isArray(parsed.cases) ? parsed.cases : [],
    }),
    exportText: typeof parsed.exportText === 'string' ? parsed.exportText : '',
  };

  dataset.board = buildActionBoard(dataset);
  return dataset;
}

function toCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
