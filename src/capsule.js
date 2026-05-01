import { analyzeIncidentPack } from './briefing.js';
import { parseIncidentNotebook, renderNormalizedNotebookText } from './notebook.js';
import { analyzeIncidentPortfolio } from './portfolio.js';

const CAPSULE_KIND = 'incident-capsule';
const CAPSULE_VERSIONS = new Set(['1', '2']);
const SUPPORTED_CAPSULE_VERSIONS = [...CAPSULE_VERSIONS].join(', ');
const PACKS_PREFIX = 'packs/';
const NOTEBOOK_FILE = 'notebook.md';
const SECTION_FILES = {
  current: 'current.log',
  history: 'history.casebook',
  baseline: 'baseline.log',
  candidate: 'candidate.log',
  timeline: 'timeline.log',
};
const SECTION_ORDER = ['current', 'history', 'baseline', 'candidate', 'timeline'];
const RECOGNIZED_FILENAMES = [...SECTION_ORDER.map((name) => SECTION_FILES[name]), NOTEBOOK_FILE];
const RECOGNIZED_FILENAME_SET = new Set(RECOGNIZED_FILENAMES);
const RECOGNIZED_FILENAMES_TEXT = RECOGNIZED_FILENAMES.join(', ');

export function inspectCapsuleInput(input) {
  try {
    const parsed = JSON.parse(String(input ?? ''));

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, reason: 'invalid-shape', parsed };
    }

    if (parsed.kind !== CAPSULE_KIND) {
      return { valid: false, reason: 'wrong-kind', parsed };
    }

    if (!CAPSULE_VERSIONS.has(parsed.version)) {
      return { valid: false, reason: 'unsupported-version', parsed, supportedVersions: [...CAPSULE_VERSIONS] };
    }

    if (!Array.isArray(parsed.artifacts)) {
      return { valid: false, reason: 'invalid-shape', parsed };
    }

    for (const artifact of parsed.artifacts) {
      if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact) || typeof artifact.relativePath !== 'string') {
        return { valid: false, reason: 'invalid-shape', parsed };
      }

      try {
        normalizeRelativePath(artifact.relativePath);
      } catch {
        return { valid: false, reason: 'invalid-shape', parsed };
      }
    }

    return { valid: true, capsule: parsed };
  } catch {
    return { valid: false, reason: 'invalid-json' };
  }
}

export function describeCapsuleInputError(inspection) {
  if (inspection?.reason === 'wrong-kind') {
    return `Incident Capsule input uses unsupported kind: ${inspection.parsed?.kind ?? 'unknown'}.`;
  }

  if (inspection?.reason === 'unsupported-version') {
    return `Incident Capsule input uses unsupported version ${inspection.parsed?.version ?? 'unknown'}. Supported versions: ${inspection.supportedVersions?.join(', ') ?? SUPPORTED_CAPSULE_VERSIONS}.`;
  }

  if (inspection?.reason === 'invalid-shape') {
    return 'Incident Capsule input must be an incident-capsule artifact with an artifacts array of relative-path entries.';
  }

  return 'Incident Capsule input must be valid incident-capsule JSON.';
}

export function normalizeCapsuleToWorkflow(capsule) {
  const inspection = inspectCapsuleInput(JSON.stringify(capsule));
  if (!inspection.valid) {
    throw new Error(describeCapsuleInputError(inspection));
  }

  const rootFiles = new Map();
  const portfolioFiles = new Map();

  for (const artifact of inspection.capsule.artifacts) {
    const relativePath = normalizeRelativePath(artifact.relativePath);
    const content = readArtifactContent(artifact);
    if (!content) {
      continue;
    }

    const portfolioMatch = relativePath.match(/^packs\/([^/]+)\/([^/]+)$/);
    if (portfolioMatch) {
      const label = portfolioMatch[1];
      const fileName = portfolioMatch[2];
      if (!RECOGNIZED_FILENAME_SET.has(fileName)) {
        continue;
      }

      const packFiles = portfolioFiles.get(label) ?? new Map();
      packFiles.set(fileName, content);
      portfolioFiles.set(label, packFiles);
      continue;
    }

    if (RECOGNIZED_FILENAME_SET.has(relativePath)) {
      rootFiles.set(relativePath, content);
    }
  }

  if (portfolioFiles.size > 0) {
    return buildPortfolioWorkflow(portfolioFiles, rootFiles);
  }

  if (rootFiles.size > 0) {
    return buildSingleWorkflow(rootFiles);
  }

  throw new Error(`Incident Capsule did not contain any recognized workflow files. Supported filenames: ${RECOGNIZED_FILENAMES_TEXT}.`);
}

function buildPortfolioWorkflow(portfolioFiles, rootFiles) {
  const warnings = rootFiles.size > 0
    ? ['Ignoring recognized root capsule files because portfolio files were found under packs/<label>/.']
    : [];
  const packs = [];
  const omittedPacks = [];

  for (const label of [...portfolioFiles.keys()].sort((left, right) => left.localeCompare(right))) {
    const normalized = buildNormalizedPack(label, portfolioFiles.get(label));
    if (!normalized.runnable) {
      omittedPacks.push({ label, reason: normalized.reason });
      continue;
    }

    packs.push({
      label,
      recognizedFiles: normalized.recognizedFiles,
      normalizedText: normalized.normalizedText,
    });
  }

  if (!packs.length) {
    throw new Error(`Incident Capsule contained no runnable capsule workflows. Supported filenames: ${RECOGNIZED_FILENAMES_TEXT}.`);
  }

  const normalizedText = packs
    .map((pack) => `@@@ ${pack.label} @@@\n${pack.normalizedText}`)
    .join('\n\n')
    .trim();
  const report = analyzeIncidentPortfolio(normalizedText);

  if (!report.summary.runnablePackCount) {
    throw new Error('Incident Capsule contained no runnable capsule workflows after normalization.');
  }

  return {
    kind: 'portfolio',
    packOrder: packs.map((pack) => pack.label),
    packs,
    omittedPacks,
    warnings,
    normalizedText,
  };
}

function buildSingleWorkflow(rootFiles) {
  const directSections = buildSectionEntries(rootFiles);

  if (directSections.length > 0) {
    const normalizedText = renderPackFromSections(directSections);
    const report = analyzeIncidentPack(normalizedText);
    if (!report.availableAnalyses.length) {
      throw new Error(`Incident Capsule contained no runnable capsule workflows. Supported filenames: ${RECOGNIZED_FILENAMES_TEXT}.`);
    }

    return {
      kind: 'pack',
      recognizedFiles: directSections.map((entry) => SECTION_FILES[entry.name]),
      warnings: [],
      omittedPacks: [],
      normalizedText,
    };
  }

  if (!rootFiles.has(NOTEBOOK_FILE)) {
    throw new Error(`Incident Capsule did not contain any recognized workflow files. Supported filenames: ${RECOGNIZED_FILENAMES_TEXT}.`);
  }

  const notebook = parseIncidentNotebook(rootFiles.get(NOTEBOOK_FILE));
  if (notebook.kind === 'unsupported') {
    throw new Error(notebook.reason ?? 'Incident Capsule notebook did not normalize into a supported workflow.');
  }

  const normalizedText = renderNormalizedNotebookText(notebook);
  if (notebook.kind === 'portfolio') {
    const report = analyzeIncidentPortfolio(normalizedText);
    if (!report.summary.runnablePackCount) {
      throw new Error('Incident Capsule contained no runnable capsule workflows after notebook normalization.');
    }

    return {
      kind: 'portfolio',
      packOrder: notebook.packOrder,
      packs: notebook.packOrder.map((label) => ({
        label,
        recognizedFiles: [NOTEBOOK_FILE],
        normalizedText: notebook.packs.find((pack) => pack.label === label)
          ? renderNormalizedNotebookText({ kind: 'pack', sections: notebook.packs.find((pack) => pack.label === label).sections, sectionOrder: notebook.packs.find((pack) => pack.label === label).sectionOrder })
          : '',
      })),
      omittedPacks: [],
      warnings: [],
      normalizedText,
    };
  }

  const report = analyzeIncidentPack(normalizedText);
  if (!report.availableAnalyses.length) {
    throw new Error('Incident Capsule contained no runnable capsule workflows after notebook normalization.');
  }

  return {
    kind: 'pack',
    recognizedFiles: [NOTEBOOK_FILE],
    warnings: [],
    omittedPacks: [],
    normalizedText,
  };
}

function buildNormalizedPack(label, files) {
  const directSections = buildSectionEntries(files);
  if (directSections.length > 0) {
    const normalizedText = renderPackFromSections(directSections);
    const report = analyzeIncidentPack(normalizedText);
    if (!report.availableAnalyses.length) {
      return {
        runnable: false,
        reason: `Pack ${label} normalized into supported sections but none produced a runnable workflow.`,
      };
    }

    return {
      runnable: true,
      recognizedFiles: directSections.map((entry) => SECTION_FILES[entry.name]),
      normalizedText,
    };
  }

  if (!files.has(NOTEBOOK_FILE)) {
    return {
      runnable: false,
      reason: `Pack ${label} did not include any recognized filenames. Supported filenames: ${RECOGNIZED_FILENAMES_TEXT}.`,
    };
  }

  const notebook = parseIncidentNotebook(files.get(NOTEBOOK_FILE));
  if (notebook.kind !== 'pack') {
    return {
      runnable: false,
      reason: notebook.reason ?? `Pack ${label} notebook did not normalize into a single incident pack.`,
    };
  }

  const normalizedText = renderNormalizedNotebookText(notebook);
  const report = analyzeIncidentPack(normalizedText);
  if (!report.availableAnalyses.length) {
    return {
      runnable: false,
      reason: `Pack ${label} notebook normalized successfully but did not produce a runnable workflow.`,
    };
  }

  return {
    runnable: true,
    recognizedFiles: [NOTEBOOK_FILE],
    normalizedText,
  };
}

function buildSectionEntries(files) {
  return SECTION_ORDER
    .map((name) => ({ name, fileName: SECTION_FILES[name], content: files.get(SECTION_FILES[name]) ?? '' }))
    .filter((entry) => entry.content);
}

function renderPackFromSections(entries) {
  return entries
    .map((entry) => `@@ ${entry.name} @@\n${entry.content}`)
    .join('\n\n')
    .trim();
}

function readArtifactContent(artifact) {
  const content = typeof artifact?.content === 'string'
    ? artifact.content
    : typeof artifact?.excerpt === 'string'
      ? artifact.excerpt
      : '';

  return content.replace(/\r\n/g, '\n').trim();
}

function normalizeRelativePath(relativePath) {
  const value = String(relativePath ?? '').replace(/\\/g, '/').trim();
  if (!value || value.startsWith('/') || /^[A-Za-z]:\//.test(value)) {
    throw new Error('Invalid capsule relative path.');
  }

  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Invalid capsule relative path.');
  }

  return segments.join('/');
}
