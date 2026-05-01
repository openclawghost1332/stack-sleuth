# Stack Sleuth Response Bundle Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Stack Sleuth response bundles reopenable by exporting a self-contained replay artifact and adding CLI plus browser replay support with backward-compatible directory replay.

**Architecture:** Extend the existing response-bundle builder to emit a version-2 replay JSON artifact, add a shared `src/bundle-replay.js` normalizer and summary layer, then wire replay through CLI, browser, examples, docs, and tests.

**Tech Stack:** Node.js, ESM modules, built-in `node:test`, browser DOM rendering

---

## File structure

- Create `src/bundle-replay.js`
- Create `tests/bundle-replay.test.mjs`
- Modify `src/bundle.js`
- Modify `bin/stack-sleuth.js`
- Modify `src/main.js`
- Modify `src/examples.js`
- Modify `README.md`
- Modify `tests/bundle.test.mjs`
- Modify `tests/cli.test.mjs`
- Modify `tests/browser-copy.test.mjs`
- Modify `tests/examples.test.mjs`
- Modify `tests/readme.test.mjs`
- Modify `sample/response-bundle/*`

---

### Task 1: Build the replay contract and shared normalizer

**Files:**
- Create: `src/bundle-replay.js`
- Modify: `src/bundle.js`
- Create: `tests/bundle-replay.test.mjs`
- Modify: `tests/bundle.test.mjs`

- [ ] Write failing tests for response-bundle replay inspection, version normalization, non-recursive replay payload export, and text-summary helpers.
- [ ] Run `node --test tests/bundle-replay.test.mjs tests/bundle.test.mjs` and verify failure before implementation.
- [ ] Implement the minimal replay normalizer plus version-2 bundle export with `response-bundle.json`.
- [ ] Re-run `node --test tests/bundle-replay.test.mjs tests/bundle.test.mjs` and verify pass.
- [ ] Commit the replay-contract slice.

### Task 2: Thread replay through CLI and browser flows

**Files:**
- Modify: `bin/stack-sleuth.js`
- Modify: `src/main.js`
- Modify: `tests/cli.test.mjs`
- Modify: `tests/browser-copy.test.mjs`

- [ ] Add failing tests for `--replay-bundle` from file, stdin, and directory inputs plus browser replay detection for pasted replay JSON.
- [ ] Run `node --test tests/cli.test.mjs tests/browser-copy.test.mjs` and verify failure before implementation.
- [ ] Implement CLI replay routing, legacy directory compatibility, and browser replay rendering.
- [ ] Re-run `node --test tests/cli.test.mjs tests/browser-copy.test.mjs` and verify pass.
- [ ] Commit the replay-surface slice.

### Task 3: Refresh examples, docs, and the public sample artifact

**Files:**
- Modify: `src/examples.js`
- Modify: `README.md`
- Modify: `tests/examples.test.mjs`
- Modify: `tests/readme.test.mjs`
- Modify: `sample/response-bundle/*`

- [ ] Add failing tests for the response-bundle replay example, README documentation, and committed sample artifact contents.
- [ ] Run `node --test tests/examples.test.mjs tests/readme.test.mjs` and verify failure before implementation.
- [ ] Update examples, README, and the sample response bundle to make replay obvious from the public repo.
- [ ] Re-run `node --test tests/examples.test.mjs tests/readme.test.mjs` and verify pass.
- [ ] Commit the public-artifact slice.

### Task 4: Final validation and ship

- [ ] Run `npm test`.
- [ ] Inspect CLI output for bundle export and bundle replay examples.
- [ ] Run `python3 scripts/publish_helper.py <sanitized-artifact-path>` before pushing or opening the PR.
- [ ] Commit the final branch with a public-facing message.
- [ ] Record cycle notes, machine metadata, state updates, and preview registry updates.

## Definition of done
- Response bundles export a self-contained replay artifact.
- CLI replay works for replay JSON, stdin, and legacy bundle directories.
- Browser replay works for pasted replay JSON artifacts.
- Sample artifacts and README make the reopenable bundle story obvious.
