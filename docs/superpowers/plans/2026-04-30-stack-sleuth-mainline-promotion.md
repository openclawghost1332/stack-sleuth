# Stack Sleuth Mainline Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land Stack Sleuth's Response Queue and Casebook Merge feature branches onto `main` as one validated public product update.

**Architecture:** Treat this as an integration release, not new feature invention. Start from `main`, merge each feature branch into an isolated promotion branch, resolve only shared-surface collisions, then validate the combined CLI, browser, docs, and tests before publishing.

**Tech Stack:** Git worktrees, git merge/cherry-pick, Node.js built-in test runner, GitHub CLI, Stack Sleuth browser/CLI codebase.

---

### Task 1: Establish the promotion branch baseline

**Files:**
- Modify: `docs/superpowers/specs/2026-04-30-stack-sleuth-mainline-promotion-design.md`
- Modify: `docs/superpowers/plans/2026-04-30-stack-sleuth-mainline-promotion.md`
- Inspect: `README.md`, `index.html`, `src/main.js`, `src/examples.js`, `tests/cli.test.mjs`, `tests/browser-copy.test.mjs`, `tests/readme.test.mjs`

- [ ] **Step 1: Confirm the branch starts from current main**

```bash
git checkout main
git pull --ff-only origin main
git checkout -b promote/stack-sleuth-mainline
```

Expected: promotion branch points at the latest `origin/main` tip.

- [ ] **Step 2: Snapshot the baseline test state**

Run: `npm test`
Expected: full suite passes before any merges.

- [ ] **Step 3: Commit the scope artifacts if they are not already present**

```bash
git add docs/superpowers/specs/2026-04-30-stack-sleuth-mainline-promotion-design.md docs/superpowers/plans/2026-04-30-stack-sleuth-mainline-promotion.md
git commit -m "docs: add stack sleuth mainline promotion scope"
```

Expected: one docs-only commit exists on the promotion branch.

### Task 2: Integrate Response Queue first

**Files:**
- Merge target: `origin/feature/response-queue`
- Likely touch: `README.md`, `index.html`, `src/main.js`, `src/examples.js`, `src/portfolio.js`, `tests/cli.test.mjs`, `tests/browser-copy.test.mjs`, `tests/readme.test.mjs`

- [ ] **Step 1: Merge the branch without auto-committing if conflicts appear**

```bash
git merge --no-ff --no-commit origin/feature/response-queue
```

Expected: either a clean staged merge or a conflict list limited to shared surfaces.

- [ ] **Step 2: If conflicts appear, inspect failing surfaces before editing**

Run: `git status --short`
Expected: only overlapping docs, browser, or test files are conflicted.

- [ ] **Step 3: Finalize the merge and re-run tests immediately**

```bash
git commit -m "feat: promote response queue to mainline"
npm test
```

Expected: either all green or a small, explicit integration failure list.

### Task 3: Integrate Casebook Merge and repair integration regressions with TDD

**Files:**
- Merge target: `origin/feature/casebook-merge`
- Likely touch: `README.md`, `index.html`, `src/main.js`, `src/examples.js`, `src/labeled.js`, `src/merge.js`, `bin/stack-sleuth.js`, `tests/merge.test.mjs`, `tests/cli.test.mjs`, `tests/browser-copy.test.mjs`, `tests/readme.test.mjs`

- [ ] **Step 1: Merge the branch on top of the response-queue integration**

```bash
git merge --no-ff --no-commit origin/feature/casebook-merge
```

Expected: staged merge or a focused set of shared-surface conflicts.

- [ ] **Step 2: If integration behavior breaks, write or update the failing regression test before code edits**

```js
test('mainline promotion preserves both response queue and casebook merge browser flows', async () => {
  // extend the existing browser harness assertion that both workflows render after integration
});
```

Run: `node --test tests/browser-copy.test.mjs`
Expected: FAIL for the specific integration break before implementation changes.

- [ ] **Step 3: Apply the minimal integration fix, then rerun the targeted test**

Run: `node --test tests/browser-copy.test.mjs`
Expected: PASS with the combined workflow still visible.

- [ ] **Step 4: Finalize the merge and run the full suite**

```bash
git commit -m "feat: promote casebook merge to mainline"
npm test
```

Expected: full suite green with both workflows present.

### Task 4: Publish the integrated mainline update

**Files:**
- Validate: repository tree plus any clean export used for publish-helper validation
- Update if needed: `README.md`, preview-facing files already touched by merged branches

- [ ] **Step 1: Validate the ship-ready artifact with publish helper**

```bash
python3 scripts/publish_helper.py projects/stack-sleuth
```

Expected: `publish_guard: OK` when run from the workspace root. If a nested worktree path still trips a pointer false positive, export tracked files to a clean temp directory and validate that export instead.

- [ ] **Step 2: Push the promotion branch**

```bash
git push -u origin HEAD
```

Expected: remote branch updates successfully.

- [ ] **Step 3: Fast-forward or merge `main` with the integrated branch**

```bash
git checkout main
git merge --ff-only promote/stack-sleuth-mainline
git push origin main
```

Expected: `origin/main` now contains both promoted workflows.

- [ ] **Step 4: Verify public GitHub state**

```bash
gh pr list --repo openclawghost1332/stack-sleuth --state open
gh log -R openclawghost1332/stack-sleuth -L 1
```

Expected: promoted work is visible publicly and any superseded PRs can be closed or noted.
