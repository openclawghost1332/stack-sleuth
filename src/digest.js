import { analyzeTrace, formatFrame } from './analyze.js';
import { detectTraceStartRuntime } from './parse.js';

const PYTHON_CHAIN_MARKER = /^(?:The above exception was the direct cause of the following exception:|During handling of the above exception, another exception occurred:)$/;

export function splitTraceChunks(input) {
  const source = String(input ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) {
    return [];
  }

  const sections = source
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  return sections.reduce((chunks, section) => {
    if (chunks.length === 0) {
      chunks.push(section);
      return chunks;
    }

    const firstLine = section.split('\n')[0] ?? '';
    const lastLine = chunks.at(-1)?.split('\n').at(-1) ?? '';
    const startsNewTrace = Boolean(detectTraceStartRuntime(firstLine));
    const continuesPythonChain = firstLine === 'Traceback (most recent call last):' && PYTHON_CHAIN_MARKER.test(lastLine);

    if (startsNewTrace && !continuesPythonChain) {
      chunks.push(section);
      return chunks;
    }

    chunks[chunks.length - 1] = `${chunks.at(-1)}\n\n${section}`;
    return chunks;
  }, []);
}

export function analyzeTraceDigest(input) {
  const traces = splitTraceChunks(input)
    .map((chunk) => analyzeTrace(chunk))
    .filter((report) => !report.empty);

  const groupsBySignature = new Map();

  traces.forEach((report, index) => {
    const existing = groupsBySignature.get(report.signature);
    if (existing) {
      existing.count += 1;
      existing.tags = mergeSortedUnique(existing.tags, report.diagnosis?.tags ?? []);
      existing.runtimes = mergeSortedUnique(existing.runtimes, [report.runtime]);
      existing.errorNames = mergeSortedUnique(existing.errorNames, [report.errorName]);
      existing.confidences = mergeSortedUnique(existing.confidences, [report.diagnosis?.confidence ?? 'unknown']);
      return;
    }

    groupsBySignature.set(report.signature, {
      signature: report.signature,
      runtime: report.runtime,
      errorName: report.errorName,
      count: 1,
      firstSeenIndex: index,
      tags: [...(report.diagnosis?.tags ?? [])],
      runtimes: [report.runtime],
      errorNames: [report.errorName],
      confidences: [report.diagnosis?.confidence ?? 'unknown'],
      representative: report
    });
  });

  const groups = [...groupsBySignature.values()].sort((a, b) => b.count - a.count || a.firstSeenIndex - b.firstSeenIndex);

  return {
    totalTraces: traces.length,
    groupCount: groups.length,
    groups,
    traces
  };
}

export function renderDigestTextSummary(digest) {
  return [
    'Stack Sleuth Incident Digest',
    `Total traces: ${digest.totalTraces}`,
    `Unique incidents: ${digest.groupCount}`,
    '',
    ...digest.groups.flatMap((group, index) => [
      `Incident ${index + 1}: ${group.count}x ${group.runtime} ${group.errorName}`,
      `Signature: ${group.signature}`,
      `Culprit: ${formatFrame(group.representative.culpritFrame)}`,
      `Confidence: ${group.representative.diagnosis.confidence}`,
      `Tags: ${group.tags.join(', ')}`,
      `Summary: ${group.representative.diagnosis.summary}`,
      ''
    ])
  ].join('\n').trim();
}

export function renderDigestMarkdownSummary(digest) {
  return [
    '# Stack Sleuth Incident Digest',
    '',
    `- **Total traces:** ${digest.totalTraces}`,
    `- **Unique incidents:** ${digest.groupCount}`,
    '',
    ...digest.groups.flatMap((group, index) => [
      `## Incident ${index + 1} (${group.count} traces)`,
      '',
      `- **Runtime:** ${escapeMarkdownText(group.runtime)}`,
      `- **Error:** ${escapeMarkdownText(`${group.errorName}: ${group.representative.message}`)}`,
      `- **Signature:** ${formatMarkdownCode(group.signature)}`,
      `- **Culprit:** ${formatMarkdownCode(formatFrame(group.representative.culpritFrame))}`,
      `- **Confidence:** ${escapeMarkdownText(group.representative.diagnosis.confidence)}`,
      `- **Tags:** ${escapeMarkdownText(group.tags.join(', '))}`,
      '',
      escapeMarkdownText(group.representative.diagnosis.summary),
      ''
    ])
  ].join('\n').trim();
}

function mergeSortedUnique(existing, next) {
  return [...new Set([...(existing ?? []), ...(next ?? [])])].sort();
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
