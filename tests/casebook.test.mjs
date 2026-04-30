import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCasebook,
  renderCasebookTextSummary,
  renderCasebookMarkdownSummary,
} from '../src/casebook.js';

const profileTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const invoiceTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const alertTrace = `TypeError: Cannot read properties of undefined (reading 'title')
    at showAlert (/app/src/alerts/toast.js:11:4)
    at refreshAlerts (/app/src/alerts/index.js:5:2)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const dashboardTrace = `TypeError: Cannot read properties of undefined (reading 'id')
    at loadDashboard (/app/src/dashboard.js:14:9)
    at bootstrap (/app/src/index.js:3:1)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const currentNovelTrace = `ProfileHydrationError: Profile payload missing account metadata
    at renderProfileState (/app/src/profile.js:102:9)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const historicalProfileNeighbor = `ProfileHydrationError: Profile hydration returned an empty account shell
    at renderProfileState (/app/src/profile.js:111:9)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

test('analyzeCasebook classifies current incidents as known or novel and ranks historical cases deterministically', () => {
  const current = [profileTrace, invoiceTrace, currentNovelTrace].join('\n\n');
  const history = [
    '=== release-2026-04-15 ===',
    [profileTrace, invoiceTrace, alertTrace].join('\n\n'),
    '',
    '=== profile-rewrite ===',
    historicalProfileNeighbor,
    '',
    '=== alerts-only ===',
    alertTrace,
    '',
    '=== dashboard-only ===',
    dashboardTrace,
  ].join('\n');

  const casebook = analyzeCasebook({ current, history });
  const incidentsBySignature = new Map(casebook.incidents.map((incident) => [incident.signature, incident]));

  assert.deepEqual(casebook.summary, {
    currentTraceCount: 3,
    historicalCaseCount: 4,
    knownCount: 2,
    novelCount: 1,
    topCaseLabel: 'release-2026-04-15',
  });

  assert.equal(
    incidentsBySignature.get('javascript|TypeError|app/src/profile.js:88|nullish-data,undefined-property-access').classification,
    'known'
  );
  assert.deepEqual(
    incidentsBySignature.get('javascript|TypeError|app/src/profile.js:88|nullish-data,undefined-property-access').matchingCases,
    ['release-2026-04-15']
  );
  assert.equal(
    incidentsBySignature.get('javascript|TypeError|app/src/invoice.js:19|nullish-data,undefined-property-access').classification,
    'known'
  );
  assert.equal(
    incidentsBySignature.get('javascript|ProfileHydrationError|app/src/profile.js:102|generic-runtime-error').classification,
    'novel'
  );

  assert.deepEqual(
    casebook.historicalCases.map((entry) => ({
      label: entry.label,
      exact: entry.overlap.exactSignatureCount,
      paths: entry.overlap.culpritPathCount,
      tags: entry.overlap.diagnosisTagCount,
    })),
    [
      { label: 'release-2026-04-15', exact: 2, paths: 2, tags: 2 },
      { label: 'profile-rewrite', exact: 0, paths: 1, tags: 1 },
      { label: 'alerts-only', exact: 0, paths: 0, tags: 2 },
      { label: 'dashboard-only', exact: 0, paths: 0, tags: 2 },
    ]
  );

  assert.deepEqual(casebook.historicalCases[0].overlap.exactSignatures, [
    'javascript|TypeError|app/src/invoice.js:19|nullish-data,undefined-property-access',
    'javascript|TypeError|app/src/profile.js:88|nullish-data,undefined-property-access',
  ]);
  assert.deepEqual(casebook.historicalCases[1].overlap.culpritPaths, ['app/src/profile.js']);
  assert.deepEqual(casebook.historicalCases[2].overlap.diagnosisTags, ['nullish-data', 'undefined-property-access']);
});

test('renderCasebook helpers produce copy-ready text and markdown summaries', () => {
  const casebook = analyzeCasebook({
    current: [profileTrace, invoiceTrace, currentNovelTrace].join('\n\n'),
    history: [
      '=== release-2026-04-15 ===',
      [profileTrace, invoiceTrace, alertTrace].join('\n\n'),
      '',
      '=== profile-rewrite ===',
      historicalProfileNeighbor,
    ].join('\n'),
  });

  const text = renderCasebookTextSummary(casebook);
  const markdown = renderCasebookMarkdownSummary(casebook);

  assert.match(text, /Stack Sleuth Casebook Radar/);
  assert.match(text, /Current traces: 3/);
  assert.match(text, /Known incidents: 2/);
  assert.match(text, /Novel incidents: 1/);
  assert.match(text, /Closest historical cases: release-2026-04-15 \(exact 2, culprit paths 2, tags 2\), profile-rewrite \(exact 0, culprit paths 1, tags 1\)/);
  assert.match(text, /novel: javascript\|ProfileHydrationError\|app\/src\/profile\.js:102\|generic-runtime-error/);
  assert.match(text, /Known in: release-2026-04-15/);

  assert.match(markdown, /^# Stack Sleuth Casebook Radar/m);
  assert.match(markdown, /- \*\*Current traces:\*\* 3/);
  assert.match(markdown, /- \*\*Known incidents:\*\* 2/);
  assert.match(markdown, /## Closest historical cases/);
  assert.match(markdown, /- \*\*release-2026-04-15:\*\* exact 2, culprit paths 2, tags 2/);
  assert.match(markdown, /## Current incident classifications/);
  assert.match(markdown, /- \*\*Classification:\*\* novel/);
});
