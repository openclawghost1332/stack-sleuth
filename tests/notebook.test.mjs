import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseIncidentNotebook,
  renderNormalizedNotebookText,
  routeIncidentNotebook,
} from '../src/notebook.js';

const currentTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const historyTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

test('parseIncidentNotebook normalizes a single incident notebook into pack text', () => {
  const notebook = parseIncidentNotebook([
    '# Checkout incident notebook',
    '',
    '## Current incident',
    currentTrace,
    '',
    '## Prior incidents',
    '=== release-2026-04-15 ===',
    historyTrace,
  ].join('\n'));

  assert.equal(notebook.kind, 'pack');
  assert.deepEqual(notebook.sectionOrder, ['current', 'history']);
  assert.equal(renderNormalizedNotebookText(notebook), [
    '@@ current @@',
    currentTrace,
    '',
    '@@ history @@',
    '=== release-2026-04-15 ===',
    historyTrace,
  ].join('\n'));
});

test('parseIncidentNotebook normalizes grouped pack headings into portfolio text', () => {
  const notebook = parseIncidentNotebook([
    '# Pack: checkout-prod',
    '',
    '## Current incident',
    currentTrace,
    '',
    '# Pack: profile-rollout',
    '',
    '## Current incident',
    historyTrace,
    '',
    '## Prior incidents',
    '=== release-2026-04-15 ===',
    historyTrace,
  ].join('\n'));

  assert.equal(notebook.kind, 'portfolio');
  assert.deepEqual(notebook.packOrder, ['checkout-prod', 'profile-rollout']);
  assert.equal(renderNormalizedNotebookText(notebook), [
    '@@@ checkout-prod @@@',
    '@@ current @@',
    currentTrace,
    '',
    '@@@ profile-rollout @@@',
    '@@ current @@',
    historyTrace,
    '',
    '@@ history @@',
    '=== release-2026-04-15 ===',
    historyTrace,
  ].join('\n'));
});

test('parseIncidentNotebook reports unsupported heading notebooks with a human-readable reason', () => {
  const notebook = parseIncidentNotebook([
    '# Incident notes',
    '',
    '## Summary',
    'Checkout was noisy during deploy.',
    '',
    '## Mitigation ideas',
    'Try rolling back the feature flag.',
  ].join('\n'));

  assert.equal(notebook.kind, 'unsupported');
  assert.match(notebook.reason, /supported incident sections/i);
  assert.equal(renderNormalizedNotebookText(notebook), '');
});

test('routeIncidentNotebook chooses pack vs portfolio analyzers from parsed notebook output', () => {
  const calls = [];
  const analyzers = {
    pack(input) {
      calls.push({ mode: 'pack', input });
      return { mode: 'pack', input };
    },
    portfolio(input) {
      calls.push({ mode: 'portfolio', input });
      return { mode: 'portfolio', input };
    },
  };

  const packResult = routeIncidentNotebook({
    notebook: parseIncidentNotebook([
      '## Current incident',
      currentTrace,
    ].join('\n')),
    analyzers,
  });

  const portfolioResult = routeIncidentNotebook({
    notebook: parseIncidentNotebook([
      '# Pack: checkout-prod',
      '',
      '## Current incident',
      currentTrace,
    ].join('\n')),
    analyzers,
  });

  assert.equal(packResult.mode, 'pack');
  assert.equal(portfolioResult.mode, 'portfolio');
  assert.deepEqual(calls, [
    {
      mode: 'pack',
      input: ['@@ current @@', currentTrace].join('\n'),
    },
    {
      mode: 'portfolio',
      input: ['@@@ checkout-prod @@@', '@@ current @@', currentTrace].join('\n'),
    },
  ]);
});
