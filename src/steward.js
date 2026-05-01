const ACTION_PRIORITY = {
  conflict: 0,
  'missing-owner': 1,
  'missing-runbook': 2,
  'missing-fix': 3,
};

export function buildCasebookSteward(input = {}) {
  const cases = normalizeCases(input.cases);
  const actions = cases
    .flatMap((entry) => buildActionsForCase(entry))
    .sort(compareActions)
    .slice(0, 5);

  const summary = buildSummary(cases, actions);

  return {
    preserved: input.preserved !== false,
    cases,
    actions,
    summary,
    nextAction: actions[0]?.ask ?? 'No stewardship gaps detected in the current casebook state.',
  };
}

export function normalizeCasebookSteward(steward, fallback = {}) {
  if (steward && typeof steward === 'object') {
    const normalized = buildCasebookSteward({
      cases: Array.isArray(steward.cases) && steward.cases.length ? steward.cases : fallback.cases,
      preserved: steward.preserved !== false,
    });

    const actions = Array.isArray(steward.actions) && steward.actions.length
      ? steward.actions.map((action) => ({
        kind: String(action.kind ?? 'missing-runbook'),
        label: String(action.label ?? 'case'),
        signature: String(action.signature ?? action.label ?? 'case'),
        seenCount: Math.max(toCount(action.seenCount), 1),
        sourcePacks: normalizeSourcePacks(action.sourcePacks),
        priority: Number.isFinite(Number(action.priority)) ? Number(action.priority) : 0,
        headline: String(action.headline ?? 'Stewardship action'),
        ask: String(action.ask ?? 'Review the stewardship backlog.'),
      }))
      : normalized.actions;
    const summary = typeof steward.summary === 'object' && steward.summary
      ? {
        ...normalized.summary,
        ...steward.summary,
        headline: String(steward.summary.headline ?? normalized.summary.headline),
      }
      : normalized.summary;

    return {
      ...normalized,
      preserved: steward.preserved !== false,
      actions,
      summary,
      nextAction: String(steward.nextAction ?? actions[0]?.ask ?? normalized.nextAction),
    };
  }

  return {
    ...buildCasebookSteward({ cases: fallback.cases, preserved: false }),
    preserved: false,
  };
}

export function compareStewardSnapshots(previous, current) {
  if (!previous || !current) {
    return finalizeDrift('unavailable', previous, current, 'Steward drift unavailable because one of the compared snapshots is missing Casebook Steward detail.');
  }

  if (previous.preserved === false || current.preserved === false) {
    return finalizeDrift('unavailable', previous, current, 'Steward drift unavailable because one of the compared snapshots had to reconstruct stewardship detail from older dataset fields.');
  }

  const previousCount = toCount(previous.summary?.actionCount);
  const currentCount = toCount(current.summary?.actionCount);

  if (currentCount > previousCount) {
    return finalizeDrift('regressed', previous, current, `Regressed from ${previousCount} stewardship action${previousCount === 1 ? '' : 's'} to ${currentCount}.`);
  }

  if (currentCount < previousCount) {
    return finalizeDrift('improved', previous, current, `Improved from ${previousCount} stewardship action${previousCount === 1 ? '' : 's'} to ${currentCount}.`);
  }

  return finalizeDrift('flat', previous, current, `Stayed at ${currentCount} stewardship action${currentCount === 1 ? '' : 's'} across the compared snapshots.`);
}

export function renderCasebookStewardText(report) {
  return [
    'Casebook Steward',
    `Cases: ${report.summary.caseCount}`,
    `Conflicts: ${report.summary.conflictCount}`,
    `Owner-covered: ${report.summary.ownerCoveredCount}`,
    `Fix-covered: ${report.summary.fixCoveredCount}`,
    `Runbook-covered: ${report.summary.runbookCoveredCount}`,
    `Actions: ${report.summary.actionCount}`,
    `Urgent actions: ${report.summary.urgentActionCount}`,
    `Headline: ${report.summary.headline}`,
    '',
    'Top stewardship actions',
    ...(report.actions.length ? report.actions.map((action) => `- ${action.headline}`) : ['- None']),
  ].join('\n').trim();
}

export function renderCasebookStewardMarkdown(report) {
  return [
    '## Casebook Steward',
    '',
    `- **Cases:** ${report.summary.caseCount}`,
    `- **Conflicts:** ${report.summary.conflictCount}`,
    `- **Owner-covered:** ${report.summary.ownerCoveredCount}`,
    `- **Fix-covered:** ${report.summary.fixCoveredCount}`,
    `- **Runbook-covered:** ${report.summary.runbookCoveredCount}`,
    `- **Actions:** ${report.summary.actionCount}`,
    `- **Urgent actions:** ${report.summary.urgentActionCount}`,
    `- **Headline:** ${escapeMarkdownText(report.summary.headline)}`,
    '',
    '### Top stewardship actions',
    ...(report.actions.length ? report.actions.map((action) => `- ${escapeMarkdownText(action.headline)}`) : ['- None']),
  ].join('\n').trim();
}

function normalizeCases(cases) {
  return Array.isArray(cases)
    ? cases.map((entry) => {
      const sourcePacks = normalizeSourcePacks(entry.sourcePacks, entry.metadata?.['source-packs']);
      return {
        label: String(entry?.label ?? 'case'),
        signature: String(entry?.signature ?? entry?.label ?? 'case'),
        sourcePacks,
        seenCount: Math.max(sourcePacks.length, toCount(entry?.metadata?.['seen-count']) || 0),
        metadata: {
          summary: normalizeText(entry?.metadata?.summary),
          fix: normalizeText(entry?.metadata?.fix),
          owner: normalizeText(entry?.metadata?.owner),
          runbook: normalizeText(entry?.metadata?.runbook),
        },
        conflicts: Array.isArray(entry?.conflicts) ? entry.conflicts.map((item) => String(item)).filter(Boolean) : [],
      };
    })
    : [];
}

function buildActionsForCase(entry) {
  const actions = [];
  const caseName = entry.label;

  if (entry.conflicts.length) {
    actions.push(buildAction('conflict', entry, `Resolve ${entry.conflicts.length} merge conflict${entry.conflicts.length === 1 ? '' : 's'} for ${caseName}.`, `Review ${caseName} and reconcile the conflicting casebook guidance before the next saved export.`));
  }

  if (!entry.metadata.owner) {
    actions.push(buildAction('missing-owner', entry, `Assign an owner for ${caseName}.`, `Capture an owner for ${caseName} so future incidents route cleanly.`));
  }

  if (!entry.metadata.runbook) {
    actions.push(buildAction('missing-runbook', entry, `Add a runbook for ${caseName}.`, `Capture or link a runbook for ${caseName} so responders have a playbook.`));
  }

  if (entry.metadata.owner && !entry.metadata.fix) {
    actions.push(buildAction('missing-fix', entry, `Document the fix for ${caseName}.`, `Capture the proven fix for ${caseName} so the next incident does not rely on memory.`));
  }

  return actions;
}

function buildAction(kind, entry, headline, ask) {
  return {
    kind,
    label: entry.label,
    signature: entry.signature,
    seenCount: Math.max(entry.seenCount, 1),
    sourcePacks: entry.sourcePacks,
    priority: ((10 - (ACTION_PRIORITY[kind] ?? 9)) * 1000) + Math.max(entry.seenCount, 1),
    headline,
    ask,
  };
}

function compareActions(left, right) {
  return (ACTION_PRIORITY[left.kind] ?? 9) - (ACTION_PRIORITY[right.kind] ?? 9)
    || right.seenCount - left.seenCount
    || left.label.localeCompare(right.label)
    || left.signature.localeCompare(right.signature);
}

function buildSummary(cases, actions) {
  const caseCount = cases.length;
  const conflictCount = cases.filter((entry) => entry.conflicts.length).length;
  const ownerCoveredCount = cases.filter((entry) => entry.metadata.owner).length;
  const fixCoveredCount = cases.filter((entry) => entry.metadata.fix).length;
  const runbookCoveredCount = cases.filter((entry) => entry.metadata.runbook).length;
  const actionCount = actions.length;
  const urgentActionCount = actions.filter((entry) => entry.kind === 'conflict' || entry.kind === 'missing-owner').length;

  return {
    caseCount,
    conflictCount,
    ownerCoveredCount,
    fixCoveredCount,
    runbookCoveredCount,
    actionCount,
    urgentActionCount,
    headline: actionCount
      ? `Casebook Steward found ${actionCount} action${actionCount === 1 ? '' : 's'} across ${caseCount} case${caseCount === 1 ? '' : 's'}.`
      : `Casebook Steward found no stewardship gaps across ${caseCount} case${caseCount === 1 ? '' : 's'}.`,
  };
}

function finalizeDrift(direction, previous, current, summary) {
  return {
    direction,
    previousActionCount: toCount(previous?.summary?.actionCount),
    currentActionCount: toCount(current?.summary?.actionCount),
    summary,
    headline: summary,
    available: direction !== 'unavailable',
  };
}

function normalizeSourcePacks(sourcePacks, fallback) {
  if (Array.isArray(sourcePacks) && sourcePacks.length) {
    return [...new Set(sourcePacks.map((item) => String(item).trim()).filter(Boolean))];
  }

  return String(fallback ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || '';
}

function toCount(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}
