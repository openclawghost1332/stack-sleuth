# Stack Sleuth

Stack Sleuth turns JavaScript, Python, and Ruby stack traces or raw logs into a likely culprit frame, a reusable issue signature, nearby support frames, ranked suspect hotspots, blast radius summaries for affected services, parsed first-seen and last-seen windows, and a practical next-step checklist. It can excavate embedded traces from noisy raw logs before grouping repeated incidents, looking up known versus novel failures in an incident memory, recalling remembered fixes and owners from annotated casebooks, comparing releases, mapping rollout drift, or ranking several incident packs into one cross-pack release queue.

## Browser demo

Open `index.html` directly, or serve the folder with any static file server. The browser app uses the same shared analysis engine as the CLI, so excavation status, culprit detection, signatures, support frames, suspect hotspots, blast radius summaries, incident digest output, casebook lookup, regression comparison, and timeline trend calls stay aligned across every workflow.

Use the built-in example buttons to compare the main workflows:
- single-trace diagnosis with suspect hotspots
- raw log excavation from noisy production logs with blast radius service spread and parsed windows
- repeated traces grouped into an Incident Digest with shared hotspots
- markdown notebook ingest that normalizes a handoff note into the existing incident-pack workflow
- known-versus-novel incident lookup in Casebook Radar mode with labeled prior incidents plus remembered fix, owner, and runbook recall
- baseline and candidate batches compared in Regression Radar mode with hotspot shifts
- labeled rollout snapshots analyzed in Timeline Radar mode with trend calls and hotspot movement
- one structured Incident Pack Briefing that composes current, history, regression, and rollout context in a single pass
- several structured incident packs ranked in Portfolio Radar mode with an owner-aware response queue, explicit routing gaps, runbook gaps, recurring incidents, and shared hotspots
- Casebook Forge turning a labeled portfolio into a reusable casebook export for future incident memory
- Casebook Dataset packaging a labeled portfolio into a reusable JSON dataset plus export text for saved incident memory
- Casebook Merge turning a labeled portfolio plus embedded history into a living casebook update with visible merge conflicts
- browser copy that includes excavation-aware summaries plus notebook normalization when the input started as a markdown handoff

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

## Notebook ingest

Notebook ingest is the fastest way to reuse the richer Incident Pack Briefing and Portfolio Radar workflows when the source artifact is already a markdown handoff note instead of an `@@` or `@@@` bundle.

In the browser, paste a markdown notebook into the shared workspace, then press **Explain trace(s)**, **Copy result**, or **Load notebook example**. Stack Sleuth recognizes headings like `## Current incident`, `## Prior incidents`, `## Baseline`, `## Candidate`, and `## Timeline`, normalizes them into the existing structured workflow, and then shows or copies the routed briefing.

From the CLI, point `--notebook` at a markdown note or pipe one through stdin:

```bash
node ./bin/stack-sleuth.js --notebook ./incident-note.md
```

```bash
cat incident-note.md | node ./bin/stack-sleuth.js --notebook - --markdown
```

A single notebook becomes one normalized incident pack. Multiple `# Pack: label` headings become one normalized portfolio. A compact notebook can look like this:

```text
# Checkout incident notebook

## Current incident
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

## Prior incidents
=== release-2026-04-15 ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

## Baseline
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

## Candidate
TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)

## Timeline
=== canary ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
```

Stack Sleuth will normalize those headings into the supported incident pack or portfolio shape, then reuse the existing briefing and ranking engines instead of inventing a separate notebook-only analysis path.

## Incident Workspace

Incident Workspace is the bridge from pasted examples to a real incident folder. Instead of reassembling everything into one `@@` or `@@@` document, point `--workspace` at the directory you already have on disk and let Stack Sleuth normalize it into the existing Incident Pack Briefing or Portfolio Radar workflows.

### Analyze a single incident folder

```bash
node ./bin/stack-sleuth.js --workspace ./incident-room
```

Supported single-workspace files are discovered by convention:

- `current.log`, `current.txt`, or `current.trace`
- `history.casebook`, `history.txt`, or `history.log`
- `baseline.log` or `baseline.txt`
- `candidate.log` or `candidate.txt`
- `timeline.log` or `timeline.txt`
- `notebook.md`

If explicit section files exist, Stack Sleuth uses them first. A folder with only `notebook.md` reuses the same notebook normalization flow as `--notebook`.

```text
incident-room/
  current.log
  history.casebook
  candidate.log
```

### Analyze a portfolio workspace rooted at `packs/<label>/`

```bash
node ./bin/stack-sleuth.js --workspace ./release-review --json
```

Each pack directory under `packs/<label>/` follows the same filename conventions as a single incident folder.

```text
release-review/
  packs/
    checkout-prod/
      current.log
      history.casebook
    billing-canary/
      baseline.log
      candidate.log
```

This keeps the public CLI opinionated but lightweight. Real folders normalize into the same reusable pack and portfolio engines, so one workspace can move from ad hoc triage to ranking, casebook forging, or casebook merge without a second translation step.

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

## Portfolio Radar

Portfolio Radar wraps several Incident Pack Briefings into one release-level queue. Use it when one deploy, rollout, or incident-review thread already has multiple packs and you want one ranked answer about which pack deserves attention first, which signatures recur across packs, which hotspot files keep showing up, who likely owns the known incidents, and where the dangerous routing gaps still need fresh triage.

### Analyze a labeled portfolio from a file

```bash
node ./bin/stack-sleuth.js --portfolio ./portfolio.txt
```

### Analyze a labeled portfolio from stdin in JSON mode

```bash
cat portfolio.txt | node ./bin/stack-sleuth.js --portfolio - --json
```

### Analyze a labeled portfolio in Markdown

```bash
node ./bin/stack-sleuth.js --portfolio ./portfolio.txt --markdown
```

Wrap each incident pack with `@@@ label @@@` markers, then keep the existing inner `@@ current @@`, `@@ history @@`, `@@ baseline @@`, `@@ candidate @@`, and `@@ timeline @@` sections unchanged:

```text
@@@ checkout-prod @@@
@@ current @@
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

@@@ profile-rollout @@@
@@ current @@
ProfileHydrationError: Profile payload missing account metadata
    at renderProfileState (/app/src/profile.js:102:9)

@@ history @@
=== release-2026-04-15 ===
>>> summary: Checkout profile payload dropped account metadata before render
>>> fix: Guard renderProfile before reading account.name
>>> owner: web-platform
>>> runbook: https://example.com/runbooks/profile-null
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

@@@ billing-canary @@@
@@ baseline @@
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

@@ candidate @@
TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
```

Portfolio Radar now adds a deterministic owner-aware response queue on top of the ranking:

- groups recalled owners by impacted pack label
- carries remembered fixes and runbook links into the queue entry
- flags routing gaps when a runnable pack has no recalled owner
- flags runbook gaps when a runnable pack has no recalled runbook
- keeps recurring incidents and shared hotspots visible across packs

In the browser, paste the full labeled portfolio into the shared workspace, then press **Explain trace(s)** or **Load portfolio example** to generate one Portfolio Radar summary with the response queue, routing gaps, and runbook gaps.

## Casebook Forge

Casebook Forge is the bridge from active triage to reusable incident memory. Feed it the same labeled portfolio used by Portfolio Radar and it will emit a reusable casebook export in the existing `=== label ===` format, ready to save and feed back into later Casebook Radar or Incident Pack Briefing runs.

### Forge a reusable casebook from a labeled portfolio file

```bash
node ./bin/stack-sleuth.js --forge ./portfolio.txt
```

### Forge from stdin in JSON mode

```bash
cat portfolio.txt | node ./bin/stack-sleuth.js --forge - --json
```

### Forge in Markdown

```bash
node ./bin/stack-sleuth.js --forge ./portfolio.txt --markdown
```

Casebook Forge reuses the same `@@@ label @@@` portfolio wrapper plus the existing inner `@@ current @@`, `@@ history @@`, `@@ baseline @@`, `@@ candidate @@`, and `@@ timeline @@` sections. The output includes a summary plus a reusable casebook export like this:

```text
=== release-2026-04-15 ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

=== profile-js-generic-runtime-error ===
ProfileHydrationError: Profile payload missing account metadata
    at renderProfileState (/app/src/profile.js:102:9)
```

Save that forged export as a history file and reuse it with `--history`, or paste it into an `@@ history @@` section inside a later Incident Pack Briefing.

In the browser, paste the full labeled portfolio into the shared workspace, then press **Explain trace(s)** or **Load Casebook Forge example** to inspect the reusable casebook flow.

## Casebook Dataset

Casebook Dataset is the CLI-friendly handoff artifact between Portfolio Radar, Casebook Forge, and later Casebook Radar runs. Feed it the same labeled portfolio and it will package the ranked portfolio signals, response queue, recurring hotspots, merged case list, and a reusable casebook export into one saved JSON blob.

### Build a reusable dataset from a labeled portfolio file

```bash
node ./bin/stack-sleuth.js --dataset ./portfolio.txt
```

### Build a dataset from stdin in JSON mode

```bash
cat portfolio.txt | node ./bin/stack-sleuth.js --dataset - --json
```

### Build a dataset in Markdown

```bash
node ./bin/stack-sleuth.js --dataset ./portfolio.txt --markdown
```

The JSON payload includes the reusable `exportText` casebook plus summary fields you can keep in source control or attach to an incident handoff. Save that JSON artifact and later reuse it directly with `--history`:

```bash
cat current.log | node ./bin/stack-sleuth.js --history ./casebook-dataset.json
```

That makes the dataset a durable casebook snapshot instead of a one-time report.

In the browser, Portfolio Radar now surfaces the same dataset summary and reusable export text in dedicated Casebook Dataset cards, so the visible triage view and the saved CLI artifact stay aligned. You can also press **Load Casebook Dataset example** to open the shared portfolio example directly in that dataset-oriented view.

## Casebook Merge

Casebook Merge takes the next step after Casebook Forge. Feed it the same labeled portfolio, including any embedded `@@ history @@` sections, and it will produce an updated living casebook export that keeps human-authored `summary`, `fix`, `owner`, and `runbook` guidance when possible, adds fresh `seen-count` and `source-packs` metadata, and flags merge conflicts when two historical entries disagree about the same signature.

### Merge a living casebook from a labeled portfolio file

```bash
node ./bin/stack-sleuth.js --merge-casebook ./portfolio.txt
```

### Merge from stdin in JSON mode

```bash
cat portfolio.txt | node ./bin/stack-sleuth.js --merge-casebook - --json
```

### Merge in Markdown

```bash
node ./bin/stack-sleuth.js --merge-casebook ./portfolio.txt --markdown
```

Casebook Merge reuses the same `@@@ label @@@` portfolio wrapper as Portfolio Radar and Casebook Forge. The merged export stays in the existing `=== label ===` casebook format, but now carries living-casebook metadata like this:

```text
=== release-2026-04-15 ===
>>> summary: Checkout profile payload dropped account metadata before render
>>> fix: Guard renderProfile before reading account.name
>>> owner: web-platform
>>> seen-count: 3
>>> source-packs: checkout-prod, profile-rollout, billing-canary
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
```

Use the merge summary to review conflicts before saving the updated casebook back into your incident-memory workflow.

In the browser, paste the full labeled portfolio into the shared workspace, then press **Explain trace(s)** or **Load Casebook Merge example** to inspect the living-casebook update flow.

## Casebook Radar

Casebook Radar compares a current incident batch against labeled historical cases so you can tell which failures are known repeats versus novel incidents. It also supports optional runbook metadata on historical cases, so a known match can recall the last summary, fix, owner, or runbook link immediately. It works with direct traces or noisy raw logs, and `--history` can read either the labeled `=== case ===` format or a saved Casebook Dataset JSON artifact, so the repo reads like a compact incident-memory tool instead of a one-off parser.

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
>>> summary: Checkout profile payload dropped account metadata before render
>>> fix: Guard renderProfile before reading account.name
>>> owner: web-platform
>>> runbook: https://example.com/runbooks/profile-null
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

=== profile-rewrite ===
TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)

TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
```

The `>>> key: value` lines are optional. Today Stack Sleuth recognizes `summary`, `fix`, `owner`, and `runbook`, and it surfaces those fields whenever a current incident exactly matches that known case.

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
