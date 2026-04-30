import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeIncidentPack,
  renderIncidentPackMarkdownSummary,
  renderIncidentPackTextSummary,
} from '../src/briefing.js';

const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;
const comparisonTrace = `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;
const profileHydrationTrace = `ProfileHydrationError: Profile payload missing account metadata\n    at renderProfileState (/app/src/profile.js:102:9)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const fullPackInput = [
  '@@ current @@',
  [sampleTrace, profileHydrationTrace].join('\n\n'),
  '',
  '@@ history @@',
  [
    '=== release-2026-04-15 ===',
    [sampleTrace, comparisonTrace].join('\n\n'),
    '',
    '=== profile-rewrite ===',
    sampleTrace,
  ].join('\n'),
  '',
  '@@ baseline @@',
  sampleTrace,
  '',
  '@@ candidate @@',
  [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
  '',
  '@@ timeline @@',
  [
    '=== canary ===',
    sampleTrace,
    '',
    '=== partial ===',
    [sampleTrace, sampleTrace].join('\n\n'),
    '',
    '=== full-rollout ===',
    [sampleTrace, comparisonTrace].join('\n\n'),
  ].join('\n'),
].join('\n');

test('analyzeIncidentPack composes current, casebook, regression, and timeline analyses from one full pack', () => {
  const report = analyzeIncidentPack(fullPackInput);

  assert.deepEqual(report.availableAnalyses, ['current', 'casebook', 'regression', 'timeline']);
  assert.equal(report.currentDigest.groupCount, 2);
  assert.equal(report.casebook.summary.knownCount, 1);
  assert.equal(report.casebook.summary.novelCount, 1);
  assert.equal(report.regression.summary.newCount, 1);
  assert.equal(report.regression.summary.volumeUpCount, 1);
  assert.equal(report.timeline.summary.newCount, 1);
  assert.equal(report.summary.headline, 'Casebook Radar flagged 1 novel incident in the current batch.');
  assert.match(report.summary.topFindings[0], /novel incident/i);
  assert.deepEqual(report.omissions, []);
});

test('renderIncidentPack summaries stay copy-ready in text and markdown', () => {
  const report = analyzeIncidentPack(fullPackInput);
  const text = renderIncidentPackTextSummary(report);
  const markdown = renderIncidentPackMarkdownSummary(report);

  assert.match(text, /Stack Sleuth Incident Pack Briefing/);
  assert.match(text, /Available analyses: current, casebook, regression, timeline/);
  assert.match(text, /Primary headline: Casebook Radar flagged 1 novel incident in the current batch\./);
  assert.match(markdown, /^# Stack Sleuth Incident Pack Briefing/m);
  assert.match(markdown, /- \*\*Available analyses:\*\* current, casebook, regression, timeline/);
  assert.match(markdown, /## Key findings/);
});

test('analyzeIncidentPack degrades gracefully for partial packs and nested section problems', () => {
  const report = analyzeIncidentPack([
    '@@ current @@',
    sampleTrace,
    '',
    '@@ timeline @@',
    '=== canary ===',
    sampleTrace,
  ].join('\n'));

  assert.deepEqual(report.availableAnalyses, ['current']);
  assert.equal(report.currentDigest.groupCount, 1);
  assert.equal(report.timeline, null);
  assert.match(report.summary.headline, /Current digest found 1 incident group across 1 trace/);
  assert.deepEqual(report.omissions, [
    'Timeline section needs at least two labeled snapshots before Timeline Radar can run.'
  ]);
});
