import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIncidentPack } from '../src/briefing.js';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { renderIncidentDossierHtml } from '../src/report.js';

const sampleTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const comparisonTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const annotatedCasebookHistoryInput = [
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

const casebookCurrentInput = [
  sampleTrace,
  `ProfileHydrationError: Profile payload missing account metadata\n    at renderProfileState (/app/src/profile.js:102:9)\n    at updateView (/app/src/view.js:42:5)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)`
].join('\n\n');

const timelineInput = [
  '=== canary ===',
  sampleTrace,
  '',
  '=== full-rollout ===',
  [sampleTrace, comparisonTrace].join('\n\n'),
].join('\n');

const incidentPackInput = [
  '@@ current @@',
  casebookCurrentInput,
  '',
  '@@ history @@',
  annotatedCasebookHistoryInput,
  '',
  '@@ baseline @@',
  sampleTrace,
  '',
  '@@ candidate @@',
  [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
  '',
  '@@ timeline @@',
  timelineInput,
].join('\n');

const portfolioInput = [
  '@@@ checkout-prod @@@',
  '@@ current @@',
  [sampleTrace, sampleTrace].join('\n\n'),
  '',
  '@@@ profile-rollout @@@',
  '@@ current @@',
  casebookCurrentInput,
  '',
  '@@ history @@',
  annotatedCasebookHistoryInput,
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  sampleTrace,
  '',
  '@@ candidate @@',
  [sampleTrace, sampleTrace, comparisonTrace].join('\n\n'),
].join('\n');

test('renderIncidentDossierHtml renders a standalone incident-pack dossier', () => {
  const report = analyzeIncidentPack(incidentPackInput);
  const html = renderIncidentDossierHtml({ mode: 'pack', report, originLabel: 'Incident Pack' });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Stack Sleuth Incident Dossier/);
  assert.match(html, /Incident Pack/i);
  assert.match(html, /Key findings/i);
  assert.match(html, /Omissions/i);
  assert.match(html, /Suspect hotspots/i);
  assert.match(html, /Checklist/i);
  assert.match(html, /profile\.js/i);
});

test('renderIncidentDossierHtml renders portfolio queues, gate, and reusable exports', () => {
  const report = analyzeIncidentPortfolio(portfolioInput);
  const html = renderIncidentDossierHtml({ mode: 'portfolio', report, originLabel: 'Portfolio Radar' });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Portfolio Radar/i);
  assert.match(html, /Release gate/i);
  assert.match(html, /Priority queue/i);
  assert.match(html, /Response queue/i);
  assert.match(html, /Routing gaps/i);
  assert.match(html, /Recurring incidents/i);
  assert.match(html, /Handoff Briefing export/i);
  assert.match(html, /Casebook Forge export/i);
  assert.match(html, /Owner: web-platform/i);
  assert.match(html, /=== release-2026-04-15 ===/i);
});
