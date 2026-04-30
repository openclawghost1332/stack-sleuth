# CEO Review Summary: Stack Sleuth Casebook Forge

Generated on 2026-04-30
Mode: SELECTIVE EXPANSION
Status: DONE

## Premise Challenge
- **Is this the right problem?** Yes. Portfolio Radar currently ends at prioritization, but the compounding value is reusable memory. Turning triage output into a casebook is more durable than adding another isolated report view.
- **What if we do nothing?** Stack Sleuth stays strong at incident analysis but weak at institutional memory, forcing manual history maintenance outside the product.
- **Could a simpler framing be stronger?** Yes: “turn several incident packs into a reusable history file” is clearer than “incident knowledge platform.” Keep that tighter framing.

## Existing Code Leverage
- `src/portfolio.js` already parses the right top-level format and aggregates cross-pack signals.
- `src/casebook.js` already defines what a downstream history workflow expects.
- `src/digest.js` and `src/analyze.js` already hold the signatures, representatives, hotspots, and render-ready fields needed for curated export.
- Rebuilding a storage layer or editor now would be wasteful.

## Current State → This Plan → 12-Month Ideal
- **Current state:** Strong incident analysis plus portfolio ranking, but no generated memory artifact.
- **This plan:** Add deterministic casebook forging from portfolios, with CLI/browser export.
- **12-month ideal:** Stack Sleuth becomes a reusable incident-memory engine where every triage session can feed future detection and handoff workflows.

## Alternatives Reviewed

### Minimal viable
Append a raw export block to Portfolio Radar.
- Effort: S
- Risk: Low
- Why not chosen: Too muddy, weak product boundary.

### Recommended
Dedicated Casebook Forge engine and workflow over portfolio input.
- Effort: M
- Risk: Low-Med
- Why chosen: Strongest compounding value per unit effort.

### Ideal architecture
Persistent casebook studio with editing and storage.
- Effort: XL
- Risk: High
- Why deferred: Too much stateful product surface for one cycle.

## Strongest Challenges
1. **Zero silent label collisions.** Suggested labels must disambiguate cleanly when several incidents map to similar culprit files or reused history labels.
2. **Export fidelity matters more than card polish.** If the forged `=== label ===` output is unreliable, the whole feature collapses.
3. **Browser reset behavior must be explicit.** Portfolio, forge, casebook, and incident-pack result cards can easily drift into stale mixed state.

## Accepted Scope
- New shared forge engine.
- CLI forge mode with text, JSON, and Markdown.
- Browser portfolio-to-forge summary plus copy flow.
- README and examples.
- Full automated test coverage.

## Deferred
- Manual case label editing.
- Persistent local storage.
- Importing JSON/YAML casebook formats.
- Merge-back workflows that rewrite historical casebooks automatically.

## NOT in Scope
- Multi-user collaboration.
- Server-backed storage.
- Authentication.
- AI-generated remediation advice.

## Recommended Path
Build the forge engine first, treat the labeled-history export as the primary contract, then wire the CLI and browser to that contract. If there is any time pressure, cut UI flourish before cutting export correctness.
