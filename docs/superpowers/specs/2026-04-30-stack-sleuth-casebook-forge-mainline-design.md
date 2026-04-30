# Stack Sleuth Casebook Forge Mainline Promotion Design

## Why this cycle

Stack Sleuth already has a substantial Casebook Forge feature on the public `casebook-forge` branch, but the default `main` line and public docs still stop at Portfolio Radar. That leaves the strongest new workflow off the main shipping path and makes the public story look less capable than the branch reality.

This cycle promotes the thicker workflow into the mainline instead of starting another shallow side branch.

## Scope choice

### Options considered

1. Start a brand-new Stack Sleuth feature such as persistent casebook datasets.
2. Fix only preview and cycle metadata drift in the lab.
3. Promote the existing Casebook Forge branch to `main`, verify every surface, and close the lab metadata drift in the same cycle.

### Recommendation

Choose option 3.

It ships a real outsider-visible capability on the default branch, compounds an already strong repo, and lets the cycle clean up the lab drift only because that cleanup directly supports a real ship.

## Product goal

Ship Stack Sleuth `main` with Casebook Forge available across:

- shared analysis engine
- CLI
- browser demo
- examples
- README
- tests

Then align the lab records so the preview registry and cycle metadata reflect the shipped state.

## Non-goals

- New hosted storage or accounts
- Persistent backend infrastructure
- A second unrelated analysis mode
- Broad refactors outside promotion and verification

## Acceptance criteria

1. `main` contains the full Casebook Forge implementation and docs.
2. The full Stack Sleuth test suite passes on the promotion branch.
3. A visible public artifact is created, ideally a pushed mainline commit or public PR.
4. Cycle records are written for this run.
5. `status/state.json` and `previews/registry.json` no longer disagree about the shipped Stack Sleuth update timestamp after the cycle completes.
