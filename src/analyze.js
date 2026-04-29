import { parseTrace } from './parse.js';
import { diagnoseTrace } from './diagnose.js';

const EMPTY_MESSAGE = 'No trace provided yet. Paste a stack trace to analyze it.';

export function analyzeTrace(traceText) {
  const source = String(traceText ?? '');

  if (!source.trim()) {
    return {
      empty: true,
      runtime: 'unknown',
      errorName: null,
      message: '',
      culpritFrame: null,
      supportFrames: [],
      diagnosis: null,
      signature: 'empty-trace'
    };
  }

  const parsed = parseTrace(source);
  const diagnosis = diagnoseTrace(parsed);
  const report = {
    ...parsed,
    empty: false,
    diagnosis,
    supportFrames: selectSupportFrames(parsed.frames, parsed.culpritFrame),
  };

  return {
    ...report,
    signature: buildSignature(report)
  };
}

export function buildSignature(report) {
  if (report?.empty) {
    return 'empty-trace';
  }

  const runtime = String(report?.runtime ?? 'unknown');
  const errorName = String(report?.errorName ?? 'Error');
  const frame = formatSignatureFrame(report?.culpritFrame);
  const tags = [...(report?.diagnosis?.tags ?? [])].sort().join(',') || 'untagged';

  return `${runtime}|${errorName}|${frame}|${tags}`;
}

export function renderTextSummary(report) {
  if (report?.empty) {
    return EMPTY_MESSAGE;
  }

  const normalized = normalizeRenderableReport(report);
  const supportFrames = normalized.supportFrames.length
    ? normalized.supportFrames.map(formatFrame).join(', ')
    : 'None';

  return [
    'Stack Sleuth Report',
    `Runtime: ${normalized.runtime}`,
    `Error: ${normalized.errorName}: ${normalized.message}`,
    `Signature: ${normalized.signature}`,
    `Culprit: ${formatFrame(normalized.culpritFrame)}`,
    `Support frames: ${supportFrames}`,
    `Confidence: ${normalized.diagnosis.confidence}`,
    `Tags: ${normalized.diagnosis.tags.join(', ')}`,
    `Summary: ${normalized.diagnosis.summary}`,
    'Checklist:',
    ...normalized.diagnosis.checklist.map((item) => `- ${item}`)
  ].join('\n');
}

export function renderMarkdownSummary(report) {
  if (report?.empty) {
    return `# Stack Sleuth Report\n\n${escapeMarkdownText(EMPTY_MESSAGE)}`;
  }

  const normalized = normalizeRenderableReport(report);
  const supportFrames = normalized.supportFrames.length
    ? normalized.supportFrames.map((frame) => `- ${formatMarkdownCode(formatFrame(frame))}`).join('\n')
    : '- `None`';

  return [
    '# Stack Sleuth Report',
    '',
    `- **Runtime:** ${escapeMarkdownText(normalized.runtime)}`,
    `- **Error:** ${escapeMarkdownText(`${normalized.errorName}: ${normalized.message}`)}`,
    `- **Signature:** ${formatMarkdownCode(normalized.signature)}`,
    `- **Culprit:** ${formatMarkdownCode(formatFrame(normalized.culpritFrame))}`,
    `- **Confidence:** ${escapeMarkdownText(normalized.diagnosis.confidence)}`,
    `- **Tags:** ${escapeMarkdownText(normalized.diagnosis.tags.join(', '))}`,
    '',
    '## Support frames',
    supportFrames,
    '',
    '## Summary',
    escapeMarkdownText(normalized.diagnosis.summary),
    '',
    '## Checklist',
    ...normalized.diagnosis.checklist.map((item) => `- ${escapeMarkdownText(item)}`)
  ].join('\n');
}

function selectSupportFrames(frames, culpritFrame) {
  if (!culpritFrame) {
    return [];
  }

  const culpritIndex = frames.indexOf(culpritFrame);
  if (culpritIndex === -1) {
    return [];
  }

  return frames.slice(culpritIndex + 1).filter((frame) => !frame.internal).slice(0, 3);
}

function formatSignatureFrame(frame) {
  if (!frame?.file) {
    return 'unknown-frame';
  }

  const normalizedFile = String(frame.file)
    .replace(/^[A-Za-z]:/i, '')
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '') || 'unknown-frame';

  return frame.line ? `${normalizedFile}:${frame.line}` : normalizedFile;
}

function normalizeRenderableReport(report) {
  const diagnosis = report?.diagnosis ?? {};

  return {
    runtime: String(report?.runtime ?? 'unknown'),
    errorName: String(report?.errorName ?? 'Error'),
    message: String(report?.message ?? ''),
    culpritFrame: report?.culpritFrame ?? null,
    supportFrames: Array.isArray(report?.supportFrames) ? report.supportFrames : [],
    signature: String(report?.signature ?? buildSignature(report)),
    diagnosis: {
      confidence: String(diagnosis.confidence ?? 'unknown'),
      tags: Array.isArray(diagnosis.tags) && diagnosis.tags.length ? diagnosis.tags : ['untagged'],
      summary: String(diagnosis.summary ?? 'No diagnosis available yet.'),
      checklist: Array.isArray(diagnosis.checklist) && diagnosis.checklist.length
        ? diagnosis.checklist
        : ['No checklist available yet.']
    }
  };
}

export function formatFrame(frame) {
  if (!frame?.file) {
    return 'No application frame detected';
  }

  const location = frame.line ? `${frame.file}:${frame.line}` : frame.file;
  return frame.functionName ? `${frame.functionName} (${location})` : location;
}

function formatMarkdownCode(value) {
  return `\`${escapeMarkdownCode(value)}\``;
}

function escapeMarkdownText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}

function escapeMarkdownCode(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}
