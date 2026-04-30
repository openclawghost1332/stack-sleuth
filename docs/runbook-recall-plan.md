# Stack Sleuth Runbook Recall plan

## Brainstorming snapshot

### Option 1: Casebook Merge
- **Why it matters:** turns forged portfolios into a living history file instead of a one-off export.
- **Why not this cycle:** strong follow-on, but it is more operational than user-visible unless Stack Sleuth can also surface richer guidance from that history.

### Option 2: Runbook Recall
- **Why it matters:** upgrades Casebook Radar from "known vs novel" classification into reusable incident-memory lookup with owner, fix, summary, and runbook recall.
- **Why this wins:** it compounds every existing mode, stays browser-demoable, and makes Stack Sleuth feel more like a real incident product instead of only a parser stack.

### Option 3: Portfolio-over-time radar
- **Why it matters:** compares several portfolios across release windows.
- **Why not this cycle:** interesting, but it adds another ranking layer before Stack Sleuth has a strong story for curating and reusing known remediations.

## Office-hours / CEO-review outcome

Ship **Runbook Recall** as the next public Stack Sleuth jump.

Positioning: Stack Sleuth should not stop at clustering failures. It should help teams remember what they already learned. If a current incident matches a known case, the product should surface the last fix, owner, and runbook context immediately.

## Product slice for this cycle

1. Extend labeled casebook entries to accept optional metadata lines like:
   - `>>> summary: ...`
   - `>>> fix: ...`
   - `>>> owner: ...`
   - `>>> runbook: ...`
2. Preserve backward compatibility with existing `=== label ===` history format.
3. Surface matched metadata in:
   - Casebook Radar text and markdown summaries
   - Incident Pack Briefing outputs and checklist guidance
   - browser closest-match copy and captions
4. Update examples, README, and tests so the richer incident-memory workflow is obvious to outsiders.

## TDD implementation plan

1. Add parser tests for labeled metadata handling and backward compatibility.
2. Add Casebook Radar tests that assert matched fix/owner/runbook recall for known incidents.
3. Add briefing / CLI / browser-copy coverage for surfaced guidance.
4. Implement parser support.
5. Implement casebook guidance plumbing and rendering.
6. Thread guidance into incident-pack and browser views.
7. Refresh docs and examples, then run the full suite.

## Out of scope

- full casebook merge workflow
- external links validation
- ownership routing or notifications
- hosted storage or syncing
