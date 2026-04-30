# Stack Sleuth

Stack Sleuth turns raw JavaScript, Python, and Ruby stack traces into a likely culprit frame, a reusable issue signature, nearby support frames, ranked suspect hotspots, and a practical next-step checklist. When you paste multiple traces, it can collapse repeated failures into an Incident Digest with ranked groups and shared hotspots. When you compare a baseline batch against a candidate batch, it can also run a Regression Radar that surfaces new, resolved, and worsening incidents plus hotspot shifts. When you paste more than two labeled rollout snapshots, it can run a Timeline Radar that explains which incidents are new, rising, flapping, steady, falling, or resolved across the rollout.

## Browser demo

Open `index.html` directly, or serve the folder with any static file server. The browser app uses the same shared analysis engine as the CLI, so the runtime, culprit, signature, support frames, suspect hotspots, checklist, incident digest, regression comparison, and timeline trend calls stay aligned across every workflow.

Use the built-in example buttons to compare four modes:
- single-trace diagnosis with suspect hotspots
- repeated traces grouped into digest incidents with shared hotspots
- baseline and candidate batches compared in Regression Radar mode with hotspot shifts
- labeled rollout snapshots analyzed in Timeline Radar mode with trend calls and hotspot movement

## CLI

Use the CLI when you want quick terminal triage from stdin or saved trace files.

### Read from stdin

```bash
cat trace.txt | node ./bin/stack-sleuth.js
```

If stdin contains multiple traces separated by blank lines, Stack Sleuth automatically promotes the output into an Incident Digest and adds ranked suspect hotspots to the summary and JSON payload.

### Read from a file path

```bash
node ./bin/stack-sleuth.js ./trace.txt
```

### Emit JSON

```bash
cat trace.txt | node ./bin/stack-sleuth.js --json
```

### Emit Markdown

```bash
cat trace.txt | node ./bin/stack-sleuth.js --markdown
```

### Force Incident Digest mode

```bash
cat repeated-traces.txt | node ./bin/stack-sleuth.js --digest
```

### Force Incident Digest Markdown

```bash
cat repeated-traces.txt | node ./bin/stack-sleuth.js --digest --markdown
```

## Regression Radar

Regression Radar compares two trace batches by signature so you can see what is new, what disappeared, what got worse, and which culprit paths shifted the most.

### Compare baseline and candidate files

```bash
node ./bin/stack-sleuth.js --baseline ./baseline.txt --candidate ./candidate.txt
```

### Compare a saved baseline against candidate stdin

```bash
cat candidate.txt | node ./bin/stack-sleuth.js --baseline ./baseline.txt --candidate - --json
```

### Compare in Markdown

```bash
node ./bin/stack-sleuth.js --baseline ./baseline.txt --candidate ./candidate.txt --markdown
```

In the browser, paste baseline and candidate incident batches into the Regression Radar panel, then press **Compare batches** to populate both the incident changes list and the Hotspot shifts card.

## Timeline Radar

Timeline Radar compares three or more rollout snapshots so you can see what is brand new, what rose with each snapshot, what flapped during rollout, what stayed steady, what is falling back down, and what resolved before the latest batch.

### Analyze labeled snapshots from a file

```bash
node ./bin/stack-sleuth.js --timeline ./rollout-timeline.txt
```

### Analyze labeled snapshots from stdin in JSON mode

```bash
cat rollout-timeline.txt | node ./bin/stack-sleuth.js --timeline - --json
```

### Analyze labeled snapshots in Markdown

```bash
node ./bin/stack-sleuth.js --timeline ./rollout-timeline.txt --markdown
```

Label each snapshot with a heading like this:

```text
=== canary ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

=== 25-percent ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)

=== full-rollout ===
TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
```

In the browser, paste labeled snapshots into the Timeline Radar panel, then press **Analyze timeline** to populate both the Timeline trend calls card and the Timeline hotspot movement card.

## Local development

```bash
npm test
```

Then open `index.html` in a browser, or serve the repo with any static file server.

## GitHub

- Repository: https://github.com/openclawghost1332/stack-sleuth
- GitHub Pages: https://openclawghost1332.github.io/stack-sleuth/
