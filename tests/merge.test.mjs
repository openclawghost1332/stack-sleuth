import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCasebookMerge,
  renderCasebookMergeTextSummary,
  renderCasebookMergeMarkdownSummary,
} from '../src/merge.js';

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
    '>>> summary: Checkout profile payload dropped account metadata before render',
    '>>> fix: Guard renderProfile before reading account.name',
    '>>> owner: web-platform',
    '>>> runbook: https://example.com/runbooks/profile-null',
    [profileTrace, invoiceTrace].join('\n\n'),
  ].join('\n'),
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  profileTrace,
  '',
  '@@ candidate @@',
  [profileTrace, profileTrace, invoiceTrace].join('\n\n'),
].join('\n');

const conflictFixture = [
  '@@@ profile-rollout @@@',
  '@@ current @@',
  profileTrace,
  '',
  '@@ history @@',
  [
    '=== release-2026-04-15 ===',
    '>>> owner: web-platform',
    profileTrace,
    '',
    '=== profile-ownership-dispute ===',
    '>>> owner: growth-platform',
    profileTrace,
  ].join('\n'),
].join('\n');

test('analyzeCasebookMerge preserves guidance, adds merge metadata, and creates new cases from portfolio evidence', () => {
  const report = analyzeCasebookMerge(portfolioFixture);

  assert.deepEqual(report.summary, {
    mergedCaseCount: 3,
    existingCaseCount: 2,
    newCaseCount: 1,
    updatedCaseCount: 2,
    historicalOnlyCaseCount: 0,
    conflictCount: 0,
    headline: 'Merged 3 casebook entries from 3 runnable packs, including 1 new case and 2 refreshed known cases.',
    reviewHeadline: 'No merge conflicts detected.',
  });
  assert.equal(report.cases[0].label, 'release-2026-04-15');
  assert.deepEqual(report.cases[0].metadata, {
    summary: 'Checkout profile payload dropped account metadata before render',
    fix: 'Guard renderProfile before reading account.name',
    owner: 'web-platform',
    runbook: 'https://example.com/runbooks/profile-null',
    'seen-count': '3',
    'source-packs': 'checkout-prod, profile-rollout, billing-canary',
  });
  assert.equal(report.cases[2].label, 'profile-js-generic-runtime-error');
  assert.match(report.cases[2].metadata.summary, /renderProfileState/i);
  assert.match(report.exportText, /^=== release-2026-04-15 ===/m);
  assert.match(report.exportText, /^>>> seen-count: 3$/m);
  assert.match(report.exportText, /^>>> source-packs: checkout-prod, profile-rollout, billing-canary$/m);
  assert.match(report.exportText, /^=== profile-js-generic-runtime-error ===/m);
});

test('analyzeCasebookMerge flags duplicate-signature guidance conflicts without dropping the merged export', () => {
  const report = analyzeCasebookMerge(conflictFixture);

  assert.equal(report.summary.conflictCount, 1);
  assert.match(report.summary.reviewHeadline, /1 conflicted case requires review/);
  assert.equal(report.cases[0].label, 'release-2026-04-15');
  assert.ok(report.cases[0].conflicts.some((conflict) => /owner conflict/i.test(conflict)));
  assert.match(report.exportText, /^=== release-2026-04-15 ===/m);
  assert.match(report.exportText, /^>>> owner: web-platform$/m);
});

test('renderCasebookMerge summaries are copy-ready', () => {
  const report = analyzeCasebookMerge(portfolioFixture);

  assert.match(renderCasebookMergeTextSummary(report), /Stack Sleuth Casebook Merge/);
  assert.match(renderCasebookMergeTextSummary(report), /Conflicts: 0/);
  assert.match(renderCasebookMergeMarkdownSummary(report), /^# Stack Sleuth Casebook Merge/m);
  assert.match(renderCasebookMergeMarkdownSummary(report), /- \*\*New cases:\*\* 1/);
  assert.match(renderCasebookMergeMarkdownSummary(report), /## Merge review/);
});
