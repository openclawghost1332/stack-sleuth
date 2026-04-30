import { analyzeTrace, formatFrame } from './analyze.js';
import { buildHotspots } from './hotspots.js';
import { extractTraceSet, formatExtractionText, formatExtractionMarkdown } from './extract.js';

export function splitTraceChunks(input) {
  return extractTraceSet(input).traces;
}

export function analyzeTraceDigest(input) {
  const extraction = extractTraceSet(input);
  const traces = extraction.entries
    .map((entry) => ({ entry, report: analyzeTrace(entry.trace) }))
    .filter(({ report }) => !report.empty)
    .map(({ entry, report }) => ({
      ...report,
      sourceContext: normalizeSourceContext(entry.context, extraction.mode),
    }));

  const groupsBySignature = new Map();

  for (const [index, report] of traces.entries()) {
    const existing = groupsBySignature.get(report.signature);
    if (existing) {
      existing.count += 1;
      existing.tags = mergeSortedUnique(existing.tags, report.diagnosis?.tags ?? []);
      existing.runtimes = mergeSortedUnique(existing.runtimes, [report.runtime]);
      existing.errorNames = mergeSortedUnique(existing.errorNames, [report.errorName]);
      existing.confidences = mergeSortedUnique(existing.confidences, [report.diagnosis?.confidence ?? 'unknown']);
      existing.blastRadius = mergeBlastRadius(existing.blastRadius, report.sourceContext);
      continue;
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
      representative: report,
      blastRadius: cloneBlastRadius(report.sourceContext),
    });
  }

  const groups = [...groupsBySignature.values()].sort((a, b) => b.count - a.count || a.firstSeenIndex - b.firstSeenIndex);

  return {
    extraction,
    totalTraces: traces.length,
    groupCount: groups.length,
    groups,
    traces,
    hotspots: buildHotspots(traces),
    blastRadius: traces.reduce((aggregate, report) => mergeBlastRadius(aggregate, report.sourceContext), createEmptyBlastRadius(extraction.mode))
  };
}

export function renderDigestTextSummary(digest) {
  return [
    'Stack Sleuth Incident Digest',
    formatExtractionText(digest.extraction),
    `Total traces: ${digest.totalTraces}`,
    `Unique incidents: ${digest.groupCount}`,
    `Suspect hotspots: ${formatTextHotspots(digest.hotspots)}`,
    ...formatBlastRadiusTextLines(digest.blastRadius),
    '',
    ...digest.groups.flatMap((group, index) => [
      `Incident ${index + 1}: ${group.count}x ${group.runtime} ${group.errorName}`,
      `Signature: ${group.signature}`,
      `Culprit: ${formatFrame(group.representative.culpritFrame)}`,
      `Confidence: ${group.representative.diagnosis.confidence}`,
      `Tags: ${group.tags.join(', ')}`,
      `Summary: ${group.representative.diagnosis.summary}`,
      ...formatBlastRadiusTextLines(group.blastRadius),
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
    ...formatBlastRadiusMarkdownLines(digest.blastRadius),
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
      ...formatBlastRadiusMarkdownLines(group.blastRadius),
      '',
      escapeMarkdownText(group.representative.diagnosis.summary),
      ''
    ])
  ].join('\n').trim();
}

export function normalizeSourceContext(context, mode = 'direct') {
  const services = (context?.services ?? []).map((name) => ({ name, count: 1 }));
  return {
    origin: mode === 'extracted' ? 'extracted' : 'direct',
    services,
    levels: mergeSortedUnique([], context?.levels ?? []),
    firstSeen: context?.firstSeen ?? null,
    lastSeen: context?.lastSeen ?? null,
  };
}

export function createEmptyBlastRadius(origin = 'direct') {
  return {
    origin,
    services: [],
    levels: [],
    firstSeen: null,
    lastSeen: null,
  };
}

export function cloneBlastRadius(blastRadius) {
  return {
    origin: blastRadius?.origin ?? 'direct',
    services: (blastRadius?.services ?? []).map((service) => ({ ...service })),
    levels: [...(blastRadius?.levels ?? [])],
    firstSeen: blastRadius?.firstSeen ?? null,
    lastSeen: blastRadius?.lastSeen ?? null,
  };
}

export function mergeBlastRadius(current, next) {
  const aggregate = cloneBlastRadius(current ?? createEmptyBlastRadius(next?.origin ?? 'direct'));
  const services = new Map(aggregate.services.map((service) => [service.name, { ...service }]));

  for (const service of next?.services ?? []) {
    const existing = services.get(service.name) ?? { name: service.name, count: 0 };
    existing.count += service.count ?? 0;
    services.set(service.name, existing);
  }

  aggregate.services = [...services.values()].sort((left, right) => right.count - left.count);
  aggregate.levels = mergeSortedUnique(aggregate.levels, next?.levels ?? []);
  aggregate.firstSeen = minTimestamp(aggregate.firstSeen, next?.firstSeen ?? null);
  aggregate.lastSeen = maxTimestamp(aggregate.lastSeen, next?.lastSeen ?? null);
  aggregate.origin = aggregate.origin === 'extracted' || next?.origin === 'extracted' ? 'extracted' : 'direct';
  return aggregate;
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

function formatBlastRadiusTextLines(blastRadius) {
  const lines = [];
  const services = formatServicesText(blastRadius.services);
  if (services) {
    lines.push(`Blast radius: ${services}`);
  }

  if (blastRadius.firstSeen || blastRadius.lastSeen) {
    lines.push(`Window: ${formatWindow(blastRadius.firstSeen, blastRadius.lastSeen)}`);
  }

  if (blastRadius.origin) {
    lines.push(`Source: ${blastRadius.origin}`);
  }

  return lines;
}

function formatBlastRadiusMarkdownLines(blastRadius) {
  const lines = [];
  const services = formatServicesText(blastRadius.services);
  if (services) {
    lines.push(`- **Blast radius:** ${escapeMarkdownText(services)}`);
  }

  if (blastRadius.firstSeen || blastRadius.lastSeen) {
    lines.push(`- **Window:** ${escapeMarkdownText(formatWindow(blastRadius.firstSeen, blastRadius.lastSeen))}`);
  }

  if (blastRadius.origin) {
    lines.push(`- **Source:** ${escapeMarkdownText(blastRadius.origin)}`);
  }

  return lines;
}

function formatServicesText(services) {
  if (!(services?.length)) {
    return '';
  }

  return services.map((service) => `${service.name} ${service.count}x`).join(', ');
}

function formatWindow(firstSeen, lastSeen) {
  if (firstSeen && lastSeen) {
    return `${firstSeen} → ${lastSeen}`;
  }

  return firstSeen ?? lastSeen ?? 'Unavailable';
}

function mergeSortedUnique(existing, next) {
  return [...new Set([...(existing ?? []), ...(next ?? [])])].sort();
}

function minTimestamp(left, right) {
  if (!left) {
    return right ?? null;
  }

  if (!right) {
    return left;
  }

  return left < right ? left : right;
}

function maxTimestamp(left, right) {
  if (!left) {
    return right ?? null;
  }

  if (!right) {
    return left;
  }

  return left > right ? left : right;
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
