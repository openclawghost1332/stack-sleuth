import { analyzeResponseBundleChronicle } from './bundle-chronicle.js';
import { inspectResponseBundleReplayInput } from './bundle-replay.js';
import { describeCasebookStewardHeadline } from './steward.js';

export const RESPONSE_BUNDLE_SHELF_KIND = 'stack-sleuth-response-bundle-shelf';
export const RESPONSE_BUNDLE_SHELF_VERSION = 1;
export const BUNDLE_SHELF_KIND = RESPONSE_BUNDLE_SHELF_KIND;
export const BUNDLE_SHELF_VERSION = RESPONSE_BUNDLE_SHELF_VERSION;

const REPLAY_NOTE = 'Response Bundle Shelf replays preserved bundle inventory and embedded dataset fields only. It does not recover raw traces, support frames, or blast radius detail.';

export function buildResponseBundleShelf(entries = []) {
  const snapshots = entries.map((entry, index) => inspectBundleShelfEntry(entry, index));
  const validSnapshots = snapshots.filter((snapshot) => snapshot.status === 'valid');
  const chronicle = validSnapshots.length >= 2
    ? analyzeResponseBundleChronicle({
      valid: true,
      snapshots: validSnapshots.map((snapshot) => ({
        label: snapshot.label,
        bundle: snapshot.bundle,
      })),
      labels: validSnapshots.map((snapshot) => snapshot.label),
    })
    : null;

  return {
    kind: RESPONSE_BUNDLE_SHELF_KIND,
    version: RESPONSE_BUNDLE_SHELF_VERSION,
    summary: buildShelfSummary(snapshots, chronicle),
    snapshots,
    chronicle,
  };
}

export function inspectReplayBundleShelfInput(input) {
  const parsedInput = parseShelfInput(input);
  if (!parsedInput.valid) {
    return { valid: false, reason: parsedInput.reason };
  }

  const parsed = parsedInput.parsed;

  if (parsed.kind !== RESPONSE_BUNDLE_SHELF_KIND) {
    return { valid: false, reason: 'wrong-kind', parsed };
  }

  if (parsed.version !== RESPONSE_BUNDLE_SHELF_VERSION) {
    return {
      valid: false,
      reason: 'unsupported-version',
      parsed,
      supportedVersion: RESPONSE_BUNDLE_SHELF_VERSION,
    };
  }

  return {
    valid: true,
    parsed,
    shelf: normalizeShelf(parsed),
  };
}

export function describeResponseBundleShelfInputError(details) {
  if (details.reason === 'unsupported-version') {
    return `Response Bundle Shelf replay uses unsupported version ${details.parsed?.version ?? 'unknown'}. Supported version: ${details.supportedVersion ?? 'unknown'}.`;
  }

  if (details.reason === 'wrong-kind') {
    return `Response Bundle Shelf replay uses unsupported kind ${details.parsed?.kind ?? 'unknown'}.`;
  }

  if (details.reason === 'invalid-json') {
    return 'Response Bundle Shelf replay could not parse the saved shelf JSON.';
  }

  return 'Response Bundle Shelf replay requires saved Stack Sleuth Response Bundle Shelf JSON.';
}

export const describeBundleShelfInputError = describeResponseBundleShelfInputError;

export function renderResponseBundleShelfTextSummary(report) {
  const warningLines = report.snapshots.filter((snapshot) => snapshot.status === 'invalid');

  return [
    'Stack Sleuth Response Bundle Shelf',
    report.summary.headline,
    `Snapshots: ${report.summary.snapshotCount}`,
    `Valid snapshots: ${report.summary.validSnapshotCount}`,
    `Invalid snapshots: ${report.summary.invalidSnapshotCount}`,
    `Latest snapshot: ${report.summary.latestLabel}`,
    `Latest release gate: ${report.summary.latestReleaseGateVerdict}`,
    `Latest source workflow: ${formatSource(report.summary.latestSourceMode, report.summary.latestSourceLabel)}`,
    `Latest steward: ${report.summary.latestStewardHeadline}`,
    `Latest Action Board cards: ${report.summary.latestActionBoardCardCount}`,
    report.chronicle
      ? `Chronicle summary: ${report.chronicle.summary.headline}`
      : 'Chronicle summary: add one more valid saved response bundle snapshot to unlock drift analysis.',
    `Saved-artifact note: ${REPLAY_NOTE}`,
    '',
    'Snapshot inventory',
    ...report.snapshots.map((snapshot) => snapshot.status === 'valid'
      ? `${snapshot.sourceName}: valid (${snapshot.label})`
      : `${snapshot.sourceName}: ${snapshot.reason}`),
    '',
    'Snapshot warnings',
    ...(warningLines.length
      ? warningLines.map((snapshot) => `${snapshot.sourceName}: ${snapshot.reason}`)
      : ['None']),
  ].join('\n').trim();
}

export const renderBundleShelfTextSummary = renderResponseBundleShelfTextSummary;

export function renderResponseBundleShelfMarkdownSummary(report) {
  const warningLines = report.snapshots.filter((snapshot) => snapshot.status === 'invalid');

  return [
    '# Stack Sleuth Response Bundle Shelf',
    '',
    `- **Headline:** ${escapeMarkdownText(report.summary.headline)}`,
    `- **Snapshots:** ${report.summary.snapshotCount}`,
    `- **Valid snapshots:** ${report.summary.validSnapshotCount}`,
    `- **Invalid snapshots:** ${report.summary.invalidSnapshotCount}`,
    `- **Latest snapshot:** ${escapeMarkdownText(report.summary.latestLabel)}`,
    `- **Latest release gate:** ${escapeMarkdownText(report.summary.latestReleaseGateVerdict)}`,
    `- **Latest source workflow:** ${escapeMarkdownText(formatSource(report.summary.latestSourceMode, report.summary.latestSourceLabel))}`,
    `- **Latest steward:** ${escapeMarkdownText(report.summary.latestStewardHeadline)}`,
    `- **Latest Action Board cards:** ${report.summary.latestActionBoardCardCount}`,
    `- **Saved-artifact note:** ${escapeMarkdownText(REPLAY_NOTE)}`,
    '',
    '## Chronicle summary',
    report.chronicle
      ? `- ${escapeMarkdownText(report.chronicle.summary.headline)}`
      : '- Add one more valid saved response bundle snapshot to unlock drift analysis.',
    '',
    '## Snapshot inventory',
    ...report.snapshots.map((snapshot) => snapshot.status === 'valid'
      ? `- ${formatMarkdownCode(snapshot.sourceName)}: valid (${escapeMarkdownText(snapshot.label)})`
      : `- ${formatMarkdownCode(snapshot.sourceName)}: ${escapeMarkdownText(snapshot.reason)}`),
    '',
    '## Snapshot warnings',
    ...(warningLines.length
      ? warningLines.map((snapshot) => `- ${formatMarkdownCode(snapshot.sourceName)}: ${escapeMarkdownText(snapshot.reason)}`)
      : ['- None']),
  ].join('\n').trim();
}

export const renderBundleShelfMarkdownSummary = renderResponseBundleShelfMarkdownSummary;

function inspectBundleShelfEntry(entry, index) {
  const label = normalizeLabel(entry?.label, entry?.sourceName, index);
  const sourceName = normalizeSourceName(entry?.sourceName, label, index);
  const replay = inspectResponseBundleReplayInput(entry?.source ?? entry?.input ?? entry?.bundle ?? entry);

  if (!replay.valid) {
    return {
      label,
      sourceName,
      status: 'invalid',
      reason: replay.reason,
      message: describeBundleValidationFailure(replay),
    };
  }

  return {
    label,
    sourceName,
    status: 'valid',
    bundle: replay.bundle,
  };
}

function normalizeShelf(parsed) {
  const snapshots = Array.isArray(parsed.snapshots)
    ? parsed.snapshots.map((snapshot, index) => normalizeStoredSnapshot(snapshot, index))
    : [];
  const validSnapshots = snapshots.filter((snapshot) => snapshot.status === 'valid');
  const chronicle = validSnapshots.length >= 2
    ? analyzeResponseBundleChronicle({
      valid: true,
      snapshots: validSnapshots.map((snapshot) => ({
        label: snapshot.label,
        bundle: snapshot.bundle,
      })),
      labels: validSnapshots.map((snapshot) => snapshot.label),
    })
    : null;

  return {
    kind: RESPONSE_BUNDLE_SHELF_KIND,
    version: RESPONSE_BUNDLE_SHELF_VERSION,
    summary: buildShelfSummary(snapshots, chronicle),
    snapshots,
    chronicle,
  };
}

function normalizeStoredSnapshot(snapshot, index) {
  const label = normalizeLabel(snapshot?.label, snapshot?.sourceName, index);
  const sourceName = normalizeSourceName(snapshot?.sourceName, label, index);

  if (snapshot?.status === 'invalid') {
    return {
      label,
      sourceName,
      status: 'invalid',
      reason: String(snapshot?.reason ?? 'invalid-snapshot'),
      message: String(snapshot?.message ?? 'Saved snapshot could not be replayed.'),
    };
  }

  const replay = inspectResponseBundleReplayInput(snapshot?.bundle ?? snapshot?.source ?? snapshot?.input ?? snapshot);
  if (!replay.valid) {
    return {
      label,
      sourceName,
      status: 'invalid',
      reason: replay.reason,
      message: describeBundleValidationFailure(replay),
    };
  }

  return {
    label,
    sourceName,
    status: 'valid',
    bundle: replay.bundle,
  };
}

function buildShelfSummary(snapshots, chronicle) {
  const validSnapshots = snapshots.filter((snapshot) => snapshot.status === 'valid');
  const invalidSnapshots = snapshots.filter((snapshot) => snapshot.status === 'invalid');
  const latestValidBundle = validSnapshots.at(-1)?.bundle ?? null;

  return {
    headline: `Response Bundle Shelf cataloged ${validSnapshots.length} valid snapshot${validSnapshots.length === 1 ? '' : 's'}, ${invalidSnapshots.length} invalid snapshot${invalidSnapshots.length === 1 ? '' : 's'}, and ${invalidSnapshots.length} warning entr${invalidSnapshots.length === 1 ? 'y' : 'ies'}.`,
    snapshotCount: snapshots.length,
    validSnapshotCount: validSnapshots.length,
    invalidSnapshotCount: invalidSnapshots.length,
    chronicleAvailable: Boolean(chronicle),
    latestLabel: validSnapshots.at(-1)?.label ?? snapshots.at(-1)?.label ?? '-',
    latestReleaseGateVerdict: latestValidBundle?.dataset?.gate?.verdict ?? latestValidBundle?.summary?.releaseGateVerdict ?? 'needs-input',
    latestGateVerdict: latestValidBundle?.dataset?.gate?.verdict ?? latestValidBundle?.summary?.releaseGateVerdict ?? 'needs-input',
    latestSourceMode: String(latestValidBundle?.manifest?.source?.mode ?? 'unknown'),
    latestSourceLabel: latestValidBundle?.manifest?.source?.label == null ? null : String(latestValidBundle.manifest.source.label),
    latestStewardHeadline: describeCasebookStewardHeadline(latestValidBundle?.dataset?.steward),
    latestActionBoardCardCount: latestValidBundle?.dataset?.board?.summary?.totalCards ?? 0,
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
        reason: source.includes(RESPONSE_BUNDLE_SHELF_KIND) ? 'invalid-json' : 'not-shelf',
      };
    }
  }

  return typeof input === 'object'
    ? { valid: true, parsed: input }
    : { valid: false, reason: 'not-shelf' };
}

function normalizeLabel(label, sourceName, index) {
  if (label) {
    return String(label);
  }

  if (sourceName) {
    return String(sourceName).replace(/\/(response-bundle|manifest)\.json$/i, '').replace(/\.json$/i, '');
  }

  return `snapshot-${index + 1}`;
}

function normalizeSourceName(sourceName, label, index) {
  if (sourceName) {
    return String(sourceName);
  }

  if (label) {
    return String(label);
  }

  return `snapshot-${index + 1}`;
}

function describeBundleValidationFailure(replay) {
  if (replay.reason === 'unsupported-version') {
    return `Unsupported bundle version ${replay.parsed?.version ?? 'unknown'}. Supported versions: ${(replay.supportedVersions ?? []).join(', ')}.`;
  }

  if (replay.reason === 'wrong-kind') {
    return `Unsupported bundle kind ${replay.parsed?.kind ?? 'unknown'}.`;
  }

  if (replay.reason === 'invalid-json') {
    return 'Could not parse saved response bundle JSON.';
  }

  if (replay.reason === 'missing-dataset') {
    return 'Saved response bundle is missing casebook-dataset.json replay content.';
  }

  return 'Saved snapshot is not valid Stack Sleuth response bundle JSON.';
}

function formatSource(mode, label) {
  return label ? `${mode} (${label})` : String(mode ?? 'unknown');
}

function escapeMarkdownText(value) {
  return String(value ?? '').replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}

function formatMarkdownCode(value) {
  return `\`${String(value ?? '').replace(/`/g, '&#96;')}\``;
}
