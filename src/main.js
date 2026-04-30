import { analyzeTrace, formatFrame, renderTextSummary } from './analyze.js';
import { analyzeTraceDigest, renderDigestTextSummary } from './digest.js';
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
const copyButton = document.querySelector('#copy-button');
const caption = document.querySelector('#example-caption');

const compareBaselineInput = document.querySelector('#compare-baseline-input');
const compareCandidateInput = document.querySelector('#compare-candidate-input');
const compareButton = document.querySelector('#compare-button');
const loadRegressionButton = document.querySelector('#load-regression-button');
const compareCaption = document.querySelector('#compare-caption');

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
const timelineSummaryValue = document.querySelector('#timeline-summary-value');
const timelineIncidentsValue = document.querySelector('#timeline-incidents-value');
const timelineHotspotsValue = document.querySelector('#timeline-hotspots-value');

const jsExample = examples.find((item) => item.label === 'JavaScript undefined property');
const pythonExample = examples.find((item) => item.label === 'Python missing key');
const rawLogExample = examples.find((item) => item.label === 'Raw log excavation');
const digestExample = examples.find((item) => item.label === 'Repeated incident digest');
const regressionExample = examples.find((item) => item.label === 'Regression radar');
const timelineExample = examples.find((item) => item.label === 'Timeline radar');

function renderDiagnosis() {
  const traceText = traceInput.value.trim();
  if (!traceText) {
    resetEmptyState();
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

function renderRegressionWorkflow() {
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

function renderTimelineWorkflow() {
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

async function copyDiagnosis() {
  const traceText = traceInput.value.trim();
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

explainButton?.addEventListener('click', renderDiagnosis);
loadJsButton?.addEventListener('click', () => loadExample(jsExample));
loadPythonButton?.addEventListener('click', () => loadExample(pythonExample));
loadRawLogButton?.addEventListener('click', () => loadExample(rawLogExample));
loadDigestButton?.addEventListener('click', () => loadExample(digestExample));
loadRegressionButton?.addEventListener('click', () => loadRegressionExample(regressionExample));
compareButton?.addEventListener('click', renderRegressionWorkflow);
loadTimelineButton?.addEventListener('click', () => loadTimelineExample(timelineExample));
timelineButton?.addEventListener('click', renderTimelineWorkflow);
copyButton?.addEventListener('click', copyDiagnosis);
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
timelineInput?.addEventListener('input', () => {
  if (!timelineInput.value.trim()) {
    timelineCaption.textContent = 'Paste labeled rollout snapshots like === canary === and === full-rollout === to track trend movement.';
    resetTimelineState();
  }
});

loadExample(jsExample);
resetRegressionState();
resetTimelineState();
