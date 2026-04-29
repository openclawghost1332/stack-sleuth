const PATTERNS = [
  {
    match: (report) => /Cannot read propert(?:y|ies) of undefined/i.test(report.message),
    result: (report) => ({
      confidence: 'high',
      tags: ['nullish-data', 'undefined-property-access'],
      summary: `A value was undefined before property access in ${formatFrame(report.culpritFrame)}.`,
      checklist: [
        'Inspect the payload or upstream return value reaching this frame.',
        'Add a guard or default before reading nested properties.',
        'Log the value shape near the failing path to confirm where it becomes undefined.'
      ]
    })
  },
  {
    match: (report) => report.errorName === 'KeyError' || /key not found|missing key/i.test(report.message),
    result: (report) => ({
      confidence: 'high',
      tags: ['missing-key'],
      summary: `A required key appears to be missing before ${formatFrame(report.culpritFrame)} executes.`,
      checklist: [
        'Confirm the expected key exists in the incoming payload.',
        'Handle optional keys with a fallback or explicit validation.',
        'Log the container contents around the failing access.'
      ]
    })
  },
  {
    match: (report) => report.errorName === 'NoMethodError' || /undefined method .* nil:NilClass/i.test(report.message),
    result: (report) => ({
      confidence: 'high',
      tags: ['nullish-data', 'nil-receiver'],
      summary: `Ruby tried to call a method on nil near ${formatFrame(report.culpritFrame)}.`,
      checklist: [
        'Trace which variable is nil at the failing call site.',
        'Add presence checks or defaults before calling the method.',
        'Log the upstream record or payload that should populate the receiver.'
      ]
    })
  },
  {
    match: (report) => /Cannot find module|ERR_MODULE_NOT_FOUND|ModuleNotFoundError|LoadError/i.test(`${report.errorName}: ${report.message}`),
    result: (report) => ({
      confidence: 'medium',
      tags: ['module-import-failure'],
      summary: `The runtime could not load a module needed by ${formatFrame(report.culpritFrame)}.`,
      checklist: [
        'Verify the import or require path matches the deployed file layout.',
        'Confirm the dependency is installed and available in this environment.',
        'Check build or packaging output for omitted files.'
      ]
    })
  }
];

export function diagnoseTrace(traceReport) {
  const report = normalizeReport(traceReport);
  const pattern = PATTERNS.find((candidate) => candidate.match(report));

  if (pattern) {
    return pattern.result(report);
  }

  return {
    confidence: 'medium',
    tags: ['generic-runtime-error'],
    summary: `No specific pattern matched, so focus on the failing inputs and recent changes around ${formatFrame(report.culpritFrame)}.`,
    checklist: [
      'Reproduce the failure with the same inputs if possible.',
      'Inspect the values entering the failing frame.',
      'Compare recent code or dependency changes that touch this path.'
    ]
  };
}

function normalizeReport(traceReport) {
  return {
    runtime: String(traceReport?.runtime ?? 'unknown'),
    errorName: String(traceReport?.errorName ?? 'Error'),
    message: String(traceReport?.message ?? ''),
    culpritFrame: traceReport?.culpritFrame ?? null,
    frames: Array.isArray(traceReport?.frames) ? traceReport.frames : []
  };
}

function formatFrame(frame) {
  if (!frame?.file) {
    return 'the failing code path';
  }

  const location = frame.line ? `${frame.file}:${frame.line}` : frame.file;
  return frame.functionName ? `${frame.functionName} (${location})` : location;
}
