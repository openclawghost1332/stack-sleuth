import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitTraceChunks,
  analyzeTraceDigest,
  renderDigestTextSummary,
  renderDigestMarkdownSummary
} from '../src/digest.js';

const repeatedJavascriptTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const variantJavascriptTrace = `TypeError: Cannot read properties of undefined (reading 'email')
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

const secondRubyTrace = "worker/jobs/report_job.rb:11:in `perform': undefined method `account' for nil:NilClass (NoMethodError)\n\tfrom worker/runner.rb:4:in `run'";

const chainedPythonTrace = `Traceback (most recent call last):
  File "parser.py", line 10, in parse_payload
    return int(payload["user_id"])
ValueError: invalid literal for int() with base 10: 'abc'

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "worker.py", line 22, in sync_user
    return parse_payload(payload)
  File "parser.py", line 12, in parse_payload
    raise RuntimeError("bad payload") from error
RuntimeError: bad payload`;

const multiTraceInput = [
  repeatedJavascriptTrace,
  repeatedJavascriptTrace,
  repeatedPythonTrace
].join('\n\n');

const noisyLogInput = [
  '2026-04-30T01:00:00Z INFO api boot complete',
  "2026-04-30T01:00:01Z ERROR web TypeError: Cannot read properties of undefined (reading 'name')",
  '2026-04-30T01:00:01Z ERROR web     at renderProfile (/app/src/profile.js:88:17)',
  '2026-04-30T01:00:01Z ERROR web     at updateView (/app/src/view.js:42:5)',
  '2026-04-30T01:00:02Z WARN worker heartbeat lagging',
  '2026-04-30T01:00:03Z ERROR worker Traceback (most recent call last):',
  '2026-04-30T01:00:03Z ERROR worker   File "app.py", line 42, in <module>',
  '2026-04-30T01:00:03Z ERROR worker     run()',
  '2026-04-30T01:00:03Z ERROR worker   File "service.py", line 17, in run',
  '2026-04-30T01:00:03Z ERROR worker     return user["email"]',
  "2026-04-30T01:00:03Z ERROR worker KeyError: 'email'"
].join('\n');

test('splitTraceChunks separates repeated runtime-shaped traces', () => {
  assert.deepEqual(splitTraceChunks(multiTraceInput), [
    repeatedJavascriptTrace,
    repeatedJavascriptTrace,
    repeatedPythonTrace
  ]);
});

test('splitTraceChunks separates mixed-runtime traces including Ruby backtrace headers', () => {
  const input = [
    repeatedJavascriptTrace,
    repeatedRubyTrace,
    repeatedPythonTrace,
    secondRubyTrace
  ].join('\n\n');

  assert.deepEqual(splitTraceChunks(input), [
    repeatedJavascriptTrace,
    repeatedRubyTrace,
    repeatedPythonTrace,
    secondRubyTrace
  ]);
});

test('splitTraceChunks keeps a chained Python exception as one logical trace', () => {
  assert.deepEqual(splitTraceChunks(chainedPythonTrace), [
    chainedPythonTrace
  ]);

  const digest = analyzeTraceDigest(chainedPythonTrace);
  assert.equal(digest.totalTraces, 1);
  assert.equal(digest.groupCount, 1);
});

test('splitTraceChunks excavates trace-shaped chunks from noisy logs', () => {
  assert.equal(splitTraceChunks(noisyLogInput).length, 2);

  const digest = analyzeTraceDigest(noisyLogInput);
  assert.equal(digest.extraction.mode, 'extracted');
  assert.equal(digest.totalTraces, 2);
  assert.equal(digest.groupCount, 2);
});

test('analyzeTraceDigest excavates traces from noisy logs before grouping them', () => {
  const noisyLog = [
    '2026-04-30T01:20:00.000Z INFO booting worker',
    '[api] ERROR request failed TypeError: Cannot read properties of undefined (reading \'name\')',
    '[api] ERROR request failed     at renderProfile (/app/src/profile.js:88:17)',
    '[api] ERROR request failed     at updateView (/app/src/view.js:42:5)',
    '[api] ERROR request failed     at processTicksAndRejections (node:internal/process/task_queues:95:5)',
    '2026-04-30T01:20:05.000Z WARN retry scheduled',
    '2026-04-30 01:20:06 ERROR Traceback (most recent call last):',
    '2026-04-30 01:20:06 ERROR   File "worker.py", line 22, in sync_user',
    '2026-04-30 01:20:06 ERROR     return parse_payload(payload)',
    '2026-04-30 01:20:06 ERROR   File "parser.py", line 10, in parse_payload',
    '2026-04-30 01:20:06 ERROR     return int(payload["user_id"])',
    '2026-04-30 01:20:06 ERROR ValueError: invalid literal for int() with base 10: \'abc\'',
    '2026-04-30T01:20:07.000Z INFO request complete'
  ].join('\n');

  const digest = analyzeTraceDigest(noisyLog);

  assert.equal(digest.totalTraces, 2);
  assert.equal(digest.groupCount, 2);
  assert.deepEqual(digest.traces.map((trace) => trace.runtime), ['javascript', 'python']);
  assert.deepEqual(digest.groups.map((group) => group.runtime), ['javascript', 'python']);
});

test('analyzeTraceDigest groups reports by signature and sorts by repeat count', () => {
  const digest = analyzeTraceDigest(multiTraceInput);

  assert.equal(digest.totalTraces, 3);
  assert.equal(digest.groupCount, 2);
  assert.equal(digest.groups[0].count, 2);
  assert.equal(digest.groups[0].signature, 'javascript|TypeError|app/src/profile.js:88|nullish-data,undefined-property-access');
  assert.equal(digest.groups[0].representative.errorName, 'TypeError');
  assert.deepEqual(digest.groups[0].tags, ['nullish-data', 'undefined-property-access']);
  assert.equal(digest.groups[1].count, 1);
  assert.equal(digest.groups[1].runtime, 'python');
  assert.deepEqual(
    digest.hotspots.map(({ label, score, culpritCount, supportCount }) => ({
      label,
      score,
      culpritCount,
      supportCount,
    })),
    [
      {
        label: 'profile.js',
        score: 6,
        culpritCount: 2,
        supportCount: 0,
      },
      {
        label: 'service.py',
        score: 3,
        culpritCount: 1,
        supportCount: 0,
      },
      {
        label: 'view.js',
        score: 2,
        culpritCount: 0,
        supportCount: 2,
      },
      {
        label: 'app.py',
        score: 1,
        culpritCount: 0,
        supportCount: 1,
      },
    ]
  );
});

test('analyzeTraceDigest keeps the first matching trace as the group representative', () => {
  const digest = analyzeTraceDigest([
    variantJavascriptTrace,
    repeatedJavascriptTrace
  ].join('\n\n'));

  assert.equal(digest.groupCount, 1);
  assert.equal(digest.groups[0].count, 2);
  assert.equal(digest.groups[0].representative.message, "Cannot read properties of undefined (reading 'email')");
});

test('analyzeTraceDigest breaks equal-count ties by first appearance', () => {
  const digest = analyzeTraceDigest([
    repeatedPythonTrace,
    repeatedJavascriptTrace
  ].join('\n\n'));

  assert.equal(digest.groupCount, 2);
  assert.equal(digest.groups[0].runtime, 'python');
  assert.equal(digest.groups[1].runtime, 'javascript');
});

test('digest renderers produce copy-ready text and markdown summaries', () => {
  const digest = analyzeTraceDigest(multiTraceInput);
  const text = renderDigestTextSummary(digest);
  const markdown = renderDigestMarkdownSummary(digest);

  assert.match(text, /Stack Sleuth Incident Digest/);
  assert.match(text, /Total traces: 3/);
  assert.match(text, /Unique incidents: 2/);
  assert.match(text, /2x javascript TypeError/);
  assert.match(text, /Suspect hotspots: profile\.js \(score 6\), service\.py \(score 3\), view\.js \(score 2\)/);

  assert.match(markdown, /^# Stack Sleuth Incident Digest/m);
  assert.match(markdown, /- \*\*Total traces:\*\* 3/);
  assert.match(markdown, /## Suspect hotspots\n- `profile\.js` \(score 6, culprit 2x, support 0x\)\n- `service\.py` \(score 3, culprit 1x, support 0x\)\n- `view\.js` \(score 2, culprit 0x, support 2x\)/);
  assert.match(markdown, /## Incident 1 \(2 traces\)/);
  assert.match(markdown, /`javascript\|TypeError\|app\/src\/profile\.js:88\|nullish-data,undefined-property-access`/);
});

test('single valid trace produces a one-group digest', () => {
  const digest = analyzeTraceDigest(repeatedJavascriptTrace);

  assert.equal(digest.totalTraces, 1);
  assert.equal(digest.groupCount, 1);
  assert.equal(digest.groups[0].count, 1);
});
