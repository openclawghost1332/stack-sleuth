import { inspectReplayDatasetInput } from './dataset.js';
import { RESPONSE_BUNDLE_KIND, RESPONSE_BUNDLE_VERSION } from './bundle.js';

const SUPPORTED_BUNDLE_VERSIONS = new Set([1, RESPONSE_BUNDLE_VERSION]);
const REPLAY_NOTE = 'Response Bundle replay reuses preserved bundle and dataset fields only. It does not recover raw traces, support frames, or blast radius detail.';

export function inspectResponseBundleReplayInput(input) {
  const parsedInput = parseBundleInput(input);
  if (!parsedInput.valid) {
    return { valid: false, reason: parsedInput.reason };
  }

  const parsed = parsedInput.parsed;

  if (parsed.kind !== RESPONSE_BUNDLE_KIND) {
    return { valid: false, reason: 'wrong-kind', parsed };
  }

  if (!SUPPORTED_BUNDLE_VERSIONS.has(parsed.version)) {
    return {
      valid: false,
      reason: 'unsupported-version',
      parsed,
      supportedVersions: [...SUPPORTED_BUNDLE_VERSIONS].sort((a, b) => a - b),
    };
  }

  const bundle = normalizeBundleReplay(parsed);
  if (!bundle.dataset) {
    return { valid: false, reason: 'missing-dataset', parsed, bundle };
  }

  return {
    valid: true,
    parsed,
    bundle,
  };
}

export function renderResponseBundleTextSummary(bundle) {
  return [
    'Stack Sleuth Response Bundle Replay',
    bundle.summary.headline,
    `Source workflow: ${formatSource(bundle.manifest.source)}`,
    `Generated at: ${bundle.summary.generatedAt}`,
    `Release gate: ${bundle.summary.releaseGateVerdict}`,
    `Bundle files: ${bundle.summary.fileCount}`,
    `Response owners: ${bundle.dataset.summary.ownerCount}`,
    `Merged cases: ${bundle.dataset.summary.mergedCaseCount}`,
    `Saved-artifact note: ${REPLAY_NOTE}`,
    '',
    'Bundle inventory',
    ...bundle.manifest.files.map((name) => `- ${name}`),
  ].join('\n').trim();
}

export function renderResponseBundleMarkdownSummary(bundle) {
  return [
    '# Stack Sleuth Response Bundle Replay',
    '',
    `- **Headline:** ${escapeMarkdownText(bundle.summary.headline)}`,
    `- **Source workflow:** ${escapeMarkdownText(formatSource(bundle.manifest.source))}`,
    `- **Generated at:** ${escapeMarkdownText(bundle.summary.generatedAt)}`,
    `- **Release gate:** ${escapeMarkdownText(bundle.summary.releaseGateVerdict)}`,
    `- **Bundle files:** ${bundle.summary.fileCount}`,
    `- **Response owners:** ${bundle.dataset.summary.ownerCount}`,
    `- **Merged cases:** ${bundle.dataset.summary.mergedCaseCount}`,
    `- **Saved-artifact note:** ${escapeMarkdownText(REPLAY_NOTE)}`,
    '',
    '## Bundle inventory',
    ...bundle.manifest.files.map((name) => `- ${formatMarkdownCode(name)}`),
  ].join('\n').trim();
}

function normalizeBundleReplay(parsed) {
  const manifest = normalizeManifest(parsed.manifest ?? parsed);
  const artifacts = normalizeArtifacts(parsed);
  const datasetReplay = inspectReplayDatasetInput(artifacts['casebook-dataset.json']);

  return {
    kind: RESPONSE_BUNDLE_KIND,
    version: RESPONSE_BUNDLE_VERSION,
    sourceVersion: parsed.version,
    summary: {
      headline: manifest.summary.headline,
      releaseGateVerdict: manifest.summary.releaseGateVerdict,
      generatedAt: manifest.generatedAt,
      fileCount: manifest.files.length,
    },
    manifest,
    artifacts,
    dataset: datasetReplay.valid ? datasetReplay.dataset : null,
  };
}

function normalizeManifest(manifest) {
  const files = Array.isArray(manifest?.files)
    ? manifest.files.filter((name) => typeof name === 'string' && name.trim())
    : [];

  return {
    kind: RESPONSE_BUNDLE_KIND,
    version: Number.isInteger(manifest?.version) ? manifest.version : 1,
    generatedAt: String(manifest?.generatedAt ?? 'unknown'),
    source: {
      mode: String(manifest?.source?.mode ?? 'unknown'),
      label: manifest?.source?.label == null ? null : String(manifest.source.label),
    },
    summary: {
      headline: String(manifest?.summary?.headline ?? 'No response bundle headline available.'),
      releaseGateVerdict: String(manifest?.summary?.releaseGateVerdict ?? 'needs-input'),
      packCount: toCount(manifest?.summary?.packCount),
      runnablePackCount: toCount(manifest?.summary?.runnablePackCount),
      ownerCount: toCount(manifest?.summary?.ownerCount),
      recurringIncidentCount: toCount(manifest?.summary?.recurringIncidentCount),
      recurringHotspotCount: toCount(manifest?.summary?.recurringHotspotCount),
    },
    files,
  };
}

function normalizeArtifacts(parsed) {
  const source = parsed?.artifacts && typeof parsed.artifacts === 'object'
    ? parsed.artifacts
    : parsed?.files && typeof parsed.files === 'object'
      ? parsed.files
      : {};

  const artifacts = {};
  for (const [name, content] of Object.entries(source)) {
    if (name === 'response-bundle.json' || typeof content !== 'string') {
      continue;
    }
    artifacts[name] = content;
  }

  return artifacts;
}

function parseBundleInput(input) {
  if (!input || typeof input === 'number' || typeof input === 'boolean') {
    return { valid: false, reason: 'not-bundle' };
  }

  if (typeof input === 'string') {
    const source = input.trim();
    if (!source.startsWith('{')) {
      return { valid: false, reason: 'not-bundle' };
    }

    try {
      return { valid: true, parsed: JSON.parse(source) };
    } catch {
      return {
        valid: false,
        reason: source.includes(RESPONSE_BUNDLE_KIND) ? 'invalid-json' : 'not-bundle',
      };
    }
  }

  return typeof input === 'object'
    ? { valid: true, parsed: input }
    : { valid: false, reason: 'not-bundle' };
}

function formatSource(source) {
  return source?.label ? `${source.mode} (${source.label})` : String(source?.mode ?? 'unknown');
}

function formatMarkdownCode(value) {
  return `\`${String(value).replace(/`/g, '\\`')}\``;
}

function escapeMarkdownText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`');
}

function toCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
