const SECTION_MARKER = /^@@\s*(.+?)\s*@@$/gm;

export function parseIncidentPack(input) {
  const source = String(input ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) {
    return emptyPack();
  }

  const matches = [...source.matchAll(SECTION_MARKER)];
  if (!matches.length) {
    return emptyPack();
  }

  const sections = {};
  const sectionOrder = [];
  const seenSections = new Set();
  const unknownSections = [];
  const seenUnknownSections = new Set();

  for (const [index, match] of matches.entries()) {
    const rawName = match[1]?.trim() ?? '';
    const canonicalName = normalizeIncidentPackSection(rawName);
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    const content = source.slice(start, end).trim();

    if (!canonicalName) {
      if (rawName && !seenUnknownSections.has(rawName.toLowerCase())) {
        seenUnknownSections.add(rawName.toLowerCase());
        unknownSections.push(rawName.toLowerCase());
      }
      continue;
    }

    if (!content) {
      continue;
    }

    if (!seenSections.has(canonicalName)) {
      seenSections.add(canonicalName);
      sectionOrder.push(canonicalName);
    }

    sections[canonicalName] = sections[canonicalName]
      ? `${sections[canonicalName]}\n\n${content}`
      : content;
  }

  return {
    source,
    sections,
    sectionOrder,
    unknownSections,
  };
}

export function normalizeIncidentPackSection(name) {
  const value = String(name ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (!value) {
    return null;
  }

  if (value.includes('current')) {
    return 'current';
  }

  if (value.includes('history') || value.includes('casebook')) {
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

function emptyPack() {
  return {
    source: '',
    sections: {},
    sectionOrder: [],
    unknownSections: [],
  };
}
