import { buildHandoffBriefing, renderHandoffMarkdownSummary } from './handoff.js';
import { renderIncidentPortfolioMarkdownSummary } from './portfolio.js';
import { renderIncidentDossierHtml } from './report.js';
import { buildCasebookDataset } from './dataset.js';
import { analyzeCasebookMerge, renderCasebookMergeMarkdownSummary } from './merge.js';

export const RESPONSE_BUNDLE_KIND = 'stack-sleuth-response-bundle';
export const RESPONSE_BUNDLE_VERSION = 1;

const RESPONSE_BUNDLE_FILENAMES = [
  'manifest.json',
  'incident-dossier.html',
  'portfolio-summary.md',
  'handoff.md',
  'casebook.txt',
  'casebook-dataset.json',
  'merge-review.md',
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
    },
    files: RESPONSE_BUNDLE_FILENAMES,
  };

  const files = {
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
  };

  return {
    kind: RESPONSE_BUNDLE_KIND,
    version: RESPONSE_BUNDLE_VERSION,
    manifest,
    files,
  };
}
