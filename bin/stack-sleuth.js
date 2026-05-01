#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { analyzeTrace, renderTextSummary, renderMarkdownSummary } from '../src/analyze.js';
import {
  analyzeIncidentPack,
  renderIncidentPackTextSummary,
  renderIncidentPackMarkdownSummary,
} from '../src/briefing.js';
import {
  analyzeTraceDigest,
  renderDigestTextSummary,
  renderDigestMarkdownSummary,
} from '../src/digest.js';
import {
  analyzeRegression,
  renderRegressionTextSummary,
  renderRegressionMarkdownSummary
} from '../src/regression.js';
import {
  analyzeCasebook,
  parseCasebookHistoryInput,
  renderCasebookTextSummary,
  renderCasebookMarkdownSummary,
} from '../src/casebook.js';
import {
  analyzeTimeline,
  renderTimelineTextSummary,
  renderTimelineMarkdownSummary,
} from '../src/timeline.js';
import {
  analyzeCasebookChronicle,
  describeChronicleInputError,
  inspectCasebookChronicleInput,
  renderCasebookChronicleTextSummary,
  renderCasebookChronicleMarkdownSummary,
} from '../src/chronicle.js';
import {
  analyzeIncidentPortfolio,
  parseIncidentPortfolio,
  renderIncidentPortfolioTextSummary,
  renderIncidentPortfolioMarkdownSummary,
} from '../src/portfolio.js';
import {
  buildHandoffBriefing,
  renderHandoffTextSummary,
  renderHandoffMarkdownSummary,
} from '../src/handoff.js';
import {
  analyzeCasebookForge,
  renderCasebookForgeTextSummary,
  renderCasebookForgeMarkdownSummary,
} from '../src/forge.js';
import {
  analyzeCasebookMerge,
  renderCasebookMergeTextSummary,
  renderCasebookMergeMarkdownSummary,
} from '../src/merge.js';
import {
  buildCasebookDataset,
  inspectDatasetHistoryInput,
  inspectReplayDatasetInput,
  renderDatasetMarkdownSummary,
  renderDatasetTextSummary,
} from '../src/dataset.js';
import { extractTraceSet, formatExtractionMarkdown, formatExtractionText } from '../src/extract.js';
import {
  parseIncidentNotebook,
  renderNormalizedNotebookText,
  routeIncidentNotebook,
} from '../src/notebook.js';
import { parseIncidentPack } from '../src/pack.js';
import { loadIncidentWorkspace } from '../src/workspace.js';

const args = process.argv.slice(2);
const mode = args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'text';
const wantsDigest = args.includes('--digest');
const compareArgumentError = validateCompareArguments(args);
const packArgumentError = validateOptionValue(args, '--pack');
const portfolioArgumentError = validateOptionValue(args, '--portfolio');
const forgeArgumentError = validateOptionValue(args, '--forge');
const handoffArgumentError = validateOptionValue(args, '--handoff');
const notebookArgumentError = validateOptionValue(args, '--notebook');
const mergeCasebookArgumentError = validateOptionValue(args, '--merge-casebook');
const timelineArgumentError = validateOptionValue(args, '--timeline');
const chronicleArgumentError = validateOptionValue(args, '--chronicle');
const datasetArgumentError = validateOptionValue(args, '--dataset');
const replayDatasetArgumentError = validateOptionValue(args, '--replay-dataset');
const historyArgumentError = validateOptionValue(args, '--history');
const currentArgumentError = validateOptionValue(args, '--current');
const workspaceArgumentError = validateOptionValue(args, '--workspace');
const baselinePath = readOptionValue(args, '--baseline');
const candidatePath = readOptionValue(args, '--candidate');
const packPath = readOptionValue(args, '--pack');
const portfolioPath = readOptionValue(args, '--portfolio');
const forgePath = readOptionValue(args, '--forge');
const handoffPath = readOptionValue(args, '--handoff');
const notebookPath = readOptionValue(args, '--notebook');
const mergeCasebookPath = readOptionValue(args, '--merge-casebook');
const timelinePath = readOptionValue(args, '--timeline');
const chroniclePath = readOptionValue(args, '--chronicle');
const datasetPath = readOptionValue(args, '--dataset');
const replayDatasetPath = readOptionValue(args, '--replay-dataset');
const historyPath = readOptionValue(args, '--history');
const currentPath = readOptionValue(args, '--current');
const workspacePath = readOptionValue(args, '--workspace');
const workflowArgumentError = validateWorkflowArguments({
  baselinePath,
  candidatePath,
  packPath,
  portfolioPath,
  forgePath,
  handoffPath,
  notebookPath,
  mergeCasebookPath,
  timelinePath,
  chroniclePath,
  datasetPath,
  replayDatasetPath,
  historyPath,
  workspacePath,
});
const filePath = args.find((arg, index) => {
  if (arg.startsWith('--')) {
    return false;
  }

  const previous = args[index - 1] ?? '';
  return ![
    '--baseline',
    '--candidate',
    '--pack',
    '--portfolio',
    '--forge',
    '--handoff',
    '--notebook',
    '--merge-casebook',
    '--timeline',
    '--chronicle',
    '--dataset',
    '--replay-dataset',
    '--history',
    '--current',
    '--workspace',
  ].includes(previous);
}) ?? null;

if (compareArgumentError) {
  fail(compareArgumentError);
}

if (packArgumentError) {
  fail(packArgumentError);
}

if (portfolioArgumentError) {
  fail(portfolioArgumentError);
}

if (forgeArgumentError) {
  fail(forgeArgumentError);
}

if (handoffArgumentError) {
  fail(handoffArgumentError);
}

if (notebookArgumentError) {
  fail(notebookArgumentError);
}

if (mergeCasebookArgumentError) {
  fail(mergeCasebookArgumentError);
}

if (timelineArgumentError) {
  fail(timelineArgumentError);
}

if (chronicleArgumentError) {
  fail(chronicleArgumentError);
}

if (datasetArgumentError) {
  fail(datasetArgumentError);
}

if (replayDatasetArgumentError) {
  fail(replayDatasetArgumentError);
}

if (historyArgumentError) {
  fail(historyArgumentError);
}

if (currentArgumentError) {
  fail(currentArgumentError);
}

if (workspaceArgumentError) {
  fail(workspaceArgumentError);
}

if (currentPath && !historyPath) {
  fail('Casebook Radar requires --history when using --current.');
}

if (workflowArgumentError) {
  fail(workflowArgumentError);
}

try {
  if (workspacePath) {
    const workspace = loadIncidentWorkspace(workspacePath);

    if (workspace.kind === 'notebook') {
      const notebook = parseIncidentNotebook(workspace.input);
      if (notebook.kind === 'unsupported') {
        fail(notebook.reason ?? 'Workspace mode requires supported incident notebook headings like Current incident, Prior incidents, Baseline, Candidate, or Timeline.');
      }

      const routed = routeNotebookForCli(notebook);

      if (routed.mode === 'pack' && !routed.report.availableAnalyses.length) {
        fail('Workspace mode did not find any runnable analyses after notebook normalization. Provide at least Current incident, Baseline plus Candidate, or a valid Timeline section.');
      }

      if (routed.mode === 'portfolio' && !routed.report.summary.runnablePackCount) {
        fail('Workspace mode did not find any runnable analyses after notebook normalization. Add at least one pack with Current incident, Baseline plus Candidate, or a valid Timeline section.');
      }

      writeOutput({ workspace, notebook, routed }, mode, renderWorkspaceCliTextSummary, renderWorkspaceCliMarkdownSummary);
      process.exit(0);
    }

    if (workspace.kind === 'portfolio') {
      const report = analyzeIncidentPortfolio(workspace.normalizedText);
      if (!report.summary.runnablePackCount) {
        fail('Workspace mode did not find any runnable analyses. Add at least one labeled pack with @@ current @@, @@ baseline @@ plus @@ candidate @@, or a valid @@ timeline @@ section.');
      }

      writeOutput({ workspace, routed: { mode: 'portfolio', report } }, mode, renderWorkspaceCliTextSummary, renderWorkspaceCliMarkdownSummary);
      process.exit(0);
    }

    const report = analyzeIncidentPack(workspace.normalizedText);
    if (!report.availableAnalyses.length) {
      fail('Workspace mode did not find any runnable analyses. Provide at least @@ current @@, @@ baseline @@ plus @@ candidate @@, or a valid @@ timeline @@ section.');
    }

    writeOutput({ workspace, routed: { mode: 'pack', report } }, mode, renderWorkspaceCliTextSummary, renderWorkspaceCliMarkdownSummary);
    process.exit(0);
  }

  if (notebookPath) {
    const notebookInput = notebookPath === '-' ? fs.readFileSync(0, 'utf8') : readNotebookInput(notebookPath);
    const notebook = parseIncidentNotebook(notebookInput);
    if (notebook.kind === 'unsupported') {
      fail(notebook.reason ?? 'Notebook mode requires supported headings like Current incident, Prior incidents, Baseline, Candidate, or Timeline.');
    }

    const routed = routeNotebookForCli(notebook);

    if (routed.mode === 'pack' && !routed.report.availableAnalyses.length) {
      fail('Notebook mode did not find any runnable analyses after normalization. Provide at least Current incident, Baseline plus Candidate, or a valid Timeline section.');
    }

    if (routed.mode === 'portfolio' && !routed.report.summary.runnablePackCount) {
      fail('Notebook mode did not find any runnable analyses after normalization. Add at least one pack with Current incident, Baseline plus Candidate, or a valid Timeline section.');
    }

    writeOutput({ notebook, routed }, mode, renderNotebookCliTextSummary, renderNotebookCliMarkdownSummary);
    process.exit(0);
  }

  if (forgePath) {
    const forgeInput = forgePath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(forgePath, 'forge');
    const portfolio = parseIncidentPortfolio(forgeInput);
    if (!portfolio.packOrder.length) {
      fail('Casebook Forge requires @@@ label @@@ blocks around one or more incident packs.');
    }

    const report = analyzeCasebookForge(portfolio);
    if (!report.summary.runnablePackCount) {
      fail('Casebook Forge requires at least one runnable labeled incident pack. Add at least one pack with @@ current @@, @@ baseline @@ plus @@ candidate @@, or a valid @@ timeline @@ section.');
    }

    writeOutput(report, mode, renderForgeCliTextSummary, renderForgeCliMarkdownSummary);
    process.exit(0);
  }

  if (handoffPath) {
    const handoffInput = handoffPath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(handoffPath, 'handoff');
    const portfolio = parseIncidentPortfolio(handoffInput);
    if (!portfolio.packOrder.length) {
      fail('Handoff mode requires @@@ label @@@ blocks around one or more incident packs.');
    }

    const report = buildHandoffBriefing(portfolio);
    if (!report.summary.runnablePackCount) {
      fail('Handoff mode requires at least one runnable labeled incident pack. Add at least one pack with @@ current @@, @@ baseline @@ plus @@ candidate @@, or a valid @@ timeline @@ section.');
    }

    writeOutput(report, mode, renderHandoffTextSummary, renderHandoffMarkdownSummary);
    process.exit(0);
  }

  if (mergeCasebookPath) {
    const mergeInput = mergeCasebookPath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(mergeCasebookPath, 'merge-casebook');
    const portfolio = parseIncidentPortfolio(mergeInput);
    if (!portfolio.packOrder.length) {
      fail('Casebook Merge requires @@@ label @@@ blocks around one or more incident packs.');
    }

    const report = analyzeCasebookMerge(portfolio);
    if (!report.summary.updatedCaseCount && !report.summary.newCaseCount) {
      fail('Casebook Merge requires at least one runnable labeled incident pack. Add at least one pack with @@ current @@, @@ baseline @@ plus @@ candidate @@, or a valid @@ timeline @@ section.');
    }

    writeOutput(report, mode, renderMergeCliTextSummary, renderMergeCliMarkdownSummary);
    process.exit(0);
  }

  if (datasetPath) {
    const datasetInput = datasetPath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(datasetPath, 'dataset');
    const portfolio = parseIncidentPortfolio(datasetInput);
    if (!portfolio.packOrder.length) {
      fail('Casebook Dataset mode requires @@@ label @@@ blocks around one or more incident packs.');
    }

    const portfolioReport = analyzeIncidentPortfolio(portfolio);
    const report = buildCasebookDataset(portfolioReport);
    if (!report.cases.length) {
      fail('Casebook Dataset mode requires at least one runnable labeled incident pack. Add at least one pack with @@ current @@, @@ baseline @@ plus @@ candidate @@, or a valid @@ timeline @@ section.');
    }

    writeOutput(report, mode, renderDatasetTextSummary, renderDatasetMarkdownSummary);
    process.exit(0);
  }

  if (replayDatasetPath) {
    const replayInput = replayDatasetPath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(replayDatasetPath, 'dataset replay');
    const replay = inspectReplayDatasetInput(replayInput);

    if (!replay.valid && replay.reason === 'wrong-kind') {
      fail(`Casebook Dataset replay uses unsupported kind: ${replay.parsed?.kind ?? 'unknown'}.`);
    }

    if (!replay.valid && replay.reason === 'unsupported-version') {
      fail(`Casebook Dataset replay uses unsupported version ${replay.parsed?.version ?? 'unknown'}. Supported version: ${replay.supportedVersion}.`);
    }

    if (!replay.valid) {
      fail('Casebook Dataset replay requires saved Stack Sleuth dataset JSON.');
    }

    writeOutput(replay.dataset, mode, renderDatasetTextSummary, renderDatasetMarkdownSummary);
    process.exit(0);
  }

  if (portfolioPath) {
    const portfolioInput = portfolioPath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(portfolioPath, 'portfolio');
    const portfolio = parseIncidentPortfolio(portfolioInput);
    if (!portfolio.packOrder.length) {
      fail('Portfolio mode requires @@@ label @@@ blocks around one or more incident packs.');
    }

    const report = analyzeIncidentPortfolio(portfolio);
    if (!report.summary.runnablePackCount) {
      fail('Portfolio mode did not find any runnable analyses. Add at least one labeled pack with @@ current @@, @@ baseline @@ plus @@ candidate @@, or a valid @@ timeline @@ section.');
    }

    writeOutput(report, mode, renderIncidentPortfolioTextSummary, renderIncidentPortfolioMarkdownSummary);
    process.exit(0);
  }

  if (packPath) {
    const packInput = packPath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(packPath, 'incident-pack');
    const pack = parseIncidentPack(packInput);
    if (!pack.sectionOrder.length) {
      fail('Incident Pack mode requires @@ current @@ style sections, such as @@ current @@, @@ history @@, @@ baseline @@, @@ candidate @@, or @@ timeline @@.');
    }

    const briefing = analyzeIncidentPack(pack);
    if (!briefing.availableAnalyses.length) {
      fail('Incident Pack mode did not find any runnable analyses. Provide at least @@ current @@, @@ baseline @@ plus @@ candidate @@, or a valid @@ timeline @@ section.');
    }

    writeOutput(briefing, mode, renderIncidentPackTextSummary, renderIncidentPackMarkdownSummary);
    process.exit(0);
  }

  if (historyPath) {
    const historyInput = readNamedInput(historyPath, 'history');
    const currentInput = currentPath && currentPath !== '-'
      ? readNamedInput(currentPath, 'current')
      : fs.readFileSync(0, 'utf8');

    if (!currentInput.trim()) {
      fail('Casebook Radar requires non-empty current input. Pipe current traces or use --current <path|->.');
    }

    const datasetHistory = inspectDatasetHistoryInput(historyInput);
    if (!datasetHistory.valid && datasetHistory.reason === 'missing-export-text') {
      fail('Casebook Dataset history must include a non-empty exportText payload.');
    }

    if (!datasetHistory.valid && datasetHistory.reason === 'wrong-kind') {
      fail(`Casebook Dataset history uses unsupported kind: ${datasetHistory.parsed?.kind ?? 'unknown'}.`);
    }

    if (!datasetHistory.valid && datasetHistory.reason === 'unsupported-version') {
      fail(`Casebook Dataset history uses unsupported version ${datasetHistory.parsed?.version ?? 'unknown'}. Supported version: ${datasetHistory.supportedVersion}.`);
    }

    const historyBatches = parseCasebookHistoryInput(historyInput);
    if (!historyBatches.length) {
      fail('Casebook Radar requires labeled historical cases like === release-2026-04-15 ===.');
    }

    const casebook = analyzeCasebook({ current: currentInput, history: historyInput });
    if (casebook.summary.currentTraceCount === 0) {
      fail('Casebook Radar could not excavate any current traces from the provided input.');
    }

    if (casebook.summary.historicalCaseCount === 0) {
      fail('Casebook Radar requires at least one usable historical case with a stack trace or excavatable raw log.');
    }

    writeOutput(casebook, mode, renderCasebookTextSummary, renderCasebookMarkdownSummary);
    process.exit(0);
  }

  if (timelinePath) {
    const timelineInput = timelinePath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(timelinePath, 'timeline');
    const timeline = analyzeTimeline(timelineInput);

    if (timeline.summary.snapshotCount < 2) {
      fail('Timeline mode requires at least two labeled snapshots.');
    }

    writeOutput(timeline, mode, renderTimelineTextSummary, renderTimelineMarkdownSummary);
    process.exit(0);
  }

  if (chroniclePath) {
    const chronicleInput = chroniclePath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(chroniclePath, 'chronicle');
    const chronicleInspection = inspectCasebookChronicleInput(chronicleInput);

    if (!chronicleInspection.valid) {
      fail(describeChronicleInputError(chronicleInspection));
    }

    const chronicle = analyzeCasebookChronicle(chronicleInspection);
    writeOutput(chronicle, mode, renderCasebookChronicleTextSummary, renderCasebookChronicleMarkdownSummary);
    process.exit(0);
  }

  if (baselinePath || candidatePath) {
    if (!baselinePath || !candidatePath) {
      fail('Compare mode requires both --baseline and --candidate inputs.');
    }

    const baselineInput = readNamedInput(baselinePath, 'baseline');
    const candidateInput = candidatePath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(candidatePath, 'candidate');

    if (!baselineInput.trim() || !candidateInput.trim()) {
      fail('Compare mode requires non-empty baseline and candidate trace batches.');
    }

    const regression = analyzeRegression({ baseline: baselineInput, candidate: candidateInput });
    if (regression.baselineDigest.totalTraces === 0 || regression.candidateDigest.totalTraces === 0) {
      fail('Compare mode could not excavate any traces from one side of the comparison.');
    }

    writeOutput(regression, mode, renderRegressionTextSummary, renderRegressionMarkdownSummary);
    process.exit(0);
  }

  const input = filePath ? fs.readFileSync(filePath, 'utf8') : fs.readFileSync(0, 'utf8');
  const extraction = extractTraceSet(input);
  const useDigest = wantsDigest || extraction.traceCount > 1;

  if (useDigest) {
    const digest = analyzeTraceDigest(input);

    if (digest.totalTraces === 0) {
      fail('No trace provided. Pipe a stack trace or pass a file path.');
    }

    writeOutput(digest, mode, renderDigestTextSummary, renderDigestMarkdownSummary);
  } else {
    if (extraction.traceCount === 0) {
      fail('No trace provided. Pipe a stack trace or pass a file path.');
    }

    const report = analyzeTrace(extraction.traces[0]);
    const payload = extraction.mode === 'extracted' ? { ...report, extraction } : report;
    writeOutput(payload, mode, renderSingleTraceTextSummary, renderSingleTraceMarkdownSummary);
  }
} catch (error) {
  if (notebookPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read notebook input: ${error.message}`);
  }

  if (workspacePath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read workspace input: ${error.message}`);
  }

  if (portfolioPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read portfolio input: ${error.message}`);
  }

  if (forgePath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read forge input: ${error.message}`);
  }

  if (handoffPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read handoff input: ${error.message}`);
  }

  if (packPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read incident pack input: ${error.message}`);
  }

  if (historyPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read casebook input: ${error.message}`);
  }

  if (timelinePath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read timeline input: ${error.message}`);
  }

  if (datasetPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read dataset input: ${error.message}`);
  }

  if (replayDatasetPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read dataset replay input: ${error.message}`);
  }

  if (baselinePath || candidatePath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read compare input: ${error.message}`);
  }

  if (filePath) {
    fail(`Could not read trace file: ${error.message}`);
  }

  fail(`Could not read trace from stdin: ${error.message}`);
}

function readOptionValue(list, flag) {
  const index = list.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const value = list[index + 1] ?? null;
  return value && !value.startsWith('--') ? value : null;
}

function validateCompareArguments(list) {
  for (const flag of ['--baseline', '--candidate']) {
    const error = validateOptionValue(list, flag);
    if (error) {
      return error;
    }
  }

  return null;
}

function validateOptionValue(list, flag) {
  const index = list.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const value = list[index + 1] ?? null;
  if (!value || value.startsWith('--')) {
    return `Missing value for ${flag}.`;
  }

  return null;
}

function validateWorkflowArguments({ baselinePath, candidatePath, packPath, portfolioPath, forgePath, handoffPath, notebookPath, mergeCasebookPath, timelinePath, chroniclePath, datasetPath, replayDatasetPath, historyPath, workspacePath }) {
  const activeModes = [
    historyPath ? 'casebook' : null,
    portfolioPath ? 'portfolio' : null,
    forgePath ? 'forge' : null,
    handoffPath ? 'handoff' : null,
    notebookPath ? 'notebook' : null,
    workspacePath ? 'workspace' : null,
    mergeCasebookPath ? 'merge-casebook' : null,
    packPath ? 'incident-pack' : null,
    timelinePath ? 'timeline' : null,
    chroniclePath ? 'chronicle' : null,
    datasetPath ? 'dataset' : null,
    replayDatasetPath ? 'replay-dataset' : null,
    baselinePath || candidatePath ? 'compare' : null,
  ].filter(Boolean);

  if (activeModes.length > 1) {
    return 'Choose one workflow mode at a time: forge, handoff, merge-casebook, portfolio, notebook, workspace, incident-pack, casebook, timeline, chronicle, dataset, replay-dataset, or compare.';
  }

  return null;
}

function readNamedInput(targetPath, label) {
  try {
    return fs.readFileSync(targetPath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${label} trace file: ${error.message}`);
  }
}

function readNotebookInput(targetPath) {
  try {
    return fs.readFileSync(targetPath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read notebook input file: ${error.message}`);
  }
}

function writeOutput(payload, outputMode, textRenderer, markdownRenderer) {
  if (outputMode === 'json') {
    process.stdout.write(`${JSON.stringify(toSerializablePayload(payload), null, 2)}\n`);
  } else if (outputMode === 'markdown') {
    process.stdout.write(`${markdownRenderer(payload)}\n`);
  } else {
    process.stdout.write(`${textRenderer(payload)}\n`);
  }
}

function toSerializablePayload(payload) {
  if (payload?.workspace && payload?.notebook && payload?.routed?.report) {
    const routedPayload = toSerializablePayload(payload.routed.report);
    return {
      workspace: serializeWorkspace(payload.workspace),
      notebook: serializeNotebook(payload.notebook),
      routed: {
        mode: payload.routed.mode,
        summary: routedPayload.summary ?? null,
      },
      ...routedPayload,
    };
  }

  if (payload?.workspace && payload?.routed?.report) {
    const routedPayload = toSerializablePayload(payload.routed.report);
    return {
      workspace: serializeWorkspace(payload.workspace),
      routed: {
        mode: payload.routed.mode,
        summary: routedPayload.summary ?? null,
      },
      ...routedPayload,
    };
  }

  if (payload?.notebook && payload?.routed?.report) {
    const routedPayload = toSerializablePayload(payload.routed.report);
    return {
      notebook: serializeNotebook(payload.notebook),
      routed: {
        mode: payload.routed.mode,
        summary: routedPayload.summary ?? null,
      },
      ...routedPayload,
    };
  }

  if (payload?.kind === 'stack-sleuth-casebook-dataset' && typeof payload?.version === 'number') {
    return {
      kind: payload.kind,
      version: payload.version,
      summary: payload.summary,
      portfolio: {
        packOrder: payload.portfolio?.packOrder ?? [],
      },
      responseQueue: payload.responseQueue ?? [],
      recurringIncidents: payload.recurringIncidents ?? [],
      recurringHotspots: payload.recurringHotspots ?? [],
      cases: (payload.cases ?? []).map((entry) => ({
        label: entry.label,
        signature: entry.signature,
        sourcePacks: entry.sourcePacks,
        metadata: entry.metadata,
        conflicts: entry.conflicts,
      })),
      exportText: payload.exportText,
    };
  }

  if (Array.isArray(payload?.cases) && typeof payload?.exportText === 'string' && payload?.summary?.mergedCaseCount !== undefined) {
    return {
      portfolio: {
        packOrder: payload.portfolio?.packOrder ?? [],
      },
      summary: payload.summary,
      cases: payload.cases.map((entry) => ({
        label: entry.label,
        signature: entry.signature,
        sourcePacks: entry.sourcePacks,
        metadata: entry.metadata,
        conflicts: entry.conflicts,
      })),
      exportText: payload.exportText,
    };
  }

  if (Array.isArray(payload?.cases) && typeof payload?.exportText === 'string' && payload?.summary?.caseCount !== undefined) {
    return {
      portfolio: {
        packOrder: payload.portfolio?.packOrder ?? [],
      },
      summary: payload.summary,
      cases: payload.cases.map((entry) => ({
        label: entry.label,
        signature: entry.signature,
        sourcePacks: entry.sourcePacks,
        matchedHistoryLabels: entry.matchedHistoryLabels,
      })),
      exportText: payload.exportText,
    };
  }

  if (Array.isArray(payload?.ownerPackets) && Array.isArray(payload?.gapPackets) && typeof payload?.exportText === 'string' && payload?.summary?.packetCount !== undefined) {
    return {
      portfolio: {
        packOrder: payload.portfolio?.packOrder ?? [],
      },
      summary: payload.summary,
      ownerPackets: payload.ownerPackets,
      gapPackets: payload.gapPackets,
      packets: payload.packets,
      exportText: payload.exportText,
    };
  }

  if (payload?.portfolio?.packs && Array.isArray(payload?.priorityQueue) && payload?.summary?.runnablePackCount !== undefined) {
    return {
      portfolio: {
        packOrder: payload.portfolio.packOrder,
      },
      summary: payload.summary,
      priorityQueue: payload.priorityQueue.map((item) => ({
        label: item.label,
        priorityScore: item.priorityScore,
        priorityReasons: item.priorityReasons,
        availableAnalyses: item.report.availableAnalyses,
        headline: item.report.summary.headline,
      })),
      responseQueue: (payload.responseQueue ?? []).map((item) => ({
        owner: item.owner,
        labels: item.labels,
        guidance: item.guidance,
        highestPriorityScore: item.highestPriorityScore,
        novelIncidentCount: item.novelIncidentCount,
        packCount: item.packCount,
      })),
      runbookGaps: payload.runbookGaps ?? [],
      unownedPacks: payload.unownedPacks ?? [],
      recurringIncidents: payload.recurringIncidents,
      recurringHotspots: payload.recurringHotspots,
      packReports: payload.packReports.map((item) => ({
        label: item.label,
        runnable: item.runnable,
        priorityScore: item.priorityScore,
        priorityReasons: item.priorityReasons,
        availableAnalyses: item.report.availableAnalyses,
        omissions: item.report.omissions,
        summary: item.summary,
      })),
    };
  }

  if (!(payload?.pack && Array.isArray(payload?.availableAnalyses) && payload?.summary?.sectionsPresent)) {
    return payload;
  }

  return {
    pack: {
      sectionOrder: payload.pack.sectionOrder,
      unknownSections: payload.pack.unknownSections,
    },
    availableAnalyses: payload.availableAnalyses,
    omissions: payload.omissions,
    summary: payload.summary,
    currentDigest: payload.currentDigest ? {
      totalTraces: payload.currentDigest.totalTraces,
      groupCount: payload.currentDigest.groupCount,
      hotspots: payload.currentDigest.hotspots,
      groups: payload.currentDigest.groups.map((group) => ({
        signature: group.signature,
        runtime: group.runtime,
        errorName: group.errorName,
        count: group.count,
      })),
    } : null,
    casebook: payload.casebook ? {
      summary: payload.casebook.summary,
      incidents: payload.casebook.incidents.map((incident) => ({
        signature: incident.signature,
        classification: incident.classification,
        matchingCases: incident.matchingCases,
        count: incident.count,
        culpritPath: incident.culpritPath,
        diagnosisTags: incident.diagnosisTags,
      })),
    } : null,
    regression: payload.regression ? {
      summary: payload.regression.summary,
      hotspotShifts: payload.regression.hotspotShifts,
      incidents: payload.regression.incidents.map((incident) => ({
        signature: incident.signature,
        status: incident.status,
        baselineCount: incident.baselineCount,
        candidateCount: incident.candidateCount,
        delta: incident.delta,
      })),
    } : null,
    timeline: payload.timeline ? {
      labels: payload.timeline.labels,
      summary: payload.timeline.summary,
      incidents: payload.timeline.incidents.map((incident) => ({
        signature: incident.signature,
        trend: incident.trend,
        series: incident.series,
        latestCount: incident.latestCount,
      })),
      hotspots: payload.timeline.hotspots,
    } : null,
  };
}

function renderSingleTraceTextSummary(report) {
  const summary = renderTextSummary(report);
  if (report?.extraction?.mode === 'extracted') {
    return `${formatExtractionText(report.extraction)}\n${summary}`;
  }

  return summary;
}

function renderSingleTraceMarkdownSummary(report) {
  const summary = renderMarkdownSummary(report);
  if (report?.extraction?.mode === 'extracted') {
    return ['# Stack Sleuth Report', '', formatExtractionMarkdown(report.extraction), '', ...summary.split('\n').slice(2)].join('\n');
  }

  return summary;
}

function serializeNotebook(notebook) {
  if (notebook?.kind === 'portfolio') {
    return {
      kind: notebook.kind,
      packOrder: notebook.packOrder,
      packs: notebook.packs.map((pack) => ({
        label: pack.label,
        sectionOrder: pack.sectionOrder,
      })),
      normalizedText: renderNormalizedNotebookText(notebook),
    };
  }

  if (notebook?.kind === 'pack') {
    return {
      kind: notebook.kind,
      sectionOrder: notebook.sectionOrder,
      normalizedText: renderNormalizedNotebookText(notebook),
    };
  }

  return {
    kind: notebook?.kind ?? 'unsupported',
    reason: notebook?.reason ?? null,
    normalizedText: '',
  };
}

function serializeWorkspace(workspace) {
  return {
    kind: workspace?.kind ?? 'unsupported',
    path: workspace?.path ?? null,
    recognizedFiles: workspace?.recognizedFiles ?? [],
    packOrder: workspace?.packOrder ?? [],
    packs: Array.isArray(workspace?.packs)
      ? workspace.packs.map((pack) => ({
        label: pack.label,
        recognizedFiles: pack.recognizedFiles ?? [],
      }))
      : [],
    omittedPacks: workspace?.omittedPacks ?? [],
  };
}

function routeNotebookForCli(notebook) {
  return routeIncidentNotebook({
    notebook,
    analyzers: {
      pack(normalizedText) {
        return {
          mode: 'pack',
          report: analyzeIncidentPack(normalizedText),
        };
      },
      portfolio(normalizedText) {
        return {
          mode: 'portfolio',
          report: analyzeIncidentPortfolio(normalizedText),
        };
      },
    },
  });
}

function renderWorkspaceCliTextSummary(payload) {
  if (payload.notebook) {
    return renderNotebookCliTextSummary(payload);
  }

  return payload.routed.mode === 'portfolio'
    ? renderIncidentPortfolioTextSummary(payload.routed.report)
    : renderIncidentPackTextSummary(payload.routed.report);
}

function renderWorkspaceCliMarkdownSummary(payload) {
  if (payload.notebook) {
    return renderNotebookCliMarkdownSummary(payload);
  }

  return payload.routed.mode === 'portfolio'
    ? renderIncidentPortfolioMarkdownSummary(payload.routed.report)
    : renderIncidentPackMarkdownSummary(payload.routed.report);
}

function renderNotebookCliTextSummary(payload) {
  const routedText = payload.routed.mode === 'portfolio'
    ? renderIncidentPortfolioTextSummary(payload.routed.report)
    : renderIncidentPackTextSummary(payload.routed.report);
  const countLabel = payload.notebook.kind === 'portfolio'
    ? `Kind: portfolio (${payload.notebook.packOrder.length} packs)`
    : `Kind: pack (${payload.notebook.sectionOrder.length} sections)`;

  return [
    'Notebook normalization',
    countLabel,
    '',
    renderNormalizedNotebookText(payload.notebook),
    '',
    routedText,
  ].join('\n').trim();
}

function renderNotebookCliMarkdownSummary(payload) {
  const routedMarkdown = payload.routed.mode === 'portfolio'
    ? renderIncidentPortfolioMarkdownSummary(payload.routed.report)
    : renderIncidentPackMarkdownSummary(payload.routed.report);
  const countLabel = payload.notebook.kind === 'portfolio'
    ? `Kind: portfolio (${payload.notebook.packOrder.length} packs)`
    : `Kind: pack (${payload.notebook.sectionOrder.length} sections)`;

  return [
    '# Notebook normalization',
    '',
    `- **${countLabel}**`,
    '',
    '## Normalized incident workflow',
    '```text',
    renderNormalizedNotebookText(payload.notebook),
    '```',
    '',
    routedMarkdown,
  ].join('\n').trim();
}

function renderForgeCliTextSummary(report) {
  return [
    renderCasebookForgeTextSummary(report),
    '',
    'Reusable casebook export',
    report.exportText,
  ].join('\n').trim();
}

function renderForgeCliMarkdownSummary(report) {
  return [
    renderCasebookForgeMarkdownSummary(report),
    '',
    '## Reusable casebook export',
    '```text',
    report.exportText,
    '```',
  ].join('\n').trim();
}

function renderMergeCliTextSummary(report) {
  return [
    renderCasebookMergeTextSummary(report),
    '',
    'Merged casebook export',
    report.exportText,
  ].join('\n').trim();
}

function renderMergeCliMarkdownSummary(report) {
  return [
    renderCasebookMergeMarkdownSummary(report),
    '',
    '## Merged casebook export',
    '```text',
    report.exportText,
    '```',
  ].join('\n').trim();
}


function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
