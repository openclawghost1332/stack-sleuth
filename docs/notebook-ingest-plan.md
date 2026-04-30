# Notebook ingest plan

Stack Sleuth now accepts markdown incident notebooks as a first-class input shape.

## Goal

Let an incident handoff note with headings like `## Current incident`, `## Prior incidents`, `## Baseline`, `## Candidate`, and `## Timeline` flow into the existing Incident Pack Briefing and Portfolio Radar engines without manual `@@` or `@@@` rewrites.

## Scope

- Detect notebook input in the browser shared textarea before falling back to raw traces, incident packs, or portfolios.
- Ship a notebook example and notebook-focused UI copy so the feature is visible to outsiders.
- Copy both the notebook normalization and the routed briefing or portfolio summary.
- Document browser and CLI usage with `--notebook` in the public README.

## Non-goals

- No new notebook-only analyzer.
- No fuzzy source-specific heuristics beyond supported heading aliases.
- No divergence from the existing incident-pack and portfolio output formats.

## Result

Notebook ingest stays deterministic, normalizes into existing structured workflows, and makes markdown incident handoffs usable in Stack Sleuth in one paste.
