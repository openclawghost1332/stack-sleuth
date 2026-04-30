import { analyzeTraceDigest } from './digest.js';
import { formatFrame } from './analyze.js';
import { parseLabeledTraceBatches } from './labeled.js';
import { parseDatasetHistory } from './dataset.js';

export function analyzeCasebook({ current, history }) {
  const currentDigest = analyzeTraceDigest(current);
  const historyBatches = parseCasebookHistoryInput(history);
  const currentSignals = collectDigestSignals(currentDigest);
  const historicalCases = historyBatches
    .map((batch, historyIndex) => {
      const digest = analyzeTraceDigest(batch.traces);
      return {
        label: batch.label,
        metadata: normalizeGuidanceMetadata(batch.metadata),
        traces: batch.traces,
        digest,
        historyIndex,
        overlap: buildOverlap(currentSignals, digest),
      };
    })
    .filter((entry) => entry.digest.totalTraces > 0)
    .sort(compareHistoricalCases);

  const incidents = currentDigest.groups.map((group) => {
    const matchingCases = historicalCases
      .filter((entry) => entry.overlap.exactSignatures.includes(group.signature))
      .map((entry) => entry.label);
    const matchingGuidance = historicalCases
      .filter((entry) => entry.overlap.exactSignatures.includes(group.signature))
      .map((entry) => ({
        label: entry.label,
        ...entry.metadata,
      }))
      .filter(hasMeaningfulGuidance);

    return {
      signature: group.signature,
      classification: matchingCases.length ? 'known' : 'novel',
      matchingCases,
      matchingGuidance,
      count: group.count,
      culpritPath: normalizeCulpritPath(group.representative?.culpritFrame),
      diagnosisTags: [...group.tags],
      representative: group.representative,
    };
  });

  return {
    currentDigest,
    historicalCases,
    incidents,
    summary: {
      currentTraceCount: currentDigest.totalTraces,
      historicalCaseCount: historicalCases.length,
      knownCount: incidents.filter((incident) => incident.classification === 'known').length,
      novelCount: incidents.filter((incident) => incident.classification === 'novel').length,
      topCaseLabel: historicalCases[0]?.label ?? null,
    },
  };
}

export function parseCasebookHistoryInput(history) {
  if (Array.isArray(history)) {
    return history;
  }

  const datasetHistory = parseDatasetHistory(history);
  if (datasetHistory?.length) {
    return datasetHistory;
  }

  return parseLabeledTraceBatches(history);
}

export function renderCasebookTextSummary(casebook) {
  const sections = [
    'Stack Sleuth Casebook Radar',
    `Current traces: ${casebook.summary.currentTraceCount}`,
    `Historical cases: ${casebook.summary.historicalCaseCount}`,
    `Known incidents: ${casebook.summary.knownCount}`,
    `Novel incidents: ${casebook.summary.novelCount}`,
    `Closest historical cases: ${formatTextClosestCases(casebook.historicalCases)}`,
    '',
    'Current incident classifications',
  ];

  for (const incident of casebook.incidents) {
    sections.push(`${incident.classification}: ${incident.signature}`);
    sections.push(`  Culprit: ${formatFrame(incident.representative?.culpritFrame ?? null)}`);
    if (incident.matchingCases.length) {
      sections.push(`  Known in: ${incident.matchingCases.join(', ')}`);
    }
    for (const guidance of incident.matchingGuidance ?? []) {
      sections.push(...formatTextGuidance(guidance));
    }
    sections.push(`  Tags: ${incident.diagnosisTags.join(', ')}`);
  }

  return sections.join('\n').trim();
}

export function renderCasebookMarkdownSummary(casebook) {
  const lines = [
    '# Stack Sleuth Casebook Radar',
    '',
    `- **Current traces:** ${casebook.summary.currentTraceCount}`,
    `- **Historical cases:** ${casebook.summary.historicalCaseCount}`,
    `- **Known incidents:** ${casebook.summary.knownCount}`,
    `- **Novel incidents:** ${casebook.summary.novelCount}`,
    '',
    '## Closest historical cases',
    formatMarkdownClosestCases(casebook.historicalCases),
    '',
    '## Current incident classifications',
    '',
  ];

  for (const incident of casebook.incidents) {
    lines.push(`- **Classification:** ${escapeMarkdownText(incident.classification)}`);
    lines.push(`- **Signature:** ${formatMarkdownCode(incident.signature)}`);
    lines.push(`- **Culprit:** ${formatMarkdownCode(formatFrame(incident.representative?.culpritFrame ?? null))}`);
    if (incident.matchingCases.length) {
      lines.push(`- **Known in:** ${escapeMarkdownText(incident.matchingCases.join(', '))}`);
    }
    for (const guidance of incident.matchingGuidance ?? []) {
      lines.push(...formatMarkdownGuidance(guidance));
    }
    lines.push(`- **Tags:** ${escapeMarkdownText(incident.diagnosisTags.join(', '))}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function collectDigestSignals(digest) {
  const signatures = new Set(digest.groups.map((group) => group.signature));
  const culpritPaths = new Set(
    digest.groups
      .map((group) => normalizeCulpritPath(group.representative?.culpritFrame))
      .filter(Boolean)
  );
  const diagnosisTags = new Set(digest.groups.flatMap((group) => group.tags ?? []));

  return {
    signatures,
    culpritPaths,
    diagnosisTags,
  };
}

function buildOverlap(currentSignals, historicalDigest) {
  const historicalSignals = collectDigestSignals(historicalDigest);
  const exactSignatures = [...currentSignals.signatures].filter((signature) => historicalSignals.signatures.has(signature)).sort();
  const culpritPaths = [...currentSignals.culpritPaths].filter((path) => historicalSignals.culpritPaths.has(path)).sort();
  const diagnosisTags = [...currentSignals.diagnosisTags].filter((tag) => historicalSignals.diagnosisTags.has(tag)).sort();

  return {
    exactSignatures,
    culpritPaths,
    diagnosisTags,
    exactSignatureCount: exactSignatures.length,
    culpritPathCount: culpritPaths.length,
    diagnosisTagCount: diagnosisTags.length,
  };
}

function compareHistoricalCases(left, right) {
  return right.overlap.exactSignatureCount - left.overlap.exactSignatureCount
    || right.overlap.culpritPathCount - left.overlap.culpritPathCount
    || right.overlap.diagnosisTagCount - left.overlap.diagnosisTagCount
    || left.historyIndex - right.historyIndex;
}

function normalizeCulpritPath(frame) {
  if (!frame?.file) {
    return null;
  }

  return String(frame.file)
    .replace(/^[A-Za-z]:/i, '')
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '') || null;
}

function formatTextClosestCases(historicalCases) {
  if (!(historicalCases?.length)) {
    return 'None';
  }

  return historicalCases
    .slice(0, 3)
    .map((entry) => `${entry.label} (exact ${entry.overlap.exactSignatureCount}, culprit paths ${entry.overlap.culpritPathCount}, tags ${entry.overlap.diagnosisTagCount})`)
    .join(', ');
}

function formatMarkdownClosestCases(historicalCases) {
  if (!(historicalCases?.length)) {
    return '- `None`';
  }

  return historicalCases
    .slice(0, 5)
    .map((entry) => {
      const guidanceSuffix = formatClosestCaseGuidance(entry.metadata);
      return `- **${escapeMarkdownText(entry.label)}:** exact ${entry.overlap.exactSignatureCount}, culprit paths ${entry.overlap.culpritPathCount}, tags ${entry.overlap.diagnosisTagCount}${guidanceSuffix}`;
    })
    .join('\n');
}

function normalizeGuidanceMetadata(metadata) {
  const normalized = {};
  for (const key of ['summary', 'fix', 'owner', 'runbook']) {
    const value = String(metadata?.[key] ?? '').trim();
    if (value) {
      normalized[key] = value;
    }
  }
  return normalized;
}

function hasMeaningfulGuidance(guidance) {
  return Boolean(guidance?.summary || guidance?.fix || guidance?.owner || guidance?.runbook);
}

function formatTextGuidance(guidance) {
  const lines = [`  Recall: ${guidance.label}`];
  if (guidance.summary) {
    lines.push(`  Summary: ${guidance.summary}`);
  }
  if (guidance.fix) {
    lines.push(`  Fix: ${guidance.fix}`);
  }
  if (guidance.owner) {
    lines.push(`  Owner: ${guidance.owner}`);
  }
  if (guidance.runbook) {
    lines.push(`  Runbook: ${guidance.runbook}`);
  }
  return lines;
}

function formatMarkdownGuidance(guidance) {
  const lines = [`- **Recall:** ${escapeMarkdownText(guidance.label)}`];
  if (guidance.summary) {
    lines.push(`- **Summary:** ${escapeMarkdownText(guidance.summary)}`);
  }
  if (guidance.fix) {
    lines.push(`- **Fix:** ${escapeMarkdownText(guidance.fix)}`);
  }
  if (guidance.owner) {
    lines.push(`- **Owner:** ${escapeMarkdownText(guidance.owner)}`);
  }
  if (guidance.runbook) {
    lines.push(`- **Runbook:** ${escapeMarkdownText(guidance.runbook)}`);
  }
  return lines;
}

function formatClosestCaseGuidance(metadata) {
  const fragments = [];
  if (metadata?.owner) {
    fragments.push(`owner ${escapeMarkdownText(metadata.owner)}`);
  }
  if (metadata?.fix) {
    fragments.push(`fix ${escapeMarkdownText(metadata.fix)}`);
  }
  return fragments.length ? `, ${fragments.join(', ')}` : '';
}

function formatMarkdownCode(value) {
  return `\`${escapeMarkdownText(value)}\``;
}

function escapeMarkdownText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}
