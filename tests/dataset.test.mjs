import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCasebookDataset,
  inspectReplayDatasetInput,
  parseDatasetHistory,
  renderDatasetMarkdownSummary,
  renderDatasetTextSummary,
} from '../src/dataset.js';

const portfolioInput = `@@@ checkout-prod @@@
@@ current @@
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

@@@ profile-rollout @@@
@@ current @@
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

@@ history @@
=== release-2026-04-15 ===
>>> owner: web-platform
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)`;

test('buildCasebookDataset packages merge and portfolio signals into a reusable artifact', () => {
  const dataset = buildCasebookDataset(portfolioInput);

  assert.equal(dataset.kind, 'stack-sleuth-casebook-dataset');
  assert.equal(dataset.version, 1);
  assert.match(dataset.summary.headline, /Casebook Dataset captured/i);
  assert.equal(dataset.summary.packCount, 2);
  assert.equal(dataset.summary.runnablePackCount, 2);
  assert.ok(dataset.summary.mergedCaseCount >= 1);
  assert.equal(dataset.summary.conflictCount, 0);
  assert.equal(dataset.gate.verdict, 'hold');
  assert.ok(dataset.responseQueue.length >= 1);
  assert.ok(dataset.cases.length >= 1);
  assert.match(dataset.exportText, /^=== release-2026-04-15 ===/m);
});

test('parseDatasetHistory converts saved dataset json into labeled history batches', () => {
  const dataset = buildCasebookDataset(portfolioInput);
  const batches = parseDatasetHistory(JSON.stringify(dataset));

  assert.equal(batches[0].label, 'release-2026-04-15');
  assert.equal(batches[0].metadata.owner, 'web-platform');
  assert.match(batches[0].traces, /renderProfile/);
});

test('inspectReplayDatasetInput validates a saved dataset and returns a normalized replay payload', () => {
  const dataset = buildCasebookDataset(portfolioInput);

  const result = inspectReplayDatasetInput(JSON.stringify(dataset));

  assert.equal(result.valid, true);
  assert.equal(result.dataset.kind, 'stack-sleuth-casebook-dataset');
  assert.equal(result.dataset.version, 1);
  assert.equal(result.dataset.summary.ownerCount, 1);
  assert.equal(result.dataset.gate.verdict, 'hold');
  assert.equal(result.dataset.steward.preserved, true);
  assert.ok(result.dataset.steward.summary.actionCount >= 0);
  assert.ok(result.dataset.responseQueue.length >= 1);
  assert.ok(result.dataset.recurringHotspots.length >= 1);
  assert.match(result.dataset.exportText, /^=== release-2026-04-15 ===/m);
});

test('inspectReplayDatasetInput preserves stored steward state and reconstructs older datasets honestly', () => {
  const dataset = buildCasebookDataset(portfolioInput);
  delete dataset.steward;

  const replay = inspectReplayDatasetInput(JSON.stringify(dataset));

  assert.equal(replay.valid, true);
  assert.equal(replay.dataset.steward.preserved, false);
  assert.ok(replay.dataset.steward.summary.actionCount >= 0);
});

test('inspectReplayDatasetInput rejects unsupported dataset versions with the supported version number', () => {
  const dataset = buildCasebookDataset(portfolioInput);
  dataset.version = 99;

  const result = inspectReplayDatasetInput(dataset);

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'unsupported-version');
  assert.equal(result.supportedVersion, 1);
  assert.equal(result.parsed.version, 99);
});

test('shared dataset renderers include summary counts and reusable export text', () => {
  const dataset = buildCasebookDataset(portfolioInput);

  delete dataset.gate;
  const replay = inspectReplayDatasetInput(JSON.stringify(dataset));
  assert.equal(replay.valid, true);
  assert.equal(replay.dataset.gate.verdict, 'hold');

  const text = renderDatasetTextSummary(replay.dataset);
  const markdown = renderDatasetMarkdownSummary(replay.dataset);

  assert.match(text, /Stack Sleuth Casebook Dataset/);
  assert.match(text, /Response owners: 1/);
  assert.match(text, /Release gate: hold/i);
  assert.match(text, /Merged cases:/);
  assert.match(text, /Reusable casebook export/);
  assert.match(text, /Casebook Steward/);
  assert.match(text, /=== release-2026-04-15 ===/);

  assert.match(markdown, /^# Stack Sleuth Casebook Dataset/m);
  assert.match(markdown, /- \*\*Release gate:\*\* hold/i);
  assert.match(markdown, /- \*\*Response owners:\*\* 1/);
  assert.match(markdown, /## Casebook Steward/);
  assert.match(markdown, /## Reusable casebook export/);
  assert.match(markdown, /=== release-2026-04-15 ===/);
});
