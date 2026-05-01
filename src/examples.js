import { buildCasebookDataset } from './dataset.js';
import { buildResponseBundleShelf } from './bundle-shelf.js';
import { buildCasebookShelf } from './shelf.js';
import { buildReleaseGate } from './gate.js';
import { analyzeIncidentPortfolio } from './portfolio.js';
import { buildResponseBundle } from './bundle.js';

const javascriptTrace = `TypeError: Cannot read properties of undefined (reading 'name')
    at renderProfile (/app/src/profile.js:88:17)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const pythonTrace = `Traceback (most recent call last):
  File "app.py", line 42, in <module>
    run()
  File "service.py", line 17, in run
    return user["email"]
KeyError: 'email'`;

const regressionTrace = `TypeError: Cannot read properties of undefined (reading 'email')
    at renderInvoice (/app/src/invoice.js:19:7)
    at refreshBilling (/app/src/billing.js:57:3)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const dashboardTrace = `TypeError: Cannot read properties of undefined (reading 'id')
    at loadDashboard (/app/src/dashboard.js:14:9)
    at bootstrap (/app/src/index.js:3:1)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const alertTrace = `TypeError: Cannot read properties of undefined (reading 'title')
    at showAlert (/app/src/alerts/toast.js:11:4)
    at refreshAlerts (/app/src/alerts/index.js:5:2)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const profileHydrationTrace = `ProfileHydrationError: Profile payload missing account metadata
    at renderProfileState (/app/src/profile.js:102:9)
    at updateView (/app/src/view.js:42:5)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const rubyTrace = "app/service.rb:7:in `run': undefined method `email' for nil:NilClass (NoMethodError)\n\tfrom app/controller.rb:3:in `call'";

const rawLogTrace = [
  '2026-04-30T01:50:00Z INFO api boot complete',
  `2026-04-30T01:50:01Z ERROR web ${javascriptTrace.split('\n').join('\n2026-04-30T01:50:01Z ERROR web ')}`,
  '2026-04-30T01:50:02Z WARN billing retry queued for customer sync',
  `2026-04-30T01:50:04Z ERROR billing ${regressionTrace.split('\n').join('\n2026-04-30T01:50:04Z ERROR billing ')}`,
  '2026-04-30T01:50:05Z INFO request complete',
].join('\n');

const casebookHistoryTrace = [
  '=== release-2026-04-15 ===',
  '>>> summary: Checkout profile payload dropped account metadata before render',
  '>>> fix: Guard renderProfile before reading account.name',
  '>>> owner: web-platform',
  '>>> runbook: https://example.com/runbooks/profile-null',
  [javascriptTrace, regressionTrace].join('\n\n'),
  '',
  '=== profile-rewrite ===',
  javascriptTrace,
].join('\n');

const casebookCurrentTrace = [
  javascriptTrace,
  profileHydrationTrace,
].join('\n\n');

const timelineTrace = [
  '=== canary ===',
  [javascriptTrace, dashboardTrace, dashboardTrace, dashboardTrace, pythonTrace, rubyTrace].join('\n\n'),
  '',
  '=== 25-percent ===',
  [javascriptTrace, javascriptTrace, dashboardTrace, dashboardTrace, pythonTrace, rubyTrace, alertTrace, alertTrace].join('\n\n'),
  '',
  '=== full-rollout ===',
  [javascriptTrace, javascriptTrace, javascriptTrace, dashboardTrace, rubyTrace, regressionTrace, alertTrace].join('\n\n'),
].join('\n');

const incidentPackTrace = [
  '@@ current @@',
  casebookCurrentTrace,
  '',
  '@@ history @@',
  casebookHistoryTrace,
  '',
  '@@ baseline @@',
  `${javascriptTrace}\n\n${pythonTrace}`,
  '',
  '@@ candidate @@',
  `${javascriptTrace}\n\n${javascriptTrace}\n\n${regressionTrace}`,
  '',
  '@@ timeline @@',
  timelineTrace,
].join('\n');

const notebookTrace = [
  '# Checkout incident notebook',
  '',
  '## Current incident',
  casebookCurrentTrace,
  '',
  '## Prior incidents',
  casebookHistoryTrace,
  '',
  '## Baseline',
  `${javascriptTrace}\n\n${pythonTrace}`,
  '',
  '## Candidate',
  `${javascriptTrace}\n\n${javascriptTrace}\n\n${regressionTrace}`,
  '',
  '## Timeline',
  timelineTrace,
].join('\n');

const portfolioTrace = [
  '@@@ checkout-prod @@@',
  '@@ current @@',
  `${javascriptTrace}\n\n${javascriptTrace}`,
  '',
  '@@@ profile-rollout @@@',
  '@@ current @@',
  casebookCurrentTrace,
  '',
  '@@ history @@',
  casebookHistoryTrace,
  '',
  '@@@ billing-canary @@@',
  '@@ baseline @@',
  `${javascriptTrace}\n\n${pythonTrace}`,
  '',
  '@@ candidate @@',
  `${javascriptTrace}\n\n${javascriptTrace}\n\n${regressionTrace}`,
].join('\n');

const datasetReplay = JSON.stringify(buildCasebookDataset(portfolioTrace), null, 2);
const responseBundleReplay = buildResponseBundle({
  report: analyzeIncidentPortfolio(portfolioTrace),
  sourceMode: 'portfolio',
  sourceLabel: 'saved example portfolio',
}).files['response-bundle.json'];
const responseBundleChronicleReplay = [
  '=== release-a ===',
  JSON.stringify(buildChronicleReplayBundle({
    sourceMode: 'portfolio',
    sourceLabel: 'release-a-bundle',
    dataset: buildChronicleReplayDataset({
      packCount: 2,
      owners: [{ owner: 'web-platform', packCount: 1 }],
      hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
      stewardActions: [
        buildStewardAction('missing-runbook', 'profile-js', 'sig-profile-js', 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.'),
        buildStewardAction('missing-owner', 'billing-js', 'sig-billing-js', 'Assign an owner for billing-js.', 'Capture an owner for billing-js.'),
      ],
    }),
    files: ['manifest.json', 'incident-dossier.html', 'portfolio-summary.md', 'handoff.md', 'casebook.txt', 'casebook-dataset.json', 'merge-review.md'],
  }), null, 2),
  '',
  '=== release-b ===',
  JSON.stringify(buildChronicleReplayBundle({
    sourceMode: 'portfolio',
    sourceLabel: 'release-b-bundle',
    dataset: buildChronicleReplayDataset({
      packCount: 3,
      owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
      hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
      stewardActions: [
        buildStewardAction('missing-runbook', 'profile-js', 'sig-profile-js', 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.'),
        buildStewardAction('missing-fix', 'search-js', 'sig-search-js', 'Document the fix for search-js.', 'Capture the fix for search-js.'),
      ],
    }),
  }), null, 2),
  '',
  '=== release-c ===',
  JSON.stringify(buildChronicleReplayBundle({
    sourceMode: 'workspace',
    sourceLabel: 'release-c-bundle',
    dataset: buildChronicleReplayDataset({
      packCount: 4,
      owners: [{ owner: 'web-platform', packCount: 3 }, { owner: 'billing', packCount: 2 }],
      hotspots: [{ label: 'profile.js', packCount: 3, maxScore: 4 }, { label: 'billing.js', packCount: 2, maxScore: 3 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
      stewardActions: [
        buildStewardAction('missing-owner', 'billing-js', 'sig-billing-js', 'Assign an owner for billing-js.', 'Capture an owner for billing-js.'),
        buildStewardAction('missing-fix', 'search-js', 'sig-search-js', 'Document the fix for search-js.', 'Capture the fix for search-js.'),
      ],
    }),
  }), null, 2),
].join('\n');
const shelfReplay = JSON.stringify(buildCasebookShelf([
  {
    label: 'release-a',
    filename: 'release-a.json',
    source: JSON.stringify(buildChronicleReplayDataset({
      packCount: 2,
      owners: [{ owner: 'web-platform', packCount: 1 }],
      hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
    }), null, 2),
  },
  {
    label: 'release-b',
    filename: 'release-b.json',
    source: JSON.stringify(buildChronicleReplayDataset({
      packCount: 3,
      owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
      hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
      cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
    }), null, 2),
  },
  {
    label: 'broken',
    filename: 'broken.json',
    source: '{"kind":"stack-sleuth-casebook-dataset","version":1',
  },
]), null, 2);
const responseBundleShelfReplay = JSON.stringify(buildResponseBundleShelf([
  {
    label: 'release-a',
    filename: 'release-a',
    source: JSON.stringify(buildChronicleReplayBundle({
      sourceMode: 'portfolio',
      sourceLabel: 'release-a-bundle',
      dataset: buildChronicleReplayDataset({
        packCount: 2,
        owners: [{ owner: 'web-platform', packCount: 1 }],
        hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
        cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
      }),
    }), null, 2),
  },
  {
    label: 'release-b',
    filename: 'release-b-response-bundle.json',
    source: JSON.stringify(buildChronicleReplayBundle({
      sourceMode: 'workspace',
      sourceLabel: 'release-b-bundle',
      dataset: buildChronicleReplayDataset({
        packCount: 4,
        owners: [{ owner: 'web-platform', packCount: 3 }, { owner: 'billing', packCount: 2 }],
        hotspots: [{ label: 'profile.js', packCount: 3, maxScore: 4 }, { label: 'billing.js', packCount: 2, maxScore: 3 }],
        cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
      }),
    }), null, 2),
  },
  {
    label: 'broken',
    filename: 'broken-response-bundle.json',
    source: '{"kind":"stack-sleuth-response-bundle","version":3',
  },
]), null, 2);
const chronicleReplay = [
  '=== release-a ===',
  JSON.stringify(buildChronicleReplayDataset({
    packCount: 2,
    owners: [{ owner: 'web-platform', packCount: 1 }],
    hotspots: [{ label: 'profile.js', packCount: 1, maxScore: 2 }],
    cases: [{ label: 'profile-js', signature: 'sig-profile-js' }],
    stewardActions: [
      buildStewardAction('missing-runbook', 'profile-js', 'sig-profile-js', 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.'),
      buildStewardAction('missing-owner', 'billing-js', 'sig-billing-js', 'Assign an owner for billing-js.', 'Capture an owner for billing-js.'),
    ],
  }), null, 2),
  '',
  '=== release-b ===',
  JSON.stringify(buildChronicleReplayDataset({
    packCount: 3,
    owners: [{ owner: 'web-platform', packCount: 2 }, { owner: 'billing', packCount: 1 }],
    hotspots: [{ label: 'profile.js', packCount: 2, maxScore: 3 }, { label: 'billing.js', packCount: 1, maxScore: 2 }],
    cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
    stewardActions: [
      buildStewardAction('missing-runbook', 'profile-js', 'sig-profile-js', 'Add a runbook for profile-js.', 'Capture a runbook for profile-js.'),
      buildStewardAction('missing-fix', 'search-js', 'sig-search-js', 'Document the fix for search-js.', 'Capture the fix for search-js.'),
    ],
  }), null, 2),
  '',
  '=== release-c ===',
  JSON.stringify(buildChronicleReplayDataset({
    packCount: 4,
    owners: [{ owner: 'web-platform', packCount: 3 }, { owner: 'billing', packCount: 2 }],
    hotspots: [{ label: 'profile.js', packCount: 3, maxScore: 4 }, { label: 'billing.js', packCount: 2, maxScore: 3 }],
    cases: [{ label: 'profile-js', signature: 'sig-profile-js' }, { label: 'billing-js', signature: 'sig-billing-js' }],
    stewardActions: [
      buildStewardAction('missing-owner', 'billing-js', 'sig-billing-js', 'Assign an owner for billing-js.', 'Capture an owner for billing-js.'),
      buildStewardAction('missing-fix', 'search-js', 'sig-search-js', 'Document the fix for search-js.', 'Capture the fix for search-js.'),
    ],
  }), null, 2),
].join('\n');

export const examples = [
  {
    label: 'JavaScript undefined property',
    caption: 'Frontend render path loses a nested profile object before reading the name field, with profile.js and view.js surfacing as the top hotspots.',
    trace: javascriptTrace
  },
  {
    label: 'Python missing key',
    caption: 'Backend payload arrives without an expected email key during account sync, centering the hotspot radar on service.py.',
    trace: pythonTrace
  },
  {
    label: 'Raw log excavation',
    caption: 'A noisy raw log dump still excavates embedded production traces and preserves blast radius context, including affected services and first-seen and last-seen windows.',
    trace: rawLogTrace
  },
  {
    label: 'Repeated incident digest',
    caption: 'Two repeated frontend failures and one backend key miss collapse into a repeat-friendly incident digest with ranked suspect hotspots.',
    trace: `${javascriptTrace}\n\n${javascriptTrace}\n\n${pythonTrace}`
  },
  {
    label: 'Casebook Radar',
    caption: 'Today\'s incident batch matches one known failure and one novel profile hydration break, and the known match recalls the last fix, owner, and runbook context like a real incident-memory handoff.',
    current: casebookCurrentTrace,
    history: casebookHistoryTrace,
  },
  {
    label: 'Notebook ingest',
    caption: 'A markdown handoff note with Current incident, Prior incidents, Baseline, Candidate, and Timeline headings normalizes into the existing incident-pack workflow without rewriting the notebook by hand.',
    notebook: notebookTrace,
  },
  {
    label: 'Regression radar',
    caption: 'The candidate batch introduces a brand-new billing failure while the profile crash spikes and the old backend key miss disappears, making the hotspot shifts easy to scan.',
    baseline: `${javascriptTrace}\n\n${pythonTrace}`,
    candidate: `${javascriptTrace}\n\n${javascriptTrace}\n\n${regressionTrace}`
  },
  {
    label: 'Timeline radar',
    caption: 'A rollout timeline across canary, 25-percent, and full-rollout snapshots exposes one new incident, one rising incident, one flapping incident, one steady incident, one falling incident, and one resolved incident.',
    timeline: timelineTrace,
  },
  {
    label: 'Incident pack briefing',
    caption: 'One structured incident pack folds today\'s batch, the casebook, a regression compare, and a rollout timeline into a single briefing that is easy to paste into chat or an incident doc.',
    pack: incidentPackTrace,
  },
  {
    label: 'Portfolio radar',
    caption: 'Several labeled incident packs roll up into one owner-aware Portfolio Radar queue plus a deterministic Action Board, surfacing a release gate verdict alongside recalled owners, runbook gaps, routing gaps, recurring incidents, shared hotspots, and copy-ready handoff packets in one release-level view.',
    portfolio: portfolioTrace,
  },
  {
    label: 'Handoff Briefing',
    caption: 'A labeled incident portfolio turns into owner-specific handoff packets plus explicit routing and runbook gaps that are ready to paste into chat or tickets.',
    portfolio: portfolioTrace,
  },
  {
    label: 'Casebook Forge',
    caption: 'A labeled incident portfolio turns into a reusable casebook export, so active triage feeds the next incident-memory lookup without hand-curating new history files.',
    portfolio: portfolioTrace,
  },
  {
    label: 'Casebook Dataset',
    caption: 'A saved Casebook Dataset JSON artifact replays the preserved release gate verdict, Action Board routing and runbook gaps, recurring hotspot drift, and reusable casebook export story without needing the original portfolio input.',
    dataset: datasetReplay,
  },
  {
    label: 'Response Bundle replay',
    caption: 'A self-contained response-bundle.json artifact replays preserved bundle inventory plus embedded dataset fields for saved incident handoff and Action Board lanes, while staying honest that replay does not recover raw traces, support frames, or blast radius detail.',
    bundle: responseBundleReplay,
  },
  {
    label: 'Response Bundle Chronicle',
    caption: 'Several saved response bundles stitched into one chronicle reveal release gate drift, owner load, source workflow changes, bundle inventory movement, and stewardship backlog resurfacing across release windows without pretending to recover raw trace detail.',
    bundleChronicle: responseBundleChronicleReplay,
  },
  {
    label: 'Response Bundle Shelf',
    caption: 'A saved response bundle shelf catalogs several saved handoff snapshots, keeps invalid warning entries visible, and replays the latest saved command library plus release gate and chronicle drift without pretending to recover raw traces.',
    bundleShelf: responseBundleShelfReplay,
  },
  {
    label: 'Casebook Chronicle',
    caption: 'Several saved Casebook Dataset snapshots stitched into one chronicle reveal release gate drift, owner load, recurring hotspot drift, casebook movement, and stewardship backlog resurfacing across release windows without pretending to recover raw trace detail.',
    chronicle: chronicleReplay,
  },
  {
    label: 'Casebook Shelf',
    caption: 'A saved dataset shelf catalogs several saved snapshots, keeps invalid warning entries visible, and replays the latest saved library state plus release gate and chronicle drift without pretending to recover raw traces.',
    shelf: shelfReplay,
  },
  {
    label: 'Casebook Merge',
    caption: 'A labeled incident portfolio plus embedded history turns into a living casebook update that preserves human guidance, adds seen-count and source-packs metadata, and flags merge conflicts when older entries disagree.',
    portfolio: portfolioTrace,
  }
];

function buildChronicleReplayDataset({
  packCount = 2,
  owners = [],
  hotspots = [],
  cases = [],
  stewardActionCount = Math.max(0, 4 - packCount),
  stewardPreserved = true,
  stewardActions = null,
} = {}) {
  return {
    kind: 'stack-sleuth-casebook-dataset',
    version: 1,
    summary: {
      headline: `Casebook Dataset captured ${cases.length} merged case${cases.length === 1 ? '' : 's'} from ${packCount} pack${packCount === 1 ? '' : 's'}.`,
      packCount,
      runnablePackCount: packCount,
      mergedCaseCount: cases.length,
      conflictCount: 0,
      portfolioHeadline: 'Saved portfolio snapshot',
      mergeHeadline: 'Saved merge snapshot',
      ownerCount: owners.length,
    },
    portfolio: {
      packOrder: Array.from({ length: packCount }, (_, index) => `pack-${index + 1}`),
    },
    gate: buildReleaseGate({
      runnablePackCount: packCount,
      totalNovelIncidents: packCount >= 4 ? 1 : 0,
      runbookGapCount: 1,
      recurringHotspotCount: hotspots.length,
      recurringIncidentCount: Math.max(0, cases.length - 1),
    }),
    responseQueue: owners.map((entry) => ({
      owner: entry.owner,
      labels: Array.from({ length: entry.packCount }, (_, index) => `${entry.owner}-pack-${index + 1}`),
      guidance: [],
      highestPriorityScore: entry.packCount * 100,
      novelIncidentCount: entry.packCount,
      bestQueueIndex: 0,
      packCount: entry.packCount,
    })),
    recurringIncidents: [],
    recurringHotspots: hotspots.map((entry) => ({
      label: entry.label,
      labels: Array.from({ length: entry.packCount }, (_, index) => `${entry.label}-pack-${index + 1}`),
      packCount: entry.packCount,
      maxScore: entry.maxScore ?? entry.packCount,
    })),
    cases: cases.map((entry) => ({
      label: entry.label,
      signature: entry.signature,
      sourcePacks: ['pack-1'],
      metadata: {},
      conflicts: [],
    })),
    steward: {
      preserved: stewardPreserved,
      cases: cases.map((entry) => ({
        label: entry.label,
        signature: entry.signature,
        sourcePacks: ['pack-1'],
        metadata: {},
        conflicts: [],
      })),
      actions: stewardActions ?? Array.from({ length: stewardActionCount }, (_, index) => ({
        kind: index === 0 ? 'missing-owner' : 'missing-runbook',
        label: cases[index]?.label ?? `case-${index + 1}`,
        signature: cases[index]?.signature ?? `sig-${index + 1}`,
        seenCount: 1,
        sourcePacks: ['pack-1'],
        priority: 1000 - index,
        headline: `Do steward action ${index + 1}`,
        ask: `Handle steward action ${index + 1}`,
      })),
      summary: {
        caseCount: cases.length,
        conflictCount: 0,
        ownerCoveredCount: 0,
        fixCoveredCount: 0,
        runbookCoveredCount: 0,
        actionCount: stewardActions?.length ?? stewardActionCount,
        urgentActionCount: stewardActions
          ? stewardActions.filter((entry) => entry.kind === 'conflict' || entry.kind === 'missing-owner').length
          : stewardActionCount ? 1 : 0,
        headline: `Casebook Steward found ${(stewardActions?.length ?? stewardActionCount)} action${(stewardActions?.length ?? stewardActionCount) === 1 ? '' : 's'} across ${cases.length} case${cases.length === 1 ? '' : 's'}.`,
      },
      nextAction: stewardActions?.[0]?.ask ?? (stewardActionCount ? 'Handle steward action 1' : 'No stewardship gaps detected in the current casebook state.'),
    },
    exportText: '=== saved-case ===\nTypeError: replay me',
  };
}

function buildChronicleReplayBundle({
  dataset = buildChronicleReplayDataset(),
  sourceMode = 'portfolio',
  sourceLabel = 'saved example portfolio',
  files = null,
} = {}) {
  const bundle = JSON.parse(buildResponseBundle({
    report: analyzeIncidentPortfolio(portfolioTrace),
    sourceMode,
    sourceLabel,
  }).files['response-bundle.json']);

  bundle.manifest.source = { mode: sourceMode, label: sourceLabel };
  bundle.manifest.summary.headline = dataset.summary.headline;
  bundle.manifest.summary.releaseGateVerdict = dataset.gate.verdict;
  bundle.manifest.summary.packCount = dataset.summary.packCount;
  bundle.manifest.summary.runnablePackCount = dataset.summary.runnablePackCount;
  bundle.manifest.summary.ownerCount = dataset.summary.ownerCount;
  bundle.manifest.summary.recurringHotspotCount = dataset.recurringHotspots.length;
  bundle.manifest.summary.recurringIncidentCount = dataset.recurringIncidents.length;
  bundle.manifest.summary.stewardActionCount = dataset.steward?.summary?.actionCount ?? 0;
  bundle.manifest.summary.stewardHeadline = dataset.steward?.summary?.headline ?? 'No steward summary available.';
  bundle.manifest.files = files ?? bundle.manifest.files;
  bundle.artifacts['casebook-dataset.json'] = JSON.stringify(dataset, null, 2);

  return bundle;
}

function buildStewardAction(kind, label, signature, headline, ask) {
  return {
    kind,
    label,
    signature,
    seenCount: 1,
    sourcePacks: ['pack-1'],
    priority: 1000,
    headline,
    ask,
  };
}
