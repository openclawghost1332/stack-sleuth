const javascriptTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const pythonTrace = `Traceback (most recent call last):
  File "app.py", line 42, in <module>
    run()
  File "service.py", line 17, in run
    return user["email"]
KeyError: 'email'`;

const regressionTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const dashboardTrace = `TypeError: Cannot read properties of undefined (reading 'id')
    at loadDashboard (/app/src/dashboard.js:14:9)
    at bootstrap (/app/src/index.js:3:1)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const alertTrace = `TypeError: Cannot read properties of undefined (reading 'title')
    at showAlert (/app/src/alerts/toast.js:11:4)
    at refreshAlerts (/app/src/alerts/index.js:5:2)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const profileHydrationTrace = `ProfileHydrationError: Profile payload missing account metadata
    at renderProfileState (/app/src/profile.js:102:9)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const rubyTrace = "app/service.rb:7:in `run': undefined method `email' for nil:NilClass (NoMethodError)\n\tfrom app/controller.rb:3:in `call'";

const rawLogTrace = [
  '2026-04-30T01:50:00Z INFO api boot complete',
  `2026-04-30T01:50:01Z ERROR web ${javascriptTrace.split('\n').join('\n2026-04-30T01:50:01Z ERROR web ')}`,
  '2026-04-30T01:50:02Z WARN billing retry queued for customer sync',
  `2026-04-30T01:50:04Z ERROR billing ${regressionTrace.split('\n').join('\n2026-04-30T01:50:04Z ERROR billing ')}`,
  '2026-04-30T01:50:05Z INFO request complete',
].join('\n');

const casebookHistoryTrace = [
  '=== release-2026-04-15 ===',
  '>>> summary: Checkout profile payload dropped account metadata before render',
  '>>> fix: Guard renderProfile before reading account.name',
  '>>> owner: web-platform',
  '>>> runbook: https://example.com/runbooks/profile-null',
  [javascriptTrace, regressionTrace].join('\n\n'),
  '',
  '=== profile-rewrite ===',
  javascriptTrace,
].join('\n');

const casebookCurrentTrace = [
  javascriptTrace,
  profileHydrationTrace,
].join('\n\n');

const timelineTrace = [
  '=== canary ===',
  [javascriptTrace, dashboardTrace, dashboardTrace, dashboardTrace, pythonTrace, rubyTrace].join('\n\n'),
  '',
  '=== 25-percent ===',
  [javascriptTrace, javascriptTrace, dashboardTrace, dashboardTrace, pythonTrace, rubyTrace, alertTrace, alertTrace].join('\n\n'),
  '',
  '=== full-rollout ===',
  [javascriptTrace, javascriptTrace, javascriptTrace, dashboardTrace, rubyTrace, regressionTrace, alertTrace].join('\n\n'),
].join('\n');

const incidentPackTrace = [
  '@@ current @@',
  casebookCurrentTrace,
  '',
  '@@ history @@',
  casebookHistoryTrace,
  '',
  '@@ baseline @@',
  `${javascriptTrace}\n\n${pythonTrace}`,
  '',
  '@@ candidate @@',
  `${javascriptTrace}\n\n${javascriptTrace}\n\n${regressionTrace}`,
  '',
  '@@ timeline @@',
  timelineTrace,
].join('\n');

const notebookTrace = [
  '# Checkout incident notebook',
  '',
  '## Current incident',
  casebookCurrentTrace,
  '',
  '## Prior incidents',
  casebookHistoryTrace,
  '',
  '## Baseline',
  `${javascriptTrace}\n\n${pythonTrace}`,
  '',
  '## Candidate',
  `${javascriptTrace}\n\n${javascriptTrace}\n\n${regressionTrace}`,
  '',
  '## Timeline',
  timelineTrace,
].join('\n');

const portfolioTrace = [
  '@@@ checkout-prod @@@',
  '@@ current @@',
  `${javascriptTrace}\n\n${javascriptTrace}`,
  '',
  '@@@ profile-rollout @@@',
  '@@ current @@',
  casebookCurrentTrace,
  '',
  '@@ history @@',
  casebookHistoryTrace,
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  `${javascriptTrace}\n\n${pythonTrace}`,
  '',
  '@@ candidate @@',
  `${javascriptTrace}\n\n${javascriptTrace}\n\n${regressionTrace}`,
].join('\n');

export const examples = [
  {
    label: 'JavaScript undefined property',
    caption: 'Frontend render path loses a nested profile object before reading the name field, with profile.js and view.js surfacing as the top hotspots.',
    trace: javascriptTrace
  },
  {
    label: 'Python missing key',
    caption: 'Backend payload arrives without an expected email key during account sync, centering the hotspot radar on service.py.',
    trace: pythonTrace
  },
  {
    label: 'Raw log excavation',
    caption: 'A noisy raw log dump still excavates embedded production traces and preserves blast radius context, including affected services and first-seen and last-seen windows.',
    trace: rawLogTrace
  },
  {
    label: 'Repeated incident digest',
    caption: 'Two repeated frontend failures and one backend key miss collapse into a repeat-friendly incident digest with ranked suspect hotspots.',
    trace: `${javascriptTrace}\n\n${javascriptTrace}\n\n${pythonTrace}`
  },
  {
    label: 'Casebook Radar',
    caption: 'Today\'s incident batch matches one known failure and one novel profile hydration break, and the known match recalls the last fix, owner, and runbook context like a real incident-memory handoff.',
    current: casebookCurrentTrace,
    history: casebookHistoryTrace,
  },
  {
    label: 'Notebook ingest',
    caption: 'A markdown handoff note with Current incident, Prior incidents, Baseline, Candidate, and Timeline headings normalizes into the existing incident-pack workflow without rewriting the notebook by hand.',
    notebook: notebookTrace,
  },
  {
    label: 'Regression radar',
    caption: 'The candidate batch introduces a brand-new billing failure while the profile crash spikes and the old backend key miss disappears, making the hotspot shifts easy to scan.',
    baseline: `${javascriptTrace}\n\n${pythonTrace}`,
    candidate: `${javascriptTrace}\n\n${javascriptTrace}\n\n${regressionTrace}`
  },
  {
    label: 'Timeline radar',
    caption: 'A rollout timeline across canary, 25-percent, and full-rollout snapshots exposes one new incident, one rising incident, one flapping incident, one steady incident, one falling incident, and one resolved incident.',
    timeline: timelineTrace,
  },
  {
    label: 'Incident pack briefing',
    caption: 'One structured incident pack folds today\'s batch, the casebook, a regression compare, and a rollout timeline into a single briefing that is easy to paste into chat or an incident doc.',
    pack: incidentPackTrace,
  },
  {
    label: 'Portfolio radar',
    caption: 'Several labeled incident packs roll up into one owner-aware Portfolio Radar queue, surfacing recalled owners, runbook gaps, routing gaps, recurring incidents, and shared hotspots in one release-level view.',
    portfolio: portfolioTrace,
  },
  {
    label: 'Casebook Forge',
    caption: 'A labeled incident portfolio turns into a reusable casebook export, so active triage feeds the next incident-memory lookup without hand-curating new history files.',
    portfolio: portfolioTrace,
  },
  {
    label: 'Casebook Dataset',
    caption: 'A labeled incident portfolio packages response routing, recurring hotspots, and a reusable merged casebook export into one portable dataset handoff.',
    portfolio: portfolioTrace,
  },
  {
    label: 'Casebook Merge',
    caption: 'A labeled incident portfolio plus embedded history turns into a living casebook update that preserves human guidance, adds seen-count and source-packs metadata, and flags merge conflicts when older entries disagree.',
    portfolio: portfolioTrace,
  }
];
