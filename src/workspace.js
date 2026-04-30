import fs from 'node:fs';
import path from 'node:path';

const SECTION_FILES = {
  current: ['current.log', 'current.txt', 'current.trace'],
  history: ['history.casebook', 'history.txt', 'history.log'],
  baseline: ['baseline.log', 'baseline.txt'],
  candidate: ['candidate.log', 'candidate.txt'],
  timeline: ['timeline.log', 'timeline.txt'],
};

const SECTION_ORDER = ['current', 'history', 'baseline', 'candidate', 'timeline'];
const NOTEBOOK_FILE = 'notebook.md';
const SUPPORTED_FILENAMES = [...SECTION_ORDER.flatMap((section) => SECTION_FILES[section]), NOTEBOOK_FILE];
const SUPPORTED_FILENAMES_TEXT = SUPPORTED_FILENAMES.join(', ');

export function loadIncidentWorkspace(targetPath) {
  const workspacePath = path.resolve(String(targetPath ?? ''));
  const stats = fs.statSync(workspacePath, { throwIfNoEntry: false });

  if (!stats?.isDirectory()) {
    throw new Error(`Incident workspace must be a directory: ${workspacePath}`);
  }

  const packsPath = path.join(workspacePath, 'packs');
  const packStats = fs.statSync(packsPath, { throwIfNoEntry: false });

  if (packStats?.isDirectory()) {
    return loadPortfolioWorkspace(workspacePath, packsPath);
  }

  return loadSingleWorkspace(workspacePath);
}

function loadPortfolioWorkspace(workspacePath, packsPath) {
  const labels = fs.readdirSync(packsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const packs = [];
  const omittedPacks = [];

  for (const label of labels) {
    const packPath = path.join(packsPath, label);
    const packWorkspace = loadSingleWorkspace(packPath, {
      allowNotebook: false,
      suppressUnsupportedError: true,
    });

    if (packWorkspace.kind !== 'pack' || !packWorkspace.normalizedText) {
      omittedPacks.push({
        label,
        path: packPath,
        reason: packWorkspace.reason ?? supportedFilenamesMessage(),
      });
      continue;
    }

    packs.push({
      label,
      path: packPath,
      kind: packWorkspace.kind,
      recognizedFiles: packWorkspace.recognizedFiles,
      normalizedText: packWorkspace.normalizedText,
    });
  }

  if (!packs.length) {
    throw unsupportedWorkspaceError(workspacePath);
  }

  return {
    kind: 'portfolio',
    path: workspacePath,
    packOrder: packs.map((pack) => pack.label),
    packs,
    omittedPacks,
    normalizedText: packs
      .map((pack) => `@@@ ${pack.label} @@@\n${pack.normalizedText}`)
      .join('\n\n')
      .trim(),
  };
}

function loadSingleWorkspace(workspacePath, options = {}) {
  const { allowNotebook = true, suppressUnsupportedError = false } = options;
  const recognizedFiles = [];
  const sections = [];

  for (const sectionName of SECTION_ORDER) {
    const match = readFirstSupportedFile(workspacePath, SECTION_FILES[sectionName]);
    if (!match) {
      continue;
    }

    recognizedFiles.push(match.fileName);
    sections.push({ name: sectionName, content: match.content });
  }

  if (sections.length) {
    return {
      kind: 'pack',
      path: workspacePath,
      recognizedFiles,
      normalizedText: sections
        .map((section) => `@@ ${section.name} @@\n${section.content}`)
        .join('\n\n')
        .trim(),
    };
  }

  if (allowNotebook) {
    const notebookPath = path.join(workspacePath, NOTEBOOK_FILE);
    const notebookStats = fs.statSync(notebookPath, { throwIfNoEntry: false });
    if (notebookStats?.isFile()) {
      const input = normalizeContent(fs.readFileSync(notebookPath, 'utf8'));
      if (input) {
        return {
          kind: 'notebook',
          path: workspacePath,
          recognizedFiles: [NOTEBOOK_FILE],
          input,
        };
      }
    }
  }

  if (suppressUnsupportedError) {
    return {
      kind: 'unsupported',
      path: workspacePath,
      recognizedFiles: [],
      reason: supportedFilenamesMessage(),
    };
  }

  throw unsupportedWorkspaceError(workspacePath);
}

function readFirstSupportedFile(workspacePath, candidates) {
  for (const fileName of candidates) {
    const filePath = path.join(workspacePath, fileName);
    const stats = fs.statSync(filePath, { throwIfNoEntry: false });
    if (!stats?.isFile()) {
      continue;
    }

    const content = normalizeContent(fs.readFileSync(filePath, 'utf8'));
    if (!content) {
      continue;
    }

    return { fileName, content };
  }

  return null;
}

function normalizeContent(input) {
  return String(input ?? '').replace(/\r\n/g, '\n').trim();
}

function supportedFilenamesMessage() {
  return `Supported filenames: ${SUPPORTED_FILENAMES_TEXT}`;
}

function unsupportedWorkspaceError(workspacePath) {
  return new Error(`No supported incident workspace files found in ${workspacePath}. ${supportedFilenamesMessage()}`);
}
