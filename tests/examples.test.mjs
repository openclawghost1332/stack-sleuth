import test from 'node:test';
import assert from 'node:assert/strict';
import { examples } from '../src/examples.js';

test('ships both JavaScript and Python example traces for the demo', () => {
  assert.ok(examples.length >= 2);
  assert.ok(examples.some((item) => item.label === 'JavaScript undefined property'));
  assert.ok(examples.some((item) => item.label === 'Python missing key'));
});

test('examples expose distinct single-trace, digest, regression, and timeline demos', () => {
  const labels = examples.map((item) => item.label);

  assert.ok(labels.includes('JavaScript undefined property'));
  assert.ok(labels.includes('Python missing key'));
  assert.ok(labels.includes('Raw log excavation'));
  assert.ok(labels.includes('Repeated incident digest'));
  assert.ok(labels.includes('Regression radar'));
  assert.ok(labels.includes('Timeline radar'));

  const rawLogExample = examples.find((item) => item.label === 'Raw log excavation');
  assert.match(rawLogExample.caption, /raw log|excavat/i);
  assert.match(rawLogExample.trace, /INFO|ERROR/);

  const digestExample = examples.find((item) => item.label === 'Repeated incident digest');
  assert.match(digestExample.caption, /repeat/i);
  assert.match(digestExample.trace, /TypeError:/);
  assert.match(digestExample.trace, /KeyError:/);

  const regressionExample = examples.find((item) => item.label === 'Regression radar');
  assert.match(regressionExample.caption, /new|worse|regression/i);
  assert.match(regressionExample.baseline, /TypeError:|KeyError:/);
  assert.match(regressionExample.candidate, /TypeError:|KeyError:/);

  const timelineExample = examples.find((item) => item.label === 'Timeline radar');
  assert.match(timelineExample.caption, /timeline|rollout|snapshot/i);
  assert.match(timelineExample.timeline, /=== canary ===/);
  assert.match(timelineExample.timeline, /=== full-rollout ===/);
});
