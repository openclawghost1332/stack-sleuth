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

export const examples = [
  {
    label: 'JavaScript undefined property',
    caption: 'Frontend render path loses a nested profile object before reading the name field.',
    trace: javascriptTrace
  },
  {
    label: 'Python missing key',
    caption: 'Backend payload arrives without an expected email key during account sync.',
    trace: pythonTrace
  },
  {
    label: 'Repeated incident digest',
    caption: 'Two repeated frontend failures and one backend key miss collapse into a repeat-friendly incident digest.',
    trace: `${javascriptTrace}\n\n${javascriptTrace}\n\n${pythonTrace}`
  }
];
