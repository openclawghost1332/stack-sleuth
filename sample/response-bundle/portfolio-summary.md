# Stack Sleuth Portfolio Radar

- **Packs:** 3
- **Runnable packs:** 3
- **Unrunnable packs:** 0
- **Owned packs:** 1
- **Unowned packs:** 2
- **Runbook-covered packs:** 1
- **Runbook gaps:** 2
- **Headline:** Prioritize profile\-rollout first because it contains 1 novel casebook incident\.
- **Portfolio signals:** 1 novel, 1 regression\-new, 1 regression\-volume\-up, 0 timeline\-new, 0 timeline\-rising

## Release gate
- **Release gate:** hold
- **Summary:** Release gate is hold with 3 blockers, 4 warnings\.
- **Blockers:** 1 novel incidents, 1 regression\-new incidents, 2 unowned runnable packs
- **Warnings:** 2 runbook gaps, 1 regression\-volume\-up incidents, 2 recurring hotspots, 1 recurring incidents
- **Next action:** Stop the release and inspect the blocking packs first\.

## Priority queue
- 1\. profile\-rollout: it contains 1 novel casebook incident; its current digest has 2 incident groups across 2 traces
- 2\. billing\-canary: it introduces 1 new regression incident; it shows 1 volume\-up regression incident
- 3\. checkout\-prod: its current digest has 1 incident group across 2 traces

## Response queue
- web\-platform: profile\-rollout \(summary Checkout profile payload dropped account metadata before render; fix Guard renderProfile before reading account\.name; runbook https://example\.com/runbooks/profile\-null\)

## Routing gaps
- No recalled owner from exact casebook matches: billing\-canary
- No recalled owner from exact casebook matches: checkout\-prod
- No recalled runbook from exact casebook matches: billing\-canary
- No recalled runbook from exact casebook matches: checkout\-prod

## Recurring incidents
- 2 packs: checkout\-prod, profile\-rollout \(javascript\|TypeError\|app/src/profile\.js:88\|nullish\-data,undefined\-property\-access\)

## Recurring hotspots
- 3 packs: profile\.js \(checkout\-prod, profile\-rollout, billing\-canary\)
- 3 packs: view\.js \(checkout\-prod, profile\-rollout, billing\-canary\)

## Checklist
- Start with profile\-rollout because it ranks first in the portfolio queue\.
- Check the recurring cross\-pack signatures next so one shared failure does not fragment the triage effort\.
- Inspect the shared hotspot files because they may explain several packs at once\.
- Confirm novel casebook incidents before assuming every pack is just a repeat of known failures\.
- Review candidate\-only regression incidents before widening the rollout or release exposure\.