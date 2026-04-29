const INTERNAL_PREFIXES = ['node:', 'internal/', '<internal:', '(internal', 'ruby/'];
const TRACE_START_PATTERNS = [
  ['python', /^Traceback \(most recent call last\):$/],
  ['javascript', /^[A-Za-z_$][\w$]*(?::|$)/],
  ['ruby', /^(?:\s*from\s+)?[^\n]+:\d+:in `.*'/]
];

export function parseTrace(traceText) {
  const text = String(traceText ?? '').replace(/\r\n/g, '\n').trimEnd();
  const runtime = detectRuntime(text);
  const parsed = PARSERS[runtime](text);
  const culpritFrame = selectCulpritFrame(parsed.frames);

  return {
    runtime,
    errorName: parsed.errorName,
    message: parsed.message,
    frames: parsed.frames,
    culpritFrame,
  };
}

export function detectTraceStartRuntime(line) {
  const candidate = String(line ?? '');
  return TRACE_START_PATTERNS.find(([, pattern]) => pattern.test(candidate))?.[0] ?? null;
}

function detectRuntime(text) {
  const firstNonEmptyLine = text.split('\n').find((line) => line.trim());
  const runtimeFromStart = detectTraceStartRuntime(firstNonEmptyLine);

  if (runtimeFromStart) {
    return runtimeFromStart;
  }

  if (/^\s*at .*:\d+:\d+\)?$/m.test(text)) {
    return 'javascript';
  }

  return 'javascript';
}

const PARSERS = {
  javascript: parseJavaScriptTrace,
  python: parsePythonTrace,
  ruby: parseRubyTrace,
};

function parseJavaScriptTrace(text) {
  const lines = text.split('\n');
  const headerMatch = lines[0]?.match(/^(?<name>[A-Za-z_$][\w$]*)(?::\s*(?<message>.*))?$/);
  const frames = lines
    .slice(1)
    .map((line) => line.match(/^\s*at\s+(?:(?<functionName>.*?)\s+\()?(?<file>.*?):(?<line>\d+):(?<column>\d+)\)?$/))
    .filter(Boolean)
    .map(({ groups }) => ({
      functionName: groups.functionName || null,
      file: groups.file,
      line: Number(groups.line),
      column: Number(groups.column),
      internal: isInternalFile(groups.file),
    }));

  return {
    errorName: headerMatch?.groups?.name ?? 'Error',
    message: headerMatch?.groups?.message ?? lines[0] ?? '',
    frames,
  };
}

function parsePythonTrace(text) {
  const lines = text.split('\n');
  const frames = [];

  for (const line of lines) {
    const match = line.match(/^\s*File "(?<file>.+?)", line (?<line>\d+), in (?<functionName>.+)$/);
    if (!match) {
      continue;
    }

    frames.unshift({
      functionName: match.groups.functionName,
      file: match.groups.file,
      line: Number(match.groups.line),
      column: null,
      internal: isInternalFile(match.groups.file),
    });
  }

  const errorLine = lines.at(-1) ?? '';
  const errorMatch = errorLine.match(/^(?<name>[A-Za-z_][\w.]*)(?::\s*(?<message>.*))?$/);

  return {
    errorName: errorMatch?.groups?.name ?? 'Error',
    message: errorMatch?.groups?.message ?? errorLine,
    frames,
  };
}

function parseRubyTrace(text) {
  const lines = text.split('\n');
  const frames = lines
    .map(parseRubyFrame)
    .filter(Boolean);

  const headerMatch = lines[0]?.match(/^(?:\s*from\s+)?[^\n]+:\d+:in `.*':\s*(?<message>.*)\s+\((?<name>\S+(?:Error|Exception))\)$/);
  const errorLine = [...lines].reverse().find((line) => /^\S+(Error|Exception): /.test(line)) ?? lines[0] ?? '';
  const errorMatch = errorLine.match(/^(?<name>\S+(?:Error|Exception)):\s*(?<message>.*)$/);

  return {
    errorName: headerMatch?.groups?.name ?? errorMatch?.groups?.name ?? 'Error',
    message: headerMatch?.groups?.message ?? errorMatch?.groups?.message ?? errorLine,
    frames,
  };
}

function parseRubyFrame(line) {
  const match = line.match(/^(?:\s*from\s+)?(?<file>.*?):(?<line>\d+):in `(?<functionName>.*)'(?:\:\s+.*)?$/);
  return match && {
    functionName: match.groups.functionName || null,
    file: match.groups.file,
    line: Number(match.groups.line),
    column: null,
    internal: isInternalFile(match.groups.file),
  };
}

function selectCulpritFrame(frames) {
  return frames.find((frame) => !frame.internal) ?? frames[0] ?? null;
}

function isInternalFile(file) {
  return INTERNAL_PREFIXES.some((prefix) => file.startsWith(prefix));
}
