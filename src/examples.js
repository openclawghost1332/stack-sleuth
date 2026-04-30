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

const rubyTrace = "app/service.rb:7:in `run': undefined method `email' for nil:NilClass (NoMethodError)\n\tfrom app/controller.rb:3:in `call'";

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
    label: 'Repeated incident digest',
    caption: 'Two repeated frontend failures and one backend key miss collapse into a repeat-friendly incident digest with ranked suspect hotspots.',
    trace: `${javascriptTrace}\n\n${javascriptTrace}\n\n${pythonTrace}`
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
  }
];
