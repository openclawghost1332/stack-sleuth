import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKSPACE_FLEET_KIND,
  WORKSPACE_FLEET_VERSION,
  buildWorkspaceFleetArtifact,
  inspectReplayWorkspaceFleetInput,
  renderWorkspaceFleetMarkdownSummary,
  renderWorkspaceFleetTextSummary,
} from '../src/workspace-fleet.js';
import { analyzeIncidentPack } from '../src/briefing.js';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { parseIncidentNotebook, routeIncidentNotebook } from '../src/notebook.js';

const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'name')\n    at renderProfile (/app/src/profile.js:88:17)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;
const comparisonTrace = `TypeError: Cannot read properties of undefined (reading 'email')\n    at renderInvoice (/app/src/invoice.js:19:7)\n    at refreshBilling (/app/src/billing.js:57:3)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;
const casebookHistoryInput = [
  '=== release-2026-04-15 ===',
  [sampleTrace, comparisonTrace].join('\n\n'),
  '',
  '=== profile-rewrite ===',
  sampleTrace,
].join('\n');

function routeNotebookForTest(input) {
  const notebook = parseIncidentNotebook(input);
  return {
    notebook,
    routed: routeIncidentNotebook({
      notebook,
      analyzers: {
        pack(normalizedText) {
          return { mode: 'pack', report: analyzeIncidentPack(normalizedText) };
        },
        portfolio(normalizedText) {
          return { mode: 'portfolio', report: analyzeIncidentPortfolio(normalizedText) };
        },
      },
    }),
  };
}

test('inspectReplayWorkspaceFleetInput validates a saved fleet artifact and preserves ranked coordination signals', () => {
  const packWorkspace = {
    kind: 'pack',
    path: '/fleet/alpha-pack',
    recognizedFiles: ['current.log', 'history.casebook'],
    normalizedText: ['@@ current @@', sampleTrace, '', '@@ history @@', casebookHistoryInput].join('\n'),
  };
  const portfolioWorkspace = {
    kind: 'portfolio',
    path: '/fleet/bravo-portfolio',
    packOrder: ['checkout-prod', 'billing-canary'],
    packs: [],
    omittedPacks: [],
    normalizedText: [
      '@@@ checkout-prod @@@',
      '@@ current @@',
      [sampleTrace, sampleTrace].join('\n\n'),
      '',
      '@@@ billing-canary @@@',
      '@@ baseline @@',
      sampleTrace,
      '',
      '@@ candidate @@',
      [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
    ].join('\n'),
  };

  const artifact = buildWorkspaceFleetArtifact({
    directory: '/fleet',
    entries: [
      {
        label: 'alpha-pack',
        path: packWorkspace.path,
        workspace: packWorkspace,
        routed: { mode: 'pack', report: analyzeIncidentPack(packWorkspace.normalizedText) },
      },
      {
        label: 'bravo-portfolio',
        path: portfolioWorkspace.path,
        workspace: portfolioWorkspace,
        routed: { mode: 'portfolio', report: analyzeIncidentPortfolio(portfolioWorkspace.normalizedText) },
      },
    ],
  });

  const replay = inspectReplayWorkspaceFleetInput(JSON.stringify(artifact));
  assert.equal(replay.valid, true);
  assert.equal(replay.fleet.kind, WORKSPACE_FLEET_KIND);
  assert.equal(replay.fleet.version, WORKSPACE_FLEET_VERSION);
  assert.equal(replay.fleet.summary.validWorkspaceCount, 2);
  assert.equal(replay.fleet.rankings[0].label, 'bravo-portfolio');
  assert.equal(replay.fleet.rankings[0].routed.mode, 'portfolio');
  assert.equal(replay.fleet.rankings[0].coordination.responseOwnerCount, 0);
  assert.equal(replay.fleet.rankings[0].coordination.runnablePackCount, 2);
  assert.match(replay.fleet.rankings[0].summary.headline, /prioritize billing-canary first/i);
});

test('buildWorkspaceFleetArtifact sorts deterministically by priority score then workspace label', () => {
  const makePack = (label) => ({
    label,
    path: `/fleet/${label}`,
    workspace: {
      kind: 'pack',
      path: `/fleet/${label}`,
      recognizedFiles: ['current.log'],
      normalizedText: ['@@ current @@', sampleTrace].join('\n'),
    },
    routed: {
      mode: 'pack',
      report: analyzeIncidentPack(['@@ current @@', sampleTrace].join('\n')),
    },
  });

  const artifact = buildWorkspaceFleetArtifact({
    directory: '/fleet',
    entries: [makePack('zeta'), makePack('alpha'), makePack('mu')],
  });

  assert.deepEqual(artifact.rankings.map((entry) => entry.label), ['alpha', 'mu', 'zeta']);
});

test('buildWorkspaceFleetArtifact scores mixed workspace types with visible reasons', () => {
  const notebookPortfolioInput = [
    '# Pack: checkout-prod',
    '',
    '## Current incident',
    [sampleTrace, sampleTrace].join('\n\n'),
    '',
    '# Pack: billing-canary',
    '',
    '## Baseline',
    sampleTrace,
    '',
    '## Candidate',
    [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
  ].join('\n');
  const notebookRoute = routeNotebookForTest(notebookPortfolioInput);

  const packEntry = {
    label: 'solo-pack',
    path: '/fleet/solo-pack',
    workspace: {
      kind: 'pack',
      path: '/fleet/solo-pack',
      recognizedFiles: ['current.log'],
      normalizedText: ['@@ current @@', sampleTrace].join('\n'),
    },
    routed: {
      mode: 'pack',
      report: analyzeIncidentPack(['@@ current @@', sampleTrace].join('\n')),
    },
  };
  const notebookEntry = {
    label: 'notes-workspace',
    path: '/fleet/notes-workspace',
    workspace: {
      kind: 'notebook',
      path: '/fleet/notes-workspace',
      recognizedFiles: ['notebook.md'],
      input: notebookPortfolioInput,
    },
    notebook: notebookRoute.notebook,
    routed: notebookRoute.routed,
  };

  const artifact = buildWorkspaceFleetArtifact({
    directory: '/fleet',
    entries: [packEntry, notebookEntry],
  });

  assert.equal(artifact.rankings[0].label, 'notes-workspace');
  assert.equal(artifact.rankings[0].workspace.kind, 'notebook');
  assert.equal(artifact.rankings[0].routed.mode, 'portfolio');
  assert.match(artifact.rankings[0].priority.reasons.join(' '), /portfolio/i);
  assert.match(artifact.rankings[0].priority.reasons.join(' '), /2 runnable pack/i);
});

test('buildWorkspaceFleetArtifact preserves invalid workspace candidates as warnings when valid workspaces exist', () => {
  const artifact = buildWorkspaceFleetArtifact({
    directory: '/fleet',
    entries: [
      {
        label: 'valid-pack',
        path: '/fleet/valid-pack',
        workspace: {
          kind: 'pack',
          path: '/fleet/valid-pack',
          recognizedFiles: ['current.log'],
          normalizedText: ['@@ current @@', sampleTrace].join('\n'),
        },
        routed: {
          mode: 'pack',
          report: analyzeIncidentPack(['@@ current @@', sampleTrace].join('\n')),
        },
      },
      {
        label: 'broken-notes',
        path: '/fleet/broken-notes',
        warning: 'Supported filenames: current.log, notebook.md',
      },
    ],
  });

  assert.equal(artifact.summary.validWorkspaceCount, 1);
  assert.equal(artifact.summary.warningCount, 1);
  assert.equal(artifact.warnings[0].label, 'broken-notes');
  assert.match(artifact.warnings[0].warning, /supported filenames/i);
});

test('workspace fleet renderers stay honest about replay limits', () => {
  const artifact = buildWorkspaceFleetArtifact({
    directory: '/fleet',
    entries: [
      {
        label: 'valid-pack',
        path: '/fleet/valid-pack',
        workspace: {
          kind: 'pack',
          path: '/fleet/valid-pack',
          recognizedFiles: ['current.log'],
          normalizedText: ['@@ current @@', sampleTrace].join('\n'),
        },
        routed: {
          mode: 'pack',
          report: analyzeIncidentPack(['@@ current @@', sampleTrace].join('\n')),
        },
      },
    ],
  });

  const text = renderWorkspaceFleetTextSummary(artifact);
  const markdown = renderWorkspaceFleetMarkdownSummary(artifact);

  assert.match(text, /saved-artifact note: workspace fleet replay preserves normalized summaries and coordination signals only/i);
  assert.match(markdown, /saved-artifact note:\*\* workspace fleet replay preserves normalized summaries and coordination signals only/i);
  assert.doesNotMatch(text, /raw trace recovery/i);
  assert.doesNotMatch(markdown, /raw trace recovery/i);
});
