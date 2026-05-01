import { analyzeCasebookChronicle } from './chronicle.js';
import { inspectReplayDatasetInput } from './dataset.js';

export const SHELF_KIND = 'stack-sleuth-casebook-shelf';
export const SHELF_VERSION = 1;

export function buildCasebookShelf(entries = []) {
  const snapshots = entries.map((entry, index) => inspectShelfEntry(entry, index));
  const validSnapshots = snapshots.filter((snapshot) => snapshot.status === 'valid');
  const chronicle = validSnapshots.length >= 2
    ? analyzeCasebookChronicle({
      valid: true,
      snapshots: validSnapshots.map((snapshot) => ({
        label: snapshot.label,
        dataset: snapshot.dataset,
      })),
      labels: validSnapshots.map((snapshot) => snapshot.label),
    })
    : null;

  return {
    kind: SHELF_KIND,
    version: SHELF_VERSION,
    summary: buildShelfSummary(snapshots, chronicle),
    snapshots,
    chronicle,
  };
}

export function inspectReplayShelfInput(input) {
  const parsedInput = parseShelfInput(input);
  if (!parsedInput.valid) {
    return { valid: false, reason: parsedInput.reason };
  }

  const parsed = parsedInput.parsed;

  if (parsed.kind !== SHELF_KIND) {
    return { valid: false, reason: 'wrong-kind', parsed };
  }

  if (parsed.version !== SHELF_VERSION) {
    return {
      valid: false,
      reason: 'unsupported-version',
      parsed,
      supportedVersion: SHELF_VERSION,
    };
  }

  const shelf = normalizeShelf(parsed);
  return {
    valid: true,
    parsed,
    shelf,
  };
}

export function describeShelfInputError(details) {
  if (details.reason === 'unsupported-version') {
    return `Casebook Shelf replay uses unsupported version ${details.parsed?.version ?? 'unknown'}. Supported version: ${details.supportedVersion ?? 'unknown'}.`;
  }

  if (details.reason === 'wrong-kind') {
    return `Casebook Shelf replay uses unsupported kind ${details.parsed?.kind ?? 'unknown'}.`;
  }

  if (details.reason === 'invalid-json') {
    return 'Casebook Shelf replay could not parse the saved shelf JSON.';
  }

  return 'Casebook Shelf replay requires saved Stack Sleuth shelf JSON.';
}

export function renderShelfTextSummary(report) {
  const warningLines = report.snapshots.filter((snapshot) => snapshot.status === 'invalid');

  return [
    'Stack Sleuth Casebook Shelf',
    report.summary.headline,
    `Snapshots: ${report.summary.snapshotCount}`,
    `Valid snapshots: ${report.summary.validSnapshotCount}`,
    `Invalid snapshots: ${report.summary.invalidSnapshotCount}`,
    `Latest snapshot: ${report.summary.latestLabel}`,
    report.chronicle
      ? `Chronicle summary: ${report.chronicle.summary.headline}`
      : 'Chronicle summary: add one more valid saved dataset snapshot to unlock drift analysis.',
    'Saved-artifact note: Casebook Shelf replays preserved dataset signals only and does not recover raw traces, support frames, or blast radius detail.',
    '',
    'Snapshot inventory',
    ...report.snapshots.map((snapshot) => snapshot.status === 'valid'
      ? `${snapshot.filename}: valid (${snapshot.label})`
      : `${snapshot.filename}: ${snapshot.reason}`),
    '',
    'Snapshot warnings',
    ...(warningLines.length
      ? warningLines.map((snapshot) => `${snapshot.filename}: ${snapshot.reason}`)
      : ['None']),
  ].join('\n').trim();
}

export function renderShelfMarkdownSummary(report) {
  const warningLines = report.snapshots.filter((snapshot) => snapshot.status === 'invalid');

  return [
    '# Stack Sleuth Casebook Shelf',
    '',
    `- **Headline:** ${escapeMarkdownText(report.summary.headline)}`,
    `- **Snapshots:** ${report.summary.snapshotCount}`,
    `- **Valid snapshots:** ${report.summary.validSnapshotCount}`,
    `- **Invalid snapshots:** ${report.summary.invalidSnapshotCount}`,
    `- **Latest snapshot:** ${escapeMarkdownText(report.summary.latestLabel)}`,
    `- **Saved-artifact note:** ${escapeMarkdownText('Casebook Shelf replays preserved dataset signals only and does not recover raw traces, support frames, or blast radius detail.')}`,
    '',
    '## Chronicle summary',
    report.chronicle
      ? `- ${escapeMarkdownText(report.chronicle.summary.headline)}`
      : '- Add one more valid saved dataset snapshot to unlock chronicle drift analysis.',
    '',
    '## Snapshot inventory',
    ...report.snapshots.map((snapshot) => snapshot.status === 'valid'
      ? `- ${formatMarkdownCode(snapshot.filename)}: valid (${escapeMarkdownText(snapshot.label)})`
      : `- ${formatMarkdownCode(snapshot.filename)}: ${escapeMarkdownText(snapshot.reason)}`),
    '',
    '## Snapshot warnings',
    ...(warningLines.length
      ? warningLines.map((snapshot) => `- ${formatMarkdownCode(snapshot.filename)}: ${escapeMarkdownText(snapshot.reason)}`)
      : ['- None']),
  ].join('\n').trim();
}

function inspectShelfEntry(entry, index) {
  const label = normalizeLabel(entry?.label, entry?.filename ?? entry?.sourceName, index);
  const filename = normalizeFilename(entry?.filename ?? entry?.sourceName, label, index);
  const replay = inspectReplayDatasetInput(entry?.source ?? entry?.input ?? entry?.dataset ?? entry);

  if (!replay.valid) {
    return {
      label,
      filename,
      status: 'invalid',
      reason: replay.reason,
      message: describeDatasetValidationFailure(replay),
    };
  }

  return {
    label,
    filename,
    status: 'valid',
    dataset: replay.dataset,
  };
}

function normalizeShelf(parsed) {
  const snapshots = Array.isArray(parsed.snapshots)
    ? parsed.snapshots.map((snapshot, index) => normalizeStoredSnapshot(snapshot, index))
    : [];
  const validSnapshots = snapshots.filter((snapshot) => snapshot.status === 'valid');
  const chronicle = validSnapshots.length >= 2
    ? analyzeCasebookChronicle({
      valid: true,
      snapshots: validSnapshots.map((snapshot) => ({
        label: snapshot.label,
        dataset: snapshot.dataset,
      })),
      labels: validSnapshots.map((snapshot) => snapshot.label),
    })
    : null;

  return {
    kind: SHELF_KIND,
    version: SHELF_VERSION,
    summary: buildShelfSummary(snapshots, chronicle),
    snapshots,
    chronicle,
  };
}

function normalizeStoredSnapshot(snapshot, index) {
  const label = normalizeLabel(snapshot?.label, snapshot?.filename ?? snapshot?.sourceName, index);
  const filename = normalizeFilename(snapshot?.filename ?? snapshot?.sourceName, label, index);

  if (snapshot?.status === 'invalid') {
    return {
      label,
      filename,
      status: 'invalid',
      reason: String(snapshot?.reason ?? 'invalid-snapshot'),
      message: String(snapshot?.message ?? 'Saved snapshot could not be replayed.'),
    };
  }

  const replay = inspectReplayDatasetInput(snapshot?.dataset ?? snapshot?.source ?? snapshot?.input ?? snapshot);
  if (!replay.valid) {
    return {
      label,
      filename,
      status: 'invalid',
      reason: replay.reason,
      message: describeDatasetValidationFailure(replay),
    };
  }

  return {
    label,
    filename,
    status: 'valid',
    dataset: replay.dataset,
  };
}

function buildShelfSummary(snapshots, chronicle) {
  const validSnapshotCount = snapshots.filter((snapshot) => snapshot.status === 'valid').length;
  const invalidSnapshotCount = snapshots.filter((snapshot) => snapshot.status === 'invalid').length;
  const latestLabel = snapshots.filter((snapshot) => snapshot.status === 'valid').at(-1)?.label
    ?? snapshots.at(-1)?.label
    ?? '-';

  return {
    headline: `Casebook Shelf cataloged ${validSnapshotCount} valid snapshot${validSnapshotCount === 1 ? '' : 's'}, ${invalidSnapshotCount} invalid snapshot${invalidSnapshotCount === 1 ? '' : 's'}, and ${invalidSnapshotCount} warning entr${invalidSnapshotCount === 1 ? 'y' : 'ies'}.`,
    snapshotCount: snapshots.length,
    validSnapshotCount,
    invalidSnapshotCount,
    chronicleAvailable: Boolean(chronicle),
    latestLabel,
  };
}

function parseShelfInput(input) {
  if (!input || typeof input === 'number' || typeof input === 'boolean') {
    return { valid: false, reason: 'not-shelf' };
  }

  if (typeof input === 'string') {
    const source = input.trim();
    if (!source.startsWith('{')) {
      return { valid: false, reason: 'not-shelf' };
    }

    try {
      return { valid: true, parsed: JSON.parse(source) };
    } catch {
      return {
        valid: false,
        reason: source.includes(SHELF_KIND) ? 'invalid-json' : 'not-shelf',
      };
    }
  }

  return typeof input === 'object'
    ? { valid: true, parsed: input }
    : { valid: false, reason: 'not-shelf' };
}

function normalizeLabel(label, filename, index) {
  if (label) {
    return String(label);
  }

  if (filename) {
    return String(filename).replace(/\.json$/i, '');
  }

  return `snapshot-${index + 1}`;
}

function normalizeFilename(filename, label, index) {
  if (filename) {
    return String(filename);
  }

  if (label) {
    return `${label}.json`;
  }

  return `snapshot-${index + 1}.json`;
}

function describeDatasetValidationFailure(replay) {
  if (replay.reason === 'unsupported-version') {
    return `Unsupported dataset version ${replay.parsed?.version ?? 'unknown'}. Supported version: ${replay.supportedVersion ?? 'unknown'}.`;
  }

  if (replay.reason === 'wrong-kind') {
    return `Unsupported dataset kind ${replay.parsed?.kind ?? 'unknown'}.`;
  }

  if (replay.reason === 'invalid-json') {
    return 'Could not parse saved dataset JSON.';
  }

  return 'Saved snapshot is not valid Stack Sleuth dataset JSON.';
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}

function formatMarkdownCode(value) {
  return `\`${String(value ?? '').replace(/`/g, '&#96;')}\``;
}
