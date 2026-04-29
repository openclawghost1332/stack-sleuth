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

  assert.match(markdown, /^# Stack Sleuth Regression Radar/m);
  assert.match(markdown, /- \*\*Baseline traces:\*\* 2/);
  assert.match(markdown, /- \*\*Candidate traces:\*\* 3/);
  assert.match(markdown, /## New incidents/);
  assert.match(markdown, /## Volume-up incidents/);
});
