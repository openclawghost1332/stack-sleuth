import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHandoffBriefing,
  renderHandoffTextSummary,
  renderHandoffMarkdownSummary,
} from '../src/handoff.js';

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
  [sampleTrace, comparisonTrace].join('\n\n'),
  '',
  '=== profile-rewrite ===',
  sampleTrace,
].join('\n');

const portfolioInput = [
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
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  sampleTrace,
  '',
  '@@ candidate @@',
  [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
].join('\n');

test('buildHandoffBriefing merges owner packets and emits ownership and runbook gaps', () => {
  const report = buildHandoffBriefing(portfolioInput);

  assert.equal(report.summary.packCount, 3);
  assert.equal(report.summary.runnablePackCount, 3);
  assert.equal(report.summary.ownerPacketCount, 1);
  assert.equal(report.summary.gapPacketCount, 4);
  assert.equal(report.summary.packetCount, 5);
  assert.equal(report.ownerPackets[0].owner, 'web-platform');
  assert.deepEqual(report.ownerPackets[0].labels, ['profile-rollout']);
  assert.match(report.ownerPackets[0].fixes[0], /Guard renderProfile/);
  assert.deepEqual(report.gapPackets.map((packet) => `${packet.kind}:${packet.labels[0]}`), [
    'ownership-gap:checkout-prod',
    'runbook-gap:checkout-prod',
    'ownership-gap:billing-canary',
    'runbook-gap:billing-canary',
  ]);
  assert.match(report.summary.headline, /Prepared 5 handoff packets from 3 runnable packs/i);
  assert.match(report.exportText, /Owner: web-platform/);
  assert.match(report.exportText, /Gap: ownership/);
  assert.match(report.exportText, /Gap: runbook/);
  assert.match(report.exportText, /checkout-prod/);
});

test('handoff renderers stay copy ready in text and markdown', () => {
  const report = buildHandoffBriefing(portfolioInput);
  const text = renderHandoffTextSummary(report);
  const markdown = renderHandoffMarkdownSummary(report);

  assert.match(text, /Stack Sleuth Handoff Briefing/);
  assert.match(text, /Owner packets: 1/);
  assert.match(text, /Gap packets: 4/);
  assert.match(text, /web-platform/);
  assert.match(text, /Handoff packet export/);
  assert.match(markdown, /^# Stack Sleuth Handoff Briefing/m);
  assert.match(markdown, /## Owner packets/);
  assert.match(markdown, /## Gap packets/);
  assert.match(markdown, /```text/);
});
