# Stack Sleuth Response Bundle Chronicle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Stack Sleuth compare several saved response bundle replay artifacts in one pass, producing a bundle-aware chronicle across releases in CLI and browser workflows.

**Architecture:** Add a new `src/bundle-chronicle.js` engine on top of saved response bundle replay artifacts, then thread it through CLI, browser detection, examples, docs, and tests.

**Tech Stack:** Node.js, ESM modules, built-in `node:test`, browser DOM rendering

---

## File structure

- Create `src/bundle-chronicle.js`
- Create `tests/bundle-chronicle.test.mjs`
- Modify `bin/stack-sleuth.js`
- Modify `src/main.js`
- Modify `src/examples.js`
- Modify `README.md`
- Modify `tests/cli.test.mjs`
- Modify `tests/browser-copy.test.mjs`
- Modify `tests/examples.test.mjs`
- Modify `tests/readme.test.mjs`

---

### Task 1: Build the bundle chronicle engine

**Files:**
- Create: `src/bundle-chronicle.js`
- Create: `tests/bundle-chronicle.test.mjs`

- [ ] Write failing tests for labeled snapshot parsing, response-bundle replay validation, trend classification, bundle inventory drift, and text plus Markdown renderers.
- [ ] Run `node --test tests/bundle-chronicle.test.mjs` and verify failure before implementation.
- [ ] Implement the minimal bundle chronicle engine and summary renderers.
- [ ] Re-run `node --test tests/bundle-chronicle.test.mjs` and verify pass.
- [ ] Commit the chronicle-engine slice.

### Task 2: Wire chronicle through CLI and browser flows

**Files:**
- Modify: `bin/stack-sleuth.js`
- Modify: `src/main.js`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/browser-copy.test.mjs`

- [ ] Add failing tests for `--bundle-chronicle` text, Markdown, and JSON output plus browser chronicle detection for pasted labeled bundle snapshots.
- [ ] Run `node --test tests/cli.test.mjs tests/browser-copy.test.mjs` and verify failure before implementation.
- [ ] Implement CLI routing, browser detection, chronicle rendering, and bundle-specific error states.
- [ ] Re-run `node --test tests/cli.test.mjs tests/browser-copy.test.mjs` and verify pass.
- [ ] Commit the CLI and browser slice.

### Task 3: Refresh examples and public docs

**Files:**
- Modify: `src/examples.js`
- Modify: `README.md`
- Modify: `tests/examples.test.mjs`
- Modify: `tests/readme.test.mjs`

- [ ] Add failing tests for the response bundle chronicle example and README coverage.
- [ ] Run `node --test tests/examples.test.mjs tests/readme.test.mjs` and verify failure before implementation.
- [ ] Update examples and README so the saved-bundle drift workflow is obvious from the public repo.
- [ ] Re-run `node --test tests/examples.test.mjs tests/readme.test.mjs` and verify pass.
- [ ] Commit the public-artifact slice.

### Task 4: Final validation and ship

- [ ] Run `npm test`.
- [ ] Inspect CLI output for `--bundle-chronicle` text and markdown examples.
- [ ] Run `python3 scripts/publish_helper.py <sanitized-artifact-path>` before pushing or opening the PR.
- [ ] Commit the final branch with a public-facing message.
- [ ] Record cycle notes, machine metadata, state updates, and preview registry updates.

## Definition of done
- Stack Sleuth accepts labeled saved response bundle replay artifacts as one chronicle workflow.
- CLI and browser both render saved-bundle drift summaries from the same analysis path.
- Output includes bundle-aware context like source workflow and inventory trends while staying honest about saved-artifact limits.
- README and examples make the feature obvious to outsiders.