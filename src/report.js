import { buildHandoffBriefing } from './handoff.js';
import { analyzeCasebookForge } from './forge.js';
import { analyzeCasebookMerge } from './merge.js';
import { buildCasebookDataset } from './dataset.js';
import { renderReleaseGateText } from './gate.js';
import { describeResponseQueueEntry, describeRoutingGap } from './portfolio.js';

export function renderIncidentDossierHtml({ mode, report, originLabel = null } = {}) {
  if (mode !== 'pack' && mode !== 'portfolio') {
    throw new Error('Incident dossier HTML requires mode "pack" or "portfolio".');
  }

  if (!report || typeof report !== 'object') {
    throw new Error('Incident dossier HTML requires a structured report payload.');
  }

  const model = mode === 'portfolio'
    ? buildPortfolioDossierModel(report, originLabel)
    : buildPackDossierModel(report, originLabel);

  return renderDocument(model);
}

function buildPackDossierModel(report, originLabel) {
  const topHotspots = collectPackHotspots(report);

  return {
    title: 'Stack Sleuth Incident Dossier',
    eyebrow: originLabel || 'Incident Pack',
    headline: report.summary?.headline ?? 'No incident-pack headline available.',
    generatedAt: new Date().toISOString(),
    metrics: [
      metric('Available analyses', report.availableAnalyses?.length ?? 0),
      metric('Sections present', report.summary?.sectionsPresent?.length ?? 0),
      metric('Omissions', report.omissions?.length ?? 0),
      metric('Trace groups', report.summary?.counts?.currentGroups ?? 0),
    ],
    sections: [
      listSection('Summary', [
        `Sections present: ${formatList(report.summary?.sectionsPresent)}`,
        `Available analyses: ${formatList(report.availableAnalyses)}`,
        `Headline: ${report.summary?.headline ?? 'No headline available.'}`,
      ]),
      listSection('Key findings', report.summary?.topFindings),
      listSection('Omissions', report.omissions),
      listSection('Suspect hotspots', topHotspots.map((hotspot) => `${hotspot.label}${hotspot.score ? ` (score ${hotspot.score})` : ''}`)),
      listSection('Checklist', report.summary?.checklist),
      textSection('Current digest', report.currentDigest
        ? `Current digest found ${report.currentDigest.groupCount} incident group${report.currentDigest.groupCount === 1 ? '' : 's'} across ${report.currentDigest.totalTraces} trace${report.currentDigest.totalTraces === 1 ? '' : 's'}.`
        : null),
      textSection('Casebook Radar', report.casebook?.summary
        ? `Known incidents: ${report.casebook.summary.knownCount}. Novel incidents: ${report.casebook.summary.novelCount}. Closest prior case: ${report.casebook.summary.topCaseLabel ?? 'none'}.`
        : null),
      textSection('Regression Radar', report.regression?.summary
        ? `New incidents: ${report.regression.summary.newCount}. Volume-up incidents: ${report.regression.summary.volumeUpCount}. Resolved incidents: ${report.regression.summary.resolvedCount}.`
        : null),
      textSection('Timeline Radar', report.timeline?.summary
        ? `Snapshots: ${report.timeline.summary.snapshotCount}. New incidents: ${report.timeline.summary.newCount}. Rising incidents: ${report.timeline.summary.risingCount}.`
        : null),
    ].filter(Boolean),
  };
}

function buildPortfolioDossierModel(report, originLabel) {
  const handoff = buildHandoffBriefing(report);
  const forge = analyzeCasebookForge(report);
  const merge = analyzeCasebookMerge(report);
  const dataset = buildCasebookDataset(report);

  return {
    title: 'Stack Sleuth Incident Dossier',
    eyebrow: originLabel || 'Portfolio Radar',
    headline: report.summary?.headline ?? 'No portfolio headline available.',
    generatedAt: new Date().toISOString(),
    metrics: [
      metric('Runnable packs', report.summary?.runnablePackCount ?? 0),
      metric('Release gate', report.gate?.verdict ?? 'unknown'),
      metric('Recurring incidents', report.recurringIncidents?.length ?? 0),
      metric('Recurring hotspots', report.recurringHotspots?.length ?? 0),
    ],
    sections: [
      listSection('Summary', [
        `Headline: ${report.summary?.headline ?? 'No headline available.'}`,
        `Portfolio packs: ${report.summary?.packCount ?? 0}`,
        `Runnable packs: ${report.summary?.runnablePackCount ?? 0}`,
        `Unrunnable packs: ${report.summary?.unrunnablePackCount ?? 0}`,
      ]),
      listSection('Release gate', renderReleaseGateText(report.gate ?? { verdict: 'needs-input', blockers: [], warnings: [], summary: 'No release gate available.', nextAction: 'Gather more evidence.' }).split('\n')),
      listSection('Priority queue', (report.priorityQueue ?? []).map((item, index) => `${index + 1}. ${item.label}: ${formatList(item.priorityReasons)}`)),
      listSection('Response queue', (report.responseQueue ?? []).map((entry) => describeResponseQueueEntry(entry))),
      listSection('Routing gaps', [
        ...(report.unownedPacks ?? []).map((item) => describeRoutingGap('owner', item)),
        ...(report.runbookGaps ?? []).map((item) => describeRoutingGap('runbook', item)),
      ]),
      listSection('Recurring incidents', (report.recurringIncidents ?? []).map((item) => `${item.packCount} packs: ${item.labels.join(', ')} (${item.signature})`)),
      listSection('Recurring hotspots', (report.recurringHotspots ?? []).map((item) => `${item.packCount} packs: ${item.label} (${item.labels.join(', ')})`)),
      listSection('Checklist', report.summary?.checklist),
      textSection('Handoff Briefing summary', handoff.summary?.headline ?? null),
      preSection('Handoff Briefing export', handoff.exportText),
      textSection('Casebook Forge summary', forge.summary?.headline ?? null),
      preSection('Casebook Forge export', forge.exportText),
      textSection('Casebook Dataset summary', dataset.summary?.headline ?? null),
      preSection('Casebook Dataset export', dataset.exportText),
      listSection('Casebook Merge review', merge.cases?.some((entry) => entry.conflicts?.length)
        ? merge.cases.filter((entry) => entry.conflicts?.length).map((entry) => `${entry.label}: ${entry.conflicts.join('; ')}`)
        : [merge.summary?.reviewHeadline ?? 'No merge review available.']),
    ].filter(Boolean),
  };
}

function renderDocument(model) {
  const metricsHtml = model.metrics.map((entry) => `
        <article class="metric-card">
          <span class="metric-label">${escapeHtml(entry.label)}</span>
          <strong class="metric-value">${escapeHtml(entry.value)}</strong>
        </article>`).join('');

  const sectionsHtml = model.sections.map(renderSection).join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(model.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07111f;
        --panel: #0f1b2d;
        --panel-strong: #15253d;
        --border: #243653;
        --text: #e8eef9;
        --muted: #9cb0cf;
        --accent: #78e6c9;
        --accent-strong: #34d6b2;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #10233e 0%, var(--bg) 60%);
        color: var(--text);
      }
      main {
        max-width: 1120px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }
      .hero, .section, .metric-card {
        background: rgba(15, 27, 45, 0.92);
        border: 1px solid var(--border);
        border-radius: 20px;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24);
      }
      .hero {
        padding: 28px;
        margin-bottom: 20px;
      }
      .eyebrow {
        margin: 0 0 10px;
        color: var(--accent);
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      h1, h2 {
        margin: 0;
        line-height: 1.15;
      }
      h1 {
        font-size: clamp(2rem, 4vw, 3.3rem);
      }
      .headline {
        margin: 14px 0 0;
        color: var(--muted);
        font-size: 1.05rem;
        line-height: 1.6;
      }
      .meta {
        margin-top: 14px;
        color: var(--muted);
        font-size: 0.92rem;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }
      .metric-card {
        padding: 18px;
      }
      .metric-label {
        display: block;
        color: var(--muted);
        font-size: 0.9rem;
        margin-bottom: 8px;
      }
      .metric-value {
        font-size: 1.35rem;
        color: var(--text);
      }
      .sections {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }
      .section {
        padding: 22px;
      }
      .section.wide {
        grid-column: 1 / -1;
      }
      h2 {
        font-size: 1.15rem;
        margin-bottom: 12px;
      }
      p, li {
        color: var(--text);
        line-height: 1.55;
      }
      ul {
        margin: 0;
        padding-left: 20px;
      }
      li + li {
        margin-top: 8px;
      }
      pre {
        margin: 0;
        padding: 14px;
        overflow-x: auto;
        border-radius: 14px;
        background: var(--panel-strong);
        border: 1px solid var(--border);
        color: #d7f7ef;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre-wrap;
      }
      @media (max-width: 720px) {
        main { padding: 20px 14px 48px; }
        .hero, .section, .metric-card { border-radius: 16px; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">${escapeHtml(model.eyebrow)}</p>
        <h1>${escapeHtml(model.title)}</h1>
        <p class="headline">${escapeHtml(model.headline)}</p>
        <p class="meta">Generated at ${escapeHtml(model.generatedAt)}</p>
      </section>
      <section class="metrics">${metricsHtml}
      </section>
      <section class="sections">
${sectionsHtml}
      </section>
    </main>
  </body>
</html>`;
}

function renderSection(section) {
  if (section.kind === 'pre') {
    return `        <article class="section wide">
          <h2>${escapeHtml(section.title)}</h2>
          <pre>${escapeHtml(section.value)}</pre>
        </article>`;
  }

  if (section.kind === 'text') {
    return `        <article class="section">
          <h2>${escapeHtml(section.title)}</h2>
          <p>${escapeHtml(section.value)}</p>
        </article>`;
  }

  return `        <article class="section${section.items.length > 5 ? ' wide' : ''}">
          <h2>${escapeHtml(section.title)}</h2>
          <ul>
            ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>`;
}

function metric(label, value) {
  return { label, value: String(value ?? '-') };
}

function listSection(title, items = []) {
  const normalized = normalizeItems(items);
  return {
    kind: 'list',
    title,
    items: normalized.length ? normalized : ['None'],
  };
}

function textSection(title, value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }

  return {
    kind: 'text',
    title,
    value: normalized,
  };
}

function preSection(title, value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }

  return {
    kind: 'pre',
    title,
    value: normalized,
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function collectPackHotspots(report) {
  const hotspots = [
    ...(report.currentDigest?.hotspots ?? []),
    ...(report.regression?.candidateDigest?.hotspots ?? []),
    ...(report.timeline?.hotspots ?? []),
  ].filter((item) => item?.label);

  const seen = new Set();
  const deduped = [];
  for (const hotspot of hotspots) {
    if (seen.has(hotspot.label)) {
      continue;
    }
    seen.add(hotspot.label);
    deduped.push(hotspot);
  }

  return deduped.slice(0, 8);
}

function formatList(items = []) {
  return Array.isArray(items) && items.length ? items.join(', ') : 'none';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
