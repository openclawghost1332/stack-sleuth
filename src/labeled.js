const LABEL_MARKER = /^===\s*(.+?)\s*===$/gm;

export function parseLabeledTraceBatches(input) {
  const source = String(input ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) {
    return [];
  }

  const matches = [...source.matchAll(LABEL_MARKER)];
  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? source.length;
      return {
        label: match[1].trim(),
        traces: source.slice(start, end).trim(),
      };
    })
    .filter((batch) => batch.label && batch.traces);
}
