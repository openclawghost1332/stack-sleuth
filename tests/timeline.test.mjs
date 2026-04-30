import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimelineSnapshots,
  analyzeTimeline,
  renderTimelineTextSummary,
  renderTimelineMarkdownSummary,
} from '../src/timeline.js';

const profileTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const dashboardTrace = `TypeError: Cannot read properties of undefined (reading 'id')
    at loadDashboard (/app/src/dashboard.js:14:9)
    at bootstrap (/app/src/index.js:3:1)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const invoiceTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const pythonTrace = `Traceback (most recent call last):
  File "app.py", line 42, in <module>
    run()
  File "service.py", line 17, in run
    return user["email"]
KeyError: 'email'`;

const rubyTrace = "app/service.rb:7:in `run': undefined method `email' for nil:NilClass (NoMethodError)\n\tfrom app/controller.rb:3:in `call'";

const alertTrace = `TypeError: Cannot read properties of undefined (reading 'title')
    at showAlert (/app/src/alerts/toast.js:11:4)
    at refreshAlerts (/app/src/alerts/index.js:5:2)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const timelineInput = [
  '=== canary ===',
  [profileTrace, dashboardTrace, dashboardTrace, dashboardTrace, pythonTrace, rubyTrace].join('\n\n'),
  '',
  '=== 25-percent ===',
  [profileTrace, profileTrace, dashboardTrace, dashboardTrace, pythonTrace, rubyTrace, alertTrace, alertTrace].join('\n\n'),
  '',
  '=== full-rollout ===',
  [profileTrace, profileTrace, profileTrace, dashboardTrace, rubyTrace, invoiceTrace, alertTrace].join('\n\n'),
].join('\n');

const noisyTimelineInput = [
  '=== canary ===',
  '2026-04-30T01:40:00Z INFO boot complete',
  `2026-04-30T01:40:01Z ERROR web ${profileTrace.split('\n').join('\n2026-04-30T01:40:01Z ERROR web ')}`,
  `2026-04-30T01:40:02Z ERROR api ${dashboardTrace.split('\n').join('\n2026-04-30T01:40:02Z ERROR api ')}`,
  '',
  '=== 25-percent ===',
  '2026-04-30T01:41:00Z INFO boot complete',
  `2026-04-30T01:41:01Z ERROR web ${profileTrace.split('\n').join('\n2026-04-30T01:41:01Z ERROR web ')}`,
  `2026-04-30T01:41:02Z ERROR web ${profileTrace.split('\n').join('\n2026-04-30T01:41:02Z ERROR web ')}`,
  `2026-04-30T01:41:03Z ERROR api ${dashboardTrace.split('\n').join('\n2026-04-30T01:41:03Z ERROR api ')}`,
  '',
  '=== full-rollout ===',
  '2026-04-30T01:42:00Z INFO boot complete',
  `2026-04-30T01:42:01Z ERROR web ${profileTrace.split('\n').join('\n2026-04-30T01:42:01Z ERROR web ')}`,
  `2026-04-30T01:42:02Z ERROR web ${profileTrace.split('\n').join('\n2026-04-30T01:42:02Z ERROR web ')}`,
  `2026-04-30T01:42:03Z ERROR web ${profileTrace.split('\n').join('\n2026-04-30T01:42:03Z ERROR web ')}`,
  `2026-04-30T01:42:04Z ERROR billing ${invoiceTrace.split('\n').join('\n2026-04-30T01:42:04Z ERROR billing ')}`,
].join('\n');

test('parseTimelineSnapshots splits labeled snapshots and preserves order', () => {
  const snapshots = parseTimelineSnapshots(timelineInput);

  assert.deepEqual(snapshots.map((snapshot) => snapshot.label), ['canary', '25-percent', 'full-rollout']);
  assert.match(snapshots[0].traces, /renderProfile/);
  assert.match(snapshots[2].traces, /renderInvoice/);
});

test('analyzeTimeline classifies incident and hotspot trends across snapshots', () => {
  const timeline = analyzeTimeline(timelineInput);

  assert.deepEqual(timeline.summary, {
    snapshotCount: 3,
    latestLabel: 'full-rollout',
    latestTotalTraces: 7,
    activeLatestCount: 5,
    newCount: 1,
    risingCount: 1,
    flappingCount: 1,
    steadyCount: 1,
    fallingCount: 1,
    resolvedCount: 1,
  });

  assert.deepEqual(
    timeline.incidents.map(({ trend, signature, series, latestCount }) => ({ trend, signature, series, latestCount })),
    [
      {
        trend: 'new',
        signature: 'javascript|TypeError|app/src/invoice.js:19|nullish-data,undefined-property-access',
        series: [0, 0, 1],
        latestCount: 1,
      },
      {
        trend: 'rising',
        signature: 'javascript|TypeError|app/src/profile.js:88|nullish-data,undefined-property-access',
        series: [1, 2, 3],
        latestCount: 3,
      },
      {
        trend: 'flapping',
        signature: 'javascript|TypeError|app/src/alerts/toast.js:11|nullish-data,undefined-property-access',
        series: [0, 2, 1],
        latestCount: 1,
      },
      {
        trend: 'steady',
        signature: 'ruby|NoMethodError|app/service.rb:7|nil-receiver,nullish-data',
        series: [1, 1, 1],
        latestCount: 1,
      },
      {
        trend: 'falling',
        signature: 'javascript|TypeError|app/src/dashboard.js:14|nullish-data,undefined-property-access',
        series: [3, 2, 1],
        latestCount: 1,
      },
      {
        trend: 'resolved',
        signature: 'python|KeyError|service.py:17|missing-key',
        series: [1, 1, 0],
        latestCount: 0,
      },
    ]
  );

  assert.deepEqual(
    timeline.hotspots.slice(0, 6).map(({ trend, label, series }) => ({ trend, label, series })),
    [
      { trend: 'new', label: 'invoice.js', series: [0, 0, 3] },
      { trend: 'rising', label: 'profile.js', series: [3, 6, 9] },
      { trend: 'flapping', label: 'toast.js', series: [0, 6, 3] },
      { trend: 'steady', label: 'service.rb', series: [3, 3, 3] },
      { trend: 'falling', label: 'dashboard.js', series: [9, 6, 3] },
      { trend: 'resolved', label: 'service.py', series: [3, 3, 0] },
    ]
  );
});

test('analyzeTimeline trends noisy labeled rollout snapshots', () => {
  const timeline = analyzeTimeline(noisyTimelineInput);

  assert.equal(timeline.summary.snapshotCount, 3);
  assert.equal(timeline.snapshots[0].digest.extraction.mode, 'extracted');
  assert.equal(timeline.snapshots[1].digest.extraction.mode, 'extracted');
  assert.equal(timeline.snapshots[2].digest.extraction.mode, 'extracted');
  assert.equal(timeline.summary.newCount, 1);
  assert.equal(timeline.summary.risingCount, 1);
});

test('renderTimeline helpers produce copy-ready text and markdown summaries', () => {
  const timeline = analyzeTimeline(timelineInput);
  const text = renderTimelineTextSummary(timeline);
  const markdown = renderTimelineMarkdownSummary(timeline);

  assert.match(text, /Stack Sleuth Timeline Radar/);
  assert.match(text, /Snapshots: canary → 25-percent → full-rollout/);
  assert.match(text, /Latest snapshot: full-rollout \(7 traces\)/);
  assert.match(text, /new: 1/);
  assert.match(text, /Hotspot movement: invoice\.js \[0 → 0 → 3\], profile\.js \[3 → 6 → 9\], toast\.js \[0 → 6 → 3\]/);

  assert.match(markdown, /^# Stack Sleuth Timeline Radar/m);
  assert.match(markdown, /- \*\*Snapshots:\*\* canary → 25-percent → full-rollout/);
  assert.match(markdown, /## Hotspot movement/);
  assert.match(markdown, /- `invoice\.js` \(new, 0 → 0 → 3\)/);
  assert.match(markdown, /## Incident trends/);
  assert.match(markdown, /- \*\*Trend:\*\* new/);
});
