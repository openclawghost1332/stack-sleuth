const ACTION_PRIORITY = {
  conflict: 0,
  'missing-owner': 1,
  'missing-runbook': 2,
  'missing-fix': 3,
};

export function analyzeStewardLedger(input) {
  const snapshots = normalizeSnapshots(input);
  const labels = snapshots.map((snapshot) => snapshot.label);
  const latestSnapshot = snapshots.at(-1) ?? null;
  const previousSnapshot = snapshots.at(-2) ?? null;
  const latestActionMap = buildActionMap(latestSnapshot?.actions ?? []);
  const previousActionMap = buildActionMap(previousSnapshot?.actions ?? []);
  const grouped = groupActionHistory(snapshots);

  const activeActions = [...latestActionMap.values()]
    .map((action) => buildActiveActionEntry(action, grouped.get(createActionKey(action)), labels, latestSnapshot))
    .sort(compareActiveActions);

  const resolvedActions = [...previousActionMap.values()]
    .filter((action) => !latestActionMap.has(createActionKey(action)))
    .map((action) => buildResolvedActionEntry(action, grouped.get(createActionKey(action)), labels, previousSnapshot))
    .sort(compareResolvedActions);

  const summary = buildSummary({
    labels,
    latestSnapshot,
    snapshots,
    activeActions,
    resolvedActions,
  });

  return {
    snapshots,
    labels,
    activeActions,
    resolvedActions,
    summary,
  };
}

export function renderStewardLedgerText(report) {
  return [
    'Stack Sleuth Steward Ledger',
    `Snapshots: ${report.labels.join(' → ')}`,
    `Headline: ${report.summary.headline}`,
    `Next action: ${report.summary.nextAction}`,
    ...(report.summary.hasReconstructedSnapshot
      ? ['Trend confidence: limited because one or more snapshots reconstructed stewardship detail from older dataset fields.']
      : []),
    '',
    'Current stewardship backlog',
    ...(report.activeActions.length ? report.activeActions.map(formatActiveTextLine) : ['- None']),
    '',
    'Recently resolved actions',
    ...(report.resolvedActions.length ? report.resolvedActions.map(formatResolvedTextLine) : ['- None']),
  ].join('\n').trim();
}

export function renderStewardLedgerMarkdown(report) {
  return [
    '## Steward Ledger',
    '',
    `- **Snapshots:** ${escapeMarkdownText(report.labels.join(' → '))}`,
    `- **Headline:** ${escapeMarkdownText(report.summary.headline)}`,
    `- **Next action:** ${escapeMarkdownText(report.summary.nextAction)}`,
    ...(report.summary.hasReconstructedSnapshot
      ? ['- **Trend confidence:** limited because one or more snapshots reconstructed stewardship detail from older dataset fields.']
      : []),
    '',
    '### Current stewardship backlog',
    ...(report.activeActions.length ? report.activeActions.map(formatActiveMarkdownLine) : ['- None']),
    '',
    '### Recently resolved actions',
    ...(report.resolvedActions.length ? report.resolvedActions.map(formatResolvedMarkdownLine) : ['- None']),
  ].join('\n').trim();
}

function normalizeSnapshots(input) {
  return Array.isArray(input)
    ? input.map((snapshot) => ({
      label: String(snapshot?.label ?? 'snapshot'),
      preserved: snapshot?.steward?.preserved !== false,
      actions: normalizeActions(snapshot?.steward?.actions),
    }))
    : [];
}

function normalizeActions(actions) {
  return Array.isArray(actions)
    ? actions.map((action) => ({
      kind: String(action?.kind ?? 'missing-runbook'),
      label: String(action?.label ?? action?.signature ?? 'case'),
      signature: String(action?.signature ?? action?.label ?? 'case'),
      seenCount: toCount(action?.seenCount) || 1,
      sourcePacks: Array.isArray(action?.sourcePacks)
        ? [...new Set(action.sourcePacks.map((item) => String(item).trim()).filter(Boolean))]
        : [],
      priority: Number.isFinite(Number(action?.priority)) ? Number(action.priority) : 0,
      headline: String(action?.headline ?? 'Stewardship action'),
      ask: String(action?.ask ?? 'Review the stewardship backlog.'),
    }))
    : [];
}

function groupActionHistory(snapshots) {
  const grouped = new Map();

  snapshots.forEach((snapshot, snapshotIndex) => {
    snapshot.actions.forEach((action) => {
      const key = createActionKey(action);
      const existing = grouped.get(key) ?? {
        key,
        kind: action.kind,
        label: action.label,
        signature: action.signature,
        headline: action.headline,
        ask: action.ask,
        priority: action.priority,
        sourcePacks: new Set(),
        activeLabels: [],
        series: Array.from({ length: snapshots.length }, () => 0),
        seenSeries: Array.from({ length: snapshots.length }, () => 0),
      };

      existing.series[snapshotIndex] = 1;
      existing.seenSeries[snapshotIndex] = Math.max(toCount(action.seenCount), 1);
      existing.headline = action.headline;
      existing.ask = action.ask;
      existing.priority = action.priority;
      action.sourcePacks.forEach((item) => existing.sourcePacks.add(item));
      existing.activeLabels.push(snapshot.label);
      grouped.set(key, existing);
    });
  });

  return grouped;
}

function buildActiveActionEntry(action, history, labels, latestSnapshot) {
  const series = history?.series ?? Array.from({ length: labels.length }, () => 0);
  return {
    key: createActionKey(action),
    kind: action.kind,
    label: action.label,
    signature: action.signature,
    headline: action.headline,
    ask: action.ask,
    trend: classifyActiveTrend(series),
    streak: countActiveStreak(series),
    latestSeenCount: Math.max(toCount(action.seenCount), 1),
    activeLabels: history?.activeLabels ?? [latestSnapshot?.label ?? '-'],
    latestLabel: latestSnapshot?.label ?? '-',
    sourcePacks: [...(history?.sourcePacks ?? new Set())],
    series,
  };
}

function buildResolvedActionEntry(action, history, labels, previousSnapshot) {
  const series = history?.series ?? Array.from({ length: labels.length }, () => 0);
  return {
    key: createActionKey(action),
    kind: action.kind,
    label: action.label,
    signature: action.signature,
    headline: action.headline,
    ask: action.ask,
    trend: 'resolved',
    lastSeenLabel: previousSnapshot?.label ?? '-',
    activeLabels: history?.activeLabels ?? [],
    sourcePacks: [...(history?.sourcePacks ?? new Set())],
    series,
  };
}

function buildSummary({ labels, latestSnapshot, snapshots, activeActions, resolvedActions }) {
  const activeActionCount = activeActions.length;
  const newActionCount = activeActions.filter((action) => action.trend === 'new').length;
  const carriedActionCount = activeActions.filter((action) => action.trend === 'carried').length;
  const resurfacedActionCount = activeActions.filter((action) => action.trend === 'resurfaced').length;
  const resolvedActionCount = resolvedActions.length;
  const hasReconstructedSnapshot = snapshots.some((snapshot) => snapshot.preserved === false);
  const latestLabel = latestSnapshot?.label ?? '-';

  let headline = `Steward Ledger found ${activeActionCount} unresolved action${activeActionCount === 1 ? '' : 's'} in ${latestLabel}, including ${newActionCount} new action${newActionCount === 1 ? '' : 's'}, ${carriedActionCount} carried action${carriedActionCount === 1 ? '' : 's'}, ${resurfacedActionCount} resurfaced action${resurfacedActionCount === 1 ? '' : 's'}, and ${resolvedActionCount} recently resolved action${resolvedActionCount === 1 ? '' : 's'}.`;
  if (hasReconstructedSnapshot) {
    headline += ' Trend confidence is limited because one or more snapshots reconstructed stewardship detail from older dataset fields.';
  }

  return {
    snapshotCount: labels.length,
    latestLabel,
    activeActionCount,
    newActionCount,
    carriedActionCount,
    resurfacedActionCount,
    resolvedActionCount,
    hasReconstructedSnapshot,
    headline,
    nextAction: activeActions[0]?.ask ?? 'No stewardship gaps detected in the latest saved snapshot.',
  };
}

function classifyActiveTrend(series) {
  const latestIndex = series.length - 1;
  const previous = series[latestIndex - 1] ?? 0;
  const earlierHadPresence = series.slice(0, -1).some((count) => count > 0);

  if (previous > 0) {
    return 'carried';
  }

  if (earlierHadPresence) {
    return 'resurfaced';
  }

  return 'new';
}

function countActiveStreak(series) {
  let streak = 0;
  for (let index = series.length - 1; index >= 0; index -= 1) {
    if (series[index] > 0) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function buildActionMap(actions) {
  return new Map(actions.map((action) => [createActionKey(action), action]));
}

function createActionKey(action) {
  return `${String(action?.kind ?? 'missing-runbook')}|${String(action?.signature ?? action?.label ?? 'case')}`;
}

function compareActiveActions(left, right) {
  return (ACTION_PRIORITY[left.kind] ?? 9) - (ACTION_PRIORITY[right.kind] ?? 9)
    || compareTrendOrder(left.trend, right.trend)
    || right.streak - left.streak
    || right.latestSeenCount - left.latestSeenCount
    || left.label.localeCompare(right.label)
    || left.signature.localeCompare(right.signature);
}

function compareResolvedActions(left, right) {
  return (ACTION_PRIORITY[left.kind] ?? 9) - (ACTION_PRIORITY[right.kind] ?? 9)
    || left.label.localeCompare(right.label)
    || left.signature.localeCompare(right.signature);
}

function compareTrendOrder(left, right) {
  const order = { resurfaced: 0, new: 1, carried: 2 };
  return (order[left] ?? 9) - (order[right] ?? 9);
}

function formatActiveTextLine(action) {
  return `- ${action.trend}, streak ${action.streak}, ${action.label}: ${action.headline} (active: ${action.activeLabels.join(' → ')})`;
}

function formatResolvedTextLine(action) {
  return `- resolved at ${action.lastSeenLabel}, ${action.label}: ${action.headline}`;
}

function formatActiveMarkdownLine(action) {
  return `- **${escapeMarkdownText(action.trend)}**, streak ${action.streak}, ${escapeMarkdownText(action.label)}: ${escapeMarkdownText(action.headline)} (active: ${escapeMarkdownText(action.activeLabels.join(' → '))})`;
}

function formatResolvedMarkdownLine(action) {
  return `- **resolved at ${escapeMarkdownText(action.lastSeenLabel)}**, ${escapeMarkdownText(action.label)}: ${escapeMarkdownText(action.headline)}`;
}

function toCount(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}
