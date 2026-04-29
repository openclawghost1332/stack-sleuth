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
  }
];
