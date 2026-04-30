import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeIncidentPortfolio,
  parseIncidentPortfolio,
  renderIncidentPortfolioTextSummary,
} from '../src/portfolio.js';

const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const comparisonTrace = `TypeError: Cannot read properties of undefined (reading 'email')
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
  [sampleTrace, sampleTrace].join('\n\n'),
  '',
  '@@@ profile-rollout @@@',
  '@@ current @@',
  [sampleTrace, profileHydrationTrace].join('\n\n'),
  '',
  '@@ history @@',
  [
    '=== release-2026-04-15 ===',
    sampleTrace,
    '',
    '=== billing-outage ===',
    comparisonTrace,
  ].join('\n'),
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  sampleTrace,
  '',
  '@@ candidate @@',
  [sampleTrace, comparisonTrace].join('\n\n'),
  '',
  '@@@ malformed-pack @@@',
  '@@ history @@',
  sampleTrace,
].join('\n');

test('parseIncidentPortfolio splits @@@ label @@@ blocks and preserves labels', () => {
  const portfolio = parseIncidentPortfolio([
    '@@@ checkout-prod @@@',
    '@@ current @@',
    'TypeError: Cannot read properties of undefined (reading \'email\')',
    '    at renderInvoice (/app/src/invoice.js:19:7)',
    '',
    '@@@ profile-rollout @@@',
    '@@ current @@',
    'ProfileHydrationError: Profile payload missing account metadata',
  ].join('\n'));

  assert.deepEqual(portfolio.packOrder, ['checkout-prod', 'profile-rollout']);
  assert.match(portfolio.packs[0].content, /@@ current @@/);
});

test('analyzeIncidentPortfolio ranks runnable packs and reports recurring incidents', () => {
  const report = analyzeIncidentPortfolio(portfolioFixture);

  assert.equal(report.summary.runnablePackCount, 3);
  assert.equal(report.priorityQueue[0].label, 'profile-rollout');
  assert.match(report.summary.headline, /profile-rollout/);
  assert.ok(report.priorityQueue[0].priorityReasons.length > 0);
  assert.ok(report.recurringIncidents.some((item) => item.packCount >= 2));
  assert.match(renderIncidentPortfolioTextSummary(report), /Stack Sleuth Portfolio Radar/);
});

test('analyzeIncidentPortfolio degrades gracefully for malformed or unrunnable packs', () => {
  const report = analyzeIncidentPortfolio(portfolioFixture);
  const malformedPack = report.packReports.find((item) => item.label === 'malformed-pack');

  assert.equal(malformedPack.runnable, false);
  assert.match(malformedPack.summary.headline, /No runnable analyses/i);
  assert.match(malformedPack.priorityReasons[0], /needs a current section/i);
  assert.equal(report.summary.unrunnablePackCount, 1);
});
