import { analyzeTrace, formatFrame, renderTextSummary } from './analyze.js';
import { analyzeTraceDigest, splitTraceChunks, renderDigestTextSummary } from './digest.js';
import { examples } from './examples.js';

const traceInput = document.querySelector('#trace-input');
const explainButton = document.querySelector('#explain-button');
const loadJsButton = document.querySelector('#load-js-button');
const loadPythonButton = document.querySelector('#load-python-button');
const loadDigestButton = document.querySelector('#load-digest-button');
const copyButton = document.querySelector('#copy-button');
const caption = document.querySelector('#example-caption');

const runtimeValue = document.querySelector('#runtime-value');
const headlineValue = document.querySelector('#headline-value');
const culpritValue = document.querySelector('#culprit-value');
const confidenceValue = document.querySelector('#confidence-value');
const tagsValue = document.querySelector('#tags-value');
const signatureValue = document.querySelector('#signature-value');
const supportFramesValue = document.querySelector('#support-frames-value');
const summaryValue = document.querySelector('#summary-value');
const digestGroupsValue = document.querySelector('#digest-groups-value');
const checklistValue = document.querySelector('#checklist-value');

const jsExample = examples.find((item) => item.label === 'JavaScript undefined property');
const pythonExample = examples.find((item) => item.label === 'Python missing key');
const digestExample = examples.find((item) => item.label === 'Repeated incident digest');

function renderDiagnosis() {
  const traceText = traceInput.value.trim();
  if (!traceText) {
    resetEmptyState();
    return;
  }

  if (splitTraceChunks(traceText).length > 1) {
    renderDigest(traceText);
    return;
  }

  const report = analyzeTrace(traceText);
  const diagnosis = report.diagnosis;

  runtimeValue.textContent = report.runtime;
  headlineValue.textContent = `${report.errorName}: ${report.message}`;
  culpritValue.textContent = formatFrame(report.culpritFrame);
  confidenceValue.textContent = diagnosis.confidence;
  tagsValue.textContent = diagnosis.tags.join(', ');
  signatureValue.textContent = report.signature;
  summaryValue.textContent = diagnosis.summary;
  digestGroupsValue.replaceChildren(...buildListItems([
    'Repeated incidents will appear here when Stack Sleuth detects multiple traces.'
  ]));
  supportFramesValue.replaceChildren(...buildListItems(
    report.supportFrames.length
      ? report.supportFrames.map((frame) => formatFrame(frame))
      : ['No nearby application frames beyond the culprit were detected.']
  ));
  checklistValue.replaceChildren(...buildListItems(diagnosis.checklist));
}

function renderDigest(traceText) {
  const digest = analyzeTraceDigest(traceText);

  runtimeValue.textContent = `${digest.groupCount} grouped incident${digest.groupCount === 1 ? '' : 's'}`;
  headlineValue.textContent = `${digest.totalTraces} traces collapsed into ${digest.groupCount} incident groups`;
  culpritValue.textContent = formatFrame(digest.groups[0]?.representative?.culpritFrame ?? null);
  confidenceValue.textContent = digest.groups[0]?.representative?.diagnosis?.confidence ?? 'unknown';
  tagsValue.textContent = digest.groups[0]?.tags?.join(', ') ?? '-';
  signatureValue.textContent = digest.groups[0]?.signature ?? '-';
  summaryValue.textContent = digest.groups[0]?.representative?.diagnosis?.summary ?? 'No digest summary available yet.';
  digestGroupsValue.replaceChildren(...buildListItems(
    digest.groups.map((group) => `${group.count}x ${group.runtime} ${group.errorName} at ${formatFrame(group.representative.culpritFrame)}`)
  ));
  supportFramesValue.replaceChildren(...buildListItems(
    digest.groups[0]?.representative?.supportFrames?.length
      ? digest.groups[0].representative.supportFrames.map((frame) => formatFrame(frame))
      : ['Open the top incident to inspect its nearby application frames.']
  ));
  checklistValue.replaceChildren(...buildListItems(
    digest.groups[0]?.representative?.diagnosis?.checklist ?? ['Inspect the top repeated incident first.']
  ));
}

function resetEmptyState() {
  headlineValue.textContent = 'Paste one or more traces to get started';
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
  checklistValue.replaceChildren(...buildListItems([
    'Run an example or paste one or more real traces to see actionable next steps.'
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

async function copyDiagnosis() {
  const traceText = traceInput.value.trim();
  const payload = splitTraceChunks(traceText).length > 1
    ? renderDigestTextSummary(analyzeTraceDigest(traceText))
    : renderTextSummary(analyzeTrace(traceText));

  try {
    await navigator.clipboard.writeText(payload);
    caption.textContent = 'Diagnosis copied to clipboard.';
  } catch {
    caption.textContent = 'Clipboard copy unavailable here, but the diagnosis is ready to copy manually.';
  }
}

function buildListItems(items) {
  return items.map((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    return li;
  });
}

explainButton?.addEventListener('click', renderDiagnosis);
loadJsButton?.addEventListener('click', () => loadExample(jsExample));
loadPythonButton?.addEventListener('click', () => loadExample(pythonExample));
loadDigestButton?.addEventListener('click', () => loadExample(digestExample));
copyButton?.addEventListener('click', copyDiagnosis);
traceInput?.addEventListener('input', () => {
  if (!traceInput.value.trim()) {
    caption.textContent = '';
    resetEmptyState();
  }
});

loadExample(jsExample);
