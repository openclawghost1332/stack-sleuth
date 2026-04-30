# Plan: Stack Sleuth Casebook Forge Mainline Promotion

## Outcome

Promote the already-built Casebook Forge workflow from the public feature branch onto Stack Sleuth `main`, verify it end to end, and finish the cycle with aligned lab records.

## Steps

1. Validate the promotion candidate.
   - Compare `main` against `casebook-forge`.
   - Confirm the feature branch test suite is green.
   - Review the changed surfaces so the merge scope is explicit.

2. Promote Casebook Forge into the isolated worktree branch.
   - Merge or cherry-pick the Casebook Forge commits onto the cycle branch.
   - Resolve any conflicts without widening scope.

3. Verify with test-first discipline where new fixes are needed.
   - If promotion exposes regressions, add or adjust tests before code fixes.
   - Re-run the full suite until green.

4. Ship the public artifact.
   - Commit the promotion branch.
   - Run the publish helper for the Stack Sleuth artifact.
   - Push the branch and, if practical, open a public PR or land on `main`.

5. Close the loop in the lab.
   - Update `previews/registry.json` and cycle records.
   - Update `status/state.json` for current and completed cycle state.
   - Record any remaining blocker with concrete evidence if shipping stops short of main.

## Task split for subagent-driven development

- Subagent A: audit promotion safety, changed surfaces, and test readiness.
- Subagent B: inspect the stale preview and cycle metadata drift so the closeout fix is crisp.
- Main agent: perform the promotion, verification, ship, and record updates.
