import test from 'node:test';
import assert from 'node:assert/strict';
import { examples } from '../src/examples.js';

test('ships both JavaScript and Python example traces for the demo', () => {
  assert.ok(examples.length >= 2);
  assert.ok(examples.some((item) => item.label === 'JavaScript undefined property'));
  assert.ok(examples.some((item) => item.label === 'Python missing key'));
});
