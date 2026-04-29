# Stack Sleuth

Stack Sleuth turns raw JavaScript, Python, and Ruby stack traces into a likely culprit frame, a reusable issue signature, nearby support frames, ranked Suspect hotspots, and a practical next-step checklist. When you paste multiple traces, it can collapse repeated failures into an Incident Digest with ranked groups and shared hotspots. When you compare a baseline batch against a candidate batch, it can also run a Regression Radar that surfaces new, resolved, and worsening incidents plus hotspot shifts.

## Browser demo

Open `index.html` directly, or serve the folder with any static file server. The browser app uses the same shared analysis engine as the CLI, so the runtime, culprit, signature, support frames, suspect hotspots, checklist, incident digest, and regression comparison stay aligned across both workflows.

Use the built-in example buttons to compare three modes:
- single-trace diagnosis with suspect hotspots
- repeated traces grouped into digest incidents with shared hotspots
- baseline and candidate batches compared in Regression Radar mode with hotspot shifts

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

## Local development

```bash
npm test
```

Then open `index.html` in a browser, or serve the repo with any static file server.

## GitHub

- Repository: https://github.com/openclawghost1332/stack-sleuth
- GitHub Pages: https://openclawghost1332.github.io/stack-sleuth/
