import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLabeledTraceBatches } from '../src/labeled.js';

const firstTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const secondTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

test('parseLabeledTraceBatches splits labeled trace batches, preserves order, and drops empty sections', () => {
  const batches = parseLabeledTraceBatches([
    '',
    '=== canary ===',
    firstTrace,
    '',
    '=== empty ===',
    '',
    '=== full-rollout ===',
    secondTrace,
    '',
  ].join('\n'));

  assert.deepEqual(batches.map((batch) => batch.label), ['canary', 'full-rollout']);
  assert.match(batches[0].traces, /renderProfile/);
  assert.match(batches[1].traces, /renderInvoice/);
});

test('parseLabeledTraceBatches normalizes CRLF input for copy-paste friendly batches', () => {
  const batches = parseLabeledTraceBatches([
    '=== first ===',
    firstTrace,
    '',
    '=== second ===',
    secondTrace,
  ].join('\r\n'));

  assert.equal(batches[0].label, 'first');
  assert.match(batches[0].traces, /\n    at updateView/);
  assert.doesNotMatch(batches[0].traces, /\r/);
  assert.equal(batches[1].label, 'second');
});
