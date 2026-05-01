export const WORKSPACE_FLEET_KIND = 'stack-sleuth-workspace-fleet';
export const WORKSPACE_FLEET_VERSION = 1;

const REPLAY_NOTE = 'Workspace Fleet replay preserves normalized summaries and coordination signals only. It does not recover raw traces, support frames, or blast radius detail.';

export function buildWorkspaceFleetArtifact({ directory = null, entries = [] } = {}) {
  const inspected = entries.map((entry, index) => inspectEntry(entry, index));
  const rankings = inspected
    .filter((entry) => entry.status === 'valid')
    .sort(compareRankings);
  const warnings = rankings.length
    ? inspected.filter((entry) => entry.status === 'warning').map((entry) => ({
      label: entry.label,
      path: entry.path,
      warning: entry.warning,
    }))
    : [];

  return {
    kind: WORKSPACE_FLEET_KIND,
    version: WORKSPACE_FLEET_VERSION,
    directory,
    summary: buildSummary(directory, rankings, warnings),
    rankings,
    warnings,
  };
}

export function inspectReplayWorkspaceFleetInput(input) {
  const parsedInput = parseFleetInput(input);
  if (!parsedInput.valid) {
    return { valid: false, reason: parsedInput.reason };
  }

  const parsed = parsedInput.parsed;

  if (parsed.kind !== WORKSPACE_FLEET_KIND) {
    return { valid: false, reason: 'wrong-kind', parsed };
  }

  if (parsed.version !== WORKSPACE_FLEET_VERSION) {
    return {
      valid: false,
      reason: 'unsupported-version',
      parsed,
      supportedVersion: WORKSPACE_FLEET_VERSION,
    };
  }

  return {
    valid: true,
    parsed,
    fleet: normalizeFleet(parsed),
  };
}

export function describeWorkspaceFleetInputError(details) {
  if (details.reason === 'unsupported-version') {
    return `Workspace Fleet replay uses unsupported version ${details.parsed?.version ?? 'unknown'}. Supported version: ${details.supportedVersion ?? 'unknown'}.`;
  }

  if (details.reason === 'wrong-kind') {
    return `Workspace Fleet replay uses unsupported kind ${details.parsed?.kind ?? 'unknown'}.`;
  }

  if (details.reason === 'invalid-json') {
    return 'Workspace Fleet replay could not parse the saved fleet JSON.';
  }

  return 'Workspace Fleet replay requires saved Stack Sleuth Workspace Fleet JSON.';
}

export function renderWorkspaceFleetTextSummary(report) {
  return [
    'Stack Sleuth Workspace Fleet',
    report.summary.headline,
    `Directory: ${report.directory ?? '-'}`,
    `Valid workspaces: ${report.summary.validWorkspaceCount}`,
    `Warnings: ${report.summary.warningCount}`,
    `Top workspace: ${report.summary.topWorkspaceLabel}`,
    `Saved-artifact note: ${REPLAY_NOTE}`,
    '',
    'Ranked workspaces',
    ...(report.rankings.length
      ? report.rankings.map((entry, index) => `${index + 1}. ${entry.label}: ${entry.priority.reasons.join('; ')}`)
      : ['None']),
    '',
    'Workspace warnings',
    ...(report.warnings.length
      ? report.warnings.map((entry) => `${entry.label}: ${entry.warning}`)
      : ['None']),
  ].join('\n').trim();
}

export function renderWorkspaceFleetMarkdownSummary(report) {
  return [
    '# Stack Sleuth Workspace Fleet',
    '',
    `- **Headline:** ${escapeMarkdownText(report.summary.headline)}`,
    `- **Directory:** ${escapeMarkdownText(report.directory ?? '-')}`,
    `- **Valid workspaces:** ${report.summary.validWorkspaceCount}`,
    `- **Warnings:** ${report.summary.warningCount}`,
    `- **Top workspace:** ${escapeMarkdownText(report.summary.topWorkspaceLabel)}`,
    `- **Saved-artifact note:** ${escapeMarkdownText(REPLAY_NOTE)}`,
    '',
    '## Ranked workspaces',
    ...(report.rankings.length
      ? report.rankings.map((entry, index) => `- **${index + 1}. ${escapeMarkdownText(entry.label)}:** ${escapeMarkdownText(entry.priority.reasons.join('; '))}`)
      : ['- None']),
    '',
    '## Workspace warnings',
    ...(report.warnings.length
      ? report.warnings.map((entry) => `- **${escapeMarkdownText(entry.label)}:** ${escapeMarkdownText(entry.warning)}`)
      : ['- None']),
  ].join('\n').trim();
}

function inspectEntry(entry, index) {
  const label = String(entry?.label ?? `workspace-${index + 1}`);
  const path = entry?.path == null ? null : String(entry.path);
  const warning = entry?.warning ?? entry?.reason ?? null;

  if (warning && !entry?.routed?.report) {
    return {
      label,
      path,
      status: 'warning',
      warning: String(warning),
    };
  }

  const routedMode = entry?.routed?.mode;
  const report = entry?.routed?.report;
  const workspace = normalizeWorkspace(entry?.workspace);

  if (!report || (routedMode !== 'pack' && routedMode !== 'portfolio')) {
    return {
      label,
      path,
      status: 'warning',
      warning: String(warning ?? 'Workspace could not be normalized into a supported Stack Sleuth workflow.'),
    };
  }

  const priority = buildPriority({ workspace, routedMode, report });

  return {
    label,
    path,
    status: 'valid',
    workspace,
    notebook: normalizeNotebook(entry?.notebook),
    routed: {
      mode: routedMode,
    },
    summary: normalizeSummary(routedMode, report),
    coordination: normalizeCoordination(routedMode, report),
    priority,
  };
}

function buildPriority({ workspace, routedMode, report }) {
  const isPortfolio = routedMode === 'portfolio';
  const runnablePackCount = isPortfolio ? toCount(report?.summary?.runnablePackCount) : 1;
  const novelCount = isPortfolio
    ? toCount(report?.summary?.totalNovelIncidents)
    : toCount(report?.casebook?.summary?.novelCount);
  const regressionNewCount = isPortfolio
    ? toCount(report?.summary?.totalRegressionNew)
    : toCount(report?.regression?.summary?.newCount);
  const timelineRisingCount = isPortfolio
    ? toCount(report?.summary?.totalTimelineRising)
    : toCount(report?.timeline?.summary?.risingCount);
  const ownerCount = isPortfolio
    ? Array.isArray(report?.responseQueue) ? report.responseQueue.length : 0
    : 0;
  const base = isPortfolio ? 100000 : 10000;
  const sourceBonus = workspace.kind === 'notebook' ? 2000 : workspace.kind === 'portfolio' ? 1000 : 0;
  const score = base
    + sourceBonus
    + runnablePackCount * 1000
    + novelCount * 300
    + regressionNewCount * 200
    + timelineRisingCount * 120
    + ownerCount * 25;

  const reasons = [
    isPortfolio
      ? `${workspace.kind === 'notebook' ? 'Notebook-routed ' : ''}portfolio workspace with ${runnablePackCount} runnable pack${runnablePackCount === 1 ? '' : 's'}`
      : `${workspace.kind === 'notebook' ? 'Notebook-routed ' : ''}pack workspace with ${Array.isArray(report?.availableAnalyses) ? report.availableAnalyses.length : 0} runnable analys${Array.isArray(report?.availableAnalyses) && report.availableAnalyses.length === 1 ? 'is' : 'es'}`,
  ];

  if (novelCount > 0) {
    reasons.push(`${novelCount} novel incident${novelCount === 1 ? '' : 's'}`);
  }
  if (regressionNewCount > 0) {
    reasons.push(`${regressionNewCount} new regression incident${regressionNewCount === 1 ? '' : 's'}`);
  }
  if (timelineRisingCount > 0) {
    reasons.push(`${timelineRisingCount} rising timeline incident${timelineRisingCount === 1 ? '' : 's'}`);
  }
  if (ownerCount > 0) {
    reasons.push(`${ownerCount} response owner${ownerCount === 1 ? '' : 's'} recalled`);
  }

  return { score, reasons };
}

function compareRankings(left, right) {
  return right.priority.score - left.priority.score
    || left.label.localeCompare(right.label);
}

function buildSummary(directory, rankings, warnings) {
  const top = rankings[0] ?? null;
  return {
    headline: top
      ? `Workspace Fleet ranked ${rankings.length} valid workspace${rankings.length === 1 ? '' : 's'} from ${directory ?? 'the scanned directory'}.`
      : 'Workspace Fleet did not find any valid workspaces to rank.',
    validWorkspaceCount: rankings.length,
    warningCount: warnings.length,
    topWorkspaceLabel: top?.label ?? 'none',
  };
}

function normalizeFleet(parsed) {
  const rankings = Array.isArray(parsed.rankings)
    ? parsed.rankings.map((entry) => ({
      label: String(entry?.label ?? 'unknown'),
      path: entry?.path == null ? null : String(entry.path),
      workspace: normalizeWorkspace(entry?.workspace),
      notebook: normalizeNotebook(entry?.notebook),
      routed: { mode: entry?.routed?.mode === 'portfolio' ? 'portfolio' : 'pack' },
      summary: {
        headline: String(entry?.summary?.headline ?? 'No saved summary available.'),
      },
      coordination: {
        runnablePackCount: toCount(entry?.coordination?.runnablePackCount),
        responseOwnerCount: toCount(entry?.coordination?.responseOwnerCount),
        routingGapCount: toCount(entry?.coordination?.routingGapCount),
        runbookGapCount: toCount(entry?.coordination?.runbookGapCount),
        recurringHotspotCount: toCount(entry?.coordination?.recurringHotspotCount),
        availableAnalyses: Array.isArray(entry?.coordination?.availableAnalyses) ? entry.coordination.availableAnalyses : [],
      },
      priority: {
        score: Number.isFinite(entry?.priority?.score) ? entry.priority.score : 0,
        reasons: Array.isArray(entry?.priority?.reasons) ? entry.priority.reasons.map((item) => String(item)) : [],
      },
    }))
    : [];
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.map((entry) => ({
      label: String(entry?.label ?? 'unknown'),
      path: entry?.path == null ? null : String(entry.path),
      warning: String(entry?.warning ?? 'Unknown workspace warning.'),
    }))
    : [];

  return {
    kind: WORKSPACE_FLEET_KIND,
    version: WORKSPACE_FLEET_VERSION,
    directory: parsed.directory == null ? null : String(parsed.directory),
    summary: buildSummary(parsed.directory, rankings, warnings),
    rankings,
    warnings,
  };
}

function normalizeWorkspace(workspace) {
  return {
    kind: String(workspace?.kind ?? 'unsupported'),
    path: workspace?.path == null ? null : String(workspace.path),
    recognizedFiles: Array.isArray(workspace?.recognizedFiles) ? workspace.recognizedFiles.map((item) => String(item)) : [],
    packOrder: Array.isArray(workspace?.packOrder) ? workspace.packOrder.map((item) => String(item)) : [],
  };
}

function normalizeNotebook(notebook) {
  if (!notebook) {
    return null;
  }

  return {
    kind: String(notebook?.kind ?? 'unsupported'),
    packOrder: Array.isArray(notebook?.packOrder) ? notebook.packOrder.map((item) => String(item)) : [],
    sectionOrder: Array.isArray(notebook?.sectionOrder) ? notebook.sectionOrder.map((item) => String(item)) : [],
  };
}

function normalizeSummary(routedMode, report) {
  return {
    headline: routedMode === 'portfolio'
      ? String(report?.summary?.headline ?? 'No portfolio headline available.')
      : String(report?.summary?.headline ?? 'No incident-pack headline available.'),
  };
}

function normalizeCoordination(routedMode, report) {
  return routedMode === 'portfolio'
    ? {
      runnablePackCount: toCount(report?.summary?.runnablePackCount),
      responseOwnerCount: Array.isArray(report?.responseQueue) ? report.responseQueue.length : 0,
      routingGapCount: Array.isArray(report?.unownedPacks) ? report.unownedPacks.length : 0,
      runbookGapCount: Array.isArray(report?.runbookGaps) ? report.runbookGaps.length : 0,
      recurringHotspotCount: Array.isArray(report?.recurringHotspots) ? report.recurringHotspots.length : 0,
      availableAnalyses: [],
    }
    : {
      runnablePackCount: Array.isArray(report?.availableAnalyses) && report.availableAnalyses.length ? 1 : 0,
      responseOwnerCount: 0,
      routingGapCount: 0,
      runbookGapCount: 0,
      recurringHotspotCount: Array.isArray(report?.currentDigest?.hotspots) ? report.currentDigest.hotspots.length : 0,
      availableAnalyses: Array.isArray(report?.availableAnalyses) ? report.availableAnalyses : [],
    };
}

function parseFleetInput(input) {
  if (!input || typeof input === 'number' || typeof input === 'boolean') {
    return { valid: false, reason: 'not-fleet' };
  }

  if (typeof input === 'string') {
    const source = input.trim();
    if (!source.startsWith('{')) {
      return { valid: false, reason: 'not-fleet' };
    }

    try {
      return { valid: true, parsed: JSON.parse(source) };
    } catch {
      return {
        valid: false,
        reason: source.includes(WORKSPACE_FLEET_KIND) ? 'invalid-json' : 'not-fleet',
      };
    }
  }

  return typeof input === 'object'
    ? { valid: true, parsed: input }
    : { valid: false, reason: 'not-fleet' };
}

function toCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}
