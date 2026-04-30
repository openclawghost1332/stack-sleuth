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
  renderCasebookTextSummary,
  renderCasebookMarkdownSummary,
} from '../src/casebook.js';
import {
  analyzeTimeline,
  renderTimelineTextSummary,
  renderTimelineMarkdownSummary,
} from '../src/timeline.js';
import {
  analyzeIncidentPortfolio,
  parseIncidentPortfolio,
  renderIncidentPortfolioTextSummary,
  renderIncidentPortfolioMarkdownSummary,
} from '../src/portfolio.js';
import {
  analyzeCasebookForge,
  renderCasebookForgeTextSummary,
  renderCasebookForgeMarkdownSummary,
} from '../src/forge.js';
import { extractTraceSet, formatExtractionMarkdown, formatExtractionText } from '../src/extract.js';
import { parseLabeledTraceBatches } from '../src/labeled.js';
import { parseIncidentPack } from '../src/pack.js';

const args = process.argv.slice(2);
const mode = args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'text';
const wantsDigest = args.includes('--digest');
const compareArgumentError = validateCompareArguments(args);
const packArgumentError = validateOptionValue(args, '--pack');
const portfolioArgumentError = validateOptionValue(args, '--portfolio');
const forgeArgumentError = validateOptionValue(args, '--forge');
const timelineArgumentError = validateOptionValue(args, '--timeline');
const historyArgumentError = validateOptionValue(args, '--history');
const currentArgumentError = validateOptionValue(args, '--current');
const baselinePath = readOptionValue(args, '--baseline');
const candidatePath = readOptionValue(args, '--candidate');
const packPath = readOptionValue(args, '--pack');
const portfolioPath = readOptionValue(args, '--portfolio');
const forgePath = readOptionValue(args, '--forge');
const timelinePath = readOptionValue(args, '--timeline');
const historyPath = readOptionValue(args, '--history');
const currentPath = readOptionValue(args, '--current');
const workflowArgumentError = validateWorkflowArguments({ baselinePath, candidatePath, packPath, portfolioPath, forgePath, timelinePath, historyPath });
const filePath = args.find((arg, index) => {
  if (arg.startsWith('--')) {
    return false;
  }

  const previous = args[index - 1] ?? '';
  return !['--baseline', '--candidate', '--pack', '--portfolio', '--forge', '--timeline', '--history', '--current'].includes(previous);
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

if (timelineArgumentError) {
  fail(timelineArgumentError);
}

if (historyArgumentError) {
  fail(historyArgumentError);
}

if (currentArgumentError) {
  fail(currentArgumentError);
}

if (currentPath && !historyPath) {
  fail('Casebook Radar requires --history when using --current.');
}

if (workflowArgumentError) {
  fail(workflowArgumentError);
}

try {
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

    const historyBatches = parseLabeledTraceBatches(historyInput);
    if (!historyBatches.length) {
      fail('Casebook Radar requires labeled historical cases like === release-2026-04-15 ===.');
    }

    const casebook = analyzeCasebook({ current: currentInput, history: historyBatches });
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
  if (portfolioPath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read portfolio input: ${error.message}`);
  }

  if (forgePath) {
    fail(error.message.startsWith('Could not read') ? error.message : `Could not read forge input: ${error.message}`);
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

function validateWorkflowArguments({ baselinePath, candidatePath, packPath, portfolioPath, forgePath, timelinePath, historyPath }) {
  const activeModes = [
    historyPath ? 'casebook' : null,
    portfolioPath ? 'portfolio' : null,
    forgePath ? 'forge' : null,
    packPath ? 'incident-pack' : null,
    timelinePath ? 'timeline' : null,
    baselinePath || candidatePath ? 'compare' : null,
  ].filter(Boolean);

  if (activeModes.length > 1) {
    return 'Choose one workflow mode at a time: forge, portfolio, incident-pack, casebook, timeline, or compare.';
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

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
