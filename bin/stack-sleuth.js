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
  analyzeResponseBundleChronicle,
  describeResponseBundleChronicleInputError,
  inspectResponseBundleChronicleInput,
  renderResponseBundleChronicleTextSummary,
  renderResponseBundleChronicleMarkdownSummary,
} from '../src/bundle-chronicle.js';
import {
  analyzeIncidentPortfolio,
  parseIncidentPortfolio,
  renderIncidentPortfolioTextSummary,
  renderIncidentPortfolioMarkdownSummary,
} from '../src/portfolio.js';
import {
  buildActionBoard,
  renderActionBoardMarkdownSummary,
  renderActionBoardTextSummary,
} from '../src/action-board.js';
import { renderIncidentDossierHtml } from '../src/report.js';
import { buildResponseBundle } from '../src/bundle.js';
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
import {
  inspectResponseBundleReplayInput,
  renderResponseBundleMarkdownSummary,
  renderResponseBundleTextSummary,
} from '../src/bundle-replay.js';
import {
  buildResponseBundleShelf,
  describeResponseBundleShelfInputError,
  inspectReplayBundleShelfInput,
  renderResponseBundleShelfMarkdownSummary,
  renderResponseBundleShelfTextSummary,
} from '../src/bundle-shelf.js';
import {
  buildCasebookShelf,
  describeShelfInputError,
  inspectReplayShelfInput,
  renderShelfMarkdownSummary,
  renderShelfTextSummary,
} from '../src/shelf.js';
import { extractTraceSet, formatExtractionMarkdown, formatExtractionText } from '../src/extract.js';
import {
  parseIncidentNotebook,
  renderNormalizedNotebookText,
  routeIncidentNotebook,
} from '../src/notebook.js';
import { parseIncidentPack } from '../src/pack.js';
import { loadIncidentWorkspace } from '../src/workspace.js';
import {
  describeCapsuleInputError,
  inspectCapsuleInput,
  normalizeCapsuleToWorkflow,
} from '../src/capsule.js';

const args = process.argv.slice(2);
const outputArgumentError = validateOutputArguments(args);
const mode = args.includes('--json')
  ? 'json'
  : args.includes('--markdown')
    ? 'markdown'
    : args.includes('--html')
      ? 'html'
      : 'text';
const wantsDigest = args.includes('--digest');
const compareArgumentError = validateCompareArguments(args);
const packArgumentError = validateOptionValue(args, '--pack');
const portfolioArgumentError = validateOptionValue(args, '--portfolio');
const boardArgumentError = validateOptionValue(args, '--board');
const forgeArgumentError = validateOptionValue(args, '--forge');
const handoffArgumentError = validateOptionValue(args, '--handoff');
const notebookArgumentError = validateOptionValue(args, '--notebook');
const mergeCasebookArgumentError = validateOptionValue(args, '--merge-casebook');
const timelineArgumentError = validateOptionValue(args, '--timeline');
const chronicleArgumentError = validateOptionValue(args, '--chronicle');
const bundleChronicleArgumentError = validateOptionValue(args, '--bundle-chronicle');
const datasetArgumentError = validateOptionValue(args, '--dataset');
const replayDatasetArgumentError = validateOptionValue(args, '--replay-dataset');
const replayBundleArgumentError = validateOptionValue(args, '--replay-bundle');
const bundleShelfArgumentError = validateOptionValue(args, '--bundle-shelf');
const replayBundleShelfArgumentError = validateOptionValue(args, '--replay-bundle-shelf');
const shelfArgumentError = validateOptionValue(args, '--shelf');
const replayShelfArgumentError = validateOptionValue(args, '--replay-shelf');
const historyArgumentError = validateOptionValue(args, '--history');
const currentArgumentError = validateOptionValue(args, '--current');
const workspaceArgumentError = validateOptionValue(args, '--workspace');
const capsuleArgumentError = validateOptionValue(args, '--capsule');
const bundleArgumentError = validateOptionValue(args, '--bundle');
const baselinePath = readOptionValue(args, '--baseline');
const candidatePath = readOptionValue(args, '--candidate');
const packPath = readOptionValue(args, '--pack');
const portfolioPath = readOptionValue(args, '--portfolio');
const boardPath = readOptionValue(args, '--board');
const forgePath = readOptionValue(args, '--forge');
const handoffPath = readOptionValue(args, '--handoff');
const notebookPath = readOptionValue(args, '--notebook');
const mergeCasebookPath = readOptionValue(args, '--merge-casebook');
const timelinePath = readOptionValue(args, '--timeline');
const chroniclePath = readOptionValue(args, '--chronicle');
const bundleChroniclePath = readOptionValue(args, '--bundle-chronicle');
const datasetPath = readOptionValue(args, '--dataset');
const replayDatasetPath = readOptionValue(args, '--replay-dataset');
const replayBundlePath = readOptionValue(args, '--replay-bundle');
const bundleShelfPath = readOptionValue(args, '--bundle-shelf');
const replayBundleShelfPath = readOptionValue(args, '--replay-bundle-shelf');
const shelfPath = readOptionValue(args, '--shelf');
const replayShelfPath = readOptionValue(args, '--replay-shelf');
const historyPath = readOptionValue(args, '--history');
const currentPath = readOptionValue(args, '--current');
const workspacePath = readOptionValue(args, '--workspace');
const capsulePath = readOptionValue(args, '--capsule');
const bundlePath = readOptionValue(args, '--bundle');
const workflowArgumentError = validateWorkflowArguments({
  baselinePath,
  candidatePath,
  packPath,
  portfolioPath,
  boardPath,
  forgePath,
  handoffPath,
  notebookPath,
  mergeCasebookPath,
  timelinePath,
  chroniclePath,
  bundleChroniclePath,
  datasetPath,
  replayDatasetPath,
  replayBundlePath,
  bundleShelfPath,
  replayBundleShelfPath,
  shelfPath,
  replayShelfPath,
  historyPath,
  workspacePath,
  capsulePath,
});
const htmlWorkflowArgumentError = validateHtmlWorkflowSupport({
  mode,
  packPath,
  portfolioPath,
  notebookPath,
  workspacePath,
  capsulePath,
});
const bundleWorkflowArgumentError = validateBundleWorkflowSupport({
  mode,
  bundlePath,
  packPath,
  portfolioPath,
  notebookPath,
  workspacePath,
  capsulePath,
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
    '--board',
    '--forge',
    '--handoff',
    '--notebook',
    '--merge-casebook',
    '--timeline',
    '--chronicle',
    '--bundle-chronicle',
    '--dataset',
    '--replay-dataset',
    '--replay-bundle',
    '--bundle-shelf',
    '--replay-bundle-shelf',
    '--shelf',
    '--replay-shelf',
    '--history',
    '--current',
    '--workspace',
    '--capsule',
    '--bundle',
  ].includes(previous);
}) ?? null;

if (compareArgumentError) {
  fail(compareArgumentError);
}

if (outputArgumentError) {
  fail(outputArgumentError);
}

if (packArgumentError) {
  fail(packArgumentError);
}

if (portfolioArgumentError) {
  fail(portfolioArgumentError);
}

if (boardArgumentError) {
  fail(boardArgumentError);
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

if (bundleChronicleArgumentError) {
  fail(bundleChronicleArgumentError);
}

if (datasetArgumentError) {
  fail(datasetArgumentError);
}

if (replayDatasetArgumentError) {
  fail(replayDatasetArgumentError);
}

if (replayBundleArgumentError) {
  fail(replayBundleArgumentError);
}

if (bundleShelfArgumentError) {
  fail(bundleShelfArgumentError);
}

if (replayBundleShelfArgumentError) {
  fail(replayBundleShelfArgumentError);
}

if (shelfArgumentError) {
  fail(shelfArgumentError);
}

if (replayShelfArgumentError) {
  fail(replayShelfArgumentError);
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

if (capsuleArgumentError) {
  fail(capsuleArgumentError);
}

if (bundleArgumentError) {
  fail(bundleArgumentError);
}

if (currentPath && !historyPath) {
  fail('Casebook Radar requires --history when using --current.');
}

if (workflowArgumentError) {
  fail(workflowArgumentError);
}

if (htmlWorkflowArgumentError) {
  fail(htmlWorkflowArgumentError);
}

if (bundleWorkflowArgumentError) {
  fail(bundleWorkflowArgumentError);
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

      if (bundlePath) {
        if (routed.mode !== 'portfolio') {
          fail('Bundle output is currently supported only when workspace notebook routing normalizes into a portfolio.');
        }
        writeBundleOutput(bundlePath, { report: routed.report, sourceMode: 'workspace', sourceLabel: workspace.path ?? workspacePath });
      } else {
        writeOutput({ workspace, notebook, routed }, mode, renderWorkspaceCliTextSummary, renderWorkspaceCliMarkdownSummary, renderWorkspaceCliHtmlSummary);
      }
      process.exit(0);
    }

    if (workspace.kind === 'portfolio') {
      const report = analyzeIncidentPortfolio(workspace.normalizedText);
      if (!report.summary.runnablePackCount) {
        fail('Workspace mode did not find any runnable analyses. Add at least one labeled pack with @@ current @@, @@ baseline @@ plus @@ candidate @@, or a valid @@ timeline @@ section.');
      }

      if (bundlePath) {
        writeBundleOutput(bundlePath, { report, sourceMode: 'workspace', sourceLabel: workspace.path ?? workspacePath });
      } else {
        writeOutput({ workspace, routed: { mode: 'portfolio', report } }, mode, renderWorkspaceCliTextSummary, renderWorkspaceCliMarkdownSummary, renderWorkspaceCliHtmlSummary);
      }
      process.exit(0);
    }

    const report = analyzeIncidentPack(workspace.normalizedText);
    if (!report.availableAnalyses.length) {
      fail('Workspace mode did not find any runnable analyses. Provide at least @@ current @@, @@ baseline @@ plus @@ candidate @@, or a valid @@ timeline @@ section.');
    }

    if (bundlePath) {
      fail('Bundle output is currently supported only for portfolio-shaped workflows: --portfolio, --notebook, --workspace, and --capsule when they normalize into a portfolio.');
    }

    writeOutput({ workspace, routed: { mode: 'pack', report } }, mode, renderWorkspaceCliTextSummary, renderWorkspaceCliMarkdownSummary, renderWorkspaceCliHtmlSummary);
    process.exit(0);
  }

  if (capsulePath) {
    const capsuleInput = capsulePath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(capsulePath, 'capsule');
    const inspection = inspectCapsuleInput(capsuleInput);

    if (!inspection.valid) {
      fail(describeCapsuleInputError(inspection));
    }

    const capsule = normalizeCapsuleToWorkflow(inspection.capsule);
    const routed = capsule.kind === 'portfolio'
      ? { mode: 'portfolio', report: analyzeIncidentPortfolio(capsule.normalizedText) }
      : { mode: 'pack', report: analyzeIncidentPack(capsule.normalizedText) };

    if (bundlePath) {
      if (routed.mode !== 'portfolio') {
        fail('Bundle output is currently supported only when capsule routing normalizes into a portfolio.');
      }
      writeBundleOutput(bundlePath, { report: routed.report, sourceMode: 'capsule', sourceLabel: capsulePath === '-' ? 'stdin' : capsulePath });
    } else {
      writeOutput({ capsule, routed }, mode, renderCapsuleCliTextSummary, renderCapsuleCliMarkdownSummary, renderCapsuleCliHtmlSummary);
    }
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

    if (bundlePath) {
      if (routed.mode !== 'portfolio') {
        fail('Bundle output is currently supported only when notebook routing normalizes into a portfolio.');
      }
      writeBundleOutput(bundlePath, { report: routed.report, sourceMode: 'notebook', sourceLabel: notebookPath === '-' ? 'stdin' : notebookPath });
    } else {
      writeOutput({ notebook, routed }, mode, renderNotebookCliTextSummary, renderNotebookCliMarkdownSummary, renderNotebookCliHtmlSummary);
    }
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

  if (boardPath) {
    const boardInput = readBoardInput(boardPath);
    const board = buildActionBoard(boardInput);

    if (board.summary.sourceKind === 'unknown') {
      fail('Action Board requires a labeled portfolio or saved Stack Sleuth replay artifact.');
    }

    writeOutput(board, mode, renderActionBoardTextSummary, renderActionBoardMarkdownSummary);
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

  if (replayBundlePath) {
    const replayInput = readReplayBundleInput(replayBundlePath);
    const replay = inspectResponseBundleReplayInput(replayInput);

    if (!replay.valid && replay.reason === 'wrong-kind') {
      fail(`Response Bundle replay uses unsupported kind: ${replay.parsed?.kind ?? 'unknown'}.`);
    }

    if (!replay.valid && replay.reason === 'unsupported-version') {
      fail(`Response Bundle replay uses unsupported version ${replay.parsed?.version ?? 'unknown'}. Supported versions: ${(replay.supportedVersions ?? []).join(', ')}.`);
    }

    if (!replay.valid && replay.reason === 'invalid-json') {
      fail('Response Bundle replay could not parse the saved bundle JSON.');
    }

    if (!replay.valid && replay.reason === 'missing-dataset') {
      fail('Response Bundle replay requires casebook-dataset.json in saved bundle directories.');
    }

    if (!replay.valid) {
      fail('Response Bundle replay requires a saved Stack Sleuth response bundle JSON or directory.');
    }

    writeOutput(replay.bundle, mode, renderResponseBundleTextSummary, renderResponseBundleMarkdownSummary);
    process.exit(0);
  }

  if (bundleShelfPath) {
    const report = buildResponseBundleShelf(readBundleShelfDirectoryEntries(bundleShelfPath));
    if (!report.summary.validSnapshotCount) {
      fail('Response Bundle Shelf requires at least one valid saved response bundle snapshot.');
    }

    writeOutput(report, mode, renderResponseBundleShelfTextSummary, renderResponseBundleShelfMarkdownSummary);
    process.exit(0);
  }

  if (replayBundleShelfPath) {
    const replayInput = replayBundleShelfPath === '-'
      ? fs.readFileSync(0, 'utf8')
      : readNamedInput(replayBundleShelfPath, 'response bundle shelf replay');
    const replay = inspectReplayBundleShelfInput(replayInput);

    if (!replay.valid && replay.reason === 'wrong-kind') {
      fail(`Response Bundle Shelf replay uses unsupported kind: ${replay.parsed?.kind ?? 'unknown'}.`);
    }

    if (!replay.valid && replay.reason === 'unsupported-version') {
      fail(`Response Bundle Shelf replay uses unsupported version ${replay.parsed?.version ?? 'unknown'}. Supported version: ${replay.supportedVersion}.`);
    }

    if (!replay.valid) {
      fail(describeResponseBundleShelfInputError(replay));
    }

    writeOutput(replay.shelf, mode, renderResponseBundleShelfTextSummary, renderResponseBundleShelfMarkdownSummary);
    process.exit(0);
  }

  if (shelfPath) {
    const report = buildCasebookShelf(readShelfDirectoryEntries(shelfPath));
    if (!report.summary.validSnapshotCount) {
      fail('Casebook Shelf requires at least one valid saved Casebook Dataset snapshot.');
    }

    writeOutput(report, mode, renderShelfTextSummary, renderShelfMarkdownSummary);
    process.exit(0);
  }

  if (replayShelfPath) {
    const replayInput = replayShelfPath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(replayShelfPath, 'shelf replay');
    const replay = inspectReplayShelfInput(replayInput);

    if (!replay.valid && replay.reason === 'wrong-kind') {
      fail(`Casebook Shelf replay uses unsupported kind: ${replay.parsed?.kind ?? 'unknown'}.`);
    }

    if (!replay.valid && replay.reason === 'unsupported-version') {
      fail(`Casebook Shelf replay uses unsupported version ${replay.parsed?.version ?? 'unknown'}. Supported version: ${replay.supportedVersion}.`);
    }

    if (!replay.valid) {
      fail('Casebook Shelf replay requires saved Stack Sleuth Casebook Shelf JSON.');
    }

    writeOutput(replay.shelf, mode, renderShelfTextSummary, renderShelfMarkdownSummary);
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

    if (bundlePath) {
      writeBundleOutput(bundlePath, { report, sourceMode: 'portfolio', sourceLabel: portfolioPath === '-' ? 'stdin' : portfolioPath });
    } else {
      writeOutput(report, mode, renderIncidentPortfolioTextSummary, renderIncidentPortfolioMarkdownSummary, renderPortfolioCliHtmlSummary);
    }
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

    writeOutput(briefing, mode, renderIncidentPackTextSummary, renderIncidentPackMarkdownSummary, renderPackCliHtmlSummary);
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

  if (bundleChroniclePath) {
    const chronicleInput = bundleChroniclePath === '-' ? fs.readFileSync(0, 'utf8') : readNamedInput(bundleChroniclePath, 'response bundle chronicle');
    const chronicleInspection = inspectResponseBundleChronicleInput(chronicleInput);

    if (!chronicleInspection.valid) {
      fail(describeResponseBundleChronicleInputError(chronicleInspection));
    }

    const chronicle = analyzeResponseBundleChronicle(chronicleInspection);
    writeOutput(chronicle, mode, renderResponseBundleChronicleTextSummary, renderResponseBundleChronicleMarkdownSummary);
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

  if (capsulePath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read capsule input: ${error.message}`);
  }

  if (portfolioPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read portfolio input: ${error.message}`);
  }

  if (boardPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read Action Board input: ${error.message}`);
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

  if (replayBundlePath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read response bundle replay input: ${error.message}`);
  }

  if (shelfPath) {
    fail(error.message.startsWith('Could not read') ? error.message : error.message);
  }

  if (replayShelfPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read shelf replay input: ${error.message}`);
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

function validateOutputArguments(list) {
  const outputFlags = ['--json', '--markdown', '--html'].filter((flag) => list.includes(flag));
  return outputFlags.length > 1
    ? 'Choose one output mode at a time: --json, --markdown, or --html.'
    : null;
}

function validateBundleWorkflowSupport({ mode, bundlePath, packPath, portfolioPath, notebookPath, workspacePath, capsulePath }) {
  if (!bundlePath) {
    return null;
  }

  if (mode !== 'text') {
    return 'Bundle output cannot be combined with --json, --markdown, or --html.';
  }

  return portfolioPath || notebookPath || workspacePath || capsulePath
    ? null
    : 'Bundle output is currently supported only for portfolio-shaped workflows: --portfolio, --notebook, --workspace, and --capsule when they normalize into a portfolio.';
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

function validateWorkflowArguments({ baselinePath, candidatePath, packPath, portfolioPath, boardPath, forgePath, handoffPath, notebookPath, mergeCasebookPath, timelinePath, chroniclePath, bundleChroniclePath, datasetPath, replayDatasetPath, replayBundlePath, bundleShelfPath, replayBundleShelfPath, shelfPath, replayShelfPath, historyPath, workspacePath, capsulePath }) {
  const activeModes = [
    historyPath ? 'casebook' : null,
    capsulePath ? 'capsule' : null,
    portfolioPath ? 'portfolio' : null,
    boardPath ? 'board' : null,
    forgePath ? 'forge' : null,
    handoffPath ? 'handoff' : null,
    notebookPath ? 'notebook' : null,
    workspacePath ? 'workspace' : null,
    mergeCasebookPath ? 'merge-casebook' : null,
    packPath ? 'incident-pack' : null,
    timelinePath ? 'timeline' : null,
    chroniclePath ? 'chronicle' : null,
    bundleChroniclePath ? 'bundle-chronicle' : null,
    datasetPath ? 'dataset' : null,
    replayDatasetPath ? 'replay-dataset' : null,
    replayBundlePath ? 'replay-bundle' : null,
    bundleShelfPath ? 'bundle-shelf' : null,
    replayBundleShelfPath ? 'replay-bundle-shelf' : null,
    shelfPath ? 'shelf' : null,
    replayShelfPath ? 'replay-shelf' : null,
    baselinePath || candidatePath ? 'compare' : null,
  ].filter(Boolean);

  if (activeModes.length > 1) {
    return 'Choose one workflow mode at a time: capsule, forge, handoff, merge-casebook, portfolio, board, notebook, workspace, incident-pack, casebook, timeline, chronicle, dataset, replay-dataset, replay-bundle, bundle-shelf, replay-bundle-shelf, shelf, replay-shelf, or compare.';
  }

  return null;
}

function validateHtmlWorkflowSupport({ mode, packPath, portfolioPath, notebookPath, workspacePath, capsulePath }) {
  if (mode !== 'html') {
    return null;
  }

  return packPath || portfolioPath || notebookPath || workspacePath || capsulePath
    ? null
    : 'HTML output is currently supported only for --pack, --portfolio, --notebook, --workspace, and --capsule workflows.';
}

function readNamedInput(targetPath, label) {
  try {
    return fs.readFileSync(targetPath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read ${label} trace file: ${error.message}`);
  }
}

function readBoardInput(targetPath) {
  if (targetPath === '-') {
    return fs.readFileSync(0, 'utf8');
  }

  let stats;
  try {
    stats = fs.statSync(targetPath);
  } catch (error) {
    throw new Error(`Could not read action board input: ${error.message}`);
  }

  if (stats.isDirectory()) {
    try {
      return readReplayBundleDirectory(targetPath);
    } catch (error) {
      throw new Error(`Could not read action board input: ${error.message}`);
    }
  }

  try {
    return fs.readFileSync(targetPath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read action board input: ${error.message}`);
  }
}

function readNotebookInput(targetPath) {
  try {
    return fs.readFileSync(targetPath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read notebook input file: ${error.message}`);
  }
}

function readReplayBundleInput(targetPath) {
  if (targetPath === '-') {
    return fs.readFileSync(0, 'utf8');
  }

  let stats;
  try {
    stats = fs.statSync(targetPath);
  } catch (error) {
    throw new Error(`Could not read response bundle replay input: ${error.message}`);
  }

  if (stats.isDirectory()) {
    return readReplayBundleDirectory(targetPath);
  }

  try {
    return fs.readFileSync(targetPath, 'utf8');
  } catch (error) {
    throw new Error(`Could not read response bundle replay input: ${error.message}`);
  }
}

function readReplayBundleDirectory(targetPath) {
  let entries;
  try {
    entries = fs.readdirSync(targetPath, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Could not read response bundle replay input: ${error.message}`);
  }

  const files = {};
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const filePath = `${targetPath}/${entry.name}`;
    files[entry.name] = fs.readFileSync(filePath, 'utf8');
  }

  if (typeof files['response-bundle.json'] === 'string') {
    return files['response-bundle.json'];
  }

  if (typeof files['manifest.json'] !== 'string') {
    throw new Error('Could not read response bundle replay input: saved bundle directory requires manifest.json.');
  }

  let manifest;
  try {
    manifest = JSON.parse(files['manifest.json']);
  } catch {
    return files['manifest.json'];
  }

  return {
    kind: manifest.kind,
    version: manifest.version,
    manifest,
    files,
  };
}

function readShelfDirectoryEntries(targetPath) {
  let stats;
  try {
    stats = fs.statSync(targetPath);
  } catch (error) {
    throw new Error(`Could not read shelf input directory: ${error.message}`);
  }

  if (!stats.isDirectory()) {
    throw new Error('Casebook Shelf requires a directory of top-level .json files.');
  }

  let entries;
  try {
    entries = fs.readdirSync(targetPath, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Could not read shelf input directory: ${error.message}`);
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
      label: entry.name.replace(/\.json$/i, ''),
      sourceName: entry.name,
      source: fs.readFileSync(`${targetPath}/${entry.name}`, 'utf8'),
    }));
}

function readBundleShelfDirectoryEntries(targetPath) {
  let stats;
  try {
    stats = fs.statSync(targetPath);
  } catch (error) {
    throw new Error(`Could not read response bundle shelf input directory: ${error.message}`);
  }

  if (!stats.isDirectory()) {
    throw new Error('Response Bundle Shelf requires a directory of top-level bundle entries.');
  }

  let entries;
  try {
    entries = fs.readdirSync(targetPath, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Could not read response bundle shelf input directory: ${error.message}`);
  }

  return entries
    .filter((entry) => isBundleShelfCandidate(entry, targetPath))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const candidatePath = `${targetPath}/${entry.name}`;
      const label = entry.isDirectory()
        ? entry.name
        : entry.name.replace(/\.json$/i, '').replace(/\/response-bundle$/i, '');

      return {
        label,
        sourceName: entry.name,
        source: entry.isDirectory() ? readReplayBundleDirectory(candidatePath) : fs.readFileSync(candidatePath, 'utf8'),
      };
    });
}

function isBundleShelfCandidate(entry, targetPath) {
  if (entry.isFile()) {
    return entry.name.toLowerCase().endsWith('.json');
  }

  if (!entry.isDirectory()) {
    return false;
  }

  try {
    const names = fs.readdirSync(`${targetPath}/${entry.name}`);
    return names.includes('response-bundle.json') || names.includes('manifest.json');
  } catch {
    return false;
  }
}

function writeOutput(payload, outputMode, textRenderer, markdownRenderer, htmlRenderer = null) {
  if (outputMode === 'json') {
    process.stdout.write(`${JSON.stringify(toSerializablePayload(payload), null, 2)}\n`);
  } else if (outputMode === 'html') {
    if (!htmlRenderer) {
      fail('HTML output is currently supported only for --pack, --portfolio, --notebook, --workspace, and --capsule workflows.');
    }
    process.stdout.write(`${htmlRenderer(payload)}\n`);
  } else if (outputMode === 'markdown') {
    process.stdout.write(`${markdownRenderer(payload)}\n`);
  } else {
    process.stdout.write(`${textRenderer(payload)}\n`);
  }
}

function writeBundleOutput(targetDir, { report, sourceMode, sourceLabel = null } = {}) {
  const bundle = buildResponseBundle({ report, sourceMode, sourceLabel });
  fs.mkdirSync(targetDir, { recursive: true });

  for (const [relativePath, content] of Object.entries(bundle.files)) {
    fs.writeFileSync(`${targetDir}/${relativePath}`, content, 'utf8');
  }
}

function toSerializablePayload(payload) {
  if (payload?.capsule && payload?.routed?.report) {
    const routedPayload = toSerializablePayload(payload.routed.report);
    return {
      capsule: serializeCapsule(payload.capsule),
      routed: {
        mode: payload.routed.mode,
        summary: routedPayload.summary ?? null,
      },
      ...routedPayload,
    };
  }

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
      gate: payload.gate ?? null,
      portfolio: {
        packOrder: payload.portfolio?.packOrder ?? [],
      },
      responseQueue: payload.responseQueue ?? [],
      routingGaps: payload.routingGaps ?? [],
      runbookGaps: payload.runbookGaps ?? [],
      recurringIncidents: payload.recurringIncidents ?? [],
      recurringHotspots: payload.recurringHotspots ?? [],
      cases: (payload.cases ?? []).map((entry) => ({
        label: entry.label,
        signature: entry.signature,
        sourcePacks: entry.sourcePacks,
        metadata: entry.metadata,
        conflicts: entry.conflicts,
      })),
      steward: payload.steward ?? null,
      board: payload.board ? toSerializablePayload(payload.board) : null,
      exportText: payload.exportText,
    };
  }

  if (payload?.kind === 'stack-sleuth-casebook-shelf' && typeof payload?.version === 'number') {
    return {
      kind: payload.kind,
      version: payload.version,
      summary: payload.summary,
      snapshots: (payload.snapshots ?? []).map((snapshot) => snapshot.status === 'valid'
        ? {
          label: snapshot.label,
          sourceName: snapshot.sourceName,
          status: snapshot.status,
          dataset: toSerializablePayload(snapshot.dataset),
        }
        : {
          label: snapshot.label,
          sourceName: snapshot.sourceName,
          status: snapshot.status,
          reason: snapshot.reason,
        }),
      invalidSnapshots: payload.invalidSnapshots ?? [],
      chronicle: payload.chronicle ? toSerializablePayload(payload.chronicle) : null,
    };
  }

  if (payload?.kind === 'stack-sleuth-response-bundle-shelf' && typeof payload?.version === 'number') {
    return {
      kind: payload.kind,
      version: payload.version,
      summary: payload.summary,
      snapshots: (payload.snapshots ?? []).map((snapshot) => snapshot.status === 'valid'
        ? {
          label: snapshot.label,
          sourceName: snapshot.sourceName,
          status: snapshot.status,
          bundle: snapshot.bundle ? {
            kind: snapshot.bundle.kind,
            version: snapshot.bundle.version,
            sourceVersion: snapshot.bundle.sourceVersion,
            summary: snapshot.bundle.summary,
            manifest: snapshot.bundle.manifest,
            artifacts: snapshot.bundle.artifacts,
            dataset: snapshot.bundle.dataset ? toSerializablePayload(snapshot.bundle.dataset) : null,
          } : null,
        }
        : {
          label: snapshot.label,
          sourceName: snapshot.sourceName,
          status: snapshot.status,
          reason: snapshot.reason,
        }),
      chronicle: payload.chronicle ? toSerializablePayload(payload.chronicle) : null,
    };
  }

  if (Array.isArray(payload?.snapshots) && Array.isArray(payload?.inventoryTrends) && payload?.summary?.latestSourceMode !== undefined) {
    return {
      snapshots: payload.snapshots.map((snapshot) => ({
        label: snapshot.label,
        bundle: snapshot.bundle ? {
          kind: snapshot.bundle.kind,
          version: snapshot.bundle.version,
          sourceVersion: snapshot.bundle.sourceVersion,
          summary: snapshot.bundle.summary,
          manifest: {
            source: snapshot.bundle.manifest?.source ?? null,
            summary: snapshot.bundle.manifest?.summary ?? null,
            files: snapshot.bundle.manifest?.files ?? [],
          },
          dataset: snapshot.bundle.dataset ? toSerializablePayload(snapshot.bundle.dataset) : null,
        } : null,
      })),
      labels: payload.labels ?? [],
      ownerTrends: payload.ownerTrends ?? [],
      hotspotTrends: payload.hotspotTrends ?? [],
      caseTrends: payload.caseTrends ?? [],
      inventoryTrends: payload.inventoryTrends ?? [],
      stewardLedger: payload.stewardLedger ?? null,
      summary: payload.summary,
    };
  }

  if (Array.isArray(payload?.snapshots) && Array.isArray(payload?.ownerTrends) && payload?.summary?.latestGateVerdict !== undefined) {
    return {
      snapshots: payload.snapshots.map((snapshot) => ({
        label: snapshot.label,
        dataset: snapshot.dataset ? toSerializablePayload(snapshot.dataset) : null,
      })),
      labels: payload.labels ?? [],
      ownerTrends: payload.ownerTrends ?? [],
      hotspotTrends: payload.hotspotTrends ?? [],
      caseTrends: payload.caseTrends ?? [],
      stewardLedger: payload.stewardLedger ?? null,
      summary: payload.summary,
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
      gate: payload.gate ?? null,
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

function serializeCapsule(capsule) {
  return {
    kind: capsule?.kind ?? 'unsupported',
    recognizedFiles: capsule?.recognizedFiles ?? [],
    packOrder: capsule?.packOrder ?? [],
    packs: Array.isArray(capsule?.packs)
      ? capsule.packs.map((pack) => ({
        label: pack.label,
        recognizedFiles: pack.recognizedFiles ?? [],
      }))
      : [],
    omittedPacks: capsule?.omittedPacks ?? [],
    warnings: capsule?.warnings ?? [],
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

function renderCapsuleCliTextSummary(payload) {
  return payload.routed.mode === 'portfolio'
    ? renderIncidentPortfolioTextSummary(payload.routed.report)
    : renderIncidentPackTextSummary(payload.routed.report);
}

function renderCapsuleCliMarkdownSummary(payload) {
  return payload.routed.mode === 'portfolio'
    ? renderIncidentPortfolioMarkdownSummary(payload.routed.report)
    : renderIncidentPackMarkdownSummary(payload.routed.report);
}

function renderPackCliHtmlSummary(report) {
  return renderIncidentDossierHtml({ mode: 'pack', report, originLabel: 'Incident Pack Briefing' });
}

function renderPortfolioCliHtmlSummary(report) {
  return renderIncidentDossierHtml({ mode: 'portfolio', report, originLabel: 'Portfolio Radar' });
}

function renderNotebookCliHtmlSummary(payload) {
  return renderIncidentDossierHtml({
    mode: payload.routed.mode,
    report: payload.routed.report,
    originLabel: payload.routed.mode === 'portfolio'
      ? 'Notebook normalization · Portfolio Radar'
      : 'Notebook normalization · Incident Pack',
  });
}

function renderWorkspaceCliHtmlSummary(payload) {
  return renderIncidentDossierHtml({
    mode: payload.routed.mode,
    report: payload.routed.report,
    originLabel: payload.routed.mode === 'portfolio'
      ? 'Workspace · Portfolio Radar'
      : 'Workspace · Incident Pack',
  });
}

function renderCapsuleCliHtmlSummary(payload) {
  return renderIncidentDossierHtml({
    mode: payload.routed.mode,
    report: payload.routed.report,
    originLabel: payload.routed.mode === 'portfolio'
      ? 'Capsule · Portfolio Radar'
      : 'Capsule · Incident Pack',
  });
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
