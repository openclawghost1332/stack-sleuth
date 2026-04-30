import { analyzeIncidentPortfolio } from './portfolio.js';
import { analyzeCasebookMerge } from './merge.js';
import { parseLabeledTraceBatches } from './labeled.js';

const DATASET_KIND = 'stack-sleuth-casebook-dataset';
const DATASET_VERSION = 1;

export function buildCasebookDataset(input) {
  const portfolioReport = input?.priorityQueue ? input : analyzeIncidentPortfolio(input);
  const mergeReport = analyzeCasebookMerge(portfolioReport);

  return {
    kind: DATASET_KIND,
    version: DATASET_VERSION,
    summary: buildDatasetSummary(portfolioReport, mergeReport),
    portfolio: {
      packOrder: portfolioReport.portfolio?.packOrder ?? [],
    },
    responseQueue: portfolioReport.responseQueue ?? [],
    recurringIncidents: portfolioReport.recurringIncidents ?? [],
    recurringHotspots: portfolioReport.recurringHotspots ?? [],
    cases: (mergeReport.cases ?? []).map((entry) => ({
      label: entry.label,
      signature: entry.signature,
      sourcePacks: entry.sourcePacks,
      metadata: entry.metadata,
      conflicts: entry.conflicts,
    })),
    exportText: mergeReport.exportText,
  };
}

export function parseDatasetHistory(input) {
  const parsed = parseDatasetInput(input);
  if (!parsed) {
    return null;
  }

  if (parsed.kind !== DATASET_KIND || typeof parsed.exportText !== 'string' || !parsed.exportText.trim()) {
    return null;
  }

  return parseLabeledTraceBatches(parsed.exportText);
}

function parseDatasetInput(input) {
  if (!input || typeof input === 'number' || typeof input === 'boolean') {
    return null;
  }

  if (typeof input === 'string') {
    const source = input.trim();
    if (!source.startsWith('{')) {
      return null;
    }

    try {
      return JSON.parse(source);
    } catch {
      return null;
    }
  }

  return typeof input === 'object' ? input : null;
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
