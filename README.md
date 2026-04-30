# Stack Sleuth

Stack Sleuth turns JavaScript, Python, and Ruby stack traces or raw logs into a likely culprit frame, a reusable issue signature, nearby support frames, ranked suspect hotspots, blast radius summaries for affected services, parsed first-seen and last-seen windows, and a practical next-step checklist. It can excavate embedded traces from noisy raw logs before grouping repeated incidents, looking up known versus novel failures in an incident memory, comparing releases, or mapping rollout drift.

## Browser demo

Open `index.html` directly, or serve the folder with any static file server. The browser app uses the same shared analysis engine as the CLI, so excavation status, culprit detection, signatures, support frames, suspect hotspots, blast radius summaries, incident digest output, casebook lookup, regression comparison, and timeline trend calls stay aligned across every workflow.

Use the built-in example buttons to compare eight modes:
- single-trace diagnosis with suspect hotspots
- raw log excavation from noisy production logs with blast radius service spread and parsed windows
- repeated traces grouped into an Incident Digest with shared hotspots
- known-versus-novel incident lookup in Casebook Radar mode with labeled prior incidents
- baseline and candidate batches compared in Regression Radar mode with hotspot shifts
- labeled rollout snapshots analyzed in Timeline Radar mode with trend calls and hotspot movement
- one structured Incident Pack Briefing that composes current, history, regression, and rollout context in a single pass
- browser copy that includes excavation-aware summaries

## CLI

Use the CLI when you want quick terminal triage from stdin or saved trace files.

### Read a direct trace from stdin

```bash
cat trace.txt | node ./bin/stack-sleuth.js
```

### Read a noisy raw log from stdin

```bash
cat production.log | node ./bin/stack-sleuth.js
```

If stdin contains multiple traces or raw logs with multiple embedded exceptions, Stack Sleuth automatically promotes the output into an Incident Digest and adds ranked suspect hotspots plus additive blast radius context to the summary and JSON payload.

### Read from a file path

```bash
node ./bin/stack-sleuth.js ./trace.txt
```

### Emit JSON

```bash
cat production.log | node ./bin/stack-sleuth.js --json
```

### Emit Markdown

```bash
cat production.log | node ./bin/stack-sleuth.js --markdown
```

### Force Incident Digest mode

```bash
cat repeated-traces-or-logs.txt | node ./bin/stack-sleuth.js --digest
```

### Force Incident Digest Markdown

```bash
cat repeated-traces-or-logs.txt | node ./bin/stack-sleuth.js --digest --markdown
```

## Incident Pack Briefing

Incident Pack Briefing is the highest-leverage Stack Sleuth workflow when you already have a few related artifacts from an active incident. Instead of running the current batch, casebook, regression compare, and rollout timeline as separate commands, you can paste one structured pack and get one composed briefing back.

### Analyze an incident pack from a file

```bash
node ./bin/stack-sleuth.js --pack ./incident-pack.txt
```

### Analyze an incident pack from stdin in JSON mode

```bash
cat incident-pack.txt | node ./bin/stack-sleuth.js --pack - --json
```

### Analyze an incident pack in Markdown

```bash
node ./bin/stack-sleuth.js --pack ./incident-pack.txt --markdown
```

Use `@@ section @@` headings. Stack Sleuth will run the analyses that have enough evidence and gracefully omit the ones that do not.

```text
@@ current @@
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

@@ history @@
=== release-2026-04-15 ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

@@ baseline @@
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

@@ candidate @@
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)

@@ timeline @@
=== canary ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

=== full-rollout ===
TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
```

Supported sections are:

- `@@ current @@` for the current batch or noisy raw logs
- `@@ history @@` for labeled prior incidents using the `=== label ===` casebook format
- `@@ baseline @@` and `@@ candidate @@` for Regression Radar
- `@@ timeline @@` for labeled rollout snapshots using the `=== label ===` timeline format

In the browser, paste the full pack into the shared workspace, then press **Explain trace(s)** or **Load incident pack example** to generate one Incident Pack Briefing and populate the shared result cards.

## Casebook Radar

Casebook Radar compares a current incident batch against labeled historical cases so you can tell which failures are known repeats versus novel incidents. It works with direct traces or noisy raw logs, so the repo reads like a compact incident-memory tool instead of a one-off parser.

### Compare current stdin against a labeled history file

```bash
cat current.log | node ./bin/stack-sleuth.js --history ./history-casebook.txt
```

### Compare saved current and history files in JSON mode

```bash
node ./bin/stack-sleuth.js --history ./history-casebook.txt --current ./current.log --json
```

### Compare in Markdown

```bash
cat current.log | node ./bin/stack-sleuth.js --history ./history-casebook.txt --current - --markdown
```

Label each prior incident case with the same `=== label ===` format used elsewhere:

```text
=== release-2026-04-15 ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

=== profile-rewrite ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
```

In the browser, paste the current incident batch into **Current incident batch**, paste labeled prior incidents into **Labeled history casebook**, then press **Analyze casebook** to see known versus novel matches and the closest historical case.

## Regression Radar

Regression Radar compares two trace batches or raw logs by signature so you can see what is new, what disappeared, what got worse, which culprit paths shifted the most, and how the blast radius changed between baseline and candidate batches.

### Compare baseline and candidate files

```bash
node ./bin/stack-sleuth.js --baseline ./baseline.txt --candidate ./candidate.txt
```

### Compare a saved baseline against candidate stdin

```bash
cat candidate.log | node ./bin/stack-sleuth.js --baseline ./baseline.log --candidate - --json
```

### Compare in Markdown

```bash
node ./bin/stack-sleuth.js --baseline ./baseline.log --candidate ./candidate.log --markdown
```

In the browser, paste baseline and candidate incident batches or raw logs into the Regression Radar panel, then press **Compare batches** to populate both the incident changes list and the Hotspot shifts card.

## Timeline Radar

Timeline Radar compares three or more labeled rollout snapshots so you can see what is brand new, what rose with each snapshot, what flapped during rollout, what stayed steady, what is falling back down, what resolved before the latest batch, and how affected services widened or narrowed over time. Each labeled snapshot can contain direct traces or noisy raw logs.

### Analyze labeled snapshots from a file

```bash
node ./bin/stack-sleuth.js --timeline ./rollout-timeline.txt
```

### Analyze labeled snapshots from stdin in JSON mode

```bash
cat rollout-timeline.log | node ./bin/stack-sleuth.js --timeline - --json
```

### Analyze labeled snapshots in Markdown

```bash
node ./bin/stack-sleuth.js --timeline ./rollout-timeline.log --markdown
```

Label each snapshot with a heading like this:

```text
=== canary ===
2026-04-30T01:40:01Z ERROR web TypeError: Cannot read properties of undefined (reading 'name')
2026-04-30T01:40:01Z ERROR web     at renderProfile (/app/src/profile.js:88:17)

=== 25-percent ===
2026-04-30T01:41:01Z ERROR web TypeError: Cannot read properties of undefined (reading 'name')
2026-04-30T01:41:01Z ERROR web     at renderProfile (/app/src/profile.js:88:17)
2026-04-30T01:41:03Z ERROR billing TypeError: Cannot read properties of undefined (reading 'email')
2026-04-30T01:41:03Z ERROR billing     at renderInvoice (/app/src/invoice.js:19:7)

=== full-rollout ===
2026-04-30T01:42:03Z ERROR billing TypeError: Cannot read properties of undefined (reading 'email')
2026-04-30T01:42:03Z ERROR billing     at renderInvoice (/app/src/invoice.js:19:7)
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
