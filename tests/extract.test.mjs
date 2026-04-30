import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTraceSet } from '../src/extract.js';

const noisyLog = [
  '2026-04-30T01:00:00Z INFO api boot complete',
  "2026-04-30T01:00:01Z ERROR web TypeError: Cannot read properties of undefined (reading 'name')",
  '2026-04-30T01:00:01Z ERROR web     at renderProfile (/app/src/profile.js:88:17)',
  '2026-04-30T01:00:01Z ERROR web     at updateView (/app/src/view.js:42:5)',
  '2026-04-30T01:00:02Z WARN worker heartbeat lagging',
  '2026-04-30T01:00:03Z ERROR worker Traceback (most recent call last):',
  '2026-04-30T01:00:03Z ERROR worker   File "service.py", line 17, in run',
  '2026-04-30T01:00:03Z ERROR worker     return user["email"]',
  "2026-04-30T01:00:03Z ERROR worker KeyError: 'email'"
].join('\n');

const cleanTrace = `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)`;

test('extractTraceSet excavates JavaScript and Python traces from noisy logs', () => {
  const result = extractTraceSet(noisyLog);

  assert.equal(result.mode, 'extracted');
  assert.equal(result.traceCount, 2);
  assert.ok(result.ignoredLineCount >= 2);
  assert.match(result.traces[0], /^TypeError:/);
  assert.match(result.traces[0], /renderProfile/);
  assert.match(result.traces[1], /^Traceback \(most recent call last\):/);
  assert.match(result.traces[1], /KeyError: 'email'/);
});

test('extractTraceSet preserves clean traces as direct input', () => {
  const result = extractTraceSet(cleanTrace);

  assert.equal(result.mode, 'direct');
  assert.equal(result.traceCount, 1);
  assert.equal(result.ignoredLineCount, 0);
  assert.deepEqual(result.traces, [cleanTrace]);
});

test('extractTraceSet preserves service and timestamp context for excavated traces', () => {
  const extraction = extractTraceSet([
    "2026-04-30T03:00:00Z ERROR web TypeError: Cannot read properties of undefined (reading 'name')",
    '2026-04-30T03:00:00Z ERROR web     at renderProfile (/app/src/profile.js:88:17)',
    "2026-04-30T03:00:04Z ERROR billing TypeError: Cannot read properties of undefined (reading 'email')",
    '2026-04-30T03:00:04Z ERROR billing     at renderInvoice (/app/src/invoice.js:19:7)'
  ].join('\n'));

  assert.equal(extraction.entries.length, 2);
  assert.deepEqual(extraction.entries[0].context.services, ['web']);
  assert.equal(extraction.entries[0].context.firstSeen, '2026-04-30T03:00:00.000Z');
  assert.deepEqual(extraction.entries[1].context.services, ['billing']);
  assert.equal(extraction.entries[1].context.lastSeen, '2026-04-30T03:00:04.000Z');
});

test('extractTraceSet keeps direct traces additive and context-free', () => {
  const extraction = extractTraceSet(cleanTrace);

  assert.equal(extraction.mode, 'direct');
  assert.equal(extraction.entries[0].context.firstSeen, null);
  assert.deepEqual(extraction.entries[0].context.services, []);
});

test('extractTraceSet does not hallucinate traces from random chatter', () => {
  const result = extractTraceSet([
    '2026-04-30T01:00:00Z INFO api boot complete',
    '2026-04-30T01:00:02Z WARN worker heartbeat lagging',
    'request finished in 27ms status=200',
  ].join('\n'));

  assert.equal(result.mode, 'extracted');
  assert.equal(result.traceCount, 0);
  assert.equal(result.traces.length, 0);
});
