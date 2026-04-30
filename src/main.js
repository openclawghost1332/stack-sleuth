import { analyzeTrace, formatFrame, renderTextSummary } from './analyze.js';
import {
  analyzeIncidentPack,
  renderIncidentPackTextSummary,
} from './briefing.js';
import {
  analyzeIncidentPortfolio,
  parseIncidentPortfolio,
  summarizePortfolioPrimaryCulprit,
  selectPrimaryPortfolioIncident,
} from './portfolio.js';
import { analyzeCasebook, renderCasebookTextSummary } from './casebook.js';
import { analyzeCasebookForge, renderCasebookForgeTextSummary } from './forge.js';
import { analyzeTraceDigest, renderDigestTextSummary } from './digest.js';
import { parseIncidentPack } from './pack.js';
import { analyzeRegression } from './regression.js';
import { analyzeTimeline, renderTimelineTextSummary } from './timeline.js';
import { extractTraceSet } from './extract.js';
import { examples } from './examples.js';

const traceInput = document.querySelector('#trace-input');
const explainButton = document.querySelector('#explain-button');
const loadJsButton = document.querySelector('#load-js-button');
const loadPythonButton = document.querySelector('#load-python-button');
const loadRawLogButton = document.querySelector('#load-raw-log-button');
const loadDigestButton = document.querySelector('#load-digest-button');
const loadPackButton = document.querySelector('#load-pack-button');
const loadPortfolioButton = document.querySelector('#load-portfolio-button');
const copyButton = document.querySelector('#copy-button');
const caption = document.querySelector('#example-caption');

const compareBaselineInput = document.querySelector('#compare-baseline-input');
const compareCandidateInput = document.querySelector('#compare-candidate-input');
const compareButton = document.querySelector('#compare-button');
const loadRegressionButton = document.querySelector('#load-regression-button');
const compareCaption = document.querySelector('#compare-caption');

const casebookCurrentInput = document.querySelector('#casebook-current-input');
const casebookHistoryInput = document.querySelector('#casebook-history-input');
const casebookButton = document.querySelector('#casebook-button');
const loadCasebookButton = document.querySelector('#load-casebook-button');
const copyCasebookButton = document.querySelector('#copy-casebook-button');
const casebookCaption = document.querySelector('#casebook-caption');

const timelineInput = document.querySelector('#timeline-input');
const timelineButton = document.querySelector('#timeline-button');
const loadTimelineButton = document.querySelector('#load-timeline-button');
const copyTimelineButton = document.querySelector('#copy-timeline-button');
const timelineCaption = document.querySelector('#timeline-caption');

const excavationValue = document.querySelector('#excavation-value');
const runtimeValue = document.querySelector('#runtime-value');
const headlineValue = document.querySelector('#headline-value');
const culpritValue = document.querySelector('#culprit-value');
const confidenceValue = document.querySelector('#confidence-value');
const tagsValue = document.querySelector('#tags-value');
const signatureValue = document.querySelector('#signature-value');
const supportFramesValue = document.querySelector('#support-frames-value');
const hotspotsValue = document.querySelector('#hotspots-value');
const summaryValue = document.querySelector('#summary-value');
const blastRadiusValue = document.querySelector('#blast-radius-value');
const digestGroupsValue = document.querySelector('#digest-groups-value');
const checklistValue = document.querySelector('#checklist-value');
const regressionSummaryValue = document.querySelector('#regression-summary-value');
const regressionIncidentsValue = document.querySelector('#regression-incidents-value');
const hotspotShiftsValue = document.querySelector('#hotspot-shifts-value');
const casebookSummaryValue = document.querySelector('#casebook-summary-value');
const knownCountValue = document.querySelector('#known-count-value');
const novelCountValue = document.querySelector('#novel-count-value');
const closestMatchesValue = document.querySelector('#closest-matches-value');
const timelineSummaryValue = document.querySelector('#timeline-summary-value');
const timelineIncidentsValue = document.querySelector('#timeline-incidents-value');
const timelineHotspotsValue = document.querySelector('#timeline-hotspots-value');
const portfolioSummaryValue = document.querySelector('#portfolio-summary-value');
const portfolioPackCountValue = document.querySelector('#portfolio-pack-count-value');
const portfolioPriorityValue = document.querySelector('#portfolio-priority-value');
const portfolioRecurringIncidentsValue = document.querySelector('#portfolio-recurring-incidents-value');
const portfolioRecurringHotspotsValue = document.querySelector('#portfolio-recurring-hotspots-value');
const portfolioResponseQueueValue = document.querySelector('#portfolio-response-queue-value');
const portfolioRoutingGapsValue = document.querySelector('#portfolio-routing-gaps-value');
const forgeSummaryValue = document.querySelector('#forge-summary-value');
const forgeExportValue = document.querySelector('#forge-export-value');

const jsExample = examples.find((item) => item.label === 'JavaScript undefined property');
const pythonExample = examples.find((item) => item.label === 'Python missing key');
const rawLogExample = examples.find((item) => item.label === 'Raw log excavation');
const digestExample = examples.find((item) => item.label === 'Repeated incident digest');
const incidentPackExample = examples.find((item) => item.label === 'Incident pack briefing');
const portfolioExample = examples.find((item) => item.label === 'Portfolio radar');
const casebookExample = examples.find((item) => item.label === 'Casebook Radar');
const regressionExample = examples.find((item) => item.label === 'Regression radar');
const timelineExample = examples.find((item) => item.label === 'Timeline radar');

function renderDiagnosis() {
  const traceText = traceInput.value.trim();
  if (!traceText) {
    resetEmptyState();
    return;
  }

  const portfolio = parseIncidentPortfolio(traceText);
  if (portfolio.packOrder.length) {
    renderPortfolioWorkflow(portfolio);
    return;
  }

  resetPortfolioState();
  resetForgeState();

  const incidentPack = parseIncidentPack(traceText);
  if (incidentPack.sectionOrder.length) {
    renderIncidentPackWorkflow(incidentPack);
    return;
  }

  if (incidentPack.unknownSections.length) {
    renderUnsupportedIncidentPack(incidentPack);
    return;
  }

  const extraction = extractTraceSet(traceText);
  excavationValue.textContent = describeExcavation(extraction);

  if (extraction.traceCount === 0) {
    renderNoTraceExcavated(extraction);
    return;
  }

  if (extraction.traceCount > 1) {
    renderDigest(traceText);
    return;
  }

  const report = analyzeTrace(extraction.traces[0]);
  const diagnosis = report.diagnosis;

  runtimeValue.textContent = report.runtime;
  headlineValue.textContent = `${report.errorName}: ${report.message}`;
  culpritValue.textContent = formatFrame(report.culpritFrame);
  confidenceValue.textContent = diagnosis.confidence;
  tagsValue.textContent = diagnosis.tags.join(', ');
  signatureValue.textContent = report.signature;
  summaryValue.textContent = diagnosis.summary;
  blastRadiusValue.textContent = formatBlastRadiusSummary(normalizeBlastRadius(extraction.entries[0]?.context, extraction.mode));
  digestGroupsValue.replaceChildren(...buildListItems([
    'Repeated incidents will appear here when Stack Sleuth detects multiple traces.'
  ]));
  supportFramesValue.replaceChildren(...buildListItems(
    report.supportFrames.length
      ? report.supportFrames.map((frame) => formatFrame(frame))
      : ['No nearby application frames beyond the culprit were detected.']
  ));
  hotspotsValue.replaceChildren(...buildListItems(buildHotspotItems(report.hotspots)));
  checklistValue.replaceChildren(...buildListItems(diagnosis.checklist));
}

function renderDigest(traceText) {
  const digest = analyzeTraceDigest(traceText);

  excavationValue.textContent = describeExcavation(digest.extraction);
  runtimeValue.textContent = `${digest.groupCount} grouped incident${digest.groupCount === 1 ? '' : 's'}`;
  headlineValue.textContent = `${digest.totalTraces} traces collapsed into ${digest.groupCount} incident groups`;
  culpritValue.textContent = formatFrame(digest.groups[0]?.representative?.culpritFrame ?? null);
  confidenceValue.textContent = digest.groups[0]?.representative?.diagnosis?.confidence ?? 'unknown';
  tagsValue.textContent = digest.groups[0]?.tags?.join(', ') ?? '-';
  signatureValue.textContent = digest.groups[0]?.signature ?? '-';
  summaryValue.textContent = digest.groups[0]?.representative?.diagnosis?.summary ?? 'No digest summary available yet.';
  blastRadiusValue.textContent = formatBlastRadiusSummary(digest.blastRadius);
  digestGroupsValue.replaceChildren(...buildListItems(
    digest.groups.map((group) => `${group.count}x ${group.runtime} ${group.errorName} at ${formatFrame(group.representative.culpritFrame)}`)
  ));
  supportFramesValue.replaceChildren(...buildListItems(
    digest.groups[0]?.representative?.supportFrames?.length
      ? digest.groups[0].representative.supportFrames.map((frame) => formatFrame(frame))
      : ['Open the top incident to inspect its nearby application frames.']
  ));
  hotspotsValue.replaceChildren(...buildListItems(buildHotspotItems(digest.hotspots)));
  checklistValue.replaceChildren(...buildListItems(
    digest.groups[0]?.representative?.diagnosis?.checklist ?? ['Inspect the top repeated incident first.']
  ));
}

function renderPortfolioWorkflow(input) {
  const report = input?.priorityQueue ? input : analyzeIncidentPortfolio(input);
  const forge = analyzeCasebookForge(report);
  const topPack = report.priorityQueue[0] ?? null;
  const primaryIncident = selectPrimaryPortfolioIncident(topPack);
  const topPackLabel = topPack?.label ?? 'none';

  resetCasebookState();
  resetRegressionState();
  resetTimelineState();

  excavationValue.textContent = `Portfolio packs: ${report.summary.packCount} labeled, ${report.summary.runnablePackCount} runnable`;
  runtimeValue.textContent = 'casebook forge';
  headlineValue.textContent = forge.summary.headline;
  culpritValue.textContent = summarizePortfolioPrimaryCulprit(report);
  confidenceValue.textContent = topPack ? 'portfolio' : '-';
  tagsValue.textContent = topPack ? 'casebook-forge, portfolio-radar, incident-pack' : 'casebook-forge, portfolio-radar';
  signatureValue.textContent = topPack ? `top pack: ${topPackLabel}` : '-';
  summaryValue.textContent = `${forge.summary.headline} Portfolio Radar still ranked ${report.summary.runnablePackCount} runnable pack${report.summary.runnablePackCount === 1 ? '' : 's'} for triage.`;
  blastRadiusValue.textContent = buildPortfolioBlastRadiusSummary(topPack, primaryIncident);
  digestGroupsValue.replaceChildren(...buildListItems(buildPortfolioPriorityItems(report.priorityQueue)));
  supportFramesValue.replaceChildren(...buildListItems(
    primaryIncident?.representative?.supportFrames?.length
      ? primaryIncident.representative.supportFrames.map((frame) => formatFrame(frame))
      : ['Open the highest-priority pack to inspect nearby supporting frames.']
  ));
  hotspotsValue.replaceChildren(...buildListItems(buildPortfolioRecurringHotspotItems(report.recurringHotspots)));
  checklistValue.replaceChildren(...buildListItems(report.summary.checklist));

  portfolioSummaryValue.textContent = buildPortfolioSummary(report);
  portfolioPackCountValue.textContent = `${report.summary.runnablePackCount} / ${report.summary.packCount}`;
  portfolioPriorityValue.replaceChildren(...buildListItems(buildPortfolioPriorityItems(report.priorityQueue)));
  portfolioRecurringIncidentsValue.replaceChildren(...buildListItems(buildPortfolioRecurringIncidentItems(report.recurringIncidents)));
  portfolioRecurringHotspotsValue.replaceChildren(...buildListItems(buildPortfolioRecurringHotspotItems(report.recurringHotspots)));
  portfolioResponseQueueValue.replaceChildren(...buildListItems(buildPortfolioResponseQueueItems(report.responseQueue)));
  portfolioRoutingGapsValue.replaceChildren(...buildListItems(buildPortfolioRoutingGapItems(report.unownedPacks, report.runbookGaps)));
  forgeSummaryValue.textContent = `${forge.summary.headline} Reusable cases are ready to paste into a labeled history casebook.`;
  forgeExportValue.textContent = forge.exportText || 'No forged export available yet.';
}

function renderIncidentPackWorkflow(incidentPack) {
  const briefing = analyzeIncidentPack(incidentPack);
  const primaryAnalysis = selectIncidentPackPrimaryAnalysis(briefing);
  const primaryReport = selectIncidentPackPrimaryReport(briefing);
  const primaryRepresentative = primaryReport?.representative ?? null;
  const currentDigest = briefing.currentDigest;
  const sharedBlastRadiusText = formatBlastRadiusSummary(selectIncidentPackBlastRadius(briefing, primaryAnalysis));
  const sharedHotspotItems = selectIncidentPackHotspotItems(briefing, primaryAnalysis);

  excavationValue.textContent = `Sections: ${briefing.summary.sectionsPresent.join(', ') || 'none'} | Analyses: ${briefing.availableAnalyses.join(', ') || 'none'}`;
  runtimeValue.textContent = 'incident pack briefing';
  headlineValue.textContent = briefing.summary.headline;
  culpritValue.textContent = formatFrame(primaryRepresentative?.culpritFrame ?? null);
  confidenceValue.textContent = primaryRepresentative?.diagnosis?.confidence ?? 'briefing';
  tagsValue.textContent = briefing.availableAnalyses.length
    ? ['incident-pack', ...briefing.availableAnalyses].join(', ')
    : 'incident-pack';
  signatureValue.textContent = primaryReport?.signature ?? '-';
  summaryValue.textContent = selectIncidentPackPrimarySummary(briefing, primaryAnalysis);
  blastRadiusValue.textContent = sharedBlastRadiusText;
  digestGroupsValue.replaceChildren(...buildListItems(buildIncidentPackDigestItems(briefing)));
  supportFramesValue.replaceChildren(...buildListItems(
    primaryRepresentative?.supportFrames?.length
      ? primaryRepresentative.supportFrames.map((frame) => formatFrame(frame))
      : ['Open the top incident-pack finding to inspect nearby supporting frames.']
  ));
  hotspotsValue.replaceChildren(...buildListItems(sharedHotspotItems));
  checklistValue.replaceChildren(...buildListItems(briefing.summary.checklist));

  if (briefing.casebook) {
    casebookSummaryValue.textContent = `Casebook Radar matched ${briefing.casebook.summary.knownCount} known incident${briefing.casebook.summary.knownCount === 1 ? '' : 's'} and flagged ${briefing.casebook.summary.novelCount} novel incident${briefing.casebook.summary.novelCount === 1 ? '' : 's'} across ${briefing.casebook.summary.historicalCaseCount} labeled prior-incident cases.`;
    knownCountValue.textContent = String(briefing.casebook.summary.knownCount);
    novelCountValue.textContent = String(briefing.casebook.summary.novelCount);
    closestMatchesValue.replaceChildren(...buildListItems(buildCasebookMatchItems(briefing.casebook.historicalCases)));
    casebookCaption.textContent = briefing.casebook.summary.topCaseLabel
      ? `Closest prior incident match: ${briefing.casebook.summary.topCaseLabel}.`
      : 'Incident Pack Briefing ran Casebook Radar across the current batch and labeled history.';
  } else {
    resetCasebookState();
  }

  if (briefing.regression) {
    const summary = briefing.regression.summary;
    regressionSummaryValue.textContent = [
      `${summary.newCount} new`,
      `${summary.volumeUpCount} volume-up`,
      `${summary.recurringCount} recurring`,
      `${summary.volumeDownCount} volume-down`,
      `${summary.resolvedCount} resolved`,
    ].join(', ');
    regressionIncidentsValue.replaceChildren(...buildListItems(
      briefing.regression.incidents.length
        ? briefing.regression.incidents.map((incident) => `${incident.status}: ${incident.candidateCount} vs ${incident.baselineCount} (${formatDelta(incident.delta)}) at ${formatFrame(incident.representative?.culpritFrame ?? null)}`)
        : ['No incident changes detected.']
    ));
    hotspotShiftsValue.replaceChildren(...buildListItems(
      briefing.regression.hotspotShifts.length
        ? briefing.regression.hotspotShifts.map((shift) => `${shift.status}: ${shift.label} ${formatDelta(shift.delta)} (${shift.baselineScore} → ${shift.candidateScore})`)
        : ['No hotspot shifts detected yet.']
    ));
  } else {
    resetRegressionState();
  }

  if (briefing.timeline) {
    const summary = briefing.timeline.summary;
    timelineSummaryValue.textContent = `Latest snapshot ${summary.latestLabel} carries ${summary.latestTotalTraces} traces across ${summary.activeLatestCount} active incidents. Trend mix: ${summary.newCount} new, ${summary.risingCount} rising, ${summary.flappingCount} flapping, ${summary.steadyCount} steady, ${summary.fallingCount} falling, ${summary.resolvedCount} resolved.`;
    timelineIncidentsValue.replaceChildren(...buildListItems(buildTimelineIncidentItems(briefing.timeline.incidents)));
    timelineHotspotsValue.replaceChildren(...buildListItems(buildTimelineHotspotItems(briefing.timeline.hotspots)));
    timelineCaption.textContent = 'Incident Pack Briefing ran Timeline Radar across the labeled rollout snapshots.';
  } else {
    resetTimelineState();
  }

  if (!currentDigest && !briefing.availableAnalyses.length) {
    summaryValue.textContent = 'Incident Pack Briefing did not find any runnable analyses in this pack yet.';
  }

  blastRadiusValue.textContent = sharedBlastRadiusText;
  hotspotsValue.replaceChildren(...buildListItems(sharedHotspotItems));
}

function renderUnsupportedIncidentPack(incidentPack) {
  const unknownSections = incidentPack.unknownSections.join(', ') || 'unknown';

  excavationValue.textContent = `Unsupported incident-pack sections: ${unknownSections}`;
  runtimeValue.textContent = 'incident pack guidance';
  headlineValue.textContent = 'Stack Sleuth did not find any supported incident-pack sections in this input yet';
  culpritValue.textContent = 'No supported incident-pack section selected yet';
  confidenceValue.textContent = '-';
  tagsValue.textContent = 'incident-pack, unsupported-sections';
  signatureValue.textContent = '-';
  summaryValue.textContent = 'Use @@ current @@, @@ history @@, @@ baseline @@, @@ candidate @@, or @@ timeline @@ as top-level section headers, then rerun the incident pack briefing.';
  blastRadiusValue.textContent = 'Blast radius details will appear after at least one supported incident-pack section contains usable traces.';
  digestGroupsValue.replaceChildren(...buildListItems([
    'Supported incident-pack findings will appear here after Stack Sleuth recognizes at least one supported @@ section @@ header.'
  ]));
  supportFramesValue.replaceChildren(...buildListItems([
    'Support frames will appear here after a supported incident-pack section yields a runnable analysis.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems([
    'Suspect hotspots will appear here after Stack Sleuth recognizes a supported current, candidate, or timeline section.'
  ]));
  checklistValue.replaceChildren(...buildListItems([
    'Rename the section headers to supported incident-pack names like @@ current @@ or @@ timeline @@.',
    'Keep each supported section at the top level so Stack Sleuth can route it into the right analysis.',
  ]));
  resetCasebookState();
  resetRegressionState();
  resetTimelineState();
}

function renderRegressionWorkflow() {
  resetPortfolioState();
  resetForgeState();

  const baseline = compareBaselineInput.value.trim();
  const candidate = compareCandidateInput.value.trim();

  if (!baseline || !candidate) {
    resetRegressionState();
    return;
  }

  const regression = analyzeRegression({ baseline, candidate });
  const summary = regression.summary;
  const topIncident = regression.incidents[0] ?? null;
  const topReport = topIncident?.representative ?? null;

  excavationValue.textContent = `${describeExcavation(regression.baselineDigest.extraction, 'Baseline')} | ${describeExcavation(regression.candidateDigest.extraction, 'Candidate')}`;
  runtimeValue.textContent = 'comparison';
  headlineValue.textContent = `${summary.totalCandidateTraces} candidate traces vs ${summary.totalBaselineTraces} baseline traces`;
  culpritValue.textContent = formatFrame(topReport?.culpritFrame ?? null);
  confidenceValue.textContent = topReport?.diagnosis?.confidence ?? 'comparison';
  tagsValue.textContent = topIncident
    ? [topIncident.status, ...(topReport?.diagnosis?.tags ?? [])].join(', ')
    : '-';
  signatureValue.textContent = topIncident?.signature ?? '-';
  summaryValue.textContent = topIncident
    ? `Top shift: ${topIncident.status} incident at ${formatFrame(topReport?.culpritFrame ?? null)} changed from ${topIncident.baselineCount} to ${topIncident.candidateCount} occurrences.`
    : 'No incident changes detected.';
  blastRadiusValue.textContent = formatComparisonBlastRadiusSummary(regression);
  digestGroupsValue.replaceChildren(...buildListItems(
    regression.incidents.length
      ? regression.incidents.map((incident) => `${incident.status}: ${incident.candidateCount} vs ${incident.baselineCount} (${formatDelta(incident.delta)})`)
      : ['No incident changes detected.']
  ));
  supportFramesValue.replaceChildren(...buildListItems(
    topReport?.supportFrames?.length
      ? topReport.supportFrames.map((frame) => formatFrame(frame))
      : ['Open the top changed incident to inspect nearby supporting frames.']
  ));
  hotspotsValue.replaceChildren(...buildListItems(buildHotspotItems(regression.candidateDigest.hotspots)));
  hotspotShiftsValue.replaceChildren(...buildListItems(
    regression.hotspotShifts.length
      ? regression.hotspotShifts.map((shift) => `${shift.status}: ${shift.label} ${formatDelta(shift.delta)} (${shift.baselineScore} → ${shift.candidateScore})`)
      : ['No hotspot shifts detected yet.']
  ));
  checklistValue.replaceChildren(...buildListItems(buildRegressionChecklist(summary, topIncident)));

  regressionSummaryValue.textContent = [
    `${summary.newCount} new`,
    `${summary.volumeUpCount} volume-up`,
    `${summary.recurringCount} recurring`,
    `${summary.volumeDownCount} volume-down`,
    `${summary.resolvedCount} resolved`,
    `${summary.totalBaselineTraces} baseline traces`,
    `${summary.totalCandidateTraces} candidate traces`
  ].join(', ');

  regressionIncidentsValue.replaceChildren(...buildListItems(
    regression.incidents.map((incident) => {
      const culprit = formatFrame(incident.representative?.culpritFrame ?? null);
      return `${incident.status}: ${incident.candidateCount} vs ${incident.baselineCount} (${formatDelta(incident.delta)}) at ${culprit}`;
    })
  ));
}

function renderCasebookWorkflow() {
  resetPortfolioState();
  resetForgeState();

  const current = casebookCurrentInput.value.trim();
  const history = casebookHistoryInput.value.trim();

  if (!current || !history) {
    resetCasebookState();
    resetEmptyState();
    return;
  }

  const casebook = analyzeCasebook({ current, history });

  if (casebook.summary.currentTraceCount === 0) {
    casebookCaption.textContent = 'Casebook Radar could not excavate a current trace yet. Paste a fuller stack trace or raw log snippet first.';
    resetCasebookState();
    resetEmptyState();
    return;
  }

  if (casebook.summary.historicalCaseCount === 0) {
    casebookCaption.textContent = 'Casebook Radar needs labeled prior incidents like === release-2026-04-15 === before it can compare anything.';
    resetCasebookState();
    resetEmptyState();
    return;
  }

  const topIncident = casebook.incidents[0] ?? null;
  const topReport = topIncident?.representative ?? null;

  excavationValue.textContent = `Current: ${describeExcavation(casebook.currentDigest.extraction)} | History: ${casebook.summary.historicalCaseCount} labeled prior incidents`;
  runtimeValue.textContent = 'casebook radar';
  headlineValue.textContent = `${casebook.summary.knownCount} known matches, ${casebook.summary.novelCount} novel incidents`;
  culpritValue.textContent = formatFrame(topReport?.culpritFrame ?? null);
  confidenceValue.textContent = topReport?.diagnosis?.confidence ?? 'casebook';
  tagsValue.textContent = topIncident
    ? [topIncident.classification, ...(topIncident.diagnosisTags ?? [])].join(', ')
    : '-';
  signatureValue.textContent = topIncident?.signature ?? '-';
  summaryValue.textContent = buildCasebookSummary(casebook);
  blastRadiusValue.textContent = formatBlastRadiusSummary(casebook.currentDigest.blastRadius);
  digestGroupsValue.replaceChildren(...buildListItems(buildCasebookIncidentItems(casebook.incidents)));
  supportFramesValue.replaceChildren(...buildListItems(
    topReport?.supportFrames?.length
      ? topReport.supportFrames.map((frame) => formatFrame(frame))
      : ['Open the top Casebook Radar incident to inspect nearby supporting frames.']
  ));
  hotspotsValue.replaceChildren(...buildListItems(buildHotspotItems(casebook.currentDigest.hotspots)));
  checklistValue.replaceChildren(...buildListItems(buildCasebookChecklist(casebook)));

  casebookSummaryValue.textContent = `Casebook Radar matched ${casebook.summary.knownCount} known incident${casebook.summary.knownCount === 1 ? '' : 's'} and flagged ${casebook.summary.novelCount} novel incident${casebook.summary.novelCount === 1 ? '' : 's'} across ${casebook.summary.historicalCaseCount} labeled prior-incident cases.`;
  knownCountValue.textContent = String(casebook.summary.knownCount);
  novelCountValue.textContent = String(casebook.summary.novelCount);
  closestMatchesValue.replaceChildren(...buildListItems(buildCasebookMatchItems(casebook.historicalCases)));
  casebookCaption.textContent = casebook.summary.topCaseLabel
    ? `Closest prior incident match: ${casebook.summary.topCaseLabel}.`
    : 'Casebook Radar compared the current batch against your labeled prior incidents.';
}

function renderTimelineWorkflow() {
  resetPortfolioState();
  resetForgeState();

  const timelineText = timelineInput.value.trim();
  if (!timelineText) {
    resetTimelineState();
    return;
  }

  const timeline = analyzeTimeline(timelineText);
  if (timeline.summary.snapshotCount < 2) {
    excavationValue.textContent = 'Paste at least two labeled snapshots before Stack Sleuth can compare rollout movement.';
    blastRadiusValue.textContent = 'Blast radius details appear after at least two labeled snapshots expose affected services and time windows.';
    timelineSummaryValue.textContent = 'Add at least two labeled snapshots like === canary === and === full-rollout ===.';
    timelineIncidentsValue.replaceChildren(...buildListItems([
      'Timeline trend calls and hotspot movement will appear here after at least two labeled snapshots.'
    ]));
    timelineHotspotsValue.replaceChildren(...buildListItems([
      'Timeline hotspot movement between labeled snapshots will appear here once a rollout timeline is pasted.'
    ]));
    return;
  }

  const summary = timeline.summary;
  const topIncident = timeline.incidents[0] ?? null;
  const topReport = topIncident?.representative ?? null;
  const latestDigest = timeline.snapshots.at(-1)?.digest ?? { hotspots: [] };

  excavationValue.textContent = timeline.snapshots
    .map((snapshot) => `${snapshot.label}: ${describeExcavation(snapshot.digest.extraction)}`)
    .join(' | ');
  runtimeValue.textContent = `${summary.snapshotCount} snapshots`;
  headlineValue.textContent = `${summary.latestLabel} rollout snapshot (${summary.latestTotalTraces} traces)`;
  culpritValue.textContent = formatFrame(topReport?.culpritFrame ?? null);
  confidenceValue.textContent = topReport?.diagnosis?.confidence ?? 'timeline';
  tagsValue.textContent = topIncident
    ? [topIncident.trend, ...(topReport?.diagnosis?.tags ?? [])].join(', ')
    : '-';
  signatureValue.textContent = topIncident?.signature ?? '-';
  summaryValue.textContent = `Timeline Radar found ${summary.newCount} new, ${summary.risingCount} rising, ${summary.flappingCount} flapping, ${summary.steadyCount} steady, ${summary.fallingCount} falling, and ${summary.resolvedCount} resolved incidents across ${summary.snapshotCount} labeled snapshots.`;
  blastRadiusValue.textContent = formatTimelineBlastRadiusSummary(topIncident, latestDigest);
  digestGroupsValue.replaceChildren(...buildListItems(buildTimelineIncidentItems(timeline.incidents)));
  supportFramesValue.replaceChildren(...buildListItems(
    topReport?.supportFrames?.length
      ? topReport.supportFrames.map((frame) => formatFrame(frame))
      : ['Open the top timeline incident to inspect nearby supporting frames.']
  ));
  hotspotsValue.replaceChildren(...buildListItems(buildHotspotItems(latestDigest.hotspots)));
  checklistValue.replaceChildren(...buildListItems(buildTimelineChecklist(summary, topIncident)));

  timelineSummaryValue.textContent = `Latest snapshot ${summary.latestLabel} carries ${summary.latestTotalTraces} traces across ${summary.activeLatestCount} active incidents. Trend mix: ${summary.newCount} new, ${summary.risingCount} rising, ${summary.flappingCount} flapping, ${summary.steadyCount} steady, ${summary.fallingCount} falling, ${summary.resolvedCount} resolved.`;
  timelineIncidentsValue.replaceChildren(...buildListItems(buildTimelineIncidentItems(timeline.incidents)));
  timelineHotspotsValue.replaceChildren(...buildListItems(buildTimelineHotspotItems(timeline.hotspots)));
}

function renderNoTraceExcavated(extraction) {
  runtimeValue.textContent = 'No trace excavated';
  headlineValue.textContent = 'Stack Sleuth did not find a JavaScript, Python, or Ruby trace in this input yet';
  culpritValue.textContent = 'No application frame detected';
  confidenceValue.textContent = '-';
  tagsValue.textContent = '-';
  signatureValue.textContent = '-';
  summaryValue.textContent = `Stack Sleuth ignored ${extraction.ignoredLineCount} non-trace lines and did not excavate a usable trace. Paste a fuller stack trace or noisier log section that still contains the embedded exception.`;
  blastRadiusValue.textContent = 'No blast radius yet because Stack Sleuth did not excavate a usable trace from the noisy input.';
  digestGroupsValue.replaceChildren(...buildListItems([
    'Excavated traces will appear here when Stack Sleuth detects more than one trace in the current input.'
  ]));
  supportFramesValue.replaceChildren(...buildListItems([
    'Support frames will appear here when Stack Sleuth finds a usable excavated trace.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems([
    'Suspect hotspots will appear here after Stack Sleuth excavates at least one trace.'
  ]));
  checklistValue.replaceChildren(...buildListItems([
    'Paste a wider raw log section that still includes the exception header and stack frames.',
    'If the logs were already scrubbed, paste a direct stack trace instead.',
  ]));
}

function resetEmptyState() {
  resetPortfolioState();
  resetForgeState();
  excavationValue.textContent = 'Awaiting trace or raw log input';
  headlineValue.textContent = 'Paste one or more traces or raw logs to get started';
  runtimeValue.textContent = 'Awaiting trace';
  culpritValue.textContent = 'No frame selected yet';
  confidenceValue.textContent = '-';
  tagsValue.textContent = '-';
  signatureValue.textContent = '-';
  supportFramesValue.replaceChildren(...buildListItems([
    'Support frames will appear here when Stack Sleuth finds nearby app frames.'
  ]));
  digestGroupsValue.replaceChildren(...buildListItems([
    'Repeated incidents will appear here when Stack Sleuth detects multiple traces.'
  ]));
  summaryValue.textContent = 'Your diagnosis summary will appear here.';
  blastRadiusValue.textContent = 'Affected services, first-seen and last-seen windows, and source context will appear here when Stack Sleuth excavates noisy logs.';
  hotspotsValue.replaceChildren(...buildListItems([
    'Suspect hotspots will appear here when Stack Sleuth detects repeated culprit or support paths.'
  ]));
  checklistValue.replaceChildren(...buildListItems([
    'Run an example or paste one or more real traces to see actionable next steps.'
  ]));
}

function resetPortfolioState() {
  portfolioSummaryValue.textContent = 'Paste several labeled incident packs to rank the release-level triage queue.';
  portfolioPackCountValue.textContent = '-';
  portfolioPriorityValue.replaceChildren(...buildListItems([
    'Priority-ranked packs will appear here after Portfolio Radar runs.'
  ]));
  portfolioRecurringIncidentsValue.replaceChildren(...buildListItems([
    'Recurring cross-pack incident signatures will appear here after Portfolio Radar runs.'
  ]));
  portfolioRecurringHotspotsValue.replaceChildren(...buildListItems([
    'Recurring hotspot files will appear here after Portfolio Radar runs.'
  ]));
  portfolioResponseQueueValue.replaceChildren(...buildListItems([
    'Owner-routed response queue entries will appear here after Portfolio Radar runs.'
  ]));
  portfolioRoutingGapsValue.replaceChildren(...buildListItems([
    'Routing gaps and missing runbooks will appear here after Portfolio Radar runs.'
  ]));
}

function resetForgeState() {
  forgeSummaryValue.textContent = 'Paste several labeled incident packs to forge reusable casebook entries from a portfolio.';
  forgeExportValue.textContent = 'Forged Casebook export text will appear here after Casebook Forge runs.';
}

function resetRegressionState() {
  blastRadiusValue.textContent = 'Affected services and blast radius windows update here for single traces, incident digests, regressions, and rollout timelines.';
  regressionSummaryValue.textContent = 'Paste baseline and candidate traces to compare releases.';
  regressionIncidentsValue.replaceChildren(...buildListItems([
    'New, resolved, and volume-shifted incidents will appear here after a comparison.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems([
    'Candidate-batch suspect hotspots will appear here after a comparison.'
  ]));
  hotspotShiftsValue.replaceChildren(...buildListItems([
    'Hotspot shifts between baseline and candidate batches will appear here after a comparison.'
  ]));
}

function resetCasebookState() {
  casebookSummaryValue.textContent = 'Paste a current incident batch plus labeled prior incidents to see known versus novel matches.';
  knownCountValue.textContent = '-';
  novelCountValue.textContent = '-';
  closestMatchesValue.replaceChildren(...buildListItems([
    'Closest prior incidents will appear here after a Casebook Radar lookup.'
  ]));
}

function resetTimelineState() {
  blastRadiusValue.textContent = 'Affected services and blast radius windows update here for single traces, incident digests, regressions, and rollout timelines.';
  timelineSummaryValue.textContent = 'Paste labeled rollout snapshots to see incident trends across more than two batches.';
  timelineIncidentsValue.replaceChildren(...buildListItems([
    'Timeline trend calls and hotspot movement will appear here after at least two labeled snapshots.'
  ]));
  timelineHotspotsValue.replaceChildren(...buildListItems([
    'Timeline hotspot movement between labeled snapshots will appear here once a rollout timeline is pasted.'
  ]));
}

function loadExample(example) {
  if (!example) {
    return;
  }

  traceInput.value = example.trace;
  caption.textContent = example.caption;
  renderDiagnosis();
}

function loadIncidentPackExample(example) {
  if (!example) {
    return;
  }

  traceInput.value = example.pack;
  caption.textContent = example.caption;
  renderDiagnosis();
}

function loadPortfolioExample(example) {
  if (!example) {
    return;
  }

  traceInput.value = example.portfolio;
  caption.textContent = example.caption;
  renderDiagnosis();
}

function loadRegressionExample(example) {
  if (!example) {
    return;
  }

  compareBaselineInput.value = example.baseline;
  compareCandidateInput.value = example.candidate;
  compareCaption.textContent = example.caption;
  renderRegressionWorkflow();
}

function loadTimelineExample(example) {
  if (!example) {
    return;
  }

  timelineInput.value = example.timeline;
  timelineCaption.textContent = example.caption;
  renderTimelineWorkflow();
}

function loadCasebookExample(example) {
  if (!example) {
    return;
  }

  casebookCurrentInput.value = example.current;
  casebookHistoryInput.value = example.history;
  casebookCaption.textContent = example.caption;
  renderCasebookWorkflow();
}

async function copyDiagnosis() {
  const traceText = traceInput.value.trim();
  const portfolio = parseIncidentPortfolio(traceText);

  if (portfolio.packOrder.length) {
    const report = analyzeIncidentPortfolio(portfolio);
    const forge = analyzeCasebookForge(report);
    if (!report.summary.runnablePackCount || !forge.exportText) {
      caption.textContent = 'Casebook Forge needs at least one runnable labeled incident pack before there is anything useful to copy.';
      return;
    }

    try {
      await navigator.clipboard.writeText([renderCasebookForgeTextSummary(forge), '', forge.exportText].join('\n').trim());
      caption.textContent = 'Casebook Forge export copied to clipboard.';
    } catch {
      caption.textContent = 'Clipboard copy unavailable here, but the Casebook Forge export is ready to copy manually.';
    }
    return;
  }

  const incidentPack = parseIncidentPack(traceText);

  if (incidentPack.sectionOrder.length) {
    const briefing = analyzeIncidentPack(incidentPack);
    if (!briefing.availableAnalyses.length) {
      caption.textContent = 'Incident Pack Briefing needs at least one runnable section before there is anything useful to copy.';
      return;
    }

    try {
      await navigator.clipboard.writeText(renderIncidentPackTextSummary(briefing));
      caption.textContent = 'Incident Pack Briefing copied to clipboard.';
    } catch {
      caption.textContent = 'Clipboard copy unavailable here, but the Incident Pack Briefing is ready to copy manually.';
    }
    return;
  }

  if (incidentPack.unknownSections.length) {
    caption.textContent = 'Incident Pack Briefing expects supported headers like @@ current @@, @@ history @@, @@ baseline @@, @@ candidate @@, or @@ timeline @@ before there is anything useful to copy.';
    return;
  }

  const extraction = extractTraceSet(traceText);

  if (extraction.traceCount === 0) {
    caption.textContent = 'No excavated trace found yet. Paste a fuller stack trace or raw log snippet first.';
    return;
  }

  const payload = extraction.traceCount > 1
    ? renderDigestTextSummary(analyzeTraceDigest(traceText))
    : [describeExcavation(extraction), renderTextSummary(analyzeTrace(extraction.traces[0]))].join('\n');

  try {
    await navigator.clipboard.writeText(payload);
    caption.textContent = 'Diagnosis copied to clipboard.';
  } catch {
    caption.textContent = 'Clipboard copy unavailable here, but the diagnosis is ready to copy manually.';
  }
}

async function copyTimelineSummary() {
  const timelineText = timelineInput.value.trim();
  const timeline = analyzeTimeline(timelineText);
  if (timeline.summary.snapshotCount < 2) {
    timelineCaption.textContent = 'Add at least two labeled snapshots before copying a timeline summary.';
    return;
  }

  try {
    await navigator.clipboard.writeText(renderTimelineTextSummary(timeline));
    timelineCaption.textContent = 'Timeline Radar summary copied to clipboard.';
  } catch {
    timelineCaption.textContent = 'Clipboard copy unavailable here, but the timeline summary is ready to copy manually.';
  }
}

async function copyCasebookSummary() {
  const current = casebookCurrentInput.value.trim();
  const history = casebookHistoryInput.value.trim();

  if (!current || !history) {
    casebookCaption.textContent = 'Paste a current incident batch and labeled prior incidents before copying a Casebook Radar summary.';
    return;
  }

  const casebook = analyzeCasebook({ current, history });
  if (casebook.summary.currentTraceCount === 0) {
    casebookCaption.textContent = 'Casebook Radar could not excavate a current trace yet, so there is nothing useful to copy.';
    return;
  }

  if (casebook.summary.historicalCaseCount === 0) {
    casebookCaption.textContent = 'Add labeled prior incidents before copying a Casebook Radar summary.';
    return;
  }

  try {
    await navigator.clipboard.writeText(renderCasebookTextSummary(casebook));
    casebookCaption.textContent = 'Casebook Radar summary copied to clipboard.';
  } catch {
    casebookCaption.textContent = 'Clipboard copy unavailable here, but the Casebook Radar summary is ready to copy manually.';
  }
}

function buildListItems(items) {
  return items.map((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    return li;
  });
}

function describeExcavation(extraction, label = null) {
  const prefix = label ? `${label}: ` : '';

  if (!extraction) {
    return `${prefix}awaiting input`;
  }

  if (extraction.mode === 'extracted') {
    return `${prefix}Excavated ${extraction.traceCount} ${extraction.traceCount === 1 ? 'trace' : 'traces'} from raw logs, ignored ${extraction.ignoredLineCount} ${extraction.ignoredLineCount === 1 ? 'non-trace line' : 'non-trace lines'}`;
  }

  return `${prefix}Analyzed ${extraction.traceCount} direct ${extraction.traceCount === 1 ? 'trace' : 'traces'}`;
}

function formatDelta(delta) {
  return delta > 0 ? `+${delta}` : String(delta);
}

function normalizeBlastRadius(context, mode = 'direct') {
  return {
    origin: mode === 'extracted' ? 'extracted' : 'direct',
    services: (context?.services ?? []).map((name) => ({ name, count: 1 })),
    firstSeen: context?.firstSeen ?? null,
    lastSeen: context?.lastSeen ?? null,
  };
}

function formatBlastRadiusSummary(blastRadius) {
  const services = blastRadius?.services?.length
    ? blastRadius.services.map((service) => `${service.name} ${service.count}x`).join(', ')
    : 'no affected services parsed yet';
  const window = blastRadius?.firstSeen || blastRadius?.lastSeen
    ? `${blastRadius.firstSeen ?? blastRadius.lastSeen} → ${blastRadius.lastSeen ?? blastRadius.firstSeen}`
    : 'window unavailable';
  const source = blastRadius?.origin ?? 'direct';
  return `Blast radius: ${services}. Window: ${window}. Source: ${source}.`;
}

function formatComparisonBlastRadiusSummary(regression) {
  return [
    `Candidate ${formatBlastRadiusSummary(regression.candidateDigest?.blastRadius)}`,
    `Baseline ${formatBlastRadiusSummary(regression.baselineDigest?.blastRadius)}`
  ].join(' ');
}

function formatTimelineBlastRadiusSummary(topIncident, latestDigest) {
  if (!topIncident && !latestDigest?.blastRadius) {
    return 'Blast radius details will appear here once rollout snapshots expose affected services or incident windows.';
  }

  const sections = [];

  if (topIncident) {
    sections.push(`Top timeline incident ${formatBlastRadiusSummary(topIncident.blastRadius)}`);
  }

  if (latestDigest?.blastRadius) {
    sections.push(`Latest snapshot ${formatBlastRadiusSummary(latestDigest.blastRadius)}`);
  }

  return sections.join(' ');
}

function buildPortfolioSummary(report) {
  const topPack = report.priorityQueue[0]?.label ?? 'none';
  return `Portfolio Radar ranked ${report.summary.runnablePackCount} runnable pack${report.summary.runnablePackCount === 1 ? '' : 's'} out of ${report.summary.packCount}. Top priority: ${topPack}. Response queue: ${report.summary.ownedPackCount} owned pack${report.summary.ownedPackCount === 1 ? '' : 's'}, ${report.summary.unownedPackCount} routing gap${report.summary.unownedPackCount === 1 ? '' : 's'}, and ${report.summary.runbookGapCount} runbook gap${report.summary.runbookGapCount === 1 ? '' : 's'}. Cross-pack signals: ${report.summary.totalNovelIncidents} novel, ${report.summary.totalRegressionNew} regression-new, and ${report.summary.totalTimelineRising} timeline-rising.`;
}

function buildPortfolioBlastRadiusSummary(topPack, primaryIncident) {
  if (!topPack) {
    return 'Blast radius details will appear here once at least one labeled incident pack becomes runnable.';
  }

  const primaryAnalysis = selectIncidentPackPrimaryAnalysis(topPack.report);
  const blastRadius = selectIncidentPackBlastRadius(topPack.report, primaryAnalysis);
  const culprit = formatFrame(primaryIncident?.representative?.culpritFrame ?? null);
  return `Top pack ${topPack.label} centers on ${culprit}. ${formatBlastRadiusSummary(blastRadius)}`;
}

function buildPortfolioPriorityItems(priorityQueue) {
  if (!priorityQueue.length) {
    return ['Priority-ranked packs will appear here after Portfolio Radar runs.'];
  }

  return priorityQueue.slice(0, 5).map((item, index) => (
    `${index + 1}. ${item.label}: ${item.priorityReasons.join('; ')}`
  ));
}

function buildPortfolioRecurringIncidentItems(recurringIncidents) {
  if (!recurringIncidents.length) {
    return ['No recurring cross-pack incident signatures detected yet.'];
  }

  return recurringIncidents.slice(0, 5).map((item) => (
    `${item.packCount} packs: ${item.labels.join(', ')} (${item.signature})`
  ));
}

function buildPortfolioRecurringHotspotItems(recurringHotspots) {
  if (!recurringHotspots.length) {
    return ['No recurring hotspot files detected across runnable packs yet.'];
  }

  return recurringHotspots.slice(0, 5).map((item) => (
    `${item.label} across ${item.packCount} packs: ${item.labels.join(', ')}`
  ));
}

function buildPortfolioResponseQueueItems(responseQueue) {
  if (!responseQueue?.length) {
    return ['No recalled owners yet across runnable packs.'];
  }

  return responseQueue.map((entry) => {
    const details = [];
    if (entry.guidance?.[0]?.fix) {
      details.push(`fix ${entry.guidance[0].fix}`);
    }
    if (entry.guidance?.[0]?.runbook) {
      details.push(`runbook ${entry.guidance[0].runbook}`);
    }
    return `${entry.owner}: ${entry.labels.join(', ')}${details.length ? ` (${details.join('; ')})` : ''}`;
  });
}

function buildPortfolioRoutingGapItems(unownedPacks, runbookGaps) {
  const items = [];

  if (unownedPacks?.length) {
    items.push(...unownedPacks.map((item) => `No recalled owner: ${item.label}`));
  }

  if (runbookGaps?.length) {
    items.push(...runbookGaps.map((item) => `No recalled runbook: ${item.label}`));
  }

  return items.length ? items : ['No routing gaps or runbook gaps detected across runnable packs.'];
}

function buildCasebookSummary(casebook) {
  if (!casebook.incidents.length) {
    return 'Casebook Radar did not find any current incidents to classify yet.';
  }

  const topIncident = casebook.incidents[0];
  const knownOrNovel = topIncident.classification === 'known' ? 'a known prior incident' : 'a novel incident';
  const closestMatch = casebook.summary.topCaseLabel ? ` Closest prior incident: ${casebook.summary.topCaseLabel}.` : '';
  return `Casebook Radar found ${casebook.summary.knownCount} known and ${casebook.summary.novelCount} novel incidents in the current batch. The top signature looks like ${knownOrNovel} at ${formatFrame(topIncident.representative?.culpritFrame ?? null)}.${closestMatch}`;
}

function buildCasebookIncidentItems(incidents) {
  if (!incidents.length) {
    return ['Current incident classifications will appear here after a Casebook Radar lookup.'];
  }

  return incidents.map((incident) => (
    `${incident.classification}: ${incident.count}x at ${formatFrame(incident.representative?.culpritFrame ?? null)}${incident.matchingCases.length ? ` (known in ${incident.matchingCases.join(', ')})` : ''}`
  ));
}

function buildCasebookMatchItems(historicalCases) {
  if (!historicalCases.length) {
    return ['Closest prior incidents will appear here after a Casebook Radar lookup.'];
  }

  return historicalCases.slice(0, 5).map((entry) => {
    const guidance = [];
    if (entry.metadata?.owner) {
      guidance.push(`owner ${entry.metadata.owner}`);
    }
    if (entry.metadata?.fix) {
      guidance.push(`fix ${entry.metadata.fix}`);
    }

    return `${entry.label}: ${entry.overlap.exactSignatureCount} exact matches, ${entry.overlap.culpritPathCount} shared culprit paths, ${entry.overlap.diagnosisTagCount} shared diagnosis tags${guidance.length ? `, ${guidance.join(', ')}` : ''}`;
  });
}

function buildCasebookChecklist(casebook) {
  const checklist = [];
  const topIncident = casebook.incidents[0] ?? null;

  if (casebook.summary.novelCount > 0) {
    checklist.push('Inspect novel incidents first to confirm whether today introduced a brand-new failure mode.');
  }
  if (casebook.summary.knownCount > 0) {
    checklist.push('Compare known incident matches against the closest prior cases to reuse the last fix or mitigation faster.');
  }
  if (topIncident?.representative?.diagnosis?.checklist?.length) {
    checklist.push(...topIncident.representative.diagnosis.checklist.slice(0, 2));
  }

  return checklist.length ? checklist : ['Label a few prior incidents so Casebook Radar can separate known repeats from new breakages.'];
}

function buildHotspotItems(hotspots) {
  if (!hotspots.length) {
    return ['No suspect hotspots detected yet.'];
  }

  return hotspots.slice(0, 5).map((hotspot) => (
    `${hotspot.label} scored ${hotspot.score} (${hotspot.culpritCount} culprit, ${hotspot.supportCount} support)`
  ));
}

function buildTimelineIncidentItems(incidents) {
  if (!incidents.length) {
    return ['No incident trends detected yet.'];
  }

  return incidents.slice(0, 6).map((incident) => (
    `${incident.trend}: ${incident.latestCount} latest (${incident.series.join(' → ')}) at ${formatFrame(incident.representative?.culpritFrame ?? null)}`
  ));
}

function buildTimelineHotspotItems(hotspots) {
  if (!hotspots.length) {
    return ['No hotspot movement detected yet.'];
  }

  return hotspots.slice(0, 6).map((hotspot) => (
    `${hotspot.trend}: ${hotspot.label} (${hotspot.series.join(' → ')})`
  ));
}

function buildRegressionChecklist(summary, topIncident) {
  const checklist = [];

  if (summary.newCount > 0) {
    checklist.push('Investigate brand-new signatures first, especially if they appeared right after the latest deploy.');
  }
  if (summary.volumeUpCount > 0) {
    checklist.push('Compare payloads, traffic shape, or rollout segments for incidents that spiked in volume.');
  }
  if (summary.resolvedCount > 0) {
    checklist.push('Confirm resolved incidents against production telemetry before closing the loop.');
  }
  if (topIncident?.representative?.diagnosis?.checklist?.length) {
    checklist.push(...topIncident.representative.diagnosis.checklist.slice(0, 2));
  }

  return checklist.length ? checklist : ['Review the compared batches for signature drift or parsing mismatches.'];
}

function buildTimelineChecklist(summary, topIncident) {
  const checklist = [];

  if (summary.newCount > 0) {
    checklist.push('Inspect brand-new incidents at the latest snapshot before widening the rollout.');
  }
  if (summary.risingCount > 0) {
    checklist.push('Compare payload shape, release flags, or cohort size for incidents that climbed with each snapshot.');
  }
  if (summary.flappingCount > 0) {
    checklist.push('Check segment-specific traffic or retry behavior for incidents that disappeared and returned.');
  }
  if (summary.resolvedCount > 0) {
    checklist.push('Verify that resolved incidents really stayed absent in production telemetry after rollout.');
  }
  if (topIncident?.representative?.diagnosis?.checklist?.length) {
    checklist.push(...topIncident.representative.diagnosis.checklist.slice(0, 2));
  }

  return checklist.length ? checklist : ['Compare labeled snapshots for signature drift, parsing mismatches, or missing traces.'];
}

function buildIncidentPackDigestItems(briefing) {
  const items = [...briefing.summary.topFindings];

  if (briefing.omissions.length) {
    items.push(...briefing.omissions.map((item) => `omission: ${item}`));
  }

  return items.length ? items : ['Incident Pack Briefing findings will appear here once at least one supported section runs.'];
}

function selectIncidentPackPrimaryAnalysis(briefing) {
  if ((briefing.casebook?.summary.novelCount ?? 0) > 0) {
    return 'casebook';
  }

  if ((briefing.regression?.summary.newCount ?? 0) > 0 || (briefing.regression?.summary.volumeUpCount ?? 0) > 0) {
    return 'regression';
  }

  if ((briefing.timeline?.summary.newCount ?? 0) > 0 || (briefing.timeline?.summary.risingCount ?? 0) > 0) {
    return 'timeline';
  }

  if (briefing.currentDigest) {
    return 'current';
  }

  if (briefing.casebook) {
    return 'casebook';
  }

  if (briefing.regression) {
    return 'regression';
  }

  if (briefing.timeline) {
    return 'timeline';
  }

  return null;
}

function selectIncidentPackPrimaryReport(briefing) {
  const primaryAnalysis = selectIncidentPackPrimaryAnalysis(briefing);

  if (primaryAnalysis === 'casebook') {
    return briefing.casebook?.incidents[0] ?? null;
  }

  if (primaryAnalysis === 'regression') {
    return briefing.regression?.incidents[0] ?? null;
  }

  if (primaryAnalysis === 'timeline') {
    return briefing.timeline?.incidents[0] ?? null;
  }

  if (primaryAnalysis === 'current') {
    return briefing.currentDigest?.groups[0] ?? null;
  }

  return null;
}

function selectIncidentPackPrimarySummary(briefing, primaryAnalysis) {
  if (primaryAnalysis === 'casebook') {
    return briefing.summary.topFindings.find((item) => item.startsWith('Casebook Radar ')) ?? briefing.summary.headline;
  }

  if (primaryAnalysis === 'regression') {
    return briefing.summary.topFindings.find((item) => item.startsWith('Regression Radar ')) ?? briefing.summary.headline;
  }

  if (primaryAnalysis === 'timeline') {
    return briefing.summary.topFindings.find((item) => item.startsWith('Timeline Radar ')) ?? briefing.summary.headline;
  }

  if (primaryAnalysis === 'current') {
    return briefing.summary.topFindings.find((item) => item.startsWith('Current digest ')) ?? briefing.summary.headline;
  }

  return briefing.summary.headline;
}

function selectIncidentPackBlastRadius(briefing, primaryAnalysis) {
  if (primaryAnalysis === 'casebook') {
    return briefing.casebook?.currentDigest?.blastRadius ?? briefing.currentDigest?.blastRadius ?? null;
  }

  if (primaryAnalysis === 'regression') {
    return briefing.regression?.candidateDigest?.blastRadius ?? null;
  }

  if (primaryAnalysis === 'timeline') {
    return briefing.timeline?.snapshots?.at(-1)?.digest?.blastRadius ?? null;
  }

  if (primaryAnalysis === 'current') {
    return briefing.currentDigest?.blastRadius ?? null;
  }

  return null;
}

function selectIncidentPackHotspotItems(briefing, primaryAnalysis) {
  if ((primaryAnalysis === 'casebook' || primaryAnalysis === 'current') && briefing.currentDigest?.hotspots?.length) {
    return buildHotspotItems(briefing.currentDigest.hotspots);
  }

  if (primaryAnalysis === 'regression' && briefing.regression?.candidateDigest?.hotspots?.length) {
    return buildHotspotItems(briefing.regression.candidateDigest.hotspots);
  }

  if (primaryAnalysis === 'timeline' && briefing.timeline?.hotspots?.length) {
    return buildTimelineHotspotItems(briefing.timeline.hotspots);
  }

  if (briefing.currentDigest?.hotspots?.length) {
    return buildHotspotItems(briefing.currentDigest.hotspots);
  }

  if (briefing.regression?.candidateDigest?.hotspots?.length) {
    return buildHotspotItems(briefing.regression.candidateDigest.hotspots);
  }

  if (briefing.timeline?.hotspots?.length) {
    return buildTimelineHotspotItems(briefing.timeline.hotspots);
  }

  return ['Suspect hotspots will appear here once the incident pack contains a runnable current, candidate, or timeline analysis.'];
}

explainButton?.addEventListener('click', renderDiagnosis);
loadJsButton?.addEventListener('click', () => loadExample(jsExample));
loadPythonButton?.addEventListener('click', () => loadExample(pythonExample));
loadRawLogButton?.addEventListener('click', () => loadExample(rawLogExample));
loadDigestButton?.addEventListener('click', () => loadExample(digestExample));
loadPackButton?.addEventListener('click', () => loadIncidentPackExample(incidentPackExample));
loadPortfolioButton?.addEventListener('click', () => loadPortfolioExample(portfolioExample));
loadRegressionButton?.addEventListener('click', () => loadRegressionExample(regressionExample));
compareButton?.addEventListener('click', renderRegressionWorkflow);
loadCasebookButton?.addEventListener('click', () => loadCasebookExample(casebookExample));
casebookButton?.addEventListener('click', renderCasebookWorkflow);
loadTimelineButton?.addEventListener('click', () => loadTimelineExample(timelineExample));
timelineButton?.addEventListener('click', renderTimelineWorkflow);
copyButton?.addEventListener('click', copyDiagnosis);
copyCasebookButton?.addEventListener('click', copyCasebookSummary);
copyTimelineButton?.addEventListener('click', copyTimelineSummary);
traceInput?.addEventListener('input', () => {
  if (!traceInput.value.trim()) {
    caption.textContent = '';
    resetEmptyState();
  }
});
compareBaselineInput?.addEventListener('input', () => {
  if (!compareBaselineInput.value.trim() || !compareCandidateInput.value.trim()) {
    compareCaption.textContent = 'Paste baseline and candidate traces or raw logs to spot new, resolved, and worsening incidents.';
    resetRegressionState();
  }
});
compareCandidateInput?.addEventListener('input', () => {
  if (!compareBaselineInput.value.trim() || !compareCandidateInput.value.trim()) {
    compareCaption.textContent = 'Paste baseline and candidate traces or raw logs to spot new, resolved, and worsening incidents.';
    resetRegressionState();
  }
});
casebookCurrentInput?.addEventListener('input', () => {
  if (!casebookCurrentInput.value.trim() || !casebookHistoryInput.value.trim()) {
    casebookCaption.textContent = 'Paste a current incident batch plus labeled prior incidents to see which failures look known versus novel.';
    resetCasebookState();
    resetEmptyState();
  }
});
casebookHistoryInput?.addEventListener('input', () => {
  if (!casebookCurrentInput.value.trim() || !casebookHistoryInput.value.trim()) {
    casebookCaption.textContent = 'Paste a current incident batch plus labeled prior incidents to see which failures look known versus novel.';
    resetCasebookState();
    resetEmptyState();
  }
});
timelineInput?.addEventListener('input', () => {
  if (!timelineInput.value.trim()) {
    timelineCaption.textContent = 'Paste labeled rollout snapshots like === canary === and === full-rollout === to track trend movement.';
    resetTimelineState();
  }
});

loadExample(jsExample);
resetPortfolioState();
resetForgeState();
resetRegressionState();
resetCasebookState();
resetTimelineState();
