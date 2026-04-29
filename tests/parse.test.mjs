import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrace } from '../src/parse.js';

test('detects JavaScript traces and selects the first app frame as culprit', () => {
  const report = parseTrace(`TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`);

  assert.equal(report.runtime, 'javascript');
  assert.equal(report.errorName, 'TypeError');
  assert.match(report.message, /Cannot read properties/);
  assert.equal(report.culpritFrame.functionName, 'renderProfile');
  assert.equal(report.culpritFrame.file, '/app/src/profile.js');
});

test('detects Python traces and selects the deepest project frame before the error line', () => {
  const report = parseTrace(`Traceback (most recent call last):\n  File "app.py", line 42, in <module>\n    run()\n  File "service.py", line 17, in run\n    return user["email"]\nKeyError: 'email'`);

  assert.equal(report.runtime, 'python');
  assert.equal(report.errorName, 'KeyError');
  assert.equal(report.culpritFrame.file, 'service.py');
  assert.equal(report.culpritFrame.line, 17);
});
