import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHotspots, buildHotspotShifts } from '../src/hotspots.js';

function frame(file, line, functionName) {
  return {
    file,
    line,
    column: 1,
    functionName,
    internal: false,
  };
}

test('buildHotspots ranks culprit-heavy paths ahead of support paths and keeps labels concise but unique', () => {
  const hotspots = buildHotspots([
    {
      culpritFrame: frame('/app/src/billing/invoice.js', 19, 'renderInvoice'),
      supportFrames: [
        frame('/app/src/billing/index.js', 7, 'refreshBilling'),
        frame('/app/src/admin/invoice.js', 33, 'syncInvoice'),
      ],
    },
    {
      culpritFrame: frame('/app/src/billing/invoice.js', 21, 'renderInvoice'),
      supportFrames: [
        frame('/app/src/billing/index.js', 7, 'refreshBilling'),
      ],
    },
  ]);

  assert.deepEqual(
    hotspots.map(({ label, path, culpritCount, supportCount, score }) => ({
      label,
      path,
      culpritCount,
      supportCount,
      score,
    })),
    [
      {
        label: 'billing/invoice.js',
        path: 'app/src/billing/invoice.js',
        culpritCount: 2,
        supportCount: 0,
        score: 6,
      },
      {
        label: 'index.js',
        path: 'app/src/billing/index.js',
        culpritCount: 0,
        supportCount: 2,
        score: 2,
      },
      {
        label: 'admin/invoice.js',
        path: 'app/src/admin/invoice.js',
        culpritCount: 0,
        supportCount: 1,
        score: 1,
      },
    ]
  );
});

test('buildHotspotShifts compares ranked hotspots across baseline and candidate batches', () => {
  const baseline = buildHotspots([
    {
      culpritFrame: frame('/app/src/profile.js', 88, 'renderProfile'),
      supportFrames: [frame('/app/src/view.js', 42, 'updateView')],
    },
    {
      culpritFrame: frame('/app/service.py', 17, 'run'),
      supportFrames: [frame('/app/app.py', 42, '<module>')],
    },
  ]);
  const candidate = buildHotspots([
    {
      culpritFrame: frame('/app/src/profile.js', 88, 'renderProfile'),
      supportFrames: [frame('/app/src/view.js', 42, 'updateView')],
    },
    {
      culpritFrame: frame('/app/src/profile.js', 88, 'renderProfile'),
      supportFrames: [frame('/app/src/view.js', 42, 'updateView')],
    },
    {
      culpritFrame: frame('/app/src/billing/invoice.js', 19, 'renderInvoice'),
      supportFrames: [frame('/app/src/billing.js', 57, 'refreshBilling')],
    },
  ]);

  const shifts = buildHotspotShifts({ baseline, candidate });

  assert.deepEqual(
    shifts.map(({ status, label, baselineScore, candidateScore, delta }) => ({
      status,
      label,
      baselineScore,
      candidateScore,
      delta,
    })),
    [
      {
        status: 'volume-up',
        label: 'profile.js',
        baselineScore: 3,
        candidateScore: 6,
        delta: 3,
      },
      {
        status: 'new',
        label: 'invoice.js',
        baselineScore: 0,
        candidateScore: 3,
        delta: 3,
      },
      {
        status: 'resolved',
        label: 'service.py',
        baselineScore: 3,
        candidateScore: 0,
        delta: -3,
      },
      {
        status: 'volume-up',
        label: 'view.js',
        baselineScore: 1,
        candidateScore: 2,
        delta: 1,
      },
      {
        status: 'new',
        label: 'billing.js',
        baselineScore: 0,
        candidateScore: 1,
        delta: 1,
      },
      {
        status: 'resolved',
        label: 'app.py',
        baselineScore: 1,
        candidateScore: 0,
        delta: -1,
      },
    ]
  );
});
