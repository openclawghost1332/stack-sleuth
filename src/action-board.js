import { analyzeIncidentPortfolio, parseIncidentPortfolio } from './portfolio.js';
import { analyzeCasebookMerge } from './merge.js';
import { buildCasebookSteward } from './steward.js';

export const ACTION_BOARD_KIND = 'stack-sleuth-action-board';
export const ACTION_BOARD_VERSION = 1;
const DATASET_KIND = 'stack-sleuth-casebook-dataset';
const RESPONSE_BUNDLE_KIND = 'stack-sleuth-response-bundle';
const DATASET_VERSIONS = new Set([1, 2]);

export function buildActionBoard(input) {
  const normalized = normalizeBoardInput(input);
  const lanes = buildLanes(normalized);
  const totalCards = lanes.reduce((total, lane) => total + lane.cards.length, 0);
  const totalLabels = new Set(lanes.flatMap((lane) => lane.cards.flatMap((card) => card.affectedLabels ?? []))).size;
  const laneCounts = Object.fromEntries(lanes.map((lane) => [lane.key, lane.cards.length]));

  return {
    kind: ACTION_BOARD_KIND,
    version: ACTION_BOARD_VERSION,
    source: normalized.source,
    summary: {
      sourceKind: normalized.source.kind,
      headline: buildHeadline(normalized, totalCards),
      totalCards,
      totalLabels,
      totalLanes: lanes.length,
      hasReplayLimitations: normalized.replayNotes.length > 0,
      replayNotes: normalized.replayNotes,
      laneCounts,
    },
    lanes,
  };
}

export function renderActionBoardTextSummary(board) {
  return [
    'Stack Sleuth Action Board',
    board.summary.headline,
    `Source: ${board.summary.sourceKind}`,
    `Cards: ${board.summary.totalCards}`,
    ...(board.summary.replayNotes.length
      ? ['Replay notes', ...board.summary.replayNotes.map((note) => `- ${note}`)]
      : []),
    ...board.lanes.flatMap((lane) => [
      '',
      lane.title,
      ...(lane.cards.length ? lane.cards.map((card) => `- ${formatTextCard(card)}`) : ['- None']),
    ]),
  ].join('\n').trim();
}

export function renderActionBoardMarkdownSummary(board) {
  return [
    '# Stack Sleuth Action Board',
    '',
    `- **Headline:** ${escapeMarkdownText(board.summary.headline)}`,
    `- **Source:** ${escapeMarkdownText(board.summary.sourceKind)}`,
    `- **Cards:** ${board.summary.totalCards}`,
    ...(board.summary.replayNotes.length
      ? ['', '## Replay notes', ...board.summary.replayNotes.map((note) => `- ${escapeMarkdownText(note)}`)]
      : []),
    ...board.lanes.flatMap((lane) => [
      '',
      `## ${lane.title}`,
      ...(lane.cards.length ? lane.cards.map((card) => `- ${escapeMarkdownText(formatTextCard(card))}`) : ['- None']),
    ]),
  ].join('\n').trim();
}

function normalizeBoardInput(input) {
  if (typeof input === 'string') {
    const source = input.trim();
    if (!source) {
      return emptyBoardSource();
    }

    if (source.startsWith('{')) {
      try {
        return normalizeBoardInput(JSON.parse(source));
      } catch {
        return emptyBoardSource();
      }
    }

    const portfolio = parseIncidentPortfolio(source);
    if (portfolio.packOrder.length) {
      return normalizePortfolioSource(analyzeIncidentPortfolio(portfolio));
    }

    return emptyBoardSource();
  }

  if (input?.priorityQueue) {
    return normalizePortfolioSource(input);
  }

  if (input?.kind === RESPONSE_BUNDLE_KIND && (input?.artifacts || input?.files || input?.dataset)) {
    return normalizeBundleSource(input);
  }

  if (input?.kind === DATASET_KIND || input?.summary?.portfolioHeadline || input?.portfolio?.packOrder) {
    return normalizeDatasetSource(input);
  }

  if (input?.dataset && input?.manifest) {
    return normalizeBundleSource(input);
  }

  return emptyBoardSource();
}

function normalizePortfolioSource(report) {
  const steward = buildCasebookSteward({
    cases: analyzeCasebookMerge(report).cases ?? [],
    preserved: true,
  });

  return {
    source: {
      kind: 'portfolio',
      label: report?.summary?.headline ?? 'Live portfolio report',
    },
    responseQueue: Array.isArray(report?.responseQueue) ? report.responseQueue : [],
    routingGaps: Array.isArray(report?.unownedPacks) ? report.unownedPacks : [],
    runbookGaps: Array.isArray(report?.runbookGaps) ? report.runbookGaps : [],
    steward,
    replayNotes: [],
  };
}

function normalizeDatasetSource(dataset) {
  const version = Number.isInteger(dataset?.version) ? dataset.version : 1;
  const steward = dataset?.steward && typeof dataset.steward === 'object'
    ? dataset.steward
    : buildCasebookSteward({ cases: Array.isArray(dataset?.cases) ? dataset.cases : [], preserved: false });
  const routingGaps = Array.isArray(dataset?.routingGaps) ? dataset.routingGaps : [];
  const runbookGaps = Array.isArray(dataset?.runbookGaps) ? dataset.runbookGaps : [];
  const replayNotes = [];

  if (!DATASET_VERSIONS.has(version)) {
    replayNotes.push(`Action Board replay is using an unsupported older dataset schema (${version}) and may omit lanes.`);
  } else if (version < 2 || (!Array.isArray(dataset?.routingGaps) && !Array.isArray(dataset?.runbookGaps))) {
    replayNotes.push('Action Board replay is using an older dataset that did not preserve routing-gap and runbook-gap lanes.');
  }

  if (steward?.preserved === false) {
    replayNotes.push('Action Board replay reconstructed Casebook Steward detail from older dataset fields.');
  }

  return {
    source: {
      kind: 'dataset',
      label: dataset?.summary?.headline ?? 'Saved Casebook Dataset',
      version,
    },
    responseQueue: Array.isArray(dataset?.responseQueue) ? dataset.responseQueue : [],
    routingGaps,
    runbookGaps,
    steward,
    replayNotes,
  };
}

function normalizeBundleSource(bundle) {
  const dataset = bundle?.dataset ?? readBundleDataset(bundle);
  const normalizedDataset = normalizeDatasetSource(dataset ?? {});
  const replayNotes = [...normalizedDataset.replayNotes];

  return {
    ...normalizedDataset,
    source: {
      kind: 'bundle',
      label: bundle?.manifest?.source?.label ?? bundle?.source?.label ?? 'Saved response bundle',
      version: Number.isInteger(bundle?.version) ? bundle.version : 1,
    },
    replayNotes,
  };
}

function readBundleDataset(bundle) {
  const artifactSource = bundle?.artifacts && typeof bundle.artifacts === 'object'
    ? bundle.artifacts
    : bundle?.files && typeof bundle.files === 'object'
      ? bundle.files
      : {};
  const rawDataset = artifactSource['casebook-dataset.json'];

  if (typeof rawDataset !== 'string') {
    return null;
  }

  try {
    return JSON.parse(rawDataset);
  } catch {
    return null;
  }
}

function buildLanes(normalized) {
  return [
    {
      key: 'owner-work',
      title: 'Owner work',
      cards: normalized.responseQueue.map((entry, index) => ({
        lane: 'owner-work',
        title: `${entry.owner} owns ${entry.packCount ?? entry.labels?.length ?? 0} pack${(entry.packCount ?? entry.labels?.length ?? 0) === 1 ? '' : 's'}`,
        owner: entry.owner,
        affectedLabels: Array.isArray(entry.labels) ? entry.labels : [],
        whyNow: buildOwnerWhyNow(entry),
        guidance: Array.isArray(entry.guidance) ? entry.guidance : [],
        ask: `Route ${entry.owner} the preserved incident context for ${joinLabels(entry.labels)}.`,
        replayNote: normalized.replayNotes.length ? normalized.replayNotes[0] : '',
        sortKey: index,
      })),
    },
    {
      key: 'ownership-gaps',
      title: 'Ownership gaps',
      cards: buildOwnershipGapCards(normalized.routingGaps, normalized.replayNotes),
    },
    {
      key: 'runbook-gaps',
      title: 'Runbook gaps',
      cards: normalized.runbookGaps.map((item, index) => ({
        lane: 'runbook-gaps',
        title: `Runbook gap: ${item.label}`,
        affectedLabels: [item.label],
        whyNow: Array.isArray(item.priorityReasons) ? item.priorityReasons : [],
        guidance: [],
        ask: `Capture or link a runbook for ${item.label} so responders have a playbook.`,
        replayNote: normalized.replayNotes[0] ?? '',
        sortKey: index,
      })),
    },
    {
      key: 'steward-backlog',
      title: 'Steward backlog',
      cards: buildStewardCards(normalized.steward, normalized.replayNotes),
    },
  ];
}

function buildOwnershipGapCards(routingGaps, replayNotes) {
  if (!routingGaps.length) {
    return [];
  }

  return [{
    lane: 'ownership-gaps',
    title: `Ownership gaps across ${routingGaps.length} pack${routingGaps.length === 1 ? '' : 's'}`,
    affectedLabels: routingGaps.map((item) => item.label),
    whyNow: routingGaps.flatMap((item) => item.priorityReasons ?? []).filter(Boolean).slice(0, 3),
    guidance: [],
    ask: `Assign an owner for ${joinLabels(routingGaps.map((item) => item.label))} so future incidents route cleanly.`,
    replayNote: replayNotes[0] ?? '',
    sortKey: 0,
  }];
}

function buildStewardCards(steward, replayNotes) {
  const actions = Array.isArray(steward?.actions) ? steward.actions : [];
  if (!actions.length) {
    return [];
  }

  return [{
    lane: 'steward-backlog',
    title: steward?.summary?.headline ?? 'Steward backlog',
    affectedLabels: [...new Set(actions.flatMap((action) => action.sourcePacks?.length ? action.sourcePacks : [action.label]))],
    whyNow: actions.slice(0, 3).map((action) => action.headline),
    guidance: [],
    ask: steward?.nextAction ?? actions[0]?.ask ?? 'Review the stewardship backlog.',
    replayNote: steward?.preserved === false
      ? 'Steward backlog was reconstructed from older dataset fields.'
      : replayNotes[0] ?? '',
    sortKey: 0,
  }];
}

function buildHeadline(normalized, totalCards) {
  if (normalized.source.kind === 'portfolio') {
    return totalCards
      ? `Live portfolio Action Board assembled ${totalCards} deterministic coordination card${totalCards === 1 ? '' : 's'}.`
      : 'Live portfolio Action Board could not build any coordination cards yet.';
  }

  if (normalized.source.kind === 'bundle') {
    return totalCards
      ? `Action Board rebuilt ${totalCards} coordination card${totalCards === 1 ? '' : 's'} from a saved response bundle.`
      : 'Saved response bundle replay could not rebuild any Action Board cards.';
  }

  if (normalized.source.kind === 'dataset') {
    return totalCards
      ? `Action Board rebuilt ${totalCards} coordination card${totalCards === 1 ? '' : 's'} from a saved Casebook Dataset.`
      : 'Saved Casebook Dataset replay could not rebuild any Action Board cards.';
  }

  return 'Action Board needs a labeled portfolio or saved replay artifact.';
}

function buildOwnerWhyNow(entry) {
  const whyNow = [];
  if (Number.isFinite(entry?.novelIncidentCount) && entry.novelIncidentCount > 0) {
    whyNow.push(`${entry.novelIncidentCount} novel incident${entry.novelIncidentCount === 1 ? '' : 's'} need context.`);
  }
  if (Number.isFinite(entry?.packCount) && entry.packCount > 0) {
    whyNow.push(`${entry.packCount} pack${entry.packCount === 1 ? '' : 's'} route to this owner.`);
  }
  return whyNow;
}

function formatTextCard(card) {
  const details = [];
  if (card.affectedLabels?.length) {
    details.push(`labels ${joinLabels(card.affectedLabels)}`);
  }
  if (card.ask) {
    details.push(`ask ${card.ask}`);
  }
  if (card.replayNote) {
    details.push(`note ${card.replayNote}`);
  }
  return `${card.title}${details.length ? ` (${details.join('; ')})` : ''}`;
}

function joinLabels(labels = []) {
  return [...new Set((labels ?? []).filter(Boolean))].join(', ');
}

function emptyBoardSource() {
  return {
    source: { kind: 'unknown', label: 'Unknown input' },
    responseQueue: [],
    routingGaps: [],
    runbookGaps: [],
    steward: buildCasebookSteward({ cases: [], preserved: false }),
    replayNotes: ['Action Board needs a labeled portfolio or saved replay artifact.'],
  };
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}
