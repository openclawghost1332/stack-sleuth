# Stack Sleuth Mainline Promotion Design

Generated during builder-mode office-hours and CEO review on 2026-04-30.
Status: APPROVED FOR IMPLEMENTATION
Mode: Builder

## Problem Statement
Stack Sleuth has two substantial public feature branches, Portfolio Response Queue and Casebook Merge, already shipped as open PRs but not yet on `main`. That leaves the public default branch behind the strongest incident-workflow story and fractures the product narrative across multiple links.

## What Makes This Cool
A stranger should be able to open the repo or GitHub Pages demo and see a thicker product, not a parser with side quests. Putting Response Queue and Casebook Merge onto `main` turns Stack Sleuth into a more complete incident-memory engine: rank the release queue, forge reusable cases, merge them back into a living casebook, then reuse that memory on the next incident.

## Premises
1. Promoting already-built workflow layers to `main` compounds more than starting a third side branch right now.
2. The right acceptance bar is integrated behavior on `main`, not merely open PRs with green local notes.
3. Any manual integration changes must stay narrowly focused on cross-branch collisions in shared surfaces like `README.md`, `src/main.js`, `src/examples.js`, `index.html`, and tests.
4. If integration exposes product overlap or stale copy, prefer the more complete combined story rather than preserving older wording.

## Approaches Considered

### Approach A: Merge only Casebook Merge
- Effort: S
- Risk: Low
- Pros:
  - Ships one strong branch quickly.
  - Minimal integration surface.
- Cons:
  - Leaves another major workflow stranded in PR form.
  - Public story is still fragmented.
- Reuses: PR #11 as-is.

### Approach B: Merge only Response Queue
- Effort: S
- Risk: Low
- Pros:
  - Ships a visible queueing workflow quickly.
  - Minimal integration surface.
- Cons:
  - Leaves the incident-memory loop incomplete.
  - We miss the stronger compounding story.
- Reuses: PR #10 as-is.

### Approach C: Integrate both PRs and ship one thicker `main`
- Effort: M
- Risk: Medium
- Pros:
  - Produces the strongest public artifact this cycle.
  - Unifies queueing plus living-casebook workflows into one coherent product.
  - Cleans up branch sprawl and makes future cycles build on a stronger base.
- Cons:
  - Shared files may conflict.
  - Requires careful validation before pushing `main`.
- Reuses: PR #10, PR #11, existing notebook/casebook/portfolio workflows on `main`.

## Recommended Approach
Choose Approach C. It is the highest-leverage path with a realistic same-cycle finish because the hard feature work already exists. The remaining work is disciplined integration, verification, and publication.

## Accepted Scope
- Integrate PR #10 (`feature/response-queue`) and PR #11 (`feature/casebook-merge`) onto a fresh mainline promotion branch.
- Resolve merge conflicts and stale copy only where the branches overlap.
- Run the full Stack Sleuth test suite after integration.
- Validate a publish-safe artifact and push the integrated result to `main` if clean.
- Record cycle artifacts and update lab metadata.

## Not In Scope
- Starting a brand-new Stack Sleuth analyzer.
- UI redesign unrelated to the promoted workflows.
- Hosted syncing, storage, or user accounts.
- Deep refactors outside integration hot spots.

## Success Criteria
1. `main` contains both Response Queue and Casebook Merge.
2. The shared demo, CLI, README, and tests describe the combined workflow without contradictions.
3. `npm test` passes after integration.
4. Publish validation succeeds on the artifact that will be shipped.
5. A public GitHub update exists by the end of the cycle, ideally direct `main` commits or merged PRs.

## Next Steps
1. Merge PR #10 into the promotion branch and note any conflicts.
2. Merge PR #11 into the same branch and resolve shared-surface collisions.
3. Run the full suite and repair only integration regressions.
4. Validate publishing, push the integrated branch, and fast-forward or merge `main`.
