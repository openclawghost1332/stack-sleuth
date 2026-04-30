import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeRegression,
  renderRegressionTextSummary,
  renderRegressionMarkdownSummary
} from '../src/regression.js';

const repeatedJavascriptTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const repeatedPythonTrace = `Traceback (most recent call last):
  File "app.py", line 42, in <module>
    run()
  File "service.py", line 17, in run
    return user["email"]
KeyError: 'email'`;

const repeatedRubyTrace = "app/service.rb:7:in `run': undefined method `email' for nil:NilClass (NoMethodError)\n\tfrom app/controller.rb:3:in `call'";

const secondJavascriptTrace = `TypeError: Cannot read properties of undefined (reading 'id')
    at loadDashboard (/app/src/dashboard.js:14:9)
    at bootstrap (/app/src/index.js:3:1)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const thirdJavascriptTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const noisyBaseline = [
  '2026-04-30T01:30:00Z INFO boot complete',
  `2026-04-30T01:30:01Z ERROR web ${repeatedJavascriptTrace.split('\n').join('\n2026-04-30T01:30:01Z ERROR web ')}`,
  '2026-04-30T01:30:02Z WARN retry scheduled',
  `2026-04-30T01:30:03Z ERROR worker ${repeatedPythonTrace.split('\n').join('\n2026-04-30T01:30:03Z ERROR worker ')}`,
].join('\n');

const noisyCandidate = [
  '2026-04-30T01:31:00Z INFO boot complete',
  `2026-04-30T01:31:01Z ERROR web ${repeatedJavascriptTrace.split('\n').join('\n2026-04-30T01:31:01Z ERROR web ')}`,
  `2026-04-30T01:31:02Z ERROR web ${repeatedJavascriptTrace.split('\n').join('\n2026-04-30T01:31:02Z ERROR web ')}`,
  `2026-04-30T01:31:03Z ERROR billing ${thirdJavascriptTrace.split('\n').join('\n2026-04-30T01:31:03Z ERROR billing ')}`,
  '2026-04-30T01:31:04Z INFO request complete',
].join('\n');

test('analyzeRegression classifies incidents and sorts them by status priority then delta', () => {
  const baseline = [
    repeatedJavascriptTrace,
    repeatedPythonTrace,
    repeatedPythonTrace,
    repeatedRubyTrace,
    secondJavascriptTrace,
    secondJavascriptTrace,
    secondJavascriptTrace
  ].join('\n\n');

  const candidate = [
    thirdJavascriptTrace,
    repeatedJavascriptTrace,
    repeatedJavascriptTrace,
    repeatedJavascriptTrace,
    repeatedRubyTrace,
    secondJavascriptTrace
  ].join('\n\n');

  const regression = analyzeRegression({ baseline, candidate });

  assert.equal(regression.baselineDigest.totalTraces, 7);
  assert.equal(regression.candidateDigest.totalTraces, 6);
  assert.deepEqual(regression.summary, {
    newCount: 1,
    resolvedCount: 1,
    recurringCount: 1,
    volumeUpCount: 1,
    volumeDownCount: 1,
    totalBaselineTraces: 7,
    totalCandidateTraces: 6
  });

  assert.deepEqual(
    regression.hotspotShifts.slice(0, 4).map(({ status, label, baselineScore, candidateScore, delta }) => ({
      status,
      label,
      baselineScore,
      candidateScore,
      delta,
    })),
    [
      {
        status: 'volume-up',
        label: 'profile.js',
        baselineScore: 3,
        candidateScore: 9,
        delta: 6,
      },
      {
        status: 'volume-down',
        label: 'dashboard.js',
        baselineScore: 9,
        candidateScore: 3,
        delta: -6,
      },
      {
        status: 'resolved',
        label: 'service.py',
        baselineScore: 6,
        candidateScore: 0,
        delta: -6,
      },
      {
        status: 'new',
        label: 'invoice.js',
        baselineScore: 0,
        candidateScore: 3,
        delta: 3,
      },
    ]
  );

  assert.deepEqual(
    regression.incidents.map(({ status, signature, baselineCount, candidateCount, delta }) => ({
      status,
      signature,
      baselineCount,
      candidateCount,
      delta
    })),
    [
      {
        status: 'new',
        signature: 'javascript|TypeError|app/src/invoice.js:19|nullish-data,undefined-property-access',
        baselineCount: 0,
        candidateCount: 1,
        delta: 1
      },
      {
        status: 'volume-up',
        signature: 'javascript|TypeError|app/src/profile.js:88|nullish-data,undefined-property-access',
        baselineCount: 1,
        candidateCount: 3,
        delta: 2
      },
      {
        status: 'recurring',
        signature: 'ruby|NoMethodError|app/service.rb:7|nil-receiver,nullish-data',
        baselineCount: 1,
        candidateCount: 1,
        delta: 0
      },
      {
        status: 'volume-down',
        signature: 'javascript|TypeError|app/src/dashboard.js:14|nullish-data,undefined-property-access',
        baselineCount: 3,
        candidateCount: 1,
        delta: -2
      },
      {
        status: 'resolved',
        signature: 'python|KeyError|service.py:17|missing-key',
        baselineCount: 2,
        candidateCount: 0,
        delta: -2
      }
    ]
  );
});

test('analyzeRegression keeps a usable representative report on both candidate and resolved incidents', () => {
  const regression = analyzeRegression({
    baseline: repeatedPythonTrace,
    candidate: thirdJavascriptTrace
  });

  assert.equal(regression.incidents[0].status, 'new');
  assert.equal(regression.incidents[0].representative.errorName, 'TypeError');
  assert.equal(regression.incidents.at(-1).status, 'resolved');
  assert.equal(regression.incidents.at(-1).representative.errorName, 'KeyError');
});

test('analyzeRegression compares noisy baseline and candidate logs', () => {
  const regression = analyzeRegression({ baseline: noisyBaseline, candidate: noisyCandidate });

  assert.equal(regression.baselineDigest.extraction.mode, 'extracted');
  assert.equal(regression.candidateDigest.extraction.mode, 'extracted');
  assert.equal(regression.summary.newCount, 1);
  assert.equal(regression.summary.resolvedCount, 1);
  assert.equal(regression.summary.volumeUpCount, 1);
});

test('analyzeRegression carries blast radius metadata into incident comparisons', () => {
  const regression = analyzeRegression({ baseline: noisyBaseline, candidate: noisyCandidate });

  assert.deepEqual(regression.incidents[0].blastRadius.services, [
    { name: 'billing', count: 1 }
  ]);
  assert.equal(regression.incidents[1].blastRadius.firstSeen, '2026-04-30T01:30:01.000Z');
  assert.equal(regression.incidents[1].blastRadius.lastSeen, '2026-04-30T01:31:02.000Z');
});

test('renderRegression helpers produce copy-ready text and markdown summaries', () => {
  const regression = analyzeRegression({
    baseline: [repeatedJavascriptTrace, repeatedPythonTrace].join('\n\n'),
    candidate: [repeatedJavascriptTrace, repeatedJavascriptTrace, thirdJavascriptTrace].join('\n\n')
  });

  const text = renderRegressionTextSummary(regression);
  const markdown = renderRegressionMarkdownSummary(regression);

  assert.match(text, /Stack Sleuth Regression Radar/);
  assert.match(text, /Baseline traces: 2/);
  assert.match(text, /Candidate traces: 3/);
  assert.match(text, /new: 1/);
  assert.match(text, /volume-up: 1/);
  assert.match(text, /Hotspot shifts: profile\.js \(\+3\), invoice\.js \(\+3\), service\.py \(-3\)/);

  assert.match(markdown, /^# Stack Sleuth Regression Radar/m);
  assert.match(markdown, /- \*\*Baseline traces:\*\* 2/);
  assert.match(markdown, /- \*\*Candidate traces:\*\* 3/);
  assert.match(markdown, /## Hotspot shifts\n- `profile\.js` \(volume-up, baseline 3, candidate 6, delta \+3\)\n- `invoice\.js` \(new, baseline 0, candidate 3, delta \+3\)\n- `service\.py` \(resolved, baseline 3, candidate 0, delta -3\)/);
  assert.match(markdown, /## New incidents/);
  assert.match(markdown, /## Volume-up incidents/);
});

test('regression renderers include blast radius details when noisy logs add service spread', () => {
  const regression = analyzeRegression({ baseline: noisyBaseline, candidate: noisyCandidate });

  assert.match(renderRegressionTextSummary(regression), /Blast radius: billing 1x/);
  assert.match(renderRegressionTextSummary(regression), /Window: 2026-04-30T01:30:01.000Z → 2026-04-30T01:31:02.000Z/);
  assert.match(renderRegressionMarkdownSummary(regression), /\*\*Blast radius:\*\* billing 1x/);
});
