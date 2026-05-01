import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCasebookSteward, compareStewardSnapshots } from '../src/steward.js';

test('buildCasebookSteward prioritizes conflicts before missing coverage actions', () => {
  const report = buildCasebookSteward({
    cases: [
      {
        label: 'checkout-null-name',
        signature: 'TypeError|profile.js|88',
        sourcePacks: ['checkout-prod', 'profile-rollout'],
        metadata: { owner: 'web-platform', 'seen-count': '2' },
        conflicts: [],
      },
      {
        label: 'billing-email-null',
        signature: 'TypeError|invoice.js|19',
        sourcePacks: ['billing-canary'],
        metadata: {},
        conflicts: ['owner conflict: web-platform vs finance-platform'],
      },
    ],
  });

  assert.equal(report.summary.caseCount, 2);
  assert.equal(report.summary.actionCount, 5);
  assert.equal(report.actions[0].kind, 'conflict');
  assert.equal(report.actions[1].kind, 'missing-owner');
  assert.match(report.summary.headline, /Casebook Steward found 5 action/i);
});

test('compareStewardSnapshots reports unavailable when either snapshot was reconstructed', () => {
  const previous = buildCasebookSteward({ cases: [] });
  const current = { ...buildCasebookSteward({ cases: [] }), preserved: false };

  assert.equal(compareStewardSnapshots(previous, current).direction, 'unavailable');
});
