import { buildHandoffBriefing, renderHandoffMarkdownSummary } from './handoff.js';
import { renderIncidentPortfolioMarkdownSummary } from './portfolio.js';
import { renderIncidentDossierHtml } from './report.js';
import { buildCasebookDataset } from './dataset.js';
import { analyzeCasebookMerge, renderCasebookMergeMarkdownSummary } from './merge.js';
import { renderActionBoardMarkdownSummary } from './action-board.js';

export const RESPONSE_BUNDLE_KIND = 'stack-sleuth-response-bundle';
export const RESPONSE_BUNDLE_VERSION = 3;

const RESPONSE_BUNDLE_FILENAMES = [
  'manifest.json',
  'incident-dossier.html',
  'portfolio-summary.md',
  'handoff.md',
  'casebook.txt',
  'casebook-dataset.json',
  'merge-review.md',
  'action-board.md',
  'response-bundle.json',
];

export function buildResponseBundle({ report, sourceMode = 'portfolio', sourceLabel = null } = {}) {
  if (!report || typeof report !== 'object') {
    throw new Error('Response bundle requires a structured report payload.');
  }

  const generatedAt = new Date().toISOString();
  const handoff = buildHandoffBriefing(report);
  const dataset = buildCasebookDataset(report);
  const merge = analyzeCasebookMerge(report);

  const manifest = {
    kind: RESPONSE_BUNDLE_KIND,
    version: RESPONSE_BUNDLE_VERSION,
    generatedAt,
    source: {
      mode: sourceMode,
      label: sourceLabel,
    },
    summary: {
      headline: report.summary?.headline ?? 'No portfolio headline available.',
      releaseGateVerdict: report.gate?.verdict ?? 'needs-input',
      packCount: report.summary?.packCount ?? 0,
      runnablePackCount: report.summary?.runnablePackCount ?? 0,
      ownerCount: report.responseQueue?.length ?? 0,
      recurringIncidentCount: report.recurringIncidents?.length ?? 0,
      recurringHotspotCount: report.recurringHotspots?.length ?? 0,
      stewardActionCount: dataset.steward?.summary?.actionCount ?? 0,
      stewardHeadline: dataset.steward?.summary?.headline ?? 'No steward summary available.',
      actionBoardCardCount: dataset.board?.summary?.totalCards ?? 0,
      actionBoardHeadline: dataset.board?.summary?.headline ?? 'No Action Board summary available.',
    },
    files: RESPONSE_BUNDLE_FILENAMES,
  };

  const artifacts = {
    'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
    'incident-dossier.html': renderIncidentDossierHtml({
      mode: 'portfolio',
      report,
      originLabel: sourceLabel,
    }),
    'portfolio-summary.md': renderIncidentPortfolioMarkdownSummary(report),
    'handoff.md': renderHandoffMarkdownSummary(handoff),
    'casebook.txt': dataset.exportText,
    'casebook-dataset.json': `${JSON.stringify(dataset, null, 2)}\n`,
    'merge-review.md': renderCasebookMergeMarkdownSummary(merge),
    'action-board.md': renderActionBoardMarkdownSummary(dataset.board),
  };

  const files = {
    ...artifacts,
    'response-bundle.json': `${JSON.stringify({
      kind: RESPONSE_BUNDLE_KIND,
      version: RESPONSE_BUNDLE_VERSION,
      manifest,
      artifacts,
    }, null, 2)}\n`,
  };

  return {
    kind: RESPONSE_BUNDLE_KIND,
    version: RESPONSE_BUNDLE_VERSION,
    manifest,
    files,
  };
}
