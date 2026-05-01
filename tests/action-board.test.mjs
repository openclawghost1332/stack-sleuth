import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { buildCasebookDataset, inspectReplayDatasetInput } from '../src/dataset.js';
import { buildResponseBundle } from '../src/bundle.js';
import {
  buildActionBoard,
  renderActionBoardMarkdownSummary,
  renderActionBoardTextSummary,
} from '../src/action-board.js';

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
  annotatedHistory,
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  sampleTrace,
  '',
  '@@ candidate @@',
  [sampleTrace, comparisonTrace].join('\n\n'),
].join('\n');

test('buildActionBoard groups portfolio signals into deterministic lanes', () => {
  const report = analyzeIncidentPortfolio(portfolioFixture);

  const board = buildActionBoard(report);

  assert.equal(board.kind, 'stack-sleuth-action-board');
  assert.equal(board.summary.sourceKind, 'portfolio');
  assert.deepEqual(board.lanes.map((lane) => lane.key), [
    'owner-work',
    'ownership-gaps',
    'runbook-gaps',
    'steward-backlog',
  ]);
  assert.equal(board.lanes[0].cards.length, 1);
  assert.ok(board.lanes[1].cards.length >= 1);
  assert.ok(board.lanes[2].cards.length >= 1);
  assert.ok(board.lanes[3].cards.length >= 1);
  assert.equal(board.lanes[0].cards[0].owner, 'web-platform');
  assert.match(board.lanes[1].cards[0].ask, /Assign an owner/i);
  assert.match(board.lanes[2].cards[0].ask, /Capture or link a runbook/i);
  assert.match(board.lanes[3].cards[0].ask, /Capture/i);
  assert.equal(board.summary.totalCards, board.lanes.reduce((total, lane) => total + lane.cards.length, 0));

  const text = renderActionBoardTextSummary(board);
  const markdown = renderActionBoardMarkdownSummary(board);
  assert.match(text, /Stack Sleuth Action Board/);
  assert.match(text, /Owner work/);
  assert.match(markdown, /^# Stack Sleuth Action Board/m);
  assert.match(markdown, /## Owner work/);
});

test('buildActionBoard rebuilds saved dataset boards and discloses replay limitations for older datasets', () => {
  const dataset = buildCasebookDataset(portfolioFixture);
  const replay = inspectReplayDatasetInput(JSON.stringify(dataset));

  assert.equal(replay.valid, true);
  const board = buildActionBoard(replay.dataset);
  assert.equal(board.summary.sourceKind, 'dataset');
  assert.equal(board.summary.hasReplayLimitations, false);
  assert.ok(board.lanes[1].cards.length >= 1);
  assert.ok(board.lanes[2].cards.length >= 1);

  const legacyDataset = structuredClone(dataset);
  legacyDataset.version = 1;
  delete legacyDataset.routingGaps;
  delete legacyDataset.runbookGaps;
  delete legacyDataset.board;

  const legacyReplay = inspectReplayDatasetInput(JSON.stringify(legacyDataset));
  assert.equal(legacyReplay.valid, true);

  const legacyBoard = buildActionBoard(legacyReplay.dataset);
  assert.equal(legacyBoard.summary.sourceKind, 'dataset');
  assert.equal(legacyBoard.summary.hasReplayLimitations, true);
  assert.match(legacyBoard.summary.replayNotes.join(' '), /older dataset/i);
});

test('buildActionBoard accepts saved response bundle replays through their embedded datasets', () => {
  const bundle = JSON.parse(buildResponseBundle({
    report: analyzeIncidentPortfolio(portfolioFixture),
    sourceMode: 'portfolio',
    sourceLabel: 'Action board fixture',
  }).files['response-bundle.json']);

  const board = buildActionBoard(bundle);

  assert.equal(board.summary.sourceKind, 'bundle');
  assert.ok(board.summary.totalCards >= 4);
  assert.match(board.summary.headline, /saved response bundle/i);
});
