import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeTraceDigest } from '../src/digest.js';
import { parseLabeledTraceBatches } from '../src/labeled.js';

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

test('README documents blast radius summaries for excavated logs', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /blast radius/i);
  assert.match(readme, /affected services/i);
  assert.match(readme, /first-seen|last-seen|window/i);
});

test('README documents casebook radar workflows for browser and CLI lookup mode', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Casebook Radar/i);
  assert.match(readme, /known versus novel|known-versus-novel/i);
  assert.match(readme, /--history/);
  assert.match(readme, /--current/);
  assert.match(readme, /=== release-2026-04-15 ===/);
  assert.match(readme, /prior incidents|incident memory|historical cases/i);
});

test('README casebook example preserves separate traces inside labeled history entries', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const casebookExample = readme.match(/Label each prior incident case[\s\S]*?```text\n([\s\S]*?)```/);

  assert.ok(casebookExample, 'expected a labeled Casebook Radar history example in README.md');

  const batches = parseLabeledTraceBatches(casebookExample[1]);
  assert.deepEqual(batches.map((batch) => batch.label), ['release-2026-04-15', 'profile-rewrite']);

  const profileRewriteDigest = analyzeTraceDigest(
    batches.find((batch) => batch.label === 'profile-rewrite')?.traces ?? ''
  );

  assert.equal(profileRewriteDigest.totalTraces, 2);
  assert.deepEqual(
    profileRewriteDigest.groups.map((group) => group.signature).sort(),
    [
      'javascript|TypeError|app/src/invoice.js:19|nullish-data,undefined-property-access',
      'javascript|TypeError|app/src/profile.js:88|nullish-data,undefined-property-access',
    ]
  );
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

test('README documents portfolio radar workflows for browser and CLI multi-pack mode', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Portfolio Radar/i);
  assert.match(readme, /--portfolio/);
  assert.match(readme, /@@@ checkout-prod @@@/);
  assert.match(readme, /response queue|owner-aware queue/i);
  assert.match(readme, /routing gaps|missing owners/i);
  assert.match(readme, /runbook gaps|missing runbooks/i);
  assert.match(readme, />>> owner: web-platform/);
  assert.match(readme, />>> runbook: https:\/\/example\.com\/runbooks\/profile-null/);
  assert.match(readme, /recurring incidents|cross-pack/i);
  assert.match(readme, /recurring hotspots|shared hotspots/i);
});

test('README documents Casebook Forge workflows for browser and CLI reuse', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Casebook Forge/i);
  assert.match(readme, /--forge/);
  assert.match(readme, /=== label ===/);
  assert.match(readme, /--history|@@ history @@/);
  assert.match(readme, /reusable casebook|incident memory/i);
});
