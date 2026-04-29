import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseTrace } from '../src/diagnose.js';

test('maps undefined-property failures to a high-confidence null-check diagnosis', () => {
  const result = diagnoseTrace({
    runtime: 'javascript',
    errorName: 'TypeError',
    message: "Cannot read properties of undefined (reading 'name')",
    culpritFrame: {
      functionName: 'renderProfile',
      file: '/app/src/profile.js',
      line: 88,
      column: 17
    },
    frames: []
  });

  assert.equal(result.confidence, 'high');
  assert.ok(result.tags.includes('nullish-data'));
  assert.match(result.summary, /undefined/);
  assert.match(result.checklist.join(' '), /payload|guard|log/i);
});

test('marks generic runtime failures as lower confidence when signal is weak', () => {
  const result = diagnoseTrace({
    runtime: 'ruby',
    errorName: 'RuntimeError',
    message: 'unexpected failure',
    culpritFrame: {
      functionName: 'sync!',
      file: 'worker.rb',
      line: 12,
      column: null
    },
    frames: []
  });

  assert.equal(result.confidence, 'medium');
  assert.ok(result.tags.includes('generic-runtime-error'));
  assert.match(result.summary, /inspect the failing inputs/i);
});
