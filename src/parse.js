const INTERNAL_PREFIXES = ['node:', 'internal/', '<internal:', '(internal', 'ruby/'];

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

function detectRuntime(text) {
  if (/^Traceback \(most recent call last\):/m.test(text)) {
    return 'python';
  }

  if (/^\s*at .*:\d+:\d+\)?$/m.test(text)) {
    return 'javascript';
  }

  if (/^\s*from .*:\d+:in /m.test(text)) {
    return 'ruby';
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
    .filter((line) => /^\s*from .*:\d+:in /.test(line))
    .map((line) => {
      const match = line.match(/^\s*from (?<file>.*?):(?<line>\d+):in `(?<functionName>.*)'$/);
      return match && {
        functionName: match.groups.functionName || null,
        file: match.groups.file,
        line: Number(match.groups.line),
        column: null,
        internal: isInternalFile(match.groups.file),
      };
    })
    .filter(Boolean);

  const errorLine = [...lines].reverse().find((line) => /^\S+(Error|Exception): /.test(line)) ?? lines[0] ?? '';
  const errorMatch = errorLine.match(/^(?<name>\S+(?:Error|Exception)):\s*(?<message>.*)$/);

  return {
    errorName: errorMatch?.groups?.name ?? 'Error',
    message: errorMatch?.groups?.message ?? errorLine,
    frames,
  };
}

function selectCulpritFrame(frames) {
  return frames.find((frame) => !frame.internal) ?? frames[0] ?? null;
}

function isInternalFile(file) {
  return INTERNAL_PREFIXES.some((prefix) => file.startsWith(prefix));
}
