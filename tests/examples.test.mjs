import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { analyzeCasebook } from '../src/casebook.js';
import { analyzeIncidentPack } from '../src/briefing.js';
import { analyzeIncidentPortfolio } from '../src/portfolio.js';
import { examples } from '../src/examples.js';

test('ships both JavaScript and Python example traces for the demo', () => {
  assert.ok(examples.length >= 2);
  assert.ok(examples.some((item) => item.label === 'JavaScript undefined property'));
  assert.ok(examples.some((item) => item.label === 'Python missing key'));
});

test('examples expose distinct single-trace, digest, casebook, regression, and timeline demos', () => {
  const labels = examples.map((item) => item.label);

  assert.ok(labels.includes('JavaScript undefined property'));
  assert.ok(labels.includes('Python missing key'));
  assert.ok(labels.includes('Raw log excavation'));
  assert.ok(labels.includes('Repeated incident digest'));
  assert.ok(labels.includes('Casebook Radar'));
  assert.ok(labels.includes('Regression radar'));
  assert.ok(labels.includes('Timeline radar'));
  assert.ok(labels.includes('Incident pack briefing'));
  assert.ok(labels.includes('Portfolio radar'));

  const rawLogExample = examples.find((item) => item.label === 'Raw log excavation');
  assert.match(rawLogExample.caption, /raw log|excavat/i);
  assert.match(rawLogExample.caption, /blast radius|affected services/i);
  assert.match(rawLogExample.trace, /INFO|ERROR/);
  assert.match(rawLogExample.trace, /billing/);

  const digestExample = examples.find((item) => item.label === 'Repeated incident digest');
  assert.match(digestExample.caption, /repeat/i);
  assert.match(digestExample.trace, /TypeError:/);
  assert.match(digestExample.trace, /KeyError:/);

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
  assert.match(portfolioExample.caption, /portfolio|release|ranked/i);
  assert.match(portfolioExample.portfolio, /@@@ checkout-prod @@@/i);
  assert.match(portfolioExample.portfolio, /@@@ profile-rollout @@@/i);

  const portfolio = analyzeIncidentPortfolio(portfolioExample.portfolio);
  assert.equal(portfolio.summary.runnablePackCount, 3);
  assert.equal(portfolio.priorityQueue[0].label, 'profile-rollout');
  assert.ok(portfolio.recurringIncidents.some((item) => item.packCount >= 2));
});

test('browser main uses the shared Casebook Radar example instead of a duplicate fixture', () => {
  const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

  assert.match(mainSource, /const casebookExample = examples\.find\(\(item\) => item\.label === 'Casebook Radar'\);/);
  assert.doesNotMatch(mainSource, /const casebookExample = \{/);
});
