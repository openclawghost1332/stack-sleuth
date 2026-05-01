const VERDICT_PRIORITY = {
  'needs-input': 0,
  clear: 1,
  watch: 2,
  hold: 3,
};

const BLOCKER_SPECS = [
  ['totalNovelIncidents', 'novel incidents'],
  ['totalRegressionNew', 'regression-new incidents'],
  ['unownedPackCount', 'unowned runnable packs'],
  ['totalTimelineNew', 'timeline-new incidents'],
];

const WARNING_SPECS = [
  ['runbookGapCount', 'runbook gaps'],
  ['totalRegressionVolumeUp', 'regression-volume-up incidents'],
  ['totalTimelineRising', 'timeline-rising incidents'],
  ['recurringHotspotCount', 'recurring hotspots'],
  ['recurringIncidentCount', 'recurring incidents'],
  ['unrunnablePackCount', 'unrunnable packs'],
];

export function buildReleaseGate(signals = {}, options = {}) {
  const normalizedSignals = normalizeSourceSignals(signals);
  const runnablePackCount = normalizedSignals.runnablePackCount;

  if (runnablePackCount === 0) {
    return finalizeGate({
      verdict: 'needs-input',
      blockers: [],
      warnings: [],
      sources: normalizedSignals,
      summary: 'Release gate needs more runnable evidence before it can produce a confident verdict.',
      nextAction: 'Add at least one runnable incident pack, then rerun the release gate.',
      preserved: options.preserved ?? true,
    });
  }

  const blockers = buildSignalEntries(normalizedSignals, BLOCKER_SPECS);
  const warnings = buildSignalEntries(normalizedSignals, WARNING_SPECS);
  const verdict = blockers.length ? 'hold' : warnings.length ? 'watch' : 'clear';
  const blockerCount = blockers.length;
  const warningCount = warnings.length;

  return finalizeGate({
    verdict,
    blockers,
    warnings,
    sources: normalizedSignals,
    summary: `Release gate is ${verdict} with ${blockerCount} blocker${blockerCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}.`,
    nextAction: buildNextAction(verdict),
    preserved: options.preserved ?? true,
  });
}

export function normalizeReleaseGate(gate, fallbackSignals = {}) {
  if (!gate || typeof gate !== 'object') {
    return buildReleaseGate(fallbackSignals, { preserved: true });
  }

  const blockers = normalizeEntries(gate.blockers);
  const warnings = normalizeEntries(gate.warnings);
  const sources = normalizeSourceSignals({
    ...fallbackSignals,
    ...(gate.sources && typeof gate.sources === 'object' ? gate.sources : {}),
  });
  const verdict = normalizeVerdict(gate.verdict, blockers, warnings, sources);

  return finalizeGate({
    verdict,
    blockers,
    warnings,
    sources,
    summary: typeof gate.summary === 'string' && gate.summary.trim()
      ? gate.summary.trim()
      : buildReleaseGate(sources, { preserved: true }).summary,
    nextAction: typeof gate.nextAction === 'string' && gate.nextAction.trim()
      ? gate.nextAction.trim()
      : buildNextAction(verdict),
    preserved: gate.preserved !== false,
  });
}

export function compareGateSnapshots(previousGate, currentGate) {
  if (!previousGate || !currentGate) {
    return finalizeGateDrift({
      direction: 'unavailable',
      previousVerdict: previousGate?.verdict ?? null,
      currentVerdict: currentGate?.verdict ?? null,
      summary: 'Gate drift unavailable because one of the compared snapshots is missing release-gate detail.',
    });
  }

  if (previousGate.preserved === false || currentGate.preserved === false) {
    return finalizeGateDrift({
      direction: 'unavailable',
      previousVerdict: previousGate.verdict,
      currentVerdict: currentGate.verdict,
      summary: 'Gate drift unavailable because one of the compared snapshots had to reconstruct release-gate detail from older dataset fields.',
    });
  }

  const previousRank = VERDICT_PRIORITY[previousGate.verdict] ?? -1;
  const currentRank = VERDICT_PRIORITY[currentGate.verdict] ?? -1;

  if (currentRank > previousRank) {
    return finalizeGateDrift({
      direction: 'regressed',
      previousVerdict: previousGate.verdict,
      currentVerdict: currentGate.verdict,
      summary: `Regressed from ${previousGate.verdict} to ${currentGate.verdict}.`,
    });
  }

  if (currentRank < previousRank) {
    return finalizeGateDrift({
      direction: 'improved',
      previousVerdict: previousGate.verdict,
      currentVerdict: currentGate.verdict,
      summary: `Improved from ${previousGate.verdict} to ${currentGate.verdict}.`,
    });
  }

  return finalizeGateDrift({
    direction: 'flat',
    previousVerdict: previousGate.verdict,
    currentVerdict: currentGate.verdict,
    summary: `Stayed ${currentGate.verdict} across the compared snapshots.`,
  });
}

export function summarizeReleaseGateDrift(snapshots = []) {
  const normalized = snapshots
    .map((snapshot) => ({
      label: snapshot?.label ?? '-',
      gate: normalizeReleaseGate(snapshot?.dataset?.gate, snapshot?.dataset?.gate?.sources ?? snapshot?.dataset?.summary ?? {}),
    }))
    .filter((snapshot) => snapshot.gate.preserved);

  const previous = normalized.at(-2)?.gate ?? null;
  const current = normalized.at(-1)?.gate ?? null;
  const drift = compareGateSnapshots(previous, current);

  return {
    ...drift,
    preservedSnapshotCount: normalized.length,
    latestLabel: normalized.at(-1)?.label ?? null,
    previousLabel: normalized.at(-2)?.label ?? null,
    latestVerdict: current?.verdict ?? null,
    latestGate: current,
  };
}

export function renderReleaseGateText(gate) {
  return [
    `Release gate: ${gate.verdict}`,
    `Verdict: ${gate.verdict}`,
    `Summary: ${gate.summary}`,
    `Blockers: ${formatEntries(gate.blockers)}`,
    `Warnings: ${formatEntries(gate.warnings)}`,
    `Next action: ${gate.nextAction}`,
  ].join('\n');
}

export function renderReleaseGateMarkdown(gate) {
  return [
    `- **Release gate:** ${gate.verdict}`,
    `- **Summary:** ${escapeMarkdownText(gate.summary)}`,
    `- **Blockers:** ${escapeMarkdownText(formatEntries(gate.blockers))}`,
    `- **Warnings:** ${escapeMarkdownText(formatEntries(gate.warnings))}`,
    `- **Next action:** ${escapeMarkdownText(gate.nextAction)}`,
  ].join('\n');
}

function buildSignalEntries(signals, specs) {
  return specs
    .map(([key, label]) => ({ key, label, count: toCount(signals[key]) }))
    .filter((entry) => entry.count > 0);
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      key: String(entry.key ?? 'unknown'),
      label: String(entry.label ?? entry.key ?? 'unknown'),
      count: toCount(entry.count),
    }))
    .filter((entry) => entry.count > 0);
}

function normalizeSourceSignals(signals = {}) {
  return {
    totalNovelIncidents: toCount(signals.totalNovelIncidents),
    totalRegressionNew: toCount(signals.totalRegressionNew),
    totalRegressionVolumeUp: toCount(signals.totalRegressionVolumeUp),
    unownedPackCount: toCount(signals.unownedPackCount),
    runbookGapCount: toCount(signals.runbookGapCount),
    totalTimelineNew: toCount(signals.totalTimelineNew),
    totalTimelineRising: toCount(signals.totalTimelineRising),
    recurringHotspotCount: toCount(signals.recurringHotspotCount),
    recurringIncidentCount: toCount(signals.recurringIncidentCount),
    runnablePackCount: toCount(signals.runnablePackCount),
    unrunnablePackCount: toCount(signals.unrunnablePackCount),
  };
}

function normalizeVerdict(verdict, blockers, warnings, sources) {
  if (Object.prototype.hasOwnProperty.call(VERDICT_PRIORITY, verdict)) {
    return verdict;
  }

  if (sources.runnablePackCount === 0) {
    return 'needs-input';
  }

  if (blockers.length) {
    return 'hold';
  }

  if (warnings.length) {
    return 'watch';
  }

  return 'clear';
}

function buildNextAction(verdict) {
  if (verdict === 'hold') {
    return 'Stop the release and inspect the blocking packs first.';
  }

  if (verdict === 'watch') {
    return 'Proceed carefully and inspect the warning signals before widening the rollout.';
  }

  if (verdict === 'clear') {
    return 'No blocking or warning signals remain in runnable evidence. Proceed with the release.';
  }

  return 'Gather more runnable evidence before making a release decision.';
}

function finalizeGate({ verdict, blockers, warnings, sources, summary, nextAction, preserved }) {
  const blockerCount = blockers.length;
  const warningCount = warnings.length;
  const headline = buildHeadline(verdict, blockers, warnings, preserved);
  const checklist = buildChecklist(verdict, blockers, warnings, nextAction);

  return {
    verdict,
    blockers,
    warnings,
    summary,
    nextAction,
    sources,
    preserved,
    blockerCount,
    warningCount,
    headline,
    checklist,
  };
}

function finalizeGateDrift(drift) {
  return {
    ...drift,
    change: drift.direction === 'flat' ? 'steady' : drift.direction,
    headline: drift.summary,
    available: drift.direction !== 'unavailable',
  };
}

function buildHeadline(verdict, blockers, warnings, preserved) {
  if (preserved === false) {
    return 'Release Gate could not be preserved from this older saved artifact.';
  }

  if (verdict === 'hold') {
    return `Release Gate: HOLD because ${formatEntries(blockers)} block the release.`;
  }

  if (verdict === 'watch') {
    return `Release Gate: WATCH because ${formatEntries(warnings)} need follow-up before widening exposure.`;
  }

  if (verdict === 'clear') {
    return 'Release Gate: CLEAR because Stack Sleuth did not find blocker or warning signals in runnable evidence.';
  }

  return 'Release Gate: NEEDS INPUT because Stack Sleuth does not have enough runnable evidence yet.';
}

function buildChecklist(verdict, blockers, warnings, nextAction) {
  const checklist = [nextAction];

  if (blockers.some((item) => item.key === 'totalNovelIncidents')) {
    checklist.push('Confirm the novel incidents before assuming the release is only repeating known failures.');
  }

  if (blockers.some((item) => item.key === 'totalRegressionNew')) {
    checklist.push('Inspect candidate-only regression incidents before widening the rollout or release exposure.');
  }

  if (warnings.some((item) => item.key === 'runbookGapCount')) {
    checklist.push('Patch missing runbooks so recalled owners are not operating without playbooks.');
  }

  if (warnings.some((item) => item.key === 'recurringHotspotCount')) {
    checklist.push('Inspect recurring hotspot files because one code path may explain several packs at once.');
  }

  if (verdict === 'clear') {
    checklist.push('Keep monitoring, but Stack Sleuth did not find blocker or warning signals in runnable evidence.');
  }

  return [...new Set(checklist.filter(Boolean))];
}

function formatEntries(entries) {
  if (!entries.length) {
    return 'None';
  }

  return entries.map((entry) => `${entry.count} ${entry.label}`).join(', ');
}

function toCount(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}
