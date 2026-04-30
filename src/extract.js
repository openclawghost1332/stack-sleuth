const PYTHON_CHAIN_MARKER = /^(?:The above exception was the direct cause of the following exception:|During handling of the above exception, another exception occurred:)$/;
const TRACEBACK_LINE = 'Traceback (most recent call last):';
const JAVASCRIPT_HEADER_PATTERN = /((?:Uncaught\s+)?[A-Za-z_$][\w$.]*(?:Error|Exception)(?::\s*.*)?)$/;
const PYTHON_ERROR_PATTERN = /([A-Za-z_][\w.]*:\s*.+)$/;

export function extractTraceSet(input) {
  const source = String(input ?? '').replace(/\r\n/g, '\n').trim();
  if (!source) {
    return buildResult('direct', [], 0);
  }

  const directTraces = splitDirectTraceChunks(source);
  if (directTraces.length > 0) {
    return buildResult('direct', directTraces, 0);
  }

  return scanRawLogs(source);
}

export function formatExtractionText(extraction, label = 'Input') {
  if (!extraction) {
    return `${label}: no trace input analyzed.`;
  }

  if (extraction.mode === 'direct') {
    return `${label}: analyzed ${formatCount(extraction.traceCount, 'direct trace')}.`;
  }

  return `${label}: excavated ${formatCount(extraction.traceCount, 'trace')} from raw logs, ignored ${formatCount(extraction.ignoredLineCount, 'non-trace line')}.`;
}

export function formatExtractionMarkdown(extraction, label = 'Input') {
  return `- **${escapeMarkdownText(label)}:** ${escapeMarkdownText(formatExtractionText(extraction, '').replace(/^:\s*/, '').replace(/\.$/, ''))}`;
}

function splitDirectTraceChunks(source) {
  const sections = source
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (!sections.length) {
    return [];
  }

  const chunks = [];

  for (const section of sections) {
    const runtime = detectSectionRuntime(section);
    if (!runtime) {
      if (!chunks.length) {
        return [];
      }

      chunks[chunks.length - 1] = `${chunks.at(-1)}\n\n${section}`;
      continue;
    }

    const firstLine = section.split('\n')[0] ?? '';
    const lastLine = chunks.at(-1)?.split('\n').at(-1) ?? '';
    const continuesPythonChain = firstLine === TRACEBACK_LINE && PYTHON_CHAIN_MARKER.test(lastLine);

    if (continuesPythonChain) {
      chunks[chunks.length - 1] = `${chunks.at(-1)}\n\n${section}`;
      continue;
    }

    chunks.push(section);
  }

  return chunks.length && chunks.every((chunk) => isUsableTrace(detectSectionRuntime(chunk), chunk.split('\n')))
    ? chunks
    : [];
}

function scanRawLogs(source) {
  const traces = [];
  const lines = source.split('\n');
  let ignoredLineCount = 0;
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    const nextNonEmptyLine = findNextNonEmptyLine(lines, index + 1);
    const start = findTraceStart(rawLine, nextNonEmptyLine);

    if (current && start && shouldTreatStartAsContinuation(current, start)) {
      current.lines.push(normalizeTraceLine(start.trace, current.runtime));
      continue;
    }

    if (current && start) {
      ignoredLineCount += finalizeCurrentTrace(current, traces);
      current = createTrace(start.runtime, start.trace);
      continue;
    }

    if (current) {
      const continuation = findTraceContinuation(rawLine, current.runtime, current.lines.at(-1));
      if (continuation) {
        current.lines.push(normalizeTraceLine(continuation, current.runtime));
        continue;
      }

      ignoredLineCount += finalizeCurrentTrace(current, traces);
      current = null;
    }

    if (start) {
      current = createTrace(start.runtime, start.trace);
    } else {
      ignoredLineCount += 1;
    }
  }

  if (current) {
    ignoredLineCount += finalizeCurrentTrace(current, traces);
  }

  return buildResult('extracted', traces, ignoredLineCount);
}

function createTrace(runtime, trace) {
  return {
    runtime,
    lines: [normalizeTraceLine(trace, runtime)],
  };
}

function finalizeCurrentTrace(current, traces) {
  const normalized = current.lines.join('\n').trim();
  if (!normalized || !isUsableTrace(current.runtime, current.lines)) {
    return current.lines.filter((line) => line.trim()).length;
  }

  traces.push(normalized);
  return 0;
}

function shouldTreatStartAsContinuation(current, start) {
  return current.runtime === 'python'
    && start.runtime === 'python'
    && start.trace === TRACEBACK_LINE
    && PYTHON_CHAIN_MARKER.test(current.lines.at(-1) ?? '');
}

function isUsableTrace(runtime, lines) {
  if (runtime === 'javascript') {
    return Boolean(detectJavascriptHeader(lines[0])) && lines.slice(1).some((line) => Boolean(detectJavascriptFrame(line)));
  }

  if (runtime === 'python') {
    return lines[0] === TRACEBACK_LINE
      && lines.some((line) => Boolean(detectPythonFrame(line)))
      && lines.some((line) => Boolean(detectPythonError(line)));
  }

  if (runtime === 'ruby') {
    return lines.some((line) => Boolean(detectRubyFrame(line)));
  }

  return false;
}

function detectSectionRuntime(section) {
  const lines = String(section ?? '').split('\n');
  const firstLine = lines.find((line) => line.trim()) ?? '';

  if (firstLine === TRACEBACK_LINE) {
    return 'python';
  }

  if (detectRubyFrame(firstLine)) {
    return 'ruby';
  }

  if (detectJavascriptHeader(firstLine) && lines.slice(1).some((line) => Boolean(detectJavascriptFrame(line)))) {
    return 'javascript';
  }

  return null;
}

function findTraceStart(line, nextNonEmptyLine) {
  if (detectPythonStart(line)) {
    return { runtime: 'python', trace: TRACEBACK_LINE };
  }

  const ruby = detectRubyFrame(line);
  if (ruby && !ruby.startsWith('\tfrom ')) {
    return { runtime: 'ruby', trace: ruby };
  }

  const javascript = detectJavascriptHeader(line);
  if (javascript && detectJavascriptFrame(nextNonEmptyLine)) {
    return { runtime: 'javascript', trace: javascript };
  }

  return null;
}

function findTraceContinuation(line, runtime, previousLine) {
  if (runtime === 'javascript') {
    return detectJavascriptFrame(line);
  }

  if (runtime === 'python') {
    return detectPythonFrame(line)
      ?? detectPythonCodeLine(line, previousLine)
      ?? detectPythonChainMarker(line)
      ?? detectPythonError(line);
  }

  if (runtime === 'ruby') {
    const ruby = detectRubyFrame(line);
    return ruby?.startsWith('\tfrom ') ? ruby : null;
  }

  return null;
}

function detectPythonStart(line) {
  return String(line ?? '').includes(TRACEBACK_LINE);
}

function detectJavascriptHeader(line) {
  const match = String(line ?? '').match(JAVASCRIPT_HEADER_PATTERN);
  return match?.[1]?.trim() ?? null;
}

function detectJavascriptFrame(line) {
  const match = String(line ?? '').match(/(?:^|\s)(at\s+.*?:\d+:\d+\)?)$/);
  return match?.[1] ? `    ${match[1]}` : null;
}

function detectPythonFrame(line) {
  const match = String(line ?? '').match(/(File ".+?", line \d+, in .+)$/);
  return match?.[1] ? `  ${match[1]}` : null;
}

function detectPythonCodeLine(line, previousLine) {
  if (!String(previousLine ?? '').startsWith('  File "')) {
    return null;
  }

  const match = String(line ?? '').match(/(\s{2,}\S.*)$/);
  return match?.[1] ?? null;
}

function detectPythonChainMarker(line) {
  const normalized = String(line ?? '').trim();
  return PYTHON_CHAIN_MARKER.test(normalized) ? normalized : null;
}

function detectPythonError(line) {
  const match = String(line ?? '').match(PYTHON_ERROR_PATTERN);
  return match?.[1]?.trim() ?? null;
}

function detectRubyFrame(line) {
  const match = String(line ?? '').match(/((?:from\s+)?[^\n]*\.rb:\d+:in `.*'(?:\:\s+.*)?(?:\s+\(\S+(?:Error|Exception)\))?)$/);
  if (!match?.[1]) {
    return null;
  }

  const value = match[1].trimStart();
  return value.startsWith('from ') ? `\t${value}` : value;
}

function normalizeTraceLine(line, runtime) {
  const value = String(line ?? '').trimEnd();

  if (runtime === 'javascript' && value.startsWith('at ')) {
    return `    ${value}`;
  }

  if (runtime === 'python' && value.startsWith('File "')) {
    return `  ${value}`;
  }

  if (runtime === 'ruby' && value.startsWith('from ')) {
    return `\t${value}`;
  }

  return value;
}

function findNextNonEmptyLine(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (String(lines[index] ?? '').trim()) {
      return lines[index];
    }
  }

  return null;
}

function buildResult(mode, traces, ignoredLineCount) {
  return {
    mode,
    traces,
    traceCount: traces.length,
    ignoredLineCount,
  };
}

function formatCount(count, noun) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

function escapeMarkdownText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}
