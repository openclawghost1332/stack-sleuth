import { analyzeTrace, formatFrame, renderTextSummary } from './analyze.js';
import {
  analyzeIncidentPack,
  renderIncidentPackTextSummary,
} from './briefing.js';
import {
  analyzeIncidentPortfolio,
  describeResponseQueueEntry,
  describeRoutingGap,
  parseIncidentPortfolio,
  renderIncidentPortfolioTextSummary,
  summarizePortfolioPrimaryCulprit,
  selectPrimaryPortfolioIncident,
} from './portfolio.js';
import { buildHandoffBriefing } from './handoff.js';
import { analyzeCasebook, renderCasebookTextSummary } from './casebook.js';
import { analyzeCasebookForge, renderCasebookForgeTextSummary } from './forge.js';
import { analyzeCasebookMerge, renderCasebookMergeTextSummary } from './merge.js';
import {
  buildCasebookDataset,
  inspectReplayDatasetInput,
  renderDatasetTextSummary,
} from './dataset.js';
import {
  inspectResponseBundleReplayInput,
  renderResponseBundleTextSummary,
} from './bundle-replay.js';
import {
  describeShelfInputError,
  inspectReplayShelfInput,
  renderShelfTextSummary,
} from './shelf.js';
import { analyzeTraceDigest, renderDigestTextSummary } from './digest.js';
import { parseIncidentPack } from './pack.js';
import { analyzeRegression } from './regression.js';
import { analyzeTimeline, renderTimelineTextSummary } from './timeline.js';
import {
  analyzeCasebookChronicle,
  describeChronicleInputError,
  inspectCasebookChronicleInput,
  renderCasebookChronicleTextSummary,
} from './chronicle.js';
import {
  analyzeResponseBundleChronicle,
  describeResponseBundleChronicleInputError,
  inspectResponseBundleChronicleInput,
  renderResponseBundleChronicleTextSummary,
} from './bundle-chronicle.js';
import { extractTraceSet } from './extract.js';
import {
  parseIncidentNotebook,
  renderNormalizedNotebookText,
  routeIncidentNotebook,
} from './notebook.js';
import { describeCasebookStewardHeadline } from './steward.js';
import { examples } from './examples.js';

const traceInput = document.querySelector('#trace-input');
const explainButton = document.querySelector('#explain-button');
const loadJsButton = document.querySelector('#load-js-button');
const loadPythonButton = document.querySelector('#load-python-button');
const loadRawLogButton = document.querySelector('#load-raw-log-button');
const loadDigestButton = document.querySelector('#load-digest-button');
const loadNotebookButton = document.querySelector('#load-notebook-button');
const loadPackButton = document.querySelector('#load-pack-button');
const loadPortfolioButton = document.querySelector('#load-portfolio-button');
const loadHandoffButton = document.querySelector('#load-handoff-button');
const loadDatasetButton = document.querySelector('#load-dataset-button');
const loadBundleChronicleButton = document.querySelector('#load-bundle-chronicle-button');
const loadChronicleButton = document.querySelector('#load-chronicle-button');
const loadShelfButton = document.querySelector('#load-shelf-button');
const loadMergeButton = document.querySelector('#load-merge-button');
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
const handoffSummaryValue = document.querySelector('#handoff-summary-value');
const handoffExportValue = document.querySelector('#handoff-export-value');
const forgeSummaryValue = document.querySelector('#forge-summary-value');
const forgeExportValue = document.querySelector('#forge-export-value');
const datasetSummaryValue = document.querySelector('#dataset-summary-value');
const datasetPackCountValue = document.querySelector('#dataset-pack-count-value');
const datasetExportValue = document.querySelector('#dataset-export-value');
const mergeSummaryValue = document.querySelector('#merge-summary-value');
const mergeConflictsValue = document.querySelector('#merge-conflicts-value');
const mergeExportValue = document.querySelector('#merge-export-value');

const jsExample = examples.find((item) => item.label === 'JavaScript undefined property');
const pythonExample = examples.find((item) => item.label === 'Python missing key');
const rawLogExample = examples.find((item) => item.label === 'Raw log excavation');
const digestExample = examples.find((item) => item.label === 'Repeated incident digest');
const notebookExample = examples.find((item) => item.label === 'Notebook ingest');
const incidentPackExample = examples.find((item) => item.label === 'Incident pack briefing');
const portfolioExample = examples.find((item) => item.label === 'Portfolio radar');
const handoffExample = examples.find((item) => item.label === 'Handoff Briefing');
const datasetExample = examples.find((item) => item.label === 'Casebook Dataset');
const bundleChronicleExample = examples.find((item) => item.label === 'Response Bundle Chronicle');
const chronicleExample = examples.find((item) => item.label === 'Casebook Chronicle');
const shelfExample = examples.find((item) => item.label === 'Casebook Shelf');
const mergeExample = examples.find((item) => item.label === 'Casebook Merge');
const casebookExample = examples.find((item) => item.label === 'Casebook Radar');
const regressionExample = examples.find((item) => item.label === 'Regression radar');
const timelineExample = examples.find((item) => item.label === 'Timeline radar');

function inspectSavedArtifactWorkflow(traceText) {
  const bundleChronicle = inspectResponseBundleChronicleInput(traceText);
  if (bundleChronicle.valid) {
    return { kind: 'bundle-chronicle', value: bundleChronicle };
  }
  if (shouldRenderResponseBundleChronicleError(bundleChronicle)) {
    return { kind: 'bundle-chronicle-error', value: bundleChronicle };
  }

  const bundleReplay = inspectResponseBundleReplayInput(traceText);
  if (bundleReplay.valid) {
    return { kind: 'bundle-replay', value: bundleReplay };
  }
  if (shouldRenderResponseBundleError(bundleReplay, traceText)) {
    return { kind: 'bundle-replay-error', value: bundleReplay };
  }

  const shelfReplay = inspectReplayShelfInput(traceText);
  if (shelfReplay.valid) {
    return { kind: 'shelf-replay', value: shelfReplay };
  }
  if (shouldRenderShelfError(shelfReplay, traceText)) {
    return { kind: 'shelf-replay-error', value: shelfReplay };
  }

  const chronicle = inspectCasebookChronicleInput(traceText);
  if (chronicle.valid) {
    return { kind: 'dataset-chronicle', value: chronicle };
  }
  if (shouldRenderChronicleError(chronicle)) {
    return { kind: 'dataset-chronicle-error', value: chronicle };
  }

  const replay = inspectReplayDatasetInput(traceText);
  if (replay.valid) {
    return { kind: 'dataset-replay', value: replay };
  }
  if (shouldRenderDatasetReplayError(replay, traceText)) {
    return { kind: 'dataset-replay-error', value: replay };
  }

  return null;
}

function renderDiagnosis() {
  const traceText = traceInput.value.trim();
  if (!traceText) {
    resetEmptyState();
    return;
  }

  const savedArtifact = inspectSavedArtifactWorkflow(traceText);
  if (savedArtifact) {
    switch (savedArtifact.kind) {
      case 'bundle-chronicle':
        renderResponseBundleChronicleWorkflow(savedArtifact.value);
        return;
      case 'bundle-chronicle-error':
        renderResponseBundleChronicleError(savedArtifact.value);
        return;
      case 'bundle-replay':
        renderResponseBundleWorkflow(savedArtifact.value.bundle);
        return;
      case 'bundle-replay-error':
        renderResponseBundleError(savedArtifact.value);
        return;
      case 'shelf-replay':
        renderShelfWorkflow(savedArtifact.value.shelf);
        return;
      case 'shelf-replay-error':
        renderShelfError(savedArtifact.value);
        return;
      case 'dataset-chronicle':
        renderChronicleWorkflow(savedArtifact.value);
        return;
      case 'dataset-chronicle-error':
        renderChronicleError(savedArtifact.value);
        return;
      case 'dataset-replay':
        renderDatasetReplayWorkflow(savedArtifact.value.dataset);
        return;
      case 'dataset-replay-error':
        renderDatasetReplayError(savedArtifact.value);
        return;
      default:
        break;
    }
  }

  const notebook = parseIncidentNotebook(traceText);
  if (notebook.kind !== 'unsupported') {
    renderNotebookWorkflow(notebook);
    return;
  }

  const portfolio = parseIncidentPortfolio(traceText);
  if (portfolio.packOrder.length) {
    renderPortfolioWorkflow(portfolio);
    return;
  }

  resetPortfolioState();
  resetForgeState();
  resetDatasetState();
  resetMergeState();

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

function renderNotebookWorkflow(notebook) {
  const routed = routeNotebook(notebook.source, notebook);

  if (routed.mode === 'portfolio') {
    renderPortfolioWorkflow(routed.report);
    return;
  }

  if (routed.mode === 'pack') {
    renderIncidentPackWorkflow(routed.report);
  }
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
  const dataset = buildCasebookDataset(report);
  const merge = analyzeCasebookMerge(report);
  const handoff = buildHandoffBriefing(report);
  const topPack = report.priorityQueue[0] ?? null;
  const primaryIncident = selectPrimaryPortfolioIncident(topPack);
  const topPackLabel = topPack?.label ?? 'none';

  resetCasebookState();
  resetRegressionState();
  resetTimelineState();

  excavationValue.textContent = `Portfolio packs: ${report.summary.packCount} labeled, ${report.summary.runnablePackCount} runnable`;
  runtimeValue.textContent = 'portfolio radar';
  headlineValue.textContent = `Portfolio Radar ranked ${report.summary.runnablePackCount} runnable pack${report.summary.runnablePackCount === 1 ? '' : 's'}.`;
  culpritValue.textContent = summarizePortfolioPrimaryCulprit(report);
  confidenceValue.textContent = topPack ? 'portfolio' : '-';
  tagsValue.textContent = topPack
    ? ['portfolio-radar', 'handoff-briefing', 'casebook-forge', 'casebook-dataset', 'casebook-merge', 'incident-pack'].join(', ')
    : ['portfolio-radar', 'handoff-briefing', 'casebook-forge', 'casebook-dataset', 'casebook-merge'].join(', ');
  signatureValue.textContent = topPack ? `top pack: ${topPackLabel}` : '-';
  summaryValue.textContent = buildPortfolioSummary(report);
  blastRadiusValue.textContent = buildPortfolioBlastRadiusSummary(topPack, primaryIncident);
  digestGroupsValue.replaceChildren(...buildListItems(buildPortfolioPriorityItems(report.priorityQueue)));
  supportFramesValue.replaceChildren(...buildListItems(
    primaryIncident?.representative?.supportFrames?.length
      ? primaryIncident.representative.supportFrames.map((frame) => formatFrame(frame))
      : ['Open the highest-priority pack to inspect nearby supporting frames.']
  ));
  hotspotsValue.replaceChildren(...buildListItems(buildPortfolioRecurringHotspotItems(report.recurringHotspots)));
  checklistValue.replaceChildren(...buildListItems(buildPortfolioChecklist(report)));

  portfolioSummaryValue.textContent = buildPortfolioSummary(report);
  portfolioPackCountValue.textContent = `${report.summary.runnablePackCount} / ${report.summary.packCount}`;
  portfolioPriorityValue.replaceChildren(...buildListItems(buildPortfolioPriorityItems(report.priorityQueue)));
  portfolioRecurringIncidentsValue.replaceChildren(...buildListItems(buildPortfolioRecurringIncidentItems(report.recurringIncidents)));
  portfolioRecurringHotspotsValue.replaceChildren(...buildListItems(buildPortfolioRecurringHotspotItems(report.recurringHotspots)));
  portfolioResponseQueueValue.replaceChildren(...buildListItems(buildPortfolioResponseQueueItems(report.responseQueue)));
  portfolioRoutingGapsValue.replaceChildren(...buildListItems(buildPortfolioRoutingGapItems(report.unownedPacks, report.runbookGaps)));
  handoffSummaryValue.textContent = `${handoff.summary.headline} Owner packets carry recalled fixes and runbooks, while gap packets make missing routing explicit.`;
  handoffExportValue.textContent = handoff.exportText || 'No handoff export available yet.';
  forgeSummaryValue.textContent = `${forge.summary.headline} Reusable cases are ready to paste into a labeled history casebook.`;
  forgeExportValue.textContent = forge.exportText || 'No forged export available yet.';
  datasetSummaryValue.textContent = `${dataset.summary.headline} Release Gate ${dataset.gate.verdict.toUpperCase()} is preserved inside the saved dataset for later replay.`;
  datasetPackCountValue.textContent = `${dataset.summary.runnablePackCount} / ${dataset.summary.packCount}`;
  datasetExportValue.textContent = dataset.exportText || 'No dataset export available yet.';
  mergeSummaryValue.textContent = `${merge.summary.headline} ${merge.summary.reviewHeadline}`;
  mergeConflictsValue.replaceChildren(...buildListItems(
    merge.cases.some((entry) => entry.conflicts.length)
      ? merge.cases.filter((entry) => entry.conflicts.length).map((entry) => `${entry.label}: ${entry.conflicts.join('; ')}`)
      : ['No merge conflicts detected.']
  ));
  mergeExportValue.textContent = merge.exportText || 'No merged export available yet.';
}

function renderResponseBundleWorkflow(bundle) {
  renderDatasetReplayWorkflow(bundle.dataset);

  const responseOwnerCount = bundle.dataset.responseQueue?.length ?? 0;
  const mergedCaseCount = bundle.dataset.cases?.length ?? bundle.dataset.summary?.mergedCaseCount ?? 0;
  const steward = bundle.dataset.steward;
  const stewardActionCount = steward?.summary?.actionCount ?? 0;
  const stewardHeadline = describeCasebookStewardHeadline(steward);
  const stewardNextAction = steward?.nextAction ?? 'No stewardship gaps detected in the current casebook state.';
  const stewardReplayNote = steward?.preserved === false
    ? ' Stewardship was reconstructed from older dataset fields for replay.'
    : '';

  excavationValue.textContent = `Saved response bundle replay: ${bundle.summary.fileCount} files, ${bundle.dataset.summary.packCount} packs, ${bundle.dataset.summary.runnablePackCount} runnable`;
  runtimeValue.textContent = 'response bundle replay';
  headlineValue.textContent = 'Stack Sleuth Response Bundle Replay';
  culpritValue.textContent = 'Saved response bundle artifact';
  confidenceValue.textContent = 'replay';
  tagsValue.textContent = 'response-bundle-replay, saved-artifact';
  signatureValue.textContent = `${bundle.kind}@${bundle.sourceVersion}`;
  summaryValue.textContent = `Response Bundle replay reuses preserved bundle and dataset fields only, including ${stewardActionCount} stewardship action${stewardActionCount === 1 ? '' : 's'}.${stewardReplayNote} It does not recover raw traces, support frames, or blast radius detail.`;
  blastRadiusValue.textContent = 'Saved response bundles preserve bundle inventory plus embedded dataset state. They do not recover raw traces, support frames, or culprit-level blast radius detail.';
  digestGroupsValue.replaceChildren(...buildListItems(buildResponseBundleInventoryItems(bundle.manifest?.files)));
  supportFramesValue.replaceChildren(...buildListItems([
    'Response Bundle replay does not preserve support frames. Reopen the original traces or portfolio input if you need nearby frame context.'
  ]));
  checklistValue.replaceChildren(...buildListItems([
    'Saved-artifact note: response bundle replay uses preserved bundle and dataset fields only.',
    ...(steward?.preserved === false ? ['Stewardship note: the saved bundle had to reconstruct steward state from older dataset fields.'] : []),
    `Stewardship next action: ${stewardNextAction}`,
    'Route the preserved response queue first so recalled owners see the replayed incident memory quickly.',
    'Reopen the original portfolio or traces if you need culprit-level evidence beyond the saved artifact.',
  ]));

  portfolioSummaryValue.textContent = `Response bundle replay restored ${responseOwnerCount} owner-routed entr${responseOwnerCount === 1 ? 'y' : 'ies'}, ${mergedCaseCount} merged case${mergedCaseCount === 1 ? '' : 's'}, and ${stewardActionCount} stewardship action${stewardActionCount === 1 ? '' : 's'} from the portable saved bundle.`;
  portfolioPackCountValue.textContent = `${bundle.dataset.summary.runnablePackCount} / ${bundle.dataset.summary.packCount}`;
  portfolioPriorityValue.replaceChildren(...buildListItems(buildResponseBundleInventoryItems(bundle.manifest?.files)));
  datasetSummaryValue.textContent = `Saved bundle replay is using the portable response bundle artifact directly, with the embedded Casebook Dataset ${steward?.preserved === false ? 'reconstructed from older fields for replay' : 'preserved for replay'}. ${stewardHeadline}`;
  caption.textContent = `Response bundle replay restored ${bundle.summary.fileCount} saved bundle file${bundle.summary.fileCount === 1 ? '' : 's'}.`;
}

function renderDatasetReplayWorkflow(report) {
  resetCasebookState();
  resetRegressionState();
  resetTimelineState();

  const responseOwnerCount = report.responseQueue?.length ?? 0;
  const recurringIncidentCount = report.recurringIncidents?.length ?? 0;
  const recurringHotspotCount = report.recurringHotspots?.length ?? 0;
  const mergedCaseCount = report.cases?.length ?? report.summary?.mergedCaseCount ?? 0;
  const stewardHeadline = describeCasebookStewardHeadline(report.steward);
  const stewardReplayNote = report.steward?.preserved === false
    ? ' Stewardship was reconstructed from older dataset fields for replay.'
    : '';

  excavationValue.textContent = `Saved dataset replay: ${report.summary.packCount} packs, ${report.summary.runnablePackCount} runnable`;
  runtimeValue.textContent = 'dataset replay';
  headlineValue.textContent = report.summary.headline;
  culpritValue.textContent = 'Saved dataset artifact';
  confidenceValue.textContent = 'replay';
  tagsValue.textContent = 'dataset-replay, casebook-dataset';
  signatureValue.textContent = `${report.kind}@${report.version}`;
  summaryValue.textContent = `Replayed ${mergedCaseCount} merged case${mergedCaseCount === 1 ? '' : 's'}, ${responseOwnerCount} response owner${responseOwnerCount === 1 ? '' : 's'}, ${recurringIncidentCount} recurring incident signature${recurringIncidentCount === 1 ? '' : 's'}, and ${recurringHotspotCount} recurring hotspot${recurringHotspotCount === 1 ? '' : 's'} from a saved Casebook Dataset artifact. Release Gate verdict: ${report.gate?.verdict ?? 'needs-input'}.${stewardReplayNote}`;
  blastRadiusValue.textContent = 'Saved datasets preserve routing and reusable incident-memory state, not culprit-level blast radius detail. Reopen the source portfolio input for trace-level excavation context.';
  digestGroupsValue.replaceChildren(...buildListItems(buildDatasetReplayPackItems(report.portfolio?.packOrder)));
  supportFramesValue.replaceChildren(...buildListItems([
    'Saved dataset artifacts do not preserve support frames. Reopen the original traces if you need nearby frame context.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems(buildPortfolioRecurringHotspotItems(report.recurringHotspots ?? [])));
  checklistValue.replaceChildren(...buildListItems([
    ...(report.steward?.preserved === false ? ['Stewardship note: this saved dataset had to reconstruct steward state from older fields.'] : []),
    ...(report.gate?.checklist ?? []),
    'Route the preserved response queue first so recalled owners see the replayed incident memory quickly.',
    'Paste the saved export text into Casebook Radar or an @@ history @@ section when you want fresh current-versus-history matching.',
    'Reopen the original portfolio input if you need ranked pack reasons or culprit-level trace detail that the saved dataset does not preserve.',
  ]));

  portfolioSummaryValue.textContent = `${report.summary.headline} Replay restored ${responseOwnerCount} owner-routed entr${responseOwnerCount === 1 ? 'y' : 'ies'} and ${recurringIncidentCount} recurring incident signature${recurringIncidentCount === 1 ? '' : 's'}.`;
  portfolioPackCountValue.textContent = `${report.summary.runnablePackCount} / ${report.summary.packCount}`;
  portfolioPriorityValue.replaceChildren(...buildListItems(buildDatasetReplayPackItems(report.portfolio?.packOrder)));
  portfolioRecurringIncidentsValue.replaceChildren(...buildListItems(buildPortfolioRecurringIncidentItems(report.recurringIncidents ?? [])));
  portfolioRecurringHotspotsValue.replaceChildren(...buildListItems(buildPortfolioRecurringHotspotItems(report.recurringHotspots ?? [])));
  portfolioResponseQueueValue.replaceChildren(...buildListItems(buildPortfolioResponseQueueItems(report.responseQueue ?? [])));
  portfolioRoutingGapsValue.replaceChildren(...buildListItems([
    'Saved dataset replay does not preserve explicit routing-gap or runbook-gap packets. Re-run Portfolio Radar or Handoff Briefing on the source portfolio to rebuild them.'
  ]));

  handoffSummaryValue.textContent = `Saved dataset replay preserved ${responseOwnerCount} owner-routed response queue entr${responseOwnerCount === 1 ? 'y' : 'ies'}, but not the copy-ready handoff packet export.`;
  handoffExportValue.textContent = 'Handoff packet export is not preserved inside saved Casebook Dataset artifacts.';

  forgeSummaryValue.textContent = `Saved dataset replay preserved ${mergedCaseCount} merged case${mergedCaseCount === 1 ? '' : 's'} and one reusable casebook export.`;
  forgeExportValue.textContent = report.exportText || 'No reusable casebook export was preserved in this saved dataset.';

  datasetSummaryValue.textContent = `${report.summary.headline} Saved dataset replay is using the portable artifact directly, with Release Gate ${report.gate?.verdict?.toUpperCase?.() ?? 'NEEDS INPUT'} preserved. ${stewardHeadline}`;
  datasetPackCountValue.textContent = `${report.summary.runnablePackCount} / ${report.summary.packCount}`;
  datasetExportValue.textContent = report.exportText || 'No dataset export available in this saved artifact.';

  mergeSummaryValue.textContent = `Replayed ${mergedCaseCount} saved casebook case${mergedCaseCount === 1 ? '' : 's'} from the portable dataset artifact.`;
  mergeConflictsValue.replaceChildren(...buildListItems(
    report.cases?.some((entry) => entry.conflicts?.length)
      ? report.cases.filter((entry) => entry.conflicts?.length).map((entry) => `${entry.label}: ${entry.conflicts.join('; ')}`)
      : ['No saved merge conflicts were preserved in this dataset artifact.']
  ));
  mergeExportValue.textContent = report.exportText || 'No merged Casebook export was preserved in this saved artifact.';
}

function renderResponseBundleError(replay) {
  resetPortfolioState();
  resetForgeState();
  resetDatasetState();
  resetMergeState();
  resetCasebookState();
  resetRegressionState();
  resetTimelineState();

  const details = describeResponseBundleReplayError(replay);

  excavationValue.textContent = 'Saved response bundle replay blocked';
  runtimeValue.textContent = 'response bundle replay error';
  headlineValue.textContent = details.headline;
  culpritValue.textContent = 'Unsupported response bundle artifact';
  confidenceValue.textContent = '-';
  tagsValue.textContent = 'response-bundle-replay, error';
  signatureValue.textContent = 'stack-sleuth-response-bundle';
  summaryValue.textContent = details.summary;
  blastRadiusValue.textContent = 'No blast radius details are available because Stack Sleuth stopped before replaying the saved response bundle.';
  digestGroupsValue.replaceChildren(...buildListItems([
    'Paste a saved Stack Sleuth response-bundle.json artifact or a saved response bundle directory.'
  ]));
  supportFramesValue.replaceChildren(...buildListItems([
    'Response bundle replay errors happen before Stack Sleuth reaches any trace-level call stack.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems([
    'Recurring hotspots will appear here once Stack Sleuth can replay a supported saved response bundle.'
  ]));
  checklistValue.replaceChildren(...buildListItems(details.checklist));
  caption.textContent = details.caption;
}

function renderShelfWorkflow(report) {
  resetPortfolioState();
  resetForgeState();
  resetDatasetState();
  resetMergeState();
  resetCasebookState();
  resetRegressionState();

  const warningCount = report.summary.invalidSnapshotCount;
  const latestLabel = report.summary.latestLabel;

  excavationValue.textContent = `Saved dataset shelf: ${report.summary.validSnapshotCount} valid, ${warningCount} warnings`;
  runtimeValue.textContent = 'casebook shelf';
  headlineValue.textContent = report.summary.headline;
  culpritValue.textContent = latestLabel === '-' ? 'Saved shelf artifact' : `Latest snapshot: ${latestLabel}`;
  confidenceValue.textContent = 'saved artifact';
  tagsValue.textContent = 'casebook-shelf, saved-artifact';
  signatureValue.textContent = `${report.kind}@${report.version}`;
  summaryValue.textContent = report.chronicle
    ? `This saved dataset shelf replays ${report.summary.validSnapshotCount} valid snapshots, keeps ${warningCount} warning entr${warningCount === 1 ? 'y' : 'ies'} visible, layers chronicle drift on top of the latest saved library state, and preserves latest Release Gate ${report.summary.latestGateVerdict.toUpperCase()}.`
    : `This saved dataset shelf replays ${report.summary.validSnapshotCount} valid snapshot${report.summary.validSnapshotCount === 1 ? '' : 's'}, keeps ${warningCount} warning entr${warningCount === 1 ? 'y' : 'ies'} visible, and preserves latest Release Gate ${report.summary.latestGateVerdict.toUpperCase()}. Add one more valid saved dataset to unlock chronicle drift.`;
  blastRadiusValue.textContent = 'Saved shelf artifacts preserve dataset-level routing, hotspot, and casebook inventory. They do not recover raw trace blast radius, support frames, or culprit-level call stacks.';
  digestGroupsValue.replaceChildren(...buildListItems(buildShelfInventoryItems(report.snapshots)));
  supportFramesValue.replaceChildren(...buildListItems([
    'Casebook Shelf is a saved artifact view. Reopen the source traces or portfolio input if you need nearby frames.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems(
    report.chronicle
      ? buildChronicleHotspotItems(report.chronicle.hotspotTrends, report.snapshots.filter((snapshot) => snapshot.status === 'valid').at(-1)?.dataset ?? null)
      : ['Chronicle hotspot movement appears here once the shelf contains at least two valid saved snapshots.']
  ));
  checklistValue.replaceChildren(...buildListItems([
    'Saved artifact note: Casebook Shelf replays preserved dataset signals only, not raw traces or support frames.',
    'Review invalid snapshot warnings before treating the shelf as a complete release library.',
    report.chronicle
      ? 'Use the chronicle summary to spot owner load and hotspot drift across the saved snapshots.'
      : 'Add one more valid saved dataset snapshot to unlock chronicle drift across the shelf.',
  ]));

  timelineSummaryValue.textContent = report.chronicle
    ? `Casebook Shelf latest snapshot ${latestLabel} replays chronicle drift across ${report.chronicle.summary.snapshotCount} valid saved datasets, with Release Gate ${report.summary.latestGateVerdict.toUpperCase()}.`
    : `Casebook Shelf latest snapshot ${latestLabel} is replayable with Release Gate ${report.summary.latestGateVerdict.toUpperCase()}, but chronicle drift needs at least two valid saved datasets.`;
  timelineIncidentsValue.replaceChildren(...buildListItems(
    report.chronicle
      ? ['Owner trends across saved snapshots:', ...buildChronicleOwnerItems(report.chronicle.ownerTrends)]
      : ['Owner trend calls will appear here after the shelf contains at least two valid saved dataset snapshots.']
  ));
  timelineHotspotsValue.replaceChildren(...buildListItems(
    report.chronicle
      ? buildChronicleHotspotItems(report.chronicle.hotspotTrends, report.snapshots.filter((snapshot) => snapshot.status === 'valid').at(-1)?.dataset ?? null)
      : ['Hotspot drift will appear here after the shelf contains at least two valid saved dataset snapshots.']
  ));
  caption.textContent = `Casebook Shelf replayed ${report.summary.validSnapshotCount} valid saved snapshots and ${warningCount} warning entr${warningCount === 1 ? 'y' : 'ies'}.`;
}

function renderShelfError(replay) {
  resetPortfolioState();
  resetForgeState();
  resetDatasetState();
  resetMergeState();
  resetCasebookState();
  resetRegressionState();
  resetTimelineState();

  excavationValue.textContent = 'Saved shelf replay blocked';
  runtimeValue.textContent = 'casebook shelf error';
  headlineValue.textContent = 'Casebook Shelf could not replay this saved shelf artifact.';
  culpritValue.textContent = 'Unsupported shelf artifact';
  confidenceValue.textContent = '-';
  tagsValue.textContent = 'casebook-shelf, error';
  signatureValue.textContent = 'stack-sleuth-casebook-shelf';
  summaryValue.textContent = describeShelfInputError(replay);
  blastRadiusValue.textContent = 'No blast radius details are available because Stack Sleuth stopped before replaying the saved shelf artifact.';
  digestGroupsValue.replaceChildren(...buildListItems([
    'Paste a saved Stack Sleuth Casebook Shelf JSON artifact or rebuild the shelf with a supported Stack Sleuth version.'
  ]));
  supportFramesValue.replaceChildren(...buildListItems([
    'Shelf replay errors happen before Stack Sleuth reaches any trace-level call stack.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems([
    'Shelf hotspot drift will appear here once Stack Sleuth can replay a supported saved shelf artifact.'
  ]));
  checklistValue.replaceChildren(...buildListItems([
    'Replay a saved Stack Sleuth Casebook Shelf JSON artifact, not a different JSON document.',
    'If the shelf version is unsupported, rebuild it with a compatible Stack Sleuth release.',
  ]));
  caption.textContent = describeShelfInputError(replay);
}

function renderDatasetReplayError(replay) {
  resetPortfolioState();
  resetForgeState();
  resetDatasetState();
  resetMergeState();
  resetCasebookState();
  resetRegressionState();
  resetTimelineState();

  const details = describeDatasetReplayError(replay);

  excavationValue.textContent = 'Saved dataset replay blocked';
  runtimeValue.textContent = 'dataset replay error';
  headlineValue.textContent = details.headline;
  culpritValue.textContent = 'Unsupported dataset artifact';
  confidenceValue.textContent = '-';
  tagsValue.textContent = 'dataset-replay, error';
  signatureValue.textContent = 'stack-sleuth-casebook-dataset';
  summaryValue.textContent = details.summary;
  blastRadiusValue.textContent = 'No blast radius details are available because Stack Sleuth stopped before replaying the saved dataset artifact.';
  digestGroupsValue.replaceChildren(...buildListItems([
    'Re-export the dataset with a supported Stack Sleuth build or reopen the original labeled portfolio input.'
  ]));
  supportFramesValue.replaceChildren(...buildListItems([
    'Dataset replay errors happen before Stack Sleuth reaches culprit-level trace analysis.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems([
    'Recurring hotspots will appear here once Stack Sleuth can replay a supported saved dataset.'
  ]));
  checklistValue.replaceChildren(...buildListItems(details.checklist));

  datasetSummaryValue.textContent = details.headline;
  datasetPackCountValue.textContent = '-';
  datasetExportValue.textContent = 'Dataset export text will appear here after Casebook Dataset runs.';
  caption.textContent = details.caption;
}

function renderIncidentPackWorkflow(input) {
  const briefing = input?.availableAnalyses && input?.summary
    ? input
    : analyzeIncidentPack(input);
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
  resetDatasetState();
  resetMergeState();

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
  resetDatasetState();
  resetMergeState();

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

function renderChronicleWorkflow(input) {
  resetPortfolioState();
  resetForgeState();
  resetDatasetState();
  resetMergeState();
  resetCasebookState();
  resetRegressionState();

  const report = input?.valid
    ? analyzeCasebookChronicle(input)
    : analyzeCasebookChronicle(traceInput.value.trim());
  const topOwner = report.ownerTrends[0] ?? null;
  const topHotspot = report.hotspotTrends[0] ?? null;
  const topCase = report.caseTrends[0] ?? null;
  const latestSnapshot = report.snapshots.at(-1) ?? null;
  const latestDataset = latestSnapshot?.dataset ?? null;

  excavationValue.textContent = `Saved chronicle snapshots: ${report.labels.join(' → ')}`;
  runtimeValue.textContent = 'casebook chronicle';
  headlineValue.textContent = report.summary.headline;
  culpritValue.textContent = topHotspot ? `${topHotspot.label} (${topHotspot.trend})` : 'Saved dataset artifact';
  confidenceValue.textContent = 'saved artifact';
  tagsValue.textContent = ['chronicle', topOwner?.trend, topHotspot?.trend].filter(Boolean).join(', ');
  signatureValue.textContent = topCase?.signature ?? `chronicle:${report.summary.latestLabel}`;
  summaryValue.textContent = `Casebook Chronicle compared ${report.summary.snapshotCount} saved datasets. Latest snapshot ${report.summary.latestLabel} preserves ${report.summary.latestPackCount} packs, ${report.summary.latestOwnerCount} response owner${report.summary.latestOwnerCount === 1 ? '' : 's'}, ${report.summary.latestHotspotCount} recurring hotspot${report.summary.latestHotspotCount === 1 ? '' : 's'}, ${report.summary.latestCaseCount} casebook case${report.summary.latestCaseCount === 1 ? '' : 's'}, and Release Gate ${String(report.summary.latestGateVerdict ?? 'needs-input').toUpperCase()}.`;
  blastRadiusValue.textContent = 'Saved chronicle snapshots preserve dataset-level routing, hotspot, and case counts, but not raw trace blast radius, support frames, or culprit-level call stacks.';
  digestGroupsValue.replaceChildren(...buildListItems(buildChronicleOwnerItems(report.ownerTrends)));
  supportFramesValue.replaceChildren(...buildListItems([
    'Casebook Chronicle replays saved dataset signals only. Reopen the source trace, portfolio, or timeline input if you need supporting frames.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems(buildChronicleHotspotItems(report.hotspotTrends, latestDataset)));
  checklistValue.replaceChildren(...buildListItems(buildChronicleChecklist(report)));

  timelineSummaryValue.textContent = `Casebook Chronicle latest snapshot ${report.summary.latestLabel} spans ${report.summary.latestPackCount} packs. Release Gate ${String(report.summary.latestGateVerdict ?? 'needs-input').toUpperCase()} and ${report.summary.gateDrift.summary} Trend mix: ${report.summary.newOwnerCount} new owners, ${report.summary.risingOwnerCount} rising owners, ${report.summary.newHotspotCount} new hotspots, ${report.summary.risingHotspotCount} rising hotspots, ${report.summary.newCaseCount} new cases, ${report.summary.resolvedCaseCount} resolved cases.`;
  timelineIncidentsValue.replaceChildren(...buildListItems(buildChronicleTrendItems(report)));
  timelineHotspotsValue.replaceChildren(...buildListItems(buildChronicleHotspotItems(report.hotspotTrends, latestDataset)));
  caption.textContent = latestSnapshot
    ? `Chronicle replayed saved datasets through ${latestSnapshot.label}.`
    : 'Chronicle replayed saved datasets.';
}

function renderResponseBundleChronicleWorkflow(input) {
  resetPortfolioState();
  resetForgeState();
  resetDatasetState();
  resetMergeState();
  resetCasebookState();
  resetRegressionState();

  const report = input?.valid
    ? analyzeResponseBundleChronicle(input)
    : analyzeResponseBundleChronicle(traceInput.value.trim());
  const topOwner = report.ownerTrends[0] ?? null;
  const topHotspot = report.hotspotTrends[0] ?? null;
  const latestSnapshot = report.snapshots.at(-1) ?? null;
  const latestDataset = latestSnapshot?.dataset ?? null;

  excavationValue.textContent = `Saved response bundle snapshots: ${report.labels.join(' → ')}`;
  runtimeValue.textContent = 'response bundle chronicle';
  headlineValue.textContent = report.summary.headline;
  culpritValue.textContent = topHotspot ? `${topHotspot.label} (${topHotspot.trend})` : 'Saved response bundle artifact';
  confidenceValue.textContent = 'saved artifact';
  tagsValue.textContent = ['bundle-chronicle', topOwner?.trend, topHotspot?.trend].filter(Boolean).join(', ');
  signatureValue.textContent = `bundle-chronicle:${report.summary.latestLabel}`;
  summaryValue.textContent = `Bundle Chronicle compared ${report.summary.snapshotCount} saved response bundles. Latest snapshot ${report.summary.latestLabel} preserves ${report.summary.latestPackCount} packs, ${report.summary.latestOwnerCount} response owner${report.summary.latestOwnerCount === 1 ? '' : 's'}, ${report.summary.latestHotspotCount} recurring hotspot${report.summary.latestHotspotCount === 1 ? '' : 's'}, ${report.summary.latestCaseCount} casebook case${report.summary.latestCaseCount === 1 ? '' : 's'}, ${report.summary.latestFileCount} bundle file${report.summary.latestFileCount === 1 ? '' : 's'}, steward drift ${report.summary.stewardDrift.direction}, and Release Gate ${String(report.summary.latestGateVerdict ?? 'needs-input').toUpperCase()}.`;
  blastRadiusValue.textContent = 'Saved response bundle chronicle snapshots preserve bundle inventory plus embedded dataset routing, hotspot, case, and stewardship signals, but not raw trace blast radius, support frames, or culprit-level call stacks.';
  digestGroupsValue.replaceChildren(...buildListItems(buildChronicleOwnerItems(report.ownerTrends)));
  supportFramesValue.replaceChildren(...buildListItems([
    'Response Bundle Chronicle replays saved bundle and dataset signals only. Reopen the original portfolio or traces if you need supporting frames.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems(buildChronicleHotspotItems(report.hotspotTrends, latestDataset)));
  checklistValue.replaceChildren(...buildListItems([
    `Latest source workflow: ${report.summary.latestSourceMode}${report.summary.latestSourceLabel ? ` (${report.summary.latestSourceLabel})` : ''}.`,
    `Steward drift: ${report.summary.stewardDrift.summary}`,
    'Saved-artifact note: response bundle chronicle uses preserved bundle inventory and embedded dataset fields only.',
  ]));

  timelineSummaryValue.textContent = `Response Bundle Chronicle latest snapshot ${report.summary.latestLabel} came from ${report.summary.latestSourceMode}. Release Gate ${String(report.summary.latestGateVerdict ?? 'needs-input').toUpperCase()}, ${report.summary.gateDrift.summary}, and steward view ${report.summary.latestStewardHeadline}. Inventory drift: ${report.summary.newInventoryCount} new files, ${report.summary.resolvedInventoryCount} resolved files.`;
  timelineIncidentsValue.replaceChildren(...buildListItems(buildChronicleTrendItems(report)));
  timelineHotspotsValue.replaceChildren(...buildListItems(buildBundleChronicleInventoryItems(report.inventoryTrends)));
  caption.textContent = latestSnapshot
    ? `Response Bundle Chronicle replayed saved bundles through ${latestSnapshot.label}.`
    : 'Response Bundle Chronicle replayed saved bundles.';
}

function renderChronicleError(details) {
  resetPortfolioState();
  resetForgeState();
  resetDatasetState();
  resetMergeState();
  resetCasebookState();
  resetRegressionState();
  resetTimelineState();

  excavationValue.textContent = 'Saved chronicle replay blocked';
  runtimeValue.textContent = 'casebook chronicle error';
  headlineValue.textContent = 'Casebook Chronicle could not replay this saved dataset bundle.';
  culpritValue.textContent = 'Unsupported chronicle artifact';
  confidenceValue.textContent = '-';
  tagsValue.textContent = 'chronicle, error';
  signatureValue.textContent = 'stack-sleuth-casebook-dataset';
  summaryValue.textContent = describeChronicleInputError(details);
  blastRadiusValue.textContent = 'No blast radius details are available because Stack Sleuth stopped before replaying the saved chronicle bundle.';
  digestGroupsValue.replaceChildren(...buildListItems([
    'Chronicle snapshots must be labeled === release === style blocks containing saved Casebook Dataset JSON.'
  ]));
  supportFramesValue.replaceChildren(...buildListItems([
    'Chronicle replay errors happen before Stack Sleuth reaches any trace-level call stack.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems([
    'Recurring hotspot drift appears here once Stack Sleuth can replay at least two saved dataset snapshots.'
  ]));
  checklistValue.replaceChildren(...buildListItems([
    'Use at least two labeled snapshots like === release-a === and === release-b ===.',
    'Make sure each snapshot body is saved Casebook Dataset JSON, not raw traces or casebook text.',
    'If the dataset version is unsupported, replay it with a compatible Stack Sleuth build or regenerate the artifact.',
  ]));
  caption.textContent = describeChronicleInputError(details);
}

function renderResponseBundleChronicleError(details) {
  resetPortfolioState();
  resetForgeState();
  resetDatasetState();
  resetMergeState();
  resetCasebookState();
  resetRegressionState();
  resetTimelineState();

  excavationValue.textContent = 'Saved response bundle chronicle replay blocked';
  runtimeValue.textContent = 'response bundle chronicle error';
  headlineValue.textContent = 'Response Bundle Chronicle could not replay this saved bundle set.';
  culpritValue.textContent = 'Unsupported bundle chronicle artifact';
  confidenceValue.textContent = '-';
  tagsValue.textContent = 'bundle-chronicle, error';
  signatureValue.textContent = 'stack-sleuth-response-bundle';
  summaryValue.textContent = describeResponseBundleChronicleInputError(details);
  blastRadiusValue.textContent = 'No blast radius details are available because Stack Sleuth stopped before replaying the saved response bundle chronicle.';
  digestGroupsValue.replaceChildren(...buildListItems([
    'Bundle chronicle snapshots must be labeled === release === style blocks containing saved response-bundle.json artifacts.'
  ]));
  supportFramesValue.replaceChildren(...buildListItems([
    'Bundle chronicle replay errors happen before Stack Sleuth reaches any trace-level call stack.'
  ]));
  hotspotsValue.replaceChildren(...buildListItems([
    'Bundle inventory and hotspot drift appear here once Stack Sleuth can replay at least two saved response bundle snapshots.'
  ]));
  checklistValue.replaceChildren(...buildListItems([
    'Use at least two labeled snapshots like === release-a === and === release-b ===.',
    'Make sure each snapshot body is saved response-bundle.json, not raw traces or casebook dataset JSON.',
    'If the bundle version is unsupported, replay it with a compatible Stack Sleuth build or regenerate the artifact.',
  ]));
  caption.textContent = describeResponseBundleChronicleInputError(details);
}

function renderTimelineWorkflow() {
  resetPortfolioState();
  resetForgeState();
  resetDatasetState();
  resetMergeState();

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
  resetDatasetState();
  resetMergeState();
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
  handoffSummaryValue.textContent = 'Paste several labeled incident packs to prepare owner and gap handoff packets.';
  handoffExportValue.textContent = 'Handoff packet export text will appear here after Handoff Briefing runs.';
}

function resetForgeState() {
  forgeSummaryValue.textContent = 'Paste several labeled incident packs to forge reusable casebook entries from a portfolio.';
  forgeExportValue.textContent = 'Forged Casebook export text will appear here after Casebook Forge runs.';
}

function resetDatasetState() {
  datasetSummaryValue.textContent = 'Paste several labeled incident packs to package a reusable Casebook Dataset from the portfolio flow.';
  datasetPackCountValue.textContent = '-';
  datasetExportValue.textContent = 'Dataset export text will appear here after Casebook Dataset runs.';
}

function resetMergeState() {
  mergeSummaryValue.textContent = 'Paste several labeled incident packs with embedded history to update a living casebook.';
  mergeConflictsValue.replaceChildren(...buildListItems([
    'Merge conflicts and review notes will appear here after Casebook Merge runs.'
  ]));
  mergeExportValue.textContent = 'Merged Casebook export text will appear here after Casebook Merge runs.';
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

function loadNotebookExample(example) {
  if (!example) {
    return;
  }

  traceInput.value = example.notebook;
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

function loadDatasetExample(example) {
  if (!example) {
    return;
  }

  traceInput.value = example.dataset;
  caption.textContent = example.caption;
  renderDiagnosis();
}

function loadBundleChronicleExample(example) {
  if (!example) {
    return;
  }

  traceInput.value = example.bundleChronicle;
  caption.textContent = example.caption;
  renderDiagnosis();
}

function loadChronicleExample(example) {
  if (!example) {
    return;
  }

  traceInput.value = example.chronicle;
  caption.textContent = example.caption;
  renderDiagnosis();
}

function loadShelfExample(example) {
  if (!example) {
    return;
  }

  traceInput.value = example.shelf;
  caption.textContent = example.caption;
  renderDiagnosis();
}

function loadMergeExample(example) {
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
  const savedArtifact = inspectSavedArtifactWorkflow(traceText);

  if (savedArtifact) {
    switch (savedArtifact.kind) {
      case 'bundle-chronicle':
        try {
          await navigator.clipboard.writeText(renderResponseBundleChronicleTextSummary(analyzeResponseBundleChronicle(savedArtifact.value)));
          caption.textContent = 'Response Bundle Chronicle summary copied to clipboard.';
        } catch {
          caption.textContent = 'Clipboard copy unavailable here, but the Response Bundle Chronicle summary is ready to copy manually.';
        }
        return;
      case 'bundle-chronicle-error':
        caption.textContent = describeResponseBundleChronicleInputError(savedArtifact.value);
        return;
      case 'bundle-replay':
        try {
          await navigator.clipboard.writeText(renderResponseBundleTextSummary(savedArtifact.value.bundle));
          caption.textContent = 'Response Bundle replay copied to clipboard.';
        } catch {
          caption.textContent = 'Clipboard copy unavailable here, but the Response Bundle replay is ready to copy manually.';
        }
        return;
      case 'bundle-replay-error':
        caption.textContent = describeResponseBundleReplayError(savedArtifact.value).caption;
        return;
      case 'shelf-replay':
        try {
          await navigator.clipboard.writeText(renderShelfTextSummary(savedArtifact.value.shelf));
          caption.textContent = 'Casebook Shelf summary copied to clipboard.';
        } catch {
          caption.textContent = 'Clipboard copy unavailable here, but the Casebook Shelf summary is ready to copy manually.';
        }
        return;
      case 'shelf-replay-error':
        caption.textContent = describeShelfInputError(savedArtifact.value);
        return;
      case 'dataset-chronicle':
        try {
          await navigator.clipboard.writeText(renderCasebookChronicleTextSummary(analyzeCasebookChronicle(savedArtifact.value)));
          caption.textContent = 'Casebook Chronicle summary copied to clipboard.';
        } catch {
          caption.textContent = 'Clipboard copy unavailable here, but the Casebook Chronicle summary is ready to copy manually.';
        }
        return;
      case 'dataset-chronicle-error':
        caption.textContent = describeChronicleInputError(savedArtifact.value);
        return;
      case 'dataset-replay':
        try {
          await navigator.clipboard.writeText(renderDatasetTextSummary(savedArtifact.value.dataset));
          caption.textContent = 'Casebook Dataset replay copied to clipboard.';
        } catch {
          caption.textContent = 'Clipboard copy unavailable here, but the Casebook Dataset replay is ready to copy manually.';
        }
        return;
      case 'dataset-replay-error':
        caption.textContent = describeDatasetReplayError(savedArtifact.value).caption;
        return;
      default:
        break;
    }
  }

  const notebook = parseIncidentNotebook(traceText);

  if (notebook.kind !== 'unsupported') {
    const routed = routeNotebook(traceText, notebook);

    if (routed.mode === 'portfolio') {
      const forge = analyzeCasebookForge(routed.report);
      if (!routed.report.summary.runnablePackCount || !forge.exportText) {
        caption.textContent = 'Notebook mode needs at least one runnable labeled incident pack before there is anything useful to copy.';
        return;
      }
    }

    if (routed.mode === 'pack' && !routed.report.availableAnalyses.length) {
      caption.textContent = 'Notebook mode needs at least one runnable section before there is anything useful to copy.';
      return;
    }

    const payload = buildNotebookClipboardPayload(notebook, routed);

    try {
      await navigator.clipboard.writeText(payload);
      caption.textContent = 'Notebook briefing copied to clipboard.';
    } catch {
      caption.textContent = 'Clipboard copy unavailable here, but the notebook briefing is ready to copy manually.';
    }
    return;
  }

  const portfolio = parseIncidentPortfolio(traceText);

  if (portfolio.packOrder.length) {
    const report = analyzeIncidentPortfolio(portfolio);

    if (!report.summary.runnablePackCount) {
      caption.textContent = 'Portfolio Radar needs at least one runnable labeled incident pack before there is anything useful to copy.';
      return;
    }

    try {
      await navigator.clipboard.writeText(renderIncidentPortfolioTextSummary(report));
      caption.textContent = 'Portfolio Radar summary copied to clipboard.';
    } catch {
      caption.textContent = 'Clipboard copy unavailable here, but the Portfolio Radar summary is ready to copy manually.';
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

function routeNotebook(input, notebook) {
  return routeIncidentNotebook({
    input,
    notebook,
    analyzers: {
      pack: (normalizedText) => ({
        mode: 'pack',
        normalizedText,
        report: analyzeIncidentPack(parseIncidentPack(normalizedText)),
      }),
      portfolio: (normalizedText) => ({
        mode: 'portfolio',
        normalizedText,
        report: analyzeIncidentPortfolio(normalizedText),
      }),
    },
  });
}

function buildNotebookClipboardPayload(notebook, routed) {
  const kindLabel = notebook.kind === 'portfolio'
    ? `Kind: portfolio (${notebook.packOrder.length} packs)`
    : `Kind: pack (${notebook.sectionOrder.length} sections)`;
  const routedText = routed.mode === 'portfolio'
    ? renderIncidentPortfolioTextSummary(routed.report)
    : renderIncidentPackTextSummary(routed.report);

  return [
    'Notebook normalization',
    kindLabel,
    '',
    renderNormalizedNotebookText(notebook),
    '',
    routedText,
  ].join('\n').trim();
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
  const gateVerdict = String(report.gate?.verdict ?? 'needs-input').toUpperCase();
  const blockerCount = report.gate?.blockers?.length ?? 0;
  const warningCount = report.gate?.warnings?.length ?? 0;
  return `Portfolio Radar ranked ${report.summary.runnablePackCount} runnable pack${report.summary.runnablePackCount === 1 ? '' : 's'} out of ${report.summary.packCount}. Release Gate ${gateVerdict} with ${blockerCount} blocker${blockerCount === 1 ? '' : 's'} and ${warningCount} warning${warningCount === 1 ? '' : 's'}. Top priority: ${topPack}. Response queue: ${report.summary.ownedPackCount} owned pack${report.summary.ownedPackCount === 1 ? '' : 's'}, ${report.summary.unownedPackCount} routing gap${report.summary.unownedPackCount === 1 ? '' : 's'}, and ${report.summary.runbookGapCount} runbook gap${report.summary.runbookGapCount === 1 ? '' : 's'}. Cross-pack signals: ${report.summary.totalNovelIncidents} novel, ${report.summary.totalRegressionNew} regression-new, and ${report.summary.totalTimelineRising} timeline-rising.`;
}

function buildPortfolioChecklist(report) {
  const gateChecklist = Array.isArray(report.gate?.checklist) ? report.gate.checklist : [];
  const baseChecklist = Array.isArray(report.summary?.checklist) ? report.summary.checklist : [];
  return [...new Set([...gateChecklist, ...baseChecklist])];
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

function shouldRenderResponseBundleError(replay, input) {
  if (!replay || replay.valid) {
    return false;
  }

  if (replay.reason === 'unsupported-version' || replay.reason === 'invalid-json' || replay.reason === 'missing-dataset') {
    return true;
  }

  return replay.reason === 'not-bundle'
    && typeof input === 'string'
    && input.includes('stack-sleuth-response-bundle')
    && input.trim().startsWith('{');
}

function shouldRenderShelfError(replay, input) {
  if (replay.reason === 'unsupported-version' || replay.reason === 'invalid-json') {
    return true;
  }

  return replay.reason === 'not-shelf'
    && typeof input === 'string'
    && input.includes('stack-sleuth-casebook-shelf')
    && input.trim().startsWith('{');
}

function shouldRenderChronicleError(chronicle) {
  if (!chronicle || chronicle.valid) {
    return false;
  }

  if ((chronicle.snapshots?.length ?? 0) < 1) {
    return false;
  }

  return chronicle.snapshots.every((snapshot) => String(snapshot.source ?? '').trim().startsWith('{'));
}

function shouldRenderResponseBundleChronicleError(chronicle) {
  if (!chronicle || chronicle.valid) {
    return false;
  }

  if ((chronicle.snapshots?.length ?? 0) < 1) {
    return false;
  }

  if (chronicle.reason === 'unsupported-version') {
    return true;
  }

  if (chronicle.reason === 'wrong-kind') {
    return chronicle.replay?.parsed?.kind === 'stack-sleuth-response-bundle';
  }

  if (chronicle.reason === 'invalid-json') {
    return chronicle.snapshots.every((snapshot) => String(snapshot.source ?? '').includes('"stack-sleuth-response-bundle"'));
  }

  return chronicle.reason === 'missing-dataset'
    && chronicle.snapshots.every((snapshot) => String(snapshot.source ?? '').includes('"stack-sleuth-response-bundle"'));
}

function shouldRenderDatasetReplayError(replay, input) {
  if (replay.reason === 'unsupported-version' || replay.reason === 'wrong-kind' || replay.reason === 'invalid-json') {
    return true;
  }

  return replay.reason === 'not-dataset'
    && typeof input === 'string'
    && input.includes('stack-sleuth-casebook-dataset')
    && input.trim().startsWith('{');
}

function describeResponseBundleReplayError(replay) {
  if (replay.reason === 'unsupported-version') {
    const version = replay.parsed?.version ?? 'unknown';
    const supportedVersions = Array.isArray(replay.supportedVersions) ? replay.supportedVersions.join(', ') : 'unknown';
    return {
      headline: `Response Bundle replay uses unsupported version ${version}.`,
      summary: `Saved response bundle replay uses unsupported version ${version}. Supported versions: ${supportedVersions}. Rebuild the bundle with a compatible Stack Sleuth release or reopen the original portfolio input.`,
      caption: `Response Bundle replay uses unsupported version ${version}. Supported versions: ${supportedVersions}.`,
      checklist: [
        `Rebuild the saved response bundle with a Stack Sleuth version that supports bundle versions ${supportedVersions}.`,
        'If you still have the original portfolio input, reopen it to regenerate a fresh response bundle artifact.',
      ],
    };
  }

  if (replay.reason === 'wrong-kind') {
    return {
      headline: `Response Bundle replay uses unsupported kind ${replay.parsed?.kind ?? 'unknown'}.`,
      summary: 'This browser replay flow only supports saved Stack Sleuth response bundle artifacts.',
      caption: `Response Bundle replay uses unsupported kind ${replay.parsed?.kind ?? 'unknown'}.`,
      checklist: [
        'Paste a saved Stack Sleuth response-bundle.json artifact instead of another JSON document.',
        'If the artifact came from another workflow, replay it through the matching Stack Sleuth mode instead.',
      ],
    };
  }

  if (replay.reason === 'invalid-json') {
    return {
      headline: 'Response Bundle replay could not parse the saved bundle JSON.',
      summary: 'The pasted artifact looks like a Stack Sleuth response bundle, but the JSON is malformed. Paste the saved bundle again or reload it from disk before replaying it here.',
      caption: 'Response Bundle replay could not parse the saved bundle JSON.',
      checklist: [
        'Paste the full saved response bundle JSON blob, including the opening and closing braces.',
        'If the artifact was hand-edited, validate the JSON before replaying it here.',
      ],
    };
  }

  if (replay.reason === 'missing-dataset') {
    return {
      headline: 'Response Bundle replay is missing casebook-dataset.json.',
      summary: 'Saved response bundles must preserve the embedded Casebook Dataset artifact so Stack Sleuth can replay preserved routing and casebook state honestly.',
      caption: 'Response Bundle replay requires casebook-dataset.json in the saved bundle.',
      checklist: [
        'Regenerate the saved bundle so it includes casebook-dataset.json.',
        'If you only need the saved dataset, replay that artifact directly through Casebook Dataset replay.',
      ],
    };
  }

  return {
    headline: 'Response Bundle replay requires a saved Stack Sleuth response bundle.',
    summary: 'Paste a saved Stack Sleuth response-bundle.json artifact to replay preserved bundle inventory and embedded dataset state.',
    caption: 'Response Bundle replay needs a saved Stack Sleuth response bundle JSON artifact.',
    checklist: [
      'Generate a response bundle from a portfolio-shaped workflow first.',
      'Paste the saved response-bundle.json blob into the shared workspace to replay it here.',
    ],
  };
}

function describeDatasetReplayError(replay) {
  if (replay.reason === 'unsupported-version') {
    const version = replay.parsed?.version ?? 'unknown';
    const supportedVersion = replay.supportedVersion ?? 'unknown';
    return {
      headline: `Casebook Dataset replay uses unsupported version ${version}.`,
      summary: `Saved dataset replay uses unsupported version ${version}. Supported version: ${supportedVersion}. Re-export the dataset with a supported Stack Sleuth build or reopen the original labeled portfolio input.`,
      caption: `Casebook Dataset replay uses unsupported version ${version}. Supported version: ${supportedVersion}.`,
      checklist: [
        `Rebuild the dataset with Stack Sleuth version ${supportedVersion} support before replaying it here.`,
        'If you still have the original labeled portfolio, reopen that input to regenerate a fresh dataset artifact.',
      ],
    };
  }

  if (replay.reason === 'wrong-kind') {
    return {
      headline: `Casebook Dataset replay uses unsupported kind ${replay.parsed?.kind ?? 'unknown'}.`,
      summary: 'This browser replay flow only supports saved Stack Sleuth Casebook Dataset artifacts.',
      caption: `Casebook Dataset replay uses unsupported kind ${replay.parsed?.kind ?? 'unknown'}.`,
      checklist: [
        'Paste a saved Stack Sleuth Casebook Dataset JSON artifact instead of another JSON document.',
        'If the artifact came from another workflow, replay it through the matching Stack Sleuth mode instead.',
      ],
    };
  }

  if (replay.reason === 'invalid-json') {
    return {
      headline: 'Casebook Dataset replay could not parse the saved dataset JSON.',
      summary: 'The pasted artifact looks like a Stack Sleuth dataset, but the JSON is malformed. Paste the saved dataset again or reload it from disk before replaying it here.',
      caption: 'Casebook Dataset replay could not parse the saved dataset JSON.',
      checklist: [
        'Paste the full saved dataset JSON blob, including the opening and closing braces.',
        'If the artifact was hand-edited, validate the JSON before replaying it here.',
      ],
    };
  }

  return {
    headline: 'Casebook Dataset replay requires saved Stack Sleuth dataset JSON.',
    summary: 'Paste a saved Stack Sleuth Casebook Dataset artifact to replay preserved routing and reusable casebook state.',
    caption: 'Casebook Dataset replay needs a saved Stack Sleuth dataset JSON artifact.',
    checklist: [
      'Generate a Casebook Dataset from a labeled portfolio first.',
      'Paste the saved dataset JSON blob into the shared workspace to replay it here.',
    ],
  };
}

function buildShelfInventoryItems(snapshots) {
  if (!snapshots?.length) {
    return ['Shelf snapshot inventory will appear here once a saved shelf artifact is replayed.'];
  }

  return snapshots.map((snapshot) => snapshot.status === 'valid'
    ? `${snapshot.filename}: valid saved snapshot ${snapshot.label}`
    : `${snapshot.filename}: ${snapshot.reason}`);
}

function buildResponseBundleInventoryItems(fileNames) {
  if (!fileNames?.length) {
    return ['Saved bundle inventory is not available in this response bundle artifact.'];
  }

  return fileNames.map((name) => `saved bundle file: ${name}`);
}

function buildDatasetReplayPackItems(packOrder) {
  if (!packOrder?.length) {
    return ['Saved pack order is not available in this dataset artifact.'];
  }

  return packOrder.map((label, index) => `${index + 1}. saved pack: ${label}`);
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

  return responseQueue.map((entry) => describeResponseQueueEntry(entry));
}

function buildPortfolioRoutingGapItems(unownedPacks, runbookGaps) {
  const items = [];

  if (unownedPacks?.length) {
    items.push(...unownedPacks.map((item) => describeRoutingGap('owner', item)));
  }

  if (runbookGaps?.length) {
    items.push(...runbookGaps.map((item) => describeRoutingGap('runbook', item)));
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

function buildChronicleOwnerItems(owners) {
  return owners.length
    ? owners.map((entry) => `${entry.trend}: ${entry.owner} ${entry.series.join(' → ')}`)
    : ['Owner load trends will appear here once the chronicle has valid response-queue snapshots.'];
}

function buildChronicleHotspotItems(hotspots, latestDataset = null) {
  if (hotspots.length) {
    return hotspots.map((entry) => `${entry.trend}: ${entry.label} ${entry.series.join(' → ')}`);
  }

  if (latestDataset?.recurringHotspots?.length) {
    return latestDataset.recurringHotspots.map((entry) => `${entry.label}: ${entry.packCount} saved pack${entry.packCount === 1 ? '' : 's'}`);
  }

  return ['Recurring hotspot drift will appear here once the chronicle preserves hotspot snapshots.'];
}

function buildChronicleTrendItems(report) {
  const ownerLines = report.ownerTrends.slice(0, 3).map((entry) => `owner ${entry.trend}: ${entry.owner} ${entry.series.join(' → ')}`);
  const hotspotLines = report.hotspotTrends.slice(0, 3).map((entry) => `hotspot ${entry.trend}: ${entry.label} ${entry.series.join(' → ')}`);
  const caseLines = report.caseTrends.slice(0, 3).map((entry) => `case ${entry.trend}: ${entry.signature} ${entry.series.join(' → ')}`);
  const items = [...ownerLines, ...hotspotLines, ...caseLines];
  return items.length ? items : ['Chronicle trend calls will appear here after at least two valid saved dataset snapshots.'];
}

function buildChronicleChecklist(report) {
  return [
    `Inspect the latest saved dataset export for ${report.summary.latestLabel} if you need reusable casebook text.`,
    `Review Release Gate movement next: ${report.summary.gateDrift.summary}`,
    'Reopen the source portfolio or timeline input if you need trace-level culprit frames or blast radius detail.',
    'Use the owner and hotspot trend lines to decide which saved release window deserves a deeper replay next.',
  ];
}

function buildBundleChronicleInventoryItems(items) {
  return items.length
    ? items.map((entry) => `${entry.trend}: saved bundle file ${entry.filename} ${entry.series.join(' → ')}`)
    : ['Bundle inventory drift will appear here once the chronicle preserves saved response bundle snapshots.'];
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
loadNotebookButton?.addEventListener('click', () => loadNotebookExample(notebookExample));
loadPackButton?.addEventListener('click', () => loadIncidentPackExample(incidentPackExample));
loadPortfolioButton?.addEventListener('click', () => loadPortfolioExample(portfolioExample));
loadHandoffButton?.addEventListener('click', () => loadPortfolioExample(handoffExample));
loadDatasetButton?.addEventListener('click', () => loadDatasetExample(datasetExample));
loadBundleChronicleButton?.addEventListener('click', () => loadBundleChronicleExample(bundleChronicleExample));
loadChronicleButton?.addEventListener('click', () => loadChronicleExample(chronicleExample));
loadShelfButton?.addEventListener('click', () => loadShelfExample(shelfExample));
loadMergeButton?.addEventListener('click', () => loadMergeExample(mergeExample));
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
  resetDatasetState();
  resetMergeState();
resetRegressionState();
resetCasebookState();
resetTimelineState();
