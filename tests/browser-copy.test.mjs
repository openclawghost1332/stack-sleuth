import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const browserMain = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('browser copy invites pasting one or more traces for digesting, comparing, and timeline analysis', () => {
  assert.match(indexHtml, /Paste one or more stack traces or raw logs/i);
  assert.match(indexHtml, /Stack trace, raw log, or incident bundle/i);
  assert.match(indexHtml, /Paste one or more JavaScript, Python, or Ruby traces or raw logs here/i);
  assert.match(indexHtml, />Explain trace\(s\)<\/button>/i);
  assert.match(indexHtml, />Load raw log example</i);
  assert.match(indexHtml, /Excavation status/i);
  assert.match(indexHtml, /Regression Radar/i);
  assert.match(indexHtml, /Baseline incident batch/i);
  assert.match(indexHtml, /Candidate incident batch/i);
  assert.match(indexHtml, />Compare batches</i);
  assert.match(indexHtml, /Timeline Radar/i);
  assert.match(indexHtml, /Rollout snapshots/i);
  assert.match(indexHtml, />Analyze timeline</i);
  assert.match(indexHtml, /Load timeline example/i);
  assert.match(indexHtml, /Timeline hotspot movement/i);
  assert.match(indexHtml, /Suspect hotspots/i);
  assert.match(indexHtml, /Hotspot shifts/i);
  assert.match(indexHtml, /Timeline trend calls and hotspot movement will appear here/i);
  assert.match(indexHtml, /Timeline hotspot movement between labeled snapshots will appear here/i);
});

test('browser regression and timeline workflows use aggregate hotspot data and clear stale state', () => {
  assert.match(browserMain, /extractTraceSet/);
  assert.match(browserMain, /buildHotspotItems\(regression\.candidateDigest\.hotspots\)/);
  assert.match(browserMain, /renderTimelineWorkflow/);
  assert.match(browserMain, /buildTimelineIncidentItems/);
  assert.match(browserMain, /buildTimelineHotspotItems/);
  assert.match(browserMain, /resetRegressionState\([\s\S]*hotspotsValue\.replaceChildren/);
  assert.match(browserMain, /resetTimelineState\([\s\S]*timelineSummaryValue\.textContent/);
});
