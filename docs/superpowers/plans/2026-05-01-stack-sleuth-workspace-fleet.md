# Stack Sleuth Workspace Fleet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a directory of real incident workspaces into one ranked Stack Sleuth command queue that can also be replayed later from a saved fleet artifact.

**Architecture:** Add a new `workspace-fleet` artifact family that scans top-level directories, reuses the existing workspace normalization path to route pack, notebook, and portfolio workspaces, computes deterministic priority scores and reasons, and renders text, markdown, or JSON summaries plus replay support.

**Tech Stack:** Node.js, built-in `node:test`, existing Stack Sleuth CLI and analyzer modules.

---

## File map
- Create: `src/workspace-fleet.js`
- Modify: `bin/stack-sleuth.js`
- Modify: `README.md`
- Modify: `tests/cli.test.mjs`
- Create: `tests/workspace-fleet.test.mjs`
- Modify: `tests/readme.test.mjs`
- Create: `sample/workspace-fleet.json`

### Task 1: Fleet artifact core under TDD
**Files:**
- Create: `tests/workspace-fleet.test.mjs`
- Create: `src/workspace-fleet.js`

- [ ] Write failing unit tests for replay inspection, deterministic sorting, mixed workspace scoring, invalid-warning preservation, and honest renderer copy.
- [ ] Run `node --test tests/workspace-fleet.test.mjs` and verify the failures come from the missing module or missing exports.
- [ ] Implement the minimal fleet artifact helpers and renderers in `src/workspace-fleet.js`.
- [ ] Re-run `node --test tests/workspace-fleet.test.mjs` until it passes.
- [ ] Commit the fleet core.

### Task 2: CLI routing and live directory scan under TDD
**Files:**
- Modify: `bin/stack-sleuth.js`
- Modify: `tests/cli.test.mjs`

- [ ] Add failing CLI tests for `--workspace-fleet`, `--replay-workspace-fleet`, deterministic top-level scanning, notebook reuse, JSON and markdown output, and zero-valid or wrong-type failures.
- [ ] Run `node --test tests/cli.test.mjs --test-name-pattern "workspace fleet"` and verify the new tests fail for the right reasons.
- [ ] Extend CLI argument parsing, mode validation, directory scanning, routing, serialization, and replay handling for the new fleet workflows.
- [ ] Re-run the focused CLI tests until they pass.
- [ ] Commit the CLI integration.

### Task 3: Docs, sample artifact, and regression coverage under TDD
**Files:**
- Modify: `README.md`
- Modify: `tests/readme.test.mjs`
- Create: `sample/workspace-fleet.json`

- [ ] Add failing README assertions for the new `--workspace-fleet` and `--replay-workspace-fleet` documentation.
- [ ] Write one committed sample fleet artifact that represents a mixed queue with at least one invalid warning entry.
- [ ] Update README with usage, deterministic scanning rules, replay guidance, and saved-artifact honesty notes.
- [ ] Re-run `node --test tests/readme.test.mjs` until it passes.
- [ ] Commit the docs and sample artifact.

### Task 4: Full verification and publish prep
**Files:**
- Modify any files touched above only if verification exposes defects.

- [ ] Run `node --test tests/workspace-fleet.test.mjs`.
- [ ] Run `node --test tests/cli.test.mjs`.
- [ ] Run `node --test tests/readme.test.mjs`.
- [ ] Run `npm test`.
- [ ] Review the diff for accidental scope creep, then prepare merge and publish steps.

## Risks and countermeasures
- Risk: fleet scoring feels arbitrary.
  - Countermeasure: preserve explicit score reasons on every entry so users can see why a workspace ranked highly.
- Risk: notebook-only workspaces drift from the existing `--workspace` semantics.
  - Countermeasure: centralize or reuse the same routing logic instead of duplicating notebook handling.
- Risk: invalid folders disappear from the queue.
  - Countermeasure: keep invalid candidates as warning entries whenever at least one valid workspace exists.

## Definition of done
- New Workspace Fleet artifact exists and replays cleanly.
- CLI directory scan and replay flows are documented and tested.
- A committed sample fleet artifact demonstrates the workflow.
- Full test suite passes.
- Work is ready to publish as a visible Stack Sleuth update this cycle.
