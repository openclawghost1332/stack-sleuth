import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeTraceDigest } from '../src/digest.js';
import { parseLabeledTraceBatches } from '../src/labeled.js';

test('README documents browser and CLI workflows, local development, and GitHub Pages', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Stack Sleuth/);
  assert.match(readme, /CLI/i);
  assert.match(readme, /Notebook ingest/i);
  assert.match(readme, /stack-sleuth\.js|stack-sleuth --json/i);
  assert.match(readme, /npm test/);
  assert.match(readme, /GitHub Pages/);
});

test('README documents notebook ingest workflows for browser and CLI', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Notebook ingest/i);
  assert.match(readme, /--notebook/);
  assert.match(readme, /## Current incident/i);
  assert.match(readme, /## Prior incidents/i);
  assert.match(readme, /normalize/i);
  assert.match(readme, /incident pack|portfolio/i);
});

test('README documents incident workspace intake for single folders and portfolio folders', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Incident Workspace/i);
  assert.match(readme, /--workspace/);
  assert.match(readme, /packs\/<label>\//i);
  assert.match(readme, /current\.log/);
  assert.match(readme, /history\.casebook/);
  assert.match(readme, /notebook\.md/);
});

test('README documents Incident Capsule intake for CLI-first capsule interop', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Incident Capsule/i);
  assert.match(readme, /--capsule/);
  assert.match(readme, /incident-capsule/i);
  assert.match(readme, /version[s]? `?1`? and `?2`?/i);
  assert.match(readme, /prefer(?:s)? .*content.*excerpt/i);
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

test('README documents Handoff Briefing workflows for browser and CLI handoff mode', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Handoff Briefing/i);
  assert.match(readme, /--handoff/);
  assert.match(readme, /owner packets|owner-specific handoff packets/i);
  assert.match(readme, /gap packets|ownership-gap|runbook-gap/i);
  assert.match(readme, /Load Handoff Briefing example/i);
  assert.match(readme, /Owner: web-platform/);
});

test('README documents Handoff Briefing workflows for browser and CLI owner packets', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Handoff Briefing/i);
  assert.match(readme, /--handoff/);
  assert.match(readme, /owner packets|owner-specific handoff packets/i);
  assert.match(readme, /routing gaps|runbook gaps/i);
  assert.match(readme, /Slack|ticket|shift/i);
});

test('README documents Casebook Forge workflows for browser and CLI reuse', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Casebook Forge/i);
  assert.match(readme, /--forge/);
  assert.match(readme, /=== label ===/);
  assert.match(readme, /--history|@@ history @@/);
  assert.match(readme, /reusable casebook|incident memory/i);
});

test('README documents Action Board workflows across live portfolios and saved response bundle artifacts', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Action Board/i);
  assert.match(readme, /--board/);
  assert.match(readme, /response-bundle\.json/i);
  assert.match(readme, /saved response bundle directory|response bundle directory/i);
  assert.match(readme, /routing gaps|runbook gaps/i);
});

test('README documents Casebook Dataset workflows for browser and CLI handoff', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Casebook Dataset/i);
  assert.match(readme, /--dataset/);
  assert.match(readme, /--replay-dataset/);
  assert.match(readme, /saved JSON blob|JSON artifact/i);
  assert.match(readme, /release gate/i);
  assert.match(readme, /exportText/i);
  assert.match(readme, /--history .*casebook-dataset\.json|casebook-dataset\.json/i);
  assert.match(readme, /paste a saved dataset JSON blob|saved dataset JSON/i);
  assert.match(readme, /unsupported version|supported version/i);
});

test('README documents Casebook Chronicle workflows for browser and CLI longitudinal replay', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Casebook Chronicle/i);
  assert.match(readme, /--chronicle/);
  assert.match(readme, /saved datasets|saved dataset snapshots/i);
  assert.match(readme, /=== release-a ===|=== canary ===/i);
  assert.match(readme, /release gate/i);
  assert.match(readme, /owner load|recurring hotspots|drift/i);
  assert.match(readme, /steward ledger|resurfaced|resolved backlog/i);
});

test('README documents Casebook Shelf workflows for browser and CLI snapshot shelves', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Casebook Shelf/i);
  assert.match(readme, /--shelf/);
  assert.match(readme, /--replay-shelf/);
  assert.match(readme, /top-level \.json files/i);
  assert.match(readme, /release gate/i);
  assert.match(readme, /invalid snapshots|warning entries/i);
  assert.match(readme, /saved-artifact note|does not recover raw traces/i);
});

test('README documents Casebook Merge workflows for browser and CLI living-casebook updates', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Casebook Merge/i);
  assert.match(readme, /--merge-casebook/);
  assert.match(readme, /living casebook|updated casebook|merge conflicts/i);
  assert.match(readme, /source-packs|seen-count/i);
});

test('README documents standalone HTML dossier export and the committed sample artifact', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Incident dossier|HTML dossier|standalone HTML/i);
  assert.match(readme, /--html/);
  assert.match(readme, /--pack .*--html|--portfolio .*--html|--notebook .*--html/i);
  assert.match(readme, /sample\/portfolio-dossier\.html/i);
  assert.match(readme, /phone-friendly|shareable|standalone/i);
});

test('README documents response bundle export and replay workflows, plus the committed sample bundle', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /response bundle/i);
  assert.match(readme, /--bundle/);
  assert.match(readme, /--replay-bundle/);
  assert.match(readme, /sample\/response-bundle/i);
  assert.match(readme, /response-bundle\.json/i);
  assert.match(readme, /manifest\.json/i);
  assert.match(readme, /incident-dossier\.html/i);
  assert.match(readme, /casebook-dataset\.json/i);
  assert.match(readme, /paste a saved response-bundle\.json|browser replay via pasted JSON/i);
  assert.match(readme, /legacy bundle directory compatibility|legacy version-1 bundle directory/i);
  assert.match(readme, /does not recover raw traces/i);
});

test('README documents response bundle chronicle workflows for CLI and browser', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Response Bundle Chronicle/i);
  assert.match(readme, /--bundle-chronicle/);
  assert.match(readme, /saved response bundle|response-bundle\.json/i);
  assert.match(readme, /=== release-a ===/i);
  assert.match(readme, /Load Response Bundle Chronicle example|paste the chronicle bundle/i);
  assert.match(readme, /bundle inventory|source workflow|release gate/i);
  assert.match(readme, /steward ledger|resurfaced|resolved backlog/i);
});

test('README documents Response Bundle Shelf workflows for deterministic top-level scanning and replay', () => {
  const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /Response Bundle Shelf/i);
  assert.match(readme, /--bundle-shelf/);
  assert.match(readme, /--replay-bundle-shelf/);
  assert.match(readme, /top-level response-bundle directories|top-level \.json files/i);
  assert.match(readme, /response-bundle\.json|manifest\.json/i);
  assert.match(readme, /invalid snapshots|warning entries/i);
  assert.match(readme, /saved-artifact note|does not recover raw traces/i);
  assert.match(readme, /Load Response Bundle Shelf example|paste a saved shelf JSON/i);
});

test('sample portfolio dossier artifact is committed as standalone HTML', () => {
  const sample = fs.readFileSync(new URL('../sample/portfolio-dossier.html', import.meta.url), 'utf8');
  assert.match(sample, /<!doctype html>/i);
  assert.match(sample, /Stack Sleuth Incident Dossier/i);
  assert.match(sample, /Portfolio Radar/i);
  assert.match(sample, /Handoff Briefing export/i);
});

test('sample response bundle artifact is committed with manifest, replay json, and dossier files', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../sample/response-bundle/manifest.json', import.meta.url), 'utf8'));
  const dossier = fs.readFileSync(new URL('../sample/response-bundle/incident-dossier.html', import.meta.url), 'utf8');
  const handoff = fs.readFileSync(new URL('../sample/response-bundle/handoff.md', import.meta.url), 'utf8');
  const replay = JSON.parse(fs.readFileSync(new URL('../sample/response-bundle/response-bundle.json', import.meta.url), 'utf8'));

  assert.equal(manifest.kind, 'stack-sleuth-response-bundle');
  assert.equal(manifest.version, 3);
  assert.match(dossier, /<!doctype html>/i);
  assert.match(handoff, /Stack Sleuth Handoff Briefing/i);
  assert.match(manifest.files.join('\n'), /action-board\.md/);
  assert.match(manifest.files.join('\n'), /casebook-dataset\.json/);
  assert.match(manifest.files.join('\n'), /response-bundle\.json/);
  assert.equal(replay.kind, 'stack-sleuth-response-bundle');
  assert.equal(replay.version, 3);
  assert.equal(replay.manifest.version, 3);
  assert.equal(typeof replay.artifacts['casebook-dataset.json'], 'string');
  assert.equal(replay.artifacts['response-bundle.json'], undefined);
});
