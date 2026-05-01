import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeResponseBundleChronicle, inspectResponseBundleChronicleInput } from '../src/bundle-chronicle.js';
import { analyzeCasebook } from '../src/casebook.js';
import { analyzeCasebookChronicle, inspectCasebookChronicleInput } from '../src/chronicle.js';
import { analyzeIncidentPack } from '../src/briefing.js';
import { inspectReplayDatasetInput } from '../src/dataset.js';
import { inspectReplayShelfInput } from '../src/shelf.js';
import { inspectResponseBundleReplayInput } from '../src/bundle-replay.js';
import { analyzeCasebookForge } from '../src/forge.js';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { examples } from '../src/examples.js';

test('ships both JavaScript and Python example traces for the demo', () => {
  assert.ok(examples.length >= 2);
  assert.ok(examples.some((item) => item.label === 'JavaScript undefined property'));
  assert.ok(examples.some((item) => item.label === 'Python missing key'));
  assert.ok(examples.some((item) => item.label === 'Notebook ingest'));
});

test('examples expose distinct single-trace, digest, casebook, regression, and timeline demos', () => {
  const labels = examples.map((item) => item.label);

  assert.ok(labels.includes('JavaScript undefined property'));
  assert.ok(labels.includes('Python missing key'));
  assert.ok(labels.includes('Raw log excavation'));
  assert.ok(labels.includes('Repeated incident digest'));
  assert.ok(labels.includes('Notebook ingest'));
  assert.ok(labels.includes('Casebook Radar'));
  assert.ok(labels.includes('Regression radar'));
  assert.ok(labels.includes('Timeline radar'));
  assert.ok(labels.includes('Incident pack briefing'));
  assert.ok(labels.includes('Portfolio radar'));
  assert.ok(labels.includes('Casebook Forge'));
  assert.ok(labels.includes('Casebook Dataset'));
  assert.ok(labels.includes('Response Bundle replay'));
  assert.ok(labels.includes('Response Bundle Chronicle'));
  assert.ok(labels.includes('Casebook Chronicle'));
  assert.ok(labels.includes('Casebook Shelf'));

  const rawLogExample = examples.find((item) => item.label === 'Raw log excavation');
  assert.match(rawLogExample.caption, /raw log|excavat/i);
  assert.match(rawLogExample.caption, /blast radius|affected services/i);
  assert.match(rawLogExample.trace, /INFO|ERROR/);
  assert.match(rawLogExample.trace, /billing/);

  const digestExample = examples.find((item) => item.label === 'Repeated incident digest');
  assert.match(digestExample.caption, /repeat/i);
  assert.match(digestExample.trace, /TypeError:/);
  assert.match(digestExample.trace, /KeyError:/);

  const notebookExample = examples.find((item) => item.label === 'Notebook ingest');
  assert.match(notebookExample.caption, /markdown|notebook|handoff/i);
  assert.match(notebookExample.notebook, /^# /m);
  assert.match(notebookExample.notebook, /^## Current incident$/m);
  assert.match(notebookExample.notebook, /^## Prior incidents$/m);
  assert.match(notebookExample.notebook, /^## Baseline$/m);
  assert.match(notebookExample.notebook, /^## Candidate$/m);
  assert.match(notebookExample.notebook, /^## Timeline$/m);

  const casebookExample = examples.find((item) => item.label === 'Casebook Radar');
  assert.match(casebookExample.caption, /known|novel|prior incident|casebook/i);
  assert.match(casebookExample.current, /TypeError:|ProfileHydrationError:/);
  assert.match(casebookExample.current, /ProfileHydrationError:/);
  assert.match(casebookExample.history, /=== release-2026-04-15 ===/);
  assert.match(casebookExample.history, /=== profile-rewrite ===/);

  const casebook = analyzeCasebook({
    current: casebookExample.current,
    history: casebookExample.history,
  });
  const incidentBySignature = new Map(casebook.incidents.map((incident) => [incident.signature, incident]));

  assert.deepEqual(
    {
      historicalCaseCount: casebook.summary.historicalCaseCount,
      knownCount: casebook.summary.knownCount,
      novelCount: casebook.summary.novelCount,
    },
    {
      historicalCaseCount: 2,
      knownCount: 1,
      novelCount: 1,
    }
  );
  assert.equal(
    incidentBySignature.get('javascript|TypeError|app/src/profile.js:88|nullish-data,undefined-property-access').classification,
    'known'
  );
  assert.equal(
    incidentBySignature.get('javascript|ProfileHydrationError|app/src/profile.js:102|generic-runtime-error').classification,
    'novel'
  );

  const regressionExample = examples.find((item) => item.label === 'Regression radar');
  assert.match(regressionExample.caption, /new|worse|regression/i);
  assert.match(regressionExample.baseline, /TypeError:|KeyError:/);
  assert.match(regressionExample.candidate, /TypeError:|KeyError:/);

  const timelineExample = examples.find((item) => item.label === 'Timeline radar');
  assert.match(timelineExample.caption, /timeline|rollout|snapshot/i);
  assert.match(timelineExample.timeline, /=== canary ===/);
  assert.match(timelineExample.timeline, /=== full-rollout ===/);

  const incidentPackExample = examples.find((item) => item.label === 'Incident pack briefing');
  assert.match(incidentPackExample.caption, /incident pack|briefing|triage/i);
  assert.match(incidentPackExample.pack, /@@ current @@/i);
  assert.match(incidentPackExample.pack, /@@ history @@/i);
  assert.match(incidentPackExample.pack, /@@ baseline @@/i);
  assert.match(incidentPackExample.pack, /@@ candidate @@/i);
  assert.match(incidentPackExample.pack, /@@ timeline @@/i);

  const briefing = analyzeIncidentPack(incidentPackExample.pack);
  assert.deepEqual(briefing.availableAnalyses, ['current', 'casebook', 'regression', 'timeline']);
  assert.equal(briefing.summary.counts.novelIncidents, 1);
  assert.equal(briefing.summary.counts.regressionNew, 1);

  const portfolioExample = examples.find((item) => item.label === 'Portfolio radar');
  assert.match(portfolioExample.caption, /owner-aware queue|routing gap|runbook gap/i);
  assert.match(portfolioExample.portfolio, /@@@ checkout-prod @@@/i);
  assert.match(portfolioExample.portfolio, /@@@ profile-rollout @@@/i);
  assert.match(portfolioExample.portfolio, />>> owner: web-platform/i);

  const portfolio = analyzeIncidentPortfolio(portfolioExample.portfolio);
  assert.equal(portfolio.summary.runnablePackCount, 3);
  assert.equal(portfolio.summary.ownedPackCount, 1);
  assert.equal(portfolio.priorityQueue[0].label, 'profile-rollout');
  assert.equal(portfolio.responseQueue[0].owner, 'web-platform');
  assert.ok(portfolio.recurringIncidents.some((item) => item.packCount >= 2));

  const forgeExample = examples.find((item) => item.label === 'Casebook Forge');
  assert.match(forgeExample.caption, /casebook forge|reusable casebook|incident memory/i);
  assert.match(forgeExample.portfolio, /@@@ checkout-prod @@@/i);
  assert.match(forgeExample.portfolio, /@@@ profile-rollout @@@/i);

  const forge = analyzeCasebookForge(forgeExample.portfolio);
  assert.equal(forge.summary.caseCount, 3);
  assert.match(forge.exportText, /=== release-2026-04-15 ===/);
  assert.match(forge.exportText, /=== profile-js-generic-runtime-error ===/);

  const datasetExample = examples.find((item) => item.label === 'Casebook Dataset');
  assert.match(datasetExample.caption, /replay|saved dataset|dataset handoff/i);
  assert.equal(typeof datasetExample.dataset, 'string');
  assert.match(datasetExample.dataset, /"kind": "stack-sleuth-casebook-dataset"/i);

  const replay = inspectReplayDatasetInput(datasetExample.dataset);
  assert.equal(replay.valid, true);
  assert.equal(replay.dataset.summary.runnablePackCount, 3);
  assert.equal(replay.dataset.summary.ownerCount, 1);
  assert.equal(replay.dataset.gate.verdict, 'hold');
  assert.match(replay.dataset.exportText, /=== profile-js-generic-runtime-error ===/);

  const responseBundleExample = examples.find((item) => item.label === 'Response Bundle replay');
  assert.match(responseBundleExample.caption, /response bundle|replay|preserved bundle and dataset fields/i);
  assert.equal(typeof responseBundleExample.bundle, 'string');
  assert.match(responseBundleExample.bundle, /"kind": "stack-sleuth-response-bundle"/i);

  const bundleReplay = inspectResponseBundleReplayInput(responseBundleExample.bundle);
  assert.equal(bundleReplay.valid, true);
  assert.equal(bundleReplay.bundle.version, 2);
  assert.equal(bundleReplay.bundle.sourceVersion, 2);
  assert.equal(bundleReplay.bundle.manifest.version, 2);
  assert.match(bundleReplay.bundle.manifest.files.join('\n'), /response-bundle\.json/);
  assert.equal(bundleReplay.bundle.dataset.gate.verdict, 'hold');

  const bundleChronicleExample = examples.find((item) => item.label === 'Response Bundle Chronicle');
  assert.match(bundleChronicleExample.caption, /saved response bundles|bundle inventory|release windows|chronicle/i);
  assert.equal(typeof bundleChronicleExample.bundleChronicle, 'string');
  assert.match(bundleChronicleExample.bundleChronicle, /=== release-a ===/i);
  assert.match(bundleChronicleExample.bundleChronicle, /"kind": "stack-sleuth-response-bundle"/i);

  const bundleChronicleInspection = inspectResponseBundleChronicleInput(bundleChronicleExample.bundleChronicle);
  assert.equal(bundleChronicleInspection.valid, true);
  const bundleChronicle = analyzeResponseBundleChronicle(bundleChronicleInspection);
  assert.equal(bundleChronicle.summary.snapshotCount, 3);
  assert.equal(bundleChronicle.summary.latestLabel, 'release-c');
  assert.equal(bundleChronicle.summary.latestGateVerdict, 'hold');
  assert.equal(bundleChronicle.summary.latestSourceMode, 'workspace');
  assert.equal(bundleChronicle.summary.gateDrift.direction, 'regressed');
  assert.ok(bundleChronicle.inventoryTrends.length >= 1);

  const chronicleExample = examples.find((item) => item.label === 'Casebook Chronicle');
  assert.match(chronicleExample.caption, /saved datasets|release windows|drift|chronicle/i);
  assert.equal(typeof chronicleExample.chronicle, 'string');
  assert.match(chronicleExample.chronicle, /=== release-a ===/i);
  assert.match(chronicleExample.chronicle, /"kind": "stack-sleuth-casebook-dataset"/i);

  const chronicleInspection = inspectCasebookChronicleInput(chronicleExample.chronicle);
  assert.equal(chronicleInspection.valid, true);
  const chronicle = analyzeCasebookChronicle(chronicleInspection);
  assert.equal(chronicle.summary.snapshotCount, 3);
  assert.equal(chronicle.summary.latestLabel, 'release-c');
  assert.equal(chronicle.summary.latestGateVerdict, 'hold');
  assert.equal(chronicle.summary.gateDrift.direction, 'regressed');
  assert.ok(chronicle.ownerTrends.length >= 1);
  assert.ok(chronicle.hotspotTrends.length >= 1);

  const shelfExample = examples.find((item) => item.label === 'Casebook Shelf');
  assert.match(shelfExample.caption, /shelf|saved datasets|invalid/i);
  assert.equal(typeof shelfExample.shelf, 'string');
  assert.match(shelfExample.shelf, /"kind": "stack-sleuth-casebook-shelf"/i);

  const shelfReplay = inspectReplayShelfInput(shelfExample.shelf);
  assert.equal(shelfReplay.valid, true);
  assert.equal(shelfReplay.shelf.summary.validSnapshotCount, 2);
  assert.equal(shelfReplay.shelf.summary.invalidSnapshotCount, 1);
  assert.equal(shelfReplay.shelf.summary.latestGateVerdict, 'watch');
  assert.equal(shelfReplay.shelf.chronicle.summary.snapshotCount, 2);
});

test('browser main uses the shared Casebook Radar example instead of a duplicate fixture', () => {
  const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainSource, /const casebookExample = examples\.find\(\(item\) => item\.label === 'Casebook Radar'\);/);
  assert.doesNotMatch(mainSource, /const casebookExample = \{/);
});
