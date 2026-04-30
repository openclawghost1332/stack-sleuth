import { analyzeIncidentPortfolio } from './portfolio.js';

export function buildHandoffBriefing(input) {
  const portfolioReport = input?.priorityQueue ? input : analyzeIncidentPortfolio(input);
  const packReasons = new Map(
    (portfolioReport.priorityQueue ?? []).map((item) => [item.label, item.priorityReasons ?? []])
  );

  const ownerPackets = (portfolioReport.responseQueue ?? []).map((entry) => {
    const summaries = unique(entry.guidance.map((item) => item.summary).filter(Boolean));
    const fixes = unique(entry.guidance.map((item) => item.fix).filter(Boolean));
    const runbooks = unique(entry.guidance.map((item) => item.runbook).filter(Boolean));
    const labels = unique(entry.labels);
    const reasons = labels.flatMap((label) => {
      const packReasonsForLabel = packReasons.get(label) ?? ['needs triage'];
      return packReasonsForLabel.map((reason) => `${label}: ${reason}`);
    });

    return {
      kind: 'owner',
      owner: entry.owner,
      labels,
      reasons,
      summaries,
      fixes,
      runbooks,
      ask: `Have ${entry.owner} review ${labels.join(', ')} first and confirm ownership for the next update.`,
    };
  });

  const gapPackets = buildGapPackets(portfolioReport, packReasons);

  const packets = [...ownerPackets, ...gapPackets];
  const exportText = renderPacketExport(packets);

  return {
    portfolio: {
      packOrder: portfolioReport.portfolio?.packOrder ?? [],
    },
    ownerPackets,
    gapPackets,
    packets,
    summary: {
      packCount: portfolioReport.summary?.packCount ?? 0,
      runnablePackCount: portfolioReport.summary?.runnablePackCount ?? 0,
      ownerPacketCount: ownerPackets.length,
      gapPacketCount: gapPackets.length,
      packetCount: packets.length,
      headline: packets.length
        ? `Prepared ${packets.length} handoff packet${packets.length === 1 ? '' : 's'} from ${portfolioReport.summary?.runnablePackCount ?? 0} runnable pack${portfolioReport.summary?.runnablePackCount === 1 ? '' : 's'}.`
        : 'No handoff packets available because the portfolio does not contain any runnable packs yet.',
    },
    exportText,
  };
}

export function renderHandoffTextSummary(report) {
  const lines = [
    'Stack Sleuth Handoff Briefing',
    `Packs: ${report.summary.packCount}`,
    `Runnable packs: ${report.summary.runnablePackCount}`,
    `Owner packets: ${report.summary.ownerPacketCount}`,
    `Gap packets: ${report.summary.gapPacketCount}`,
    `Headline: ${report.summary.headline}`,
    '',
    'Owner packets',
    ...(report.ownerPackets.length
      ? report.ownerPackets.map((packet) => `- ${packet.owner}: ${packet.labels.join(', ')}`)
      : ['- None']),
    '',
    'Gap packets',
    ...(report.gapPackets.length
      ? report.gapPackets.map((packet) => `- ${packet.kind}: ${packet.labels.join(', ')}`)
      : ['- None']),
    '',
    'Handoff packet export',
    report.exportText || 'No handoff packets available.',
  ];

  return lines.join('\n').trim();
}

export function renderHandoffMarkdownSummary(report) {
  const lines = [
    '# Stack Sleuth Handoff Briefing',
    '',
    `- **Packs:** ${report.summary.packCount}`,
    `- **Runnable packs:** ${report.summary.runnablePackCount}`,
    `- **Owner packets:** ${report.summary.ownerPacketCount}`,
    `- **Gap packets:** ${report.summary.gapPacketCount}`,
    `- **Headline:** ${escapeMarkdownText(report.summary.headline)}`,
    '',
    '## Owner packets',
    ...(report.ownerPackets.length
      ? report.ownerPackets.map((packet) => `- **${escapeMarkdownText(packet.owner)}:** ${escapeMarkdownText(packet.labels.join(', '))}`)
      : ['- None']),
    '',
    '## Gap packets',
    ...(report.gapPackets.length
      ? report.gapPackets.map((packet) => `- **${escapeMarkdownText(packet.kind)}:** ${escapeMarkdownText(packet.labels.join(', '))}`)
      : ['- None']),
    '',
    '## Handoff packet export',
    '',
    '```text',
    report.exportText || 'No handoff packets available.',
    '```',
  ];

  return lines.join('\n').trim();
}

function buildGapPackets(portfolioReport, packReasons) {
  const unownedByLabel = new Map((portfolioReport.unownedPacks ?? []).map((item) => [item.label, item]));
  const runbookByLabel = new Map((portfolioReport.runbookGaps ?? []).map((item) => [item.label, item]));
  const knownPriorityLabels = (portfolioReport.priorityQueue ?? []).map((item) => item.label);
  const labels = [
    ...(portfolioReport.portfolio?.packOrder ?? []),
    ...knownPriorityLabels.filter((label) => !(portfolioReport.portfolio?.packOrder ?? []).includes(label)),
    ...[...unownedByLabel.keys()].filter((label) => !(portfolioReport.portfolio?.packOrder ?? []).includes(label) && !knownPriorityLabels.includes(label)),
    ...[...runbookByLabel.keys()].filter((label) => !(portfolioReport.portfolio?.packOrder ?? []).includes(label) && !knownPriorityLabels.includes(label)),
  ];
  const packets = [];

  for (const label of unique(labels)) {
    if (unownedByLabel.has(label)) {
      packets.push(buildGapPacket('ownership-gap', unownedByLabel.get(label), packReasons));
    }
    if (runbookByLabel.has(label)) {
      packets.push(buildGapPacket('runbook-gap', runbookByLabel.get(label), packReasons));
    }
  }

  return packets;
}

function buildGapPacket(kind, item, packReasons) {
  const labels = [item.label];
  const reasonList = (packReasons.get(item.label) ?? item.priorityReasons ?? ['needs triage'])
    .map((reason) => `${item.label}: ${reason}`);

  return {
    kind,
    labels,
    reasons: reasonList,
    summaries: [],
    fixes: [],
    runbooks: [],
    ask: kind === 'ownership-gap'
      ? `Assign an owner for ${item.label} before the next handoff.`
      : `Capture or link a runbook for ${item.label} before the next handoff.`,
  };
}

function renderPacketExport(packets) {
  if (!packets.length) {
    return 'No handoff packets available.';
  }

  return packets.map((packet) => renderPacket(packet)).join('\n\n');
}

function renderPacket(packet) {
  const lines = [];
  if (packet.kind === 'owner') {
    lines.push(`Owner: ${packet.owner}`);
  } else if (packet.kind === 'ownership-gap') {
    lines.push('Gap: ownership');
  } else {
    lines.push('Gap: runbook');
  }

  lines.push(`Packs: ${packet.labels.join(', ')}`);
  lines.push(`Why now: ${packet.reasons.join(' | ')}`);

  if (packet.summaries?.length) {
    lines.push(`Recall summary: ${packet.summaries.join(' | ')}`);
  }
  if (packet.fixes?.length) {
    lines.push(`Recall fix: ${packet.fixes.join(' | ')}`);
  }
  if (packet.runbooks?.length) {
    lines.push(`Recall runbook: ${packet.runbooks.join(' | ')}`);
  }

  lines.push(`Ask: ${packet.ask}`);
  return lines.join('\n');
}

function unique(items) {
  return [...new Set(items)];
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}
