import { parseTrace } from './parse.js';
import { diagnoseTrace } from './diagnose.js';
import { examples } from './examples.js';

const traceInput = document.querySelector('#trace-input');
const explainButton = document.querySelector('#explain-button');
const loadJsButton = document.querySelector('#load-js-button');
const loadPythonButton = document.querySelector('#load-python-button');
const copyButton = document.querySelector('#copy-button');
const caption = document.querySelector('#example-caption');

const runtimeValue = document.querySelector('#runtime-value');
const headlineValue = document.querySelector('#headline-value');
const culpritValue = document.querySelector('#culprit-value');
const confidenceValue = document.querySelector('#confidence-value');
const tagsValue = document.querySelector('#tags-value');
const summaryValue = document.querySelector('#summary-value');
const checklistValue = document.querySelector('#checklist-value');

const jsExample = examples.find((item) => item.label === 'JavaScript undefined property');
const pythonExample = examples.find((item) => item.label === 'Python missing key');

function renderDiagnosis() {
  const traceText = traceInput.value.trim();
  if (!traceText) {
    headlineValue.textContent = 'Paste a trace to get started';
    runtimeValue.textContent = 'Awaiting trace';
    culpritValue.textContent = 'No frame selected yet';
    confidenceValue.textContent = '-';
    tagsValue.textContent = '-';
    summaryValue.textContent = 'Your diagnosis summary will appear here.';
    checklistValue.innerHTML = '<li>Run an example or paste a real trace to see actionable next steps.</li>';
    return;
  }

  const report = parseTrace(traceText);
  const diagnosis = diagnoseTrace(report);

  runtimeValue.textContent = report.runtime;
  headlineValue.textContent = `${report.errorName}: ${report.message}`;
  culpritValue.textContent = formatFrame(report.culpritFrame);
  confidenceValue.textContent = diagnosis.confidence;
  tagsValue.textContent = diagnosis.tags.join(', ');
  summaryValue.textContent = diagnosis.summary;
  checklistValue.replaceChildren(...diagnosis.checklist.map((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    return li;
  }));
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
  const payload = [
    `Runtime: ${runtimeValue.textContent}`,
    `Error headline: ${headlineValue.textContent}`,
    `Culprit frame: ${culpritValue.textContent}`,
    `Confidence: ${confidenceValue.textContent}`,
    `Tags: ${tagsValue.textContent}`,
    `Summary: ${summaryValue.textContent}`,
    `Checklist: ${(Array.from(checklistValue.querySelectorAll('li')).map((item) => item.textContent).join(' | '))}`
  ].join('\n');

  try {
    await navigator.clipboard.writeText(payload);
    caption.textContent = 'Diagnosis copied to clipboard.';
  } catch {
    caption.textContent = 'Clipboard copy unavailable here, but the diagnosis is ready to copy manually.';
  }
}

function formatFrame(frame) {
  if (!frame?.file) {
    return 'No application frame detected';
  }

  const location = frame.line ? `${frame.file}:${frame.line}` : frame.file;
  return frame.functionName ? `${frame.functionName} (${location})` : location;
}

explainButton?.addEventListener('click', renderDiagnosis);
loadJsButton?.addEventListener('click', () => loadExample(jsExample));
loadPythonButton?.addEventListener('click', () => loadExample(pythonExample));
copyButton?.addEventListener('click', copyDiagnosis);
traceInput?.addEventListener('input', () => {
  if (!traceInput.value.trim()) {
    caption.textContent = '';
  }
});

loadExample(jsExample);
