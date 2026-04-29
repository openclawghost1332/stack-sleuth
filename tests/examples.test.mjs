import test from 'node:test';
import assert from 'node:assert/strict';
import { examples } from '../src/examples.js';

test('ships both JavaScript and Python example traces for the demo', () => {
  assert.ok(examples.length >= 2);
  assert.ok(examples.some((item) => item.label === 'JavaScript undefined property'));
  assert.ok(examples.some((item) => item.label === 'Python missing key'));
});

test('examples expose distinct single-trace and multi-trace demos', () => {
  const labels = examples.map((item) => item.label);

  assert.ok(labels.includes('JavaScript undefined property'));
  assert.ok(labels.includes('Python missing key'));
  assert.ok(labels.includes('Repeated incident digest'));

  const digestExample = examples.find((item) => item.label === 'Repeated incident digest');
  assert.match(digestExample.caption, /repeat/i);
  assert.match(digestExample.trace, /TypeError:/);
  assert.match(digestExample.trace, /KeyError:/);
});
