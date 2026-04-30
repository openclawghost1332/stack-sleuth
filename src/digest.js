import { analyzeTrace, formatFrame } from './analyze.js';
import { buildHotspots } from './hotspots.js';
import { extractTraceSet, formatExtractionText, formatExtractionMarkdown } from './extract.js';

export function splitTraceChunks(input) {
  return extractTraceSet(input).traces;
}

export function analyzeTraceDigest(input) {
  const extraction = extractTraceSet(input);
  const traces = extraction.traces
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
    extraction,
    totalTraces: traces.length,
    groupCount: groups.length,
    groups,
    traces,
    hotspots: buildHotspots(traces)
  };
}

export function renderDigestTextSummary(digest) {
  return [
    'Stack Sleuth Incident Digest',
    formatExtractionText(digest.extraction),
    `Total traces: ${digest.totalTraces}`,
    `Unique incidents: ${digest.groupCount}`,
    `Suspect hotspots: ${formatTextHotspots(digest.hotspots)}`,
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
    formatExtractionMarkdown(digest.extraction),
    `- **Total traces:** ${digest.totalTraces}`,
    `- **Unique incidents:** ${digest.groupCount}`,
    '',
    '## Suspect hotspots',
    formatMarkdownHotspots(digest.hotspots),
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

function formatTextHotspots(hotspots) {
  if (!(hotspots?.length)) {
    return 'None';
  }

  return hotspots
    .slice(0, 3)
    .map((hotspot) => `${hotspot.label} (score ${hotspot.score})`)
    .join(', ');
}

function formatMarkdownHotspots(hotspots) {
  if (!(hotspots?.length)) {
    return '- `None`';
  }

  return hotspots
    .slice(0, 3)
    .map((hotspot) => `- ${formatMarkdownCode(hotspot.label)} (score ${hotspot.score}, culprit ${hotspot.culpritCount}x, support ${hotspot.supportCount}x)`)
    .join('\n');
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
