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

const repeatedPythonTrace = `Traceback (most recent call last):
  File "app.py", line 42, in <module>
    run()
  File "service.py", line 17, in run
    return user["email"]
KeyError: 'email'`;

const multiTraceInput = [
  repeatedJavascriptTrace,
  repeatedJavascriptTrace,
  repeatedPythonTrace
].join('\n\n');

test('splitTraceChunks separates repeated runtime-shaped traces', () => {
  assert.deepEqual(splitTraceChunks(multiTraceInput), [
    repeatedJavascriptTrace,
    repeatedJavascriptTrace,
    repeatedPythonTrace
  ]);
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
});

test('digest renderers produce copy-ready text and markdown summaries', () => {
  const digest = analyzeTraceDigest(multiTraceInput);
  const text = renderDigestTextSummary(digest);
  const markdown = renderDigestMarkdownSummary(digest);

  assert.match(text, /Stack Sleuth Incident Digest/);
  assert.match(text, /Total traces: 3/);
  assert.match(text, /Unique incidents: 2/);
  assert.match(text, /2x javascript TypeError/);

  assert.match(markdown, /^# Stack Sleuth Incident Digest/m);
  assert.match(markdown, /- \*\*Total traces:\*\* 3/);
  assert.match(markdown, /## Incident 1 \(2 traces\)/);
  assert.match(markdown, /`javascript\|TypeError\|app\/src\/profile\.js:88\|nullish-data,undefined-property-access`/);
});

test('single valid trace produces a one-group digest', () => {
  const digest = analyzeTraceDigest(repeatedJavascriptTrace);

  assert.equal(digest.totalTraces, 1);
  assert.equal(digest.groupCount, 1);
  assert.equal(digest.groups[0].count, 1);
});
