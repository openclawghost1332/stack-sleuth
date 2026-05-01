import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReleaseGate,
  compareGateSnapshots,
  normalizeReleaseGate,
  renderReleaseGateText,
} from '../src/gate.js';

test('buildReleaseGate classifies blockers, warnings, and next steps deterministically', () => {
  const gate = buildReleaseGate({
    totalNovelIncidents: 2,
    totalRegressionNew: 1,
    totalRegressionVolumeUp: 3,
    unownedPackCount: 1,
    runbookGapCount: 2,
    totalTimelineNew: 1,
    totalTimelineRising: 4,
    recurringHotspotCount: 2,
    recurringIncidentCount: 1,
    runnablePackCount: 3,
    unrunnablePackCount: 1,
  });

  assert.equal(gate.verdict, 'hold');
  assert.deepEqual(gate.blockers.map((item) => item.key), [
    'totalNovelIncidents',
    'totalRegressionNew',
    'unownedPackCount',
    'totalTimelineNew',
  ]);
  assert.deepEqual(gate.warnings.map((item) => item.key), [
    'runbookGapCount',
    'totalRegressionVolumeUp',
    'totalTimelineRising',
    'recurringHotspotCount',
    'recurringIncidentCount',
    'unrunnablePackCount',
  ]);
  assert.match(renderReleaseGateText(gate), /Verdict: hold/i);
  assert.match(gate.summary, /4 blockers, 6 warnings/i);
  assert.match(gate.nextAction, /Stop the release/i);
});

test('buildReleaseGate returns needs-input when no runnable packs exist', () => {
  const gate = buildReleaseGate({
    runnablePackCount: 0,
    unrunnablePackCount: 2,
  });

  assert.equal(gate.verdict, 'needs-input');
  assert.equal(gate.blockers.length, 0);
  assert.equal(gate.warnings.length, 0);
  assert.match(gate.summary, /needs more runnable evidence/i);
});

test('normalizeReleaseGate preserves older artifacts with a fallback needs-input gate', () => {
  const normalized = normalizeReleaseGate(undefined, {
    runnablePackCount: 0,
    unrunnablePackCount: 1,
  });

  assert.equal(normalized.verdict, 'needs-input');
  assert.equal(normalized.sources.runnablePackCount, 0);
  assert.equal(normalized.sources.unrunnablePackCount, 1);
  assert.equal(normalized.blockers.length, 0);
  assert.equal(normalized.warnings.length, 0);
});

test('compareGateSnapshots reports regressions, improvements, flat movement, and unavailable drift', () => {
  const prior = buildReleaseGate({ runnablePackCount: 2, runbookGapCount: 1 });
  const latest = buildReleaseGate({ runnablePackCount: 2, totalNovelIncidents: 1 });
  const regressed = compareGateSnapshots(prior, latest);

  assert.equal(regressed.direction, 'regressed');
  assert.equal(regressed.previousVerdict, 'watch');
  assert.equal(regressed.currentVerdict, 'hold');
  assert.match(regressed.summary, /regressed from watch to hold/i);

  const improved = compareGateSnapshots(latest, prior);
  assert.equal(improved.direction, 'improved');
  assert.match(improved.summary, /improved from hold to watch/i);

  const flat = compareGateSnapshots(prior, buildReleaseGate({ runnablePackCount: 5, runbookGapCount: 1 }));
  assert.equal(flat.direction, 'flat');
  assert.match(flat.summary, /stayed watch/i);

  const unavailable = compareGateSnapshots(null, prior);
  assert.equal(unavailable.direction, 'unavailable');
  assert.match(unavailable.summary, /unavailable/i);
});
