const PACK_HEADING = /^#\s*Pack\s*:\s*(.+?)\s*$/gm;
const MARKDOWN_HEADING = /^(#{1,6})\s+(.+?)\s*$/gm;

export function parseIncidentNotebook(input) {
  const source = normalizeSource(input);
  if (!source) {
    return unsupportedNotebook(source, 'Notebook is empty, so there are no supported incident sections to normalize.');
  }

  const packMatches = [...source.matchAll(PACK_HEADING)];
  if (packMatches.length) {
    return parsePortfolioNotebook(source, packMatches);
  }

  return parseSingleNotebook(source);
}

export function renderNormalizedNotebookText(notebook) {
  if (!notebook || notebook.kind === 'unsupported') {
    return '';
  }

  if (notebook.kind === 'pack') {
    return renderPackText(notebook.sections, notebook.sectionOrder);
  }

  if (notebook.kind === 'portfolio') {
    return notebook.packOrder
      .map((label) => {
        const pack = notebook.packs.find((entry) => entry.label === label);
        if (!pack) {
          return null;
        }

        return [`@@@ ${pack.label} @@@`, renderPackText(pack.sections, pack.sectionOrder)]
          .filter(Boolean)
          .join('\n');
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }

  return '';
}

export function routeIncidentNotebook({ input, notebook, analyzers }) {
  const parsed = notebook ?? parseIncidentNotebook(input);

  if (parsed.kind === 'unsupported') {
    return {
      mode: 'unsupported',
      notebook: parsed,
      reason: parsed.reason,
    };
  }

  const normalizedText = renderNormalizedNotebookText(parsed);

  if (parsed.kind === 'portfolio') {
    return analyzers.portfolio(normalizedText);
  }

  return analyzers.pack(normalizedText);
}

function parsePortfolioNotebook(source, matches) {
  const packs = [];
  const packOrder = [];

  for (const [index, match] of matches.entries()) {
    const label = String(match[1] ?? '').trim();
    if (!label) {
      continue;
    }

    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    const content = source.slice(start, end).trim();
    const pack = parseNotebookSections(content);

    if (!pack.sectionOrder.length) {
      continue;
    }

    packs.push({
      label,
      sections: pack.sections,
      sectionOrder: pack.sectionOrder,
    });
    packOrder.push(label);
  }

  if (!packOrder.length) {
    return unsupportedNotebook(source, 'Notebook uses pack headings, but none of the packs contained supported incident sections like Current incident or Prior incidents.');
  }

  return {
    kind: 'portfolio',
    source,
    packOrder,
    packs,
    normalizedText: packOrder
      .map((label, index) => `@@@ ${label} @@@\n${renderPackText(packs[index].sections, packs[index].sectionOrder)}`)
      .join('\n\n'),
  };
}

function parseSingleNotebook(source) {
  const pack = parseNotebookSections(source);

  if (!pack.sectionOrder.length) {
    if (pack.headingCount > 0) {
      return unsupportedNotebook(source, 'Notebook headings were found, but no supported incident sections like Current incident, Prior incidents, Baseline, Candidate, or Timeline were recognized.');
    }

    return unsupportedNotebook(source, 'Notebook did not contain any supported incident headings to normalize.');
  }

  return {
    kind: 'pack',
    source,
    sections: pack.sections,
    sectionOrder: pack.sectionOrder,
    normalizedText: renderPackText(pack.sections, pack.sectionOrder),
  };
}

function parseNotebookSections(source) {
  const matches = [...String(source ?? '').matchAll(MARKDOWN_HEADING)];
  const sections = {};
  const sectionOrder = [];
  let headingCount = 0;

  for (const [index, match] of matches.entries()) {
    headingCount += 1;
    const title = String(match[2] ?? '').trim();
    const canonicalName = normalizeNotebookSectionTitle(title);
    if (!canonicalName) {
      continue;
    }

    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    const content = source.slice(start, end).trim();
    if (!content) {
      continue;
    }

    if (!sections[canonicalName]) {
      sectionOrder.push(canonicalName);
      sections[canonicalName] = content;
      continue;
    }

    sections[canonicalName] = `${sections[canonicalName]}\n\n${content}`;
  }

  return {
    headingCount,
    sections,
    sectionOrder,
  };
}

function normalizeNotebookSectionTitle(title) {
  const value = String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/[#:]+/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

  if (!value) {
    return null;
  }

  if (value.includes('current incident') || value === 'current' || value.includes('current symptoms')) {
    return 'current';
  }

  if (value.includes('prior incident') || value.includes('prior incidents') || value.includes('history') || value.includes('casebook')) {
    return 'history';
  }

  if (value.includes('baseline')) {
    return 'baseline';
  }

  if (value.includes('candidate')) {
    return 'candidate';
  }

  if (value.includes('timeline') || value.includes('rollout')) {
    return 'timeline';
  }

  return null;
}

function renderPackText(sections, sectionOrder) {
  return sectionOrder
    .map((name) => `@@ ${name} @@\n${sections[name]}`)
    .join('\n\n')
    .trim();
}

function normalizeSource(input) {
  return String(input ?? '').replace(/\r\n/g, '\n').trim();
}

function unsupportedNotebook(source, reason) {
  return {
    kind: 'unsupported',
    source,
    reason,
  };
}
