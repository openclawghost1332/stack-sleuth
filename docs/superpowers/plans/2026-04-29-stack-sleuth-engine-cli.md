# Stack Sleuth engine + CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Stack Sleuth into a reusable stack-trace analysis engine with a real CLI while keeping the browser demo as the visible face.

**Architecture:** Add a shared `analyzeTrace()` engine that composes the parser and diagnosis logic, generates stable signatures, and returns render-ready report helpers. Build one CLI on top of that engine and update the browser UI to expose the new fields.

**Tech Stack:** Vanilla JavaScript, Node.js test runner, browser ES modules

---

## File map
- Create: `bin/stack-sleuth.js`
- Create: `src/analyze.js`
- Create: `tests/analyze.test.mjs`
- Create: `tests/cli.test.mjs`
- Modify: `package.json`
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `tests/readme.test.mjs`

### Task 1: Shared analysis engine

**Files:**
- Create: `src/analyze.js`
- Test: `tests/analyze.test.mjs`

- [ ] Step 1: Write failing tests for the shared engine.
- [ ] Step 2: Run `npm test -- tests/analyze.test.mjs` and confirm the new tests fail because `src/analyze.js` does not exist yet.
- [ ] Step 3: Implement `analyzeTrace()`, `buildSignature()`, support-frame selection, and text/markdown render helpers in `src/analyze.js` with minimal code to satisfy the tests.
- [ ] Step 4: Run `npm test -- tests/analyze.test.mjs` and confirm the suite passes.
- [ ] Step 5: Commit with `git add src/analyze.js tests/analyze.test.mjs && git commit -m "feat: add shared stack analysis engine"`.

### Task 2: CLI

**Files:**
- Create: `bin/stack-sleuth.js`
- Modify: `package.json`
- Test: `tests/cli.test.mjs`

- [ ] Step 1: Write failing CLI tests covering stdin input, file-path input, `--json`, `--markdown`, and empty-input failure.
- [ ] Step 2: Run `npm test -- tests/cli.test.mjs` and confirm the new tests fail for the expected missing CLI behavior.
- [ ] Step 3: Implement the CLI with argument parsing, input loading, non-zero exits for empty or unreadable input, and output mode selection using `src/analyze.js`.
- [ ] Step 4: Run `npm test -- tests/cli.test.mjs` and confirm the suite passes.
- [ ] Step 5: Commit with `git add bin/stack-sleuth.js package.json tests/cli.test.mjs && git commit -m "feat: add stack sleuth cli"`.

### Task 3: Browser and docs refresh

**Files:**
- Modify: `src/main.js`
- Modify: `index.html`
- Modify: `README.md`
- Modify: `tests/readme.test.mjs`

- [ ] Step 1: Write or extend failing tests for README CLI documentation and any engine-facing browser helpers that can be exercised without a DOM runner.
- [ ] Step 2: Run the targeted tests and confirm they fail for the expected missing content.
- [ ] Step 3: Update the browser app to use `analyzeTrace()` and show the new signature and support-frame fields. Update README to document browser + CLI workflows.
- [ ] Step 4: Run `npm test` and confirm the full suite passes.
- [ ] Step 5: Commit with `git add src/main.js index.html README.md tests/readme.test.mjs && git commit -m "feat: refresh stack sleuth browser and docs"`.
