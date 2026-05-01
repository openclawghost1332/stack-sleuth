# Stack Sleuth Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared Release Gate layer so Stack Sleuth turns existing portfolio signals into a deterministic verdict, preserves that verdict in Casebook Dataset artifacts, and surfaces gate drift in Chronicle and Shelf.

**Architecture:** Build one shared `src/gate.js` engine, thread it through Portfolio, Dataset, Chronicle, Shelf, CLI, browser, examples, and README, and keep saved-artifact replay backward compatible.

**Tech Stack:** Node.js, ESM modules, built-in `node:test`, browser DOM rendering

---

## File structure

- Create `src/gate.js`
- Create `tests/gate.test.mjs`
- Modify `src/portfolio.js`
- Modify `src/dataset.js`
- Modify `src/chronicle.js`
- Modify `src/shelf.js`
- Modify `src/main.js`
- Modify `src/examples.js`
- Modify `README.md`
- Modify `tests/portfolio.test.mjs`
- Modify `tests/dataset.test.mjs`
- Modify `tests/chronicle.test.mjs`
- Modify `tests/shelf.test.mjs`
- Modify `tests/browser-copy.test.mjs`
- Modify `tests/cli.test.mjs`
- Modify `tests/examples.test.mjs`
- Modify `tests/readme.test.mjs`

---

### Task 1: Build the shared gate engine

**Files:**
- Create: `src/gate.js`
- Create: `tests/gate.test.mjs`

- [ ] Write failing gate unit tests for verdict classification, signal grouping, and chronicle drift helpers.
- [ ] Run `node --test tests/gate.test.mjs` and verify failure before implementation.
- [ ] Implement the minimal shared gate engine with deterministic blocker or warning policy plus replay-friendly normalization helpers.
- [ ] Re-run `node --test tests/gate.test.mjs` and verify pass.
- [ ] Commit the gate engine slice.

### Task 2: Thread Release Gate through Portfolio and Dataset

**Files:**
- Modify: `src/portfolio.js`
- Modify: `src/dataset.js`
- Modify: `tests/portfolio.test.mjs`
- Modify: `tests/dataset.test.mjs`
- Modify: `tests/cli.test.mjs`

- [ ] Add failing tests covering portfolio gate verdicts and dataset gate preservation.
- [ ] Run the targeted tests and verify failure.
- [ ] Add gate output to portfolio reports and CLI renderers.
- [ ] Preserve and normalize gate output in Casebook Dataset build and replay paths without breaking older artifacts.
- [ ] Re-run targeted tests and verify pass.
- [ ] Commit the portfolio or dataset slice.

### Task 3: Surface gate drift in Chronicle, Shelf, browser, docs, and examples

**Files:**
- Modify: `src/chronicle.js`
- Modify: `src/shelf.js`
- Modify: `src/main.js`
- Modify: `src/examples.js`
- Modify: `README.md`
- Modify: `tests/chronicle.test.mjs`
- Modify: `tests/shelf.test.mjs`
- Modify: `tests/browser-copy.test.mjs`
- Modify: `tests/examples.test.mjs`
- Modify: `tests/readme.test.mjs`

- [ ] Add failing tests for chronicle or shelf gate summaries, browser copy, and README coverage.
- [ ] Run the targeted tests and verify failure.
- [ ] Implement gate-aware Chronicle and Shelf summaries plus browser copy updates.
- [ ] Update examples and README to make Release Gate obvious from the public artifact.
- [ ] Re-run targeted tests and verify pass.
- [ ] Commit the UX and docs slice.

### Task 4: Final validation and ship

- [ ] Run `npm test`.
- [ ] Inspect CLI output for portfolio, dataset replay, chronicle, and shelf examples.
- [ ] Run `python3 scripts/publish_helper.py projects/stack-sleuth` from the workspace root before pushing.
- [ ] Commit the final branch with a public-facing message.
- [ ] Record cycle notes, machine metadata, state updates, and preview registry updates.

## Definition of done
- Portfolio Radar emits a deterministic release verdict with blocker or warning reasons.
- Casebook Dataset preserves that verdict and older datasets still replay.
- Chronicle and Shelf show whether the saved release gate improved, regressed, or stayed flat.
- Browser, CLI, README, and examples all expose the new workflow clearly.
