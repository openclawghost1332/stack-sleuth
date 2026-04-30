import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCasebookForge,
  renderCasebookForgeTextSummary,
  renderCasebookForgeMarkdownSummary,
} from '../src/forge.js';

const profileTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const invoiceTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const profileHydrationTrace = `ProfileHydrationError: Profile payload missing account metadata
    at renderProfileState (/app/src/profile.js:102:9)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const alternateProfileTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderProfileCard (/app/src/profile.js:144:11)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const portfolioFixture = [
  '@@@ checkout-prod @@@',
  '@@ current @@',
  [profileTrace, profileTrace].join('\n\n'),
  '',
  '@@@ profile-rollout @@@',
  '@@ current @@',
  [profileTrace, profileHydrationTrace].join('\n\n'),
  '',
  '@@ history @@',
  [
    '=== release-2026-04-15 ===',
    [profileTrace, invoiceTrace].join('\n\n'),
    '',
    '=== profile-rewrite ===',
    profileTrace,
  ].join('\n'),
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  profileTrace,
  '',
  '@@ candidate @@',
  [profileTrace, profileTrace, invoiceTrace].join('\n\n'),
].join('\n');

const collisionFixture = [
  '@@@ profile-collision @@@',
  '@@ current @@',
  [profileTrace, alternateProfileTrace].join('\n\n'),
].join('\n');

test('analyzeCasebookForge deduplicates recurring signatures across packs and reuses known labels when possible', () => {
  const report = analyzeCasebookForge(portfolioFixture);

  assert.equal(report.summary.caseCount, 3);
  assert.equal(report.summary.runnablePackCount, 3);
  assert.equal(report.cases[0].label, 'release-2026-04-15');
  assert.ok(report.cases[0].sourcePacks.length >= 2);
  assert.match(report.exportText, /^=== release-2026-04-15 ===/m);
  assert.equal(report.cases[0].sourcePacks[0], 'checkout-prod');
});

test('analyzeCasebookForge creates deterministic fallback labels and disambiguates collisions', () => {
  const report = analyzeCasebookForge(collisionFixture);

  assert.equal(report.cases[0].label, 'profile-js-nullish-data');
  assert.equal(report.cases[1].label, 'profile-js-nullish-data-2');
});

test('render helpers return copy-ready summaries', () => {
  const report = analyzeCasebookForge(portfolioFixture);

  assert.match(renderCasebookForgeTextSummary(report), /Stack Sleuth Casebook Forge/);
  assert.match(renderCasebookForgeTextSummary(report), /Reusable cases: 3/);
  assert.match(renderCasebookForgeMarkdownSummary(report), /^# Stack Sleuth Casebook Forge/m);
  assert.match(renderCasebookForgeMarkdownSummary(report), /## Forged cases/);
});
