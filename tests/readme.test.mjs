import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('README documents browser and CLI workflows, local development, and GitHub Pages', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Stack Sleuth/);
  assert.match(readme, /CLI/i);
  assert.match(readme, /stack-sleuth\.js|stack-sleuth --json/i);
  assert.match(readme, /npm test/);
  assert.match(readme, /GitHub Pages/);
});
