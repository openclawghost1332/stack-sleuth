import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('browser copy invites pasting one or more traces for digesting', () => {
  assert.match(indexHtml, /Paste one or more stack traces/i);
  assert.match(indexHtml, /Stack trace or incident bundle/i);
  assert.match(indexHtml, /Paste one or more JavaScript, Python, or Ruby traces here/i);
  assert.match(indexHtml, />Explain trace\(s\)</i);
});
