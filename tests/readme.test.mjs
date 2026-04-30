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

test('README documents browser and CLI workflows, including incident digest mode', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Incident Digest/i);
  assert.match(readme, /raw logs|raw-log/i);
  assert.match(readme, /excavat/i);
  assert.match(readme, /Suspect hotspots/i);
  assert.match(readme, /--digest/);
  assert.match(readme, /multiple traces|repeated traces/i);
});

test('README documents regression radar workflows for browser and CLI compare mode', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Regression Radar/i);
  assert.match(readme, /Hotspot shifts/i);
  assert.match(readme, /--baseline/);
  assert.match(readme, /--candidate/);
  assert.match(readme, /baseline and candidate/i);
});

test('README documents timeline radar workflows for browser and CLI timeline mode', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Timeline Radar/i);
  assert.match(readme, /--timeline/);
  assert.match(readme, /=== canary ===/);
  assert.match(readme, /raw logs/i);
  assert.match(readme, /labeled snapshots|rollout snapshots/i);
});
