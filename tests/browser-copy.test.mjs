import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('browser copy invites pasting one or more traces for digesting and comparing', () => {
  assert.match(indexHtml, /Paste one or more stack traces/i);
  assert.match(indexHtml, /Stack trace or incident bundle/i);
  assert.match(indexHtml, /Paste one or more JavaScript, Python, or Ruby traces here/i);
  assert.match(indexHtml, />Explain trace\(s\)</i);
  assert.match(indexHtml, /Regression Radar/i);
  assert.match(indexHtml, /Baseline incident batch/i);
  assert.match(indexHtml, /Candidate incident batch/i);
  assert.match(indexHtml, />Compare batches</i);
});
