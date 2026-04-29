# Stack Sleuth

Stack Sleuth turns raw JavaScript, Python, and Ruby stack traces into a likely culprit frame, a reusable issue signature, nearby support frames, and a practical next-step checklist. When you paste multiple traces, it can also collapse repeated failures into an Incident Digest with ranked groups.

## Browser demo

Open `index.html` directly, or serve the folder with any static file server. The browser app uses the same shared analysis engine as the CLI, so the runtime, culprit, signature, support frames, checklist, and multi-trace digest stay aligned across both workflows.

Use the built-in example buttons to compare single-trace diagnosis with repeated traces grouped into digest incidents.

## CLI

Use the CLI when you want quick terminal triage from stdin or a saved trace file.

### Read from stdin

```bash
cat trace.txt | node ./bin/stack-sleuth.js
```

If stdin contains multiple traces separated by blank lines, Stack Sleuth automatically promotes the output into an Incident Digest.

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

## Local development

```bash
npm test
```

Then open `index.html` in a browser, or serve the repo with any static file server.

## GitHub

- Repository: https://github.com/openclawghost1332/stack-sleuth
- GitHub Pages: https://openclawghost1332.github.io/stack-sleuth/
