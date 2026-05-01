# Stack Sleuth Artifact Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Stack Sleuth saved artifacts round-trip honestly by preserving full Casebook Dataset coordination state in JSON output and letting Action Board open saved response-bundle directories directly.

**Architecture:** Keep the existing dataset and bundle replay contracts, but patch the CLI serializer to stop dropping preserved fields and reuse the existing response-bundle directory loader for Action Board input. Validate the behavior with focused CLI tests, then refresh README guidance so the saved-artifact workflow is explicit.

**Tech Stack:** Node.js ESM, built-in `node:test`, Stack Sleuth CLI routing, saved dataset replay, response-bundle replay, Action Board engine.

---

## File structure

- Modify: `bin/stack-sleuth.js`
- Modify: `README.md`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/readme.test.mjs`

### Task 1: Lock the saved-artifact fidelity contract with failing CLI tests

**Files:**
- Modify: `tests/cli.test.mjs`

- [ ] **Step 1: Write the failing dataset-fidelity and board-directory tests**

```js
test('CLI dataset json preserves routing gaps, runbook gaps, steward state, and board state', () => {
  const result = runCli(['--dataset', '-', '--json'], { input: portfolioInput });
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.kind, 'stack-sleuth-casebook-dataset');
  assert.ok(Array.isArray(parsed.routingGaps));
  assert.ok(Array.isArray(parsed.runbookGaps));
  assert.equal(parsed.steward?.summary?.actionCount > 0, true);
  assert.equal(parsed.board?.summary?.totalCards > 0, true);
});

test('CLI builds an Action Board from a saved response bundle directory path', async () => {
  const outputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'stack-sleuth-board-dir-'));
  const writeResult = runCli(['--portfolio', '-', '--bundle', outputDir], { input: portfolioInput });
  assert.equal(writeResult.status, 0, writeResult.stderr);

  const result = runCli(['--board', outputDir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stack Sleuth Action Board/);
  assert.match(result.stdout, /saved response bundle/i);
});
```

- [ ] **Step 2: Run the focused CLI tests and verify RED**

Run: `node --test tests/cli.test.mjs --test-name-pattern "dataset json preserves|saved response bundle directory path"`
Expected: FAIL because dataset JSON output is missing the preserved coordination fields and `--board` does not accept saved bundle directories yet.

- [ ] **Step 3: Commit the red test slice**

```bash
git add tests/cli.test.mjs
git commit -m "test: lock stack sleuth artifact fidelity regressions"
```

### Task 2: Patch the serializer and Action Board input path minimally

**Files:**
- Modify: `bin/stack-sleuth.js`
- Test: `tests/cli.test.mjs`

- [ ] **Step 1: Update dataset serialization to preserve the full saved coordination payload**

```js
if (payload?.kind === 'stack-sleuth-casebook-dataset' && typeof payload?.version === 'number') {
  return {
    kind: payload.kind,
    version: payload.version,
    summary: payload.summary,
    gate: payload.gate ?? null,
    portfolio: { packOrder: payload.portfolio?.packOrder ?? [] },
    responseQueue: payload.responseQueue ?? [],
    routingGaps: payload.routingGaps ?? [],
    runbookGaps: payload.runbookGaps ?? [],
    recurringIncidents: payload.recurringIncidents ?? [],
    recurringHotspots: payload.recurringHotspots ?? [],
    cases: serializeCases(payload.cases ?? []),
    steward: payload.steward ?? null,
    board: payload.board ?? null,
    exportText: payload.exportText,
  };
}
```

- [ ] **Step 2: Route `--board` file input through the response-bundle directory loader when appropriate**

```js
if (boardPath) {
  const boardInput = readBoardInput(boardPath);
  const board = buildActionBoard(boardInput);
  ...
}

function readBoardInput(targetPath) {
  if (targetPath === '-') {
    return fs.readFileSync(0, 'utf8');
  }

  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    return readReplayBundleInput(targetPath);
  }

  return readNamedInput(targetPath, 'action board');
}
```

- [ ] **Step 3: Re-run the focused CLI tests and verify GREEN**

Run: `node --test tests/cli.test.mjs --test-name-pattern "dataset json preserves|saved response bundle directory path"`
Expected: PASS.

- [ ] **Step 4: Run the broader affected CLI replay coverage**

Run: `node --test tests/cli.test.mjs --test-name-pattern "saved dataset|Action Board|response bundle"`
Expected: PASS.

- [ ] **Step 5: Commit the implementation slice**

```bash
git add bin/stack-sleuth.js tests/cli.test.mjs
git commit -m "feat: improve stack sleuth saved artifact fidelity"
```

### Task 3: Document the upgraded saved-artifact workflow and verify the suite

**Files:**
- Modify: `README.md`
- Modify: `tests/readme.test.mjs`

- [ ] **Step 1: Add failing README assertions for the new workflow**

```js
test('README documents Action Board bundle-directory replay and dataset fidelity', () => {
  assert.match(readme, /--board \.\/sample\/response-bundle/i);
  assert.match(readme, /preserves routing gaps, runbook gaps, steward state, and Action Board state/i);
});
```

- [ ] **Step 2: Run the focused README test and verify RED**

Run: `node --test tests/readme.test.mjs`
Expected: FAIL until the README mentions the new saved-artifact guarantees and direct Action Board directory flow.

- [ ] **Step 3: Update the README examples and saved-artifact wording**

```md
### Build an Action Board directly from a saved response bundle directory

```bash
node ./bin/stack-sleuth.js --board ./sample/response-bundle
```

`--dataset --json` now preserves routing gaps, runbook gaps, steward state, and Action Board state so saved stdout remains a full-fidelity replay artifact.
```

- [ ] **Step 4: Run the full suite and verify GREEN**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit the docs slice**

```bash
git add README.md tests/readme.test.mjs
git commit -m "docs: clarify stack sleuth saved artifact workflows"
```

## Self-review
- Spec coverage: dataset fidelity, direct board directory intake, compatibility expectations, CLI tests, and README guidance are each covered by at least one task.
- Placeholder scan: no TODO or TBD markers remain.
- Type consistency: `routingGaps`, `runbookGaps`, `steward`, and `board` use the same names in tests, serializer output, and docs.

## Execution handoff
Plan complete and saved to `docs/superpowers/plans/2026-05-01-stack-sleuth-artifact-fidelity.md`.
For this autonomous cycle, execute with the required subagent-driven-development workflow in-session.
