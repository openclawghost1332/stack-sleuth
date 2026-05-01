# Stack Sleuth Dataset Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make saved Stack Sleuth Casebook Dataset artifacts first-class, replayable outputs across CLI and browser, with explicit schema-version checks.

**Architecture:** Extend the shared dataset module so it owns dataset validation, replay normalization, and shared summary renderers. Then wire one CLI replay workflow and one browser replay path on top of that shared module so saved artifacts reopen consistently without re-running raw portfolio input.

**Tech Stack:** Node.js, built-in test runner, ESM modules, static browser UI.

---

## File structure
- Modify: `src/dataset.js` for dataset constants, validation, replay helpers, and shared renderers.
- Modify: `bin/stack-sleuth.js` for `--replay-dataset` routing and version-aware dataset errors.
- Modify: `src/main.js` for browser dataset auto-detect and replay rendering.
- Modify: `src/examples.js` so the dataset example demonstrates saved-artifact replay.
- Modify: `README.md` for CLI and browser dataset replay docs.
- Modify: `tests/dataset.test.mjs`, `tests/cli.test.mjs`, `tests/browser-copy.test.mjs`, `tests/examples.test.mjs`, and `tests/readme.test.mjs`.

### Task 1: Build the shared dataset replay engine

**Files:**
- Modify: `src/dataset.js`
- Test: `tests/dataset.test.mjs`

- [ ] **Step 1: Write failing dataset replay tests**
  Add tests for a valid replay inspection result, an unsupported-version result, and shared text or markdown renderers that include summary, owner count, and export text.

- [ ] **Step 2: Run the dataset tests to verify RED**
  Run: `npm test -- tests/dataset.test.mjs`
  Expected: FAIL because replay helpers and renderers do not exist yet.

- [ ] **Step 3: Implement minimal replay helpers in `src/dataset.js`**
  Add exported helpers that validate saved dataset JSON by `kind` and `version`, return normalized replay payloads, and render shared text or markdown summaries from dataset artifacts.

- [ ] **Step 4: Re-run the dataset tests to verify GREEN**
  Run: `npm test -- tests/dataset.test.mjs`
  Expected: PASS.

- [ ] **Step 5: Commit the dataset engine task**
  Run:
  ```bash
  git add src/dataset.js tests/dataset.test.mjs
  git commit -m "feat: add stack sleuth dataset replay engine"
  ```

### Task 2: Add CLI replay and version-aware history errors

**Files:**
- Modify: `bin/stack-sleuth.js`
- Test: `tests/cli.test.mjs`

- [ ] **Step 1: Write failing CLI tests**
  Add tests for `--replay-dataset -` text output, `--replay-dataset --markdown`, `--replay-dataset --json`, and unsupported-version errors during both replay and `--history` reuse.

- [ ] **Step 2: Run the CLI tests to verify RED**
  Run: `npm test -- tests/cli.test.mjs`
  Expected: FAIL because the new flag and version error path do not exist yet.

- [ ] **Step 3: Implement CLI replay routing**
  Add `--replay-dataset <path|->` argument parsing, wire replay output to the shared dataset renderers, and make `--history` reject unsupported versions explicitly.

- [ ] **Step 4: Re-run the CLI tests to verify GREEN**
  Run: `npm test -- tests/cli.test.mjs`
  Expected: PASS.

- [ ] **Step 5: Commit the CLI task**
  Run:
  ```bash
  git add bin/stack-sleuth.js tests/cli.test.mjs
  git commit -m "feat: add stack sleuth dataset replay cli"
  ```

### Task 3: Replay saved datasets in the browser demo

**Files:**
- Modify: `src/main.js`
- Modify: `src/examples.js`
- Test: `tests/browser-copy.test.mjs`
- Test: `tests/examples.test.mjs`

- [ ] **Step 1: Write failing browser and example tests**
  Add tests that paste saved dataset JSON into the main textarea, assert dataset replay card content and reset behavior, and ensure the dataset example now provides replayable JSON input and caption copy.

- [ ] **Step 2: Run the targeted browser and example tests to verify RED**
  Run: `npm test -- tests/browser-copy.test.mjs tests/examples.test.mjs`
  Expected: FAIL because browser dataset replay detection does not exist yet.

- [ ] **Step 3: Implement browser dataset replay flow**
  Detect saved dataset JSON before notebook or portfolio parsing, render saved summary and cards without raw-trace assumptions, and update the dataset example button to load replayable dataset input.

- [ ] **Step 4: Re-run the targeted tests to verify GREEN**
  Run: `npm test -- tests/browser-copy.test.mjs tests/examples.test.mjs`
  Expected: PASS.

- [ ] **Step 5: Commit the browser task**
  Run:
  ```bash
  git add src/main.js src/examples.js tests/browser-copy.test.mjs tests/examples.test.mjs
  git commit -m "feat: replay saved datasets in browser demo"
  ```

### Task 4: Refresh README and full-suite validation

**Files:**
- Modify: `README.md`
- Test: `tests/readme.test.mjs`

- [ ] **Step 1: Write or adjust failing README assertions**
  Update README tests to require `--replay-dataset` documentation and replay guidance for saved dataset JSON in the browser.

- [ ] **Step 2: Run README tests to verify RED**
  Run: `npm test -- tests/readme.test.mjs`
  Expected: FAIL because the README does not mention dataset replay yet.

- [ ] **Step 3: Update docs with the shipped workflow**
  Document the new replay command, the saved-dataset browser flow, and the version-safety story.

- [ ] **Step 4: Run the full suite**
  Run: `npm test`
  Expected: PASS with the whole suite green.

- [ ] **Step 5: Commit the docs and validation task**
  Run:
  ```bash
  git add README.md tests/readme.test.mjs
  git commit -m "docs: add stack sleuth dataset replay workflow"
  ```