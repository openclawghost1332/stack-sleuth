import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCasebookSteward,
  compareStewardSnapshots,
  describeCasebookStewardHeadline,
  renderCasebookStewardMarkdown,
  renderCasebookStewardText,
} from '../src/steward.js';

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

test('buildCasebookSteward caps visible actions without undercounting the full backlog', () => {
  const report = buildCasebookSteward({
    cases: [
      {
        label: 'case-a',
        signature: 'sig-a',
        sourcePacks: ['pack-a'],
        metadata: {},
        conflicts: ['owner conflict'],
      },
      {
        label: 'case-b',
        signature: 'sig-b',
        sourcePacks: ['pack-b'],
        metadata: {},
        conflicts: ['runbook conflict'],
      },
      {
        label: 'case-c',
        signature: 'sig-c',
        sourcePacks: ['pack-c'],
        metadata: {},
        conflicts: [],
      },
    ],
  });

  assert.equal(report.actions.length, 5);
  assert.equal(report.summary.actionCount, 8);
  assert.equal(report.summary.urgentActionCount, 5);
  assert.match(report.summary.headline, /Casebook Steward found 8 actions across 3 cases\./i);
});

test('compareStewardSnapshots reports unavailable when either snapshot was reconstructed', () => {
  const previous = buildCasebookSteward({ cases: [] });
  const current = { ...buildCasebookSteward({ cases: [] }), preserved: false };

  assert.equal(compareStewardSnapshots(previous, current).direction, 'unavailable');
});

test('steward renderers disclose reconstructed stewardship honestly', () => {
  const reconstructed = { ...buildCasebookSteward({ cases: [] }), preserved: false };
  const text = renderCasebookStewardText(reconstructed);
  const markdown = renderCasebookStewardMarkdown(reconstructed);

  assert.match(describeCasebookStewardHeadline(reconstructed), /^Reconstructed Casebook Steward/i);
  assert.match(text, /Headline: Reconstructed Casebook Steward/i);
  assert.match(text, /Replay note: Stewardship was reconstructed from older dataset fields\./i);
  assert.match(markdown, /- \*\*Headline:\*\* Reconstructed Casebook Steward/i);
  assert.match(markdown, /- \*\*Replay note:\*\* Stewardship was reconstructed from older dataset fields\./i);
});
