import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeIncidentPortfolio,
  parseIncidentPortfolio,
  renderIncidentPortfolioMarkdownSummary,
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

const annotatedHistory = [
  '=== release-2026-04-15 ===',
  '>>> summary: Checkout profile payload dropped account metadata before render',
  '>>> fix: Guard renderProfile before reading account.name',
  '>>> owner: web-platform',
  '>>> runbook: https://example.com/runbooks/profile-null',
  sampleTrace,
  '',
  '=== billing-outage ===',
  comparisonTrace,
].join('\n');

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

const portfolioFixtureWithOwners = [
  '@@@ checkout-prod @@@',
  '@@ current @@',
  [sampleTrace, sampleTrace].join('\n\n'),
  '',
  '@@@ profile-rollout @@@',
  '@@ current @@',
  [sampleTrace, profileHydrationTrace].join('\n\n'),
  '',
  '@@ history @@',
  annotatedHistory,
].join('\n');

const queueOrderingFixture = [
  '@@@ zzz-first-pack @@@',
  '@@ current @@',
  sampleTrace,
  '',
  '@@ history @@',
  [
    '=== zzz-first-case ===',
    '>>> owner: zzz-team',
    sampleTrace,
  ].join('\n'),
  '',
  '@@@ aaa-second-pack @@@',
  '@@ current @@',
  sampleTrace,
  '',
  '@@ history @@',
  [
    '=== aaa-second-case ===',
    '>>> owner: aaa-team',
    sampleTrace,
  ].join('\n'),
].join('\n');

const multiGuidanceFixture = [
  '@@@ first-owner-pack @@@',
  '@@ current @@',
  sampleTrace,
  '',
  '@@ history @@',
  [
    '=== first-owner-case ===',
    '>>> summary: First summary',
    '>>> fix: First fix',
    '>>> owner: web-platform',
    '>>> runbook: https://example.com/runbooks/first',
    sampleTrace,
  ].join('\n'),
  '',
  '@@@ second-owner-pack @@@',
  '@@ current @@',
  sampleTrace,
  '',
  '@@ history @@',
  [
    '=== second-owner-case ===',
    '>>> summary: Second summary',
    '>>> fix: Second fix',
    '>>> owner: web-platform',
    '>>> runbook: https://example.com/runbooks/second',
    sampleTrace,
  ].join('\n'),
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
  assert.equal(report.summary.totalNovelIncidents, 1);
  assert.equal(report.summary.totalRegressionNew, 1);
  assert.ok(report.priorityQueue[0].priorityReasons.length > 0);
  assert.ok(report.recurringIncidents.some((item) => item.packCount >= 2));
  assert.ok(report.recurringHotspots.some((item) => item.packCount >= 2));
  assert.match(renderIncidentPortfolioTextSummary(report), /Stack Sleuth Portfolio Radar/);
  assert.match(renderIncidentPortfolioMarkdownSummary(report), /^# Stack Sleuth Portfolio Radar/m);
});

test('analyzeIncidentPortfolio degrades gracefully for malformed or unrunnable packs', () => {
  const report = analyzeIncidentPortfolio(portfolioFixture);
  const malformedPack = report.packReports.find((item) => item.label === 'malformed-pack');

  assert.equal(malformedPack.runnable, false);
  assert.match(malformedPack.summary.headline, /No runnable analyses/i);
  assert.match(malformedPack.priorityReasons[0], /needs a current section/i);
  assert.equal(report.summary.unrunnablePackCount, 1);
});

test('analyzeIncidentPortfolio builds a response queue from recalled casebook guidance', () => {
  const report = analyzeIncidentPortfolio(portfolioFixtureWithOwners);

  assert.equal(report.summary.ownedPackCount, 1);
  assert.equal(report.summary.unownedPackCount, 1);
  assert.equal(report.summary.runbookCoveredPackCount, 1);
  assert.equal(report.summary.runbookGapCount, 1);
  assert.equal(report.responseQueue[0].owner, 'web-platform');
  assert.deepEqual(report.responseQueue[0].labels, ['profile-rollout']);
  assert.match(report.responseQueue[0].guidance[0].fix, /Guard renderProfile/);
  assert.deepEqual(report.runbookGaps.map((item) => item.label), ['checkout-prod']);
  assert.deepEqual(report.unownedPacks.map((item) => item.label), ['checkout-prod']);
});

test('portfolio renderers include response queue and routing gaps', () => {
  const report = analyzeIncidentPortfolio(portfolioFixtureWithOwners);
  const text = renderIncidentPortfolioTextSummary(report);
  const markdown = renderIncidentPortfolioMarkdownSummary(report);

  assert.match(text, /Response queue/);
  assert.match(text, /web-platform/);
  assert.match(text, /Routing gaps/);
  assert.match(markdown, /## Response queue/);
  assert.match(markdown, /## Routing gaps/);
});

test('response queue ordering follows the main priority queue when packs tie', () => {
  const report = analyzeIncidentPortfolio(queueOrderingFixture);

  assert.deepEqual(report.priorityQueue.map((item) => item.label), ['zzz-first-pack', 'aaa-second-pack']);
  assert.deepEqual(report.responseQueue.map((item) => item.owner), ['zzz-team', 'aaa-team']);
});

test('response queue rendering preserves multiple recalled summaries, fixes, and runbooks', () => {
  const report = analyzeIncidentPortfolio(multiGuidanceFixture);
  const text = renderIncidentPortfolioTextSummary(report);
  const markdown = renderIncidentPortfolioMarkdownSummary(report);

  assert.equal(report.responseQueue.length, 1);
  assert.match(text, /First summary \| Second summary/);
  assert.match(text, /First fix \| Second fix/);
  assert.match(text, /runbooks\/first \| https:\/\/example\.com\/runbooks\/second/);
  assert.match(markdown, /First summary \\| Second summary/);
  assert.match(markdown, /First fix \\| Second fix/);
});
