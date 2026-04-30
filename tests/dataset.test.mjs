import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCasebookDataset, parseDatasetHistory } from '../src/dataset.js';

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
