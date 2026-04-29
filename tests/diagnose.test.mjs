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

test('maps missing-key failures to a deterministic missing-key diagnosis', () => {
  const result = diagnoseTrace({
    runtime: 'ruby',
    errorName: 'KeyError',
    message: 'key not found: "customer_id"',
    culpritFrame: {
      functionName: 'fetch_customer',
      file: 'app/services/customer_loader.rb',
      line: 31,
      column: null
    },
    frames: []
  });

  assert.equal(result.confidence, 'high');
  assert.deepEqual(result.tags, ['missing-key']);
  assert.match(result.summary, /missing/i);
  assert.match(result.summary, /fetch_customer/);
  assert.match(result.checklist.join(' '), /expected key|fallback|container contents/i);
});

test('maps nil receiver method calls to a deterministic nil diagnosis', () => {
  const result = diagnoseTrace({
    runtime: 'ruby',
    errorName: 'NoMethodError',
    message: "undefined method `email' for nil:NilClass",
    culpritFrame: {
      functionName: 'deliver!',
      file: 'app/mailers/invite_mailer.rb',
      line: 18,
      column: null
    },
    frames: []
  });

  assert.equal(result.confidence, 'high');
  assert.ok(result.tags.includes('nullish-data'));
  assert.ok(result.tags.includes('nil-receiver'));
  assert.match(result.summary, /nil/i);
  assert.match(result.summary, /deliver!/);
  assert.match(result.checklist.join(' '), /presence checks|upstream record|populate the receiver/i);
});

test('maps module import failures to a deterministic dependency diagnosis', () => {
  const result = diagnoseTrace({
    runtime: 'node',
    errorName: 'Error',
    message: "Cannot find module './worker.js'",
    culpritFrame: {
      functionName: 'boot',
      file: '/srv/app/src/index.js',
      line: 4,
      column: 9
    },
    frames: []
  });

  assert.equal(result.confidence, 'medium');
  assert.deepEqual(result.tags, ['module-import-failure']);
  assert.match(result.summary, /could not load a module/i);
  assert.match(result.summary, /boot/);
  assert.match(result.checklist.join(' '), /import or require path|dependency is installed|omitted files/i);
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
