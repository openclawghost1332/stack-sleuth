const LABEL_MARKER = /^===\s*(.+?)\s*===$/gm;
const METADATA_MARKER = /^>>>\s*([a-z0-9_-]+)\s*:\s*(.*)$/i;

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
      const { metadata, traces } = splitMetadataAndTraces(source.slice(start, end));
      return {
        label: match[1].trim(),
        metadata,
        traces,
      };
    })
    .filter((batch) => batch.label && batch.traces);
}

function splitMetadataAndTraces(block) {
  const lines = String(block ?? '').replace(/^\n+|\n+$/g, '').split('\n');
  const metadata = {};
  let index = 0;

  while (index < lines.length) {
    const match = lines[index].match(METADATA_MARKER);
    if (!match) {
      break;
    }

    metadata[match[1].trim().toLowerCase()] = match[2].trim();
    index += 1;
  }

  while (index < lines.length && !lines[index].trim()) {
    index += 1;
  }

  return {
    metadata,
    traces: lines.slice(index).join('\n').trim(),
  };
}
