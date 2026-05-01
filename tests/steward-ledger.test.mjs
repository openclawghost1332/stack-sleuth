import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeStewardLedger,
  renderStewardLedgerMarkdown,
  renderStewardLedgerText,
} from '../src/steward-ledger.js';

test('analyzeStewardLedger classifies active, carried, resurfaced, and resolved actions across labeled snapshots', () => {
  const report = analyzeStewardLedger([
    {
      label: 'release-a',
      steward: {
        preserved: true,
        actions: [
          buildAction('missing-runbook', 'profile-js', 'sig-profile', 1, 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.', ['pack-a']),
          buildAction('missing-owner', 'billing-js', 'sig-billing', 1, 'Assign an owner for billing-js.', 'Capture an owner for billing-js.', ['pack-a']),
        ],
      },
    },
    {
      label: 'release-b',
      steward: {
        preserved: true,
        actions: [
          buildAction('missing-runbook', 'profile-js', 'sig-profile', 2, 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.', ['pack-b']),
          buildAction('missing-fix', 'search-js', 'sig-search', 1, 'Document the fix for search-js.', 'Capture the fix for search-js.', ['pack-b']),
        ],
      },
    },
    {
      label: 'release-c',
      steward: {
        preserved: true,
        actions: [
          buildAction('missing-owner', 'billing-js', 'sig-billing', 2, 'Assign an owner for billing-js.', 'Capture an owner for billing-js.', ['pack-c']),
          buildAction('missing-fix', 'search-js', 'sig-search', 1, 'Document the fix for search-js.', 'Capture the fix for search-js.', ['pack-c']),
        ],
      },
    },
  ]);

  assert.equal(report.summary.snapshotCount, 3);
  assert.equal(report.summary.activeActionCount, 2);
  assert.equal(report.summary.newActionCount, 0);
  assert.equal(report.summary.carriedActionCount, 1);
  assert.equal(report.summary.resurfacedActionCount, 1);
  assert.equal(report.summary.resolvedActionCount, 1);
  assert.equal(report.summary.latestLabel, 'release-c');
  assert.equal(report.summary.nextAction, 'Capture an owner for billing-js.');
  assert.equal(report.activeActions[0].trend, 'resurfaced');
  assert.equal(report.activeActions[0].key, 'missing-owner|sig-billing');
  assert.equal(report.activeActions[0].streak, 1);
  assert.deepEqual(report.activeActions[0].activeLabels, ['release-a', 'release-c']);
  assert.equal(report.activeActions[1].trend, 'carried');
  assert.equal(report.activeActions[1].streak, 2);
  assert.equal(report.resolvedActions[0].trend, 'resolved');
  assert.equal(report.resolvedActions[0].lastSeenLabel, 'release-b');

  const text = renderStewardLedgerText(report);
  const markdown = renderStewardLedgerMarkdown(report);
  assert.match(text, /Stack Sleuth Steward Ledger/);
  assert.match(text, /Current stewardship backlog/);
  assert.match(text, /Recently resolved actions/);
  assert.match(text, /resurfaced, streak 1, billing-js/i);
  assert.match(markdown, /^## Steward Ledger/m);
  assert.match(markdown, /### Current stewardship backlog/);
  assert.match(markdown, /recently resolved actions/i);
});

test('analyzeStewardLedger discloses reconstructed snapshots without hiding the backlog', () => {
  const report = analyzeStewardLedger([
    {
      label: 'release-a',
      steward: {
        preserved: false,
        actions: [
          buildAction('missing-runbook', 'profile-js', 'sig-profile', 1, 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.', ['pack-a']),
        ],
      },
    },
    {
      label: 'release-b',
      steward: {
        preserved: true,
        actions: [
          buildAction('missing-runbook', 'profile-js', 'sig-profile', 1, 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.', ['pack-b']),
        ],
      },
    },
  ]);

  assert.equal(report.summary.hasReconstructedSnapshot, true);
  assert.equal(report.summary.activeActionCount, 1);
  assert.match(report.summary.headline, /reconstructed stewardship detail/i);
  assert.match(renderStewardLedgerText(report), /Trend confidence: limited/i);
});

function buildAction(kind, label, signature, seenCount, headline, ask, sourcePacks) {
  return {
    kind,
    label,
    signature,
    seenCount,
    sourcePacks,
    priority: 100,
    headline,
    ask,
  };
}
