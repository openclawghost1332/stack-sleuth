import { analyzeCasebook } from './casebook.js';
import { analyzeTraceDigest } from './digest.js';
import { parseLabeledTraceBatches } from './labeled.js';
import { parseIncidentPack } from './pack.js';
import { analyzeRegression } from './regression.js';
import { analyzeTimeline, parseTimelineSnapshots } from './timeline.js';

export function analyzeIncidentPack(input) {
  const pack = input?.sections ? input : parseIncidentPack(input);
  const omissions = [];
  const availableAnalyses = [];

  const currentText = pack.sections.current?.trim() ?? '';
  const historyText = pack.sections.history?.trim() ?? '';
  const baselineText = pack.sections.baseline?.trim() ?? '';
  const candidateText = pack.sections.candidate?.trim() ?? '';
  const timelineText = pack.sections.timeline?.trim() ?? '';

  let currentDigest = null;
  if (currentText) {
    const digest = analyzeTraceDigest(currentText);
    if (digest.totalTraces > 0) {
      currentDigest = digest;
      availableAnalyses.push('current');
    } else {
      omissions.push('Current section did not contain any usable traces.');
    }
  }

  let casebook = null;
  if (historyText && !currentText) {
    omissions.push('History section needs a current section before Casebook Radar can run.');
  } else if (historyText && currentText) {
    const historyBatches = parseLabeledTraceBatches(historyText);
    if (!historyBatches.length) {
      omissions.push('History section needs labeled cases like === release-2026-04-15 === before Casebook Radar can run.');
    } else {
      const report = analyzeCasebook({ current: currentText, history: historyBatches });
      if (report.summary.currentTraceCount === 0) {
        omissions.push('Casebook Radar could not excavate any current traces from the current section.');
      } else if (report.summary.historicalCaseCount === 0) {
        omissions.push('History section contained no usable traces for Casebook Radar.');
      } else {
        casebook = report;
        availableAnalyses.push('casebook');
      }
    }
  }

  let regression = null;
  if ((baselineText && !candidateText) || (!baselineText && candidateText)) {
    omissions.push('Regression Radar needs both baseline and candidate sections before it can run.');
  } else if (baselineText && candidateText) {
    const report = analyzeRegression({ baseline: baselineText, candidate: candidateText });
    if (report.baselineDigest.totalTraces === 0 || report.candidateDigest.totalTraces === 0) {
      omissions.push('Regression Radar could not excavate usable traces from one side of the baseline/candidate comparison.');
    } else {
      regression = report;
      availableAnalyses.push('regression');
    }
  }

  let timeline = null;
  if (timelineText) {
    const snapshots = parseTimelineSnapshots(timelineText);
    if (snapshots.length < 2) {
      omissions.push('Timeline section needs at least two labeled snapshots before Timeline Radar can run.');
    } else {
      const report = analyzeTimeline(snapshots);
      if (report.summary.snapshotCount < 2) {
        omissions.push('Timeline section needs at least two labeled snapshots before Timeline Radar can run.');
      } else {
        timeline = report;
        availableAnalyses.push('timeline');
      }
    }
  }

  const summary = summarizeIncidentPack({
    pack,
    currentDigest,
    casebook,
    regression,
    timeline,
    availableAnalyses,
    omissions,
  });

  return {
    pack,
    currentDigest,
    casebook,
    regression,
    timeline,
    availableAnalyses,
    omissions,
    summary,
  };
}

export function renderIncidentPackTextSummary(report) {
  const lines = [
    'Stack Sleuth Incident Pack Briefing',
    `Sections present: ${formatList(report.summary.sectionsPresent)}`,
    `Available analyses: ${formatList(report.availableAnalyses)}`,
    `Primary headline: ${report.summary.headline}`,
    '',
    'Key findings',
    ...report.summary.topFindings.map((finding) => `- ${finding}`),
    '',
    'Checklist',
    ...report.summary.checklist.map((item) => `- ${item}`),
  ];

  if (report.omissions.length) {
    lines.push('', 'Omissions', ...report.omissions.map((item) => `- ${item}`));
  }

  return lines.join('\n').trim();
}

export function renderIncidentPackMarkdownSummary(report) {
  const lines = [
    '# Stack Sleuth Incident Pack Briefing',
    '',
    `- **Sections present:** ${escapeMarkdownText(formatList(report.summary.sectionsPresent))}`,
    `- **Available analyses:** ${escapeMarkdownText(formatList(report.availableAnalyses))}`,
    `- **Primary headline:** ${escapeMarkdownText(report.summary.headline)}`,
    '',
    '## Key findings',
    ...report.summary.topFindings.map((finding) => `- ${escapeMarkdownText(finding)}`),
    '',
    '## Checklist',
    ...report.summary.checklist.map((item) => `- ${escapeMarkdownText(item)}`),
  ];

  if (report.omissions.length) {
    lines.push('', '## Omissions', ...report.omissions.map((item) => `- ${escapeMarkdownText(item)}`));
  }

  return lines.join('\n').trim();
}

function summarizeIncidentPack({ pack, currentDigest, casebook, regression, timeline, availableAnalyses, omissions }) {
  const sectionsPresent = [...pack.sectionOrder];
  const headline = buildHeadline({ currentDigest, casebook, regression, timeline });
  const topFindings = buildTopFindings({ currentDigest, casebook, regression, timeline });
  const checklist = buildChecklist({ currentDigest, casebook, regression, timeline, omissions });

  return {
    sectionsPresent,
    headline,
    topFindings,
    checklist,
    counts: {
      analyses: availableAnalyses.length,
      omissions: omissions.length,
      currentGroups: currentDigest?.groupCount ?? 0,
      currentTraces: currentDigest?.totalTraces ?? 0,
      knownIncidents: casebook?.summary.knownCount ?? 0,
      novelIncidents: casebook?.summary.novelCount ?? 0,
      regressionNew: regression?.summary.newCount ?? 0,
      regressionVolumeUp: regression?.summary.volumeUpCount ?? 0,
      timelineNew: timeline?.summary.newCount ?? 0,
      timelineRising: timeline?.summary.risingCount ?? 0,
    },
  };
}

function buildHeadline({ currentDigest, casebook, regression, timeline }) {
  if ((casebook?.summary.novelCount ?? 0) > 0) {
    return `Casebook Radar flagged ${formatCount(casebook.summary.novelCount, 'novel incident')} in the current batch.`;
  }

  if ((regression?.summary.newCount ?? 0) > 0 || (regression?.summary.volumeUpCount ?? 0) > 0) {
    return `Regression Radar found ${formatCount(regression.summary.newCount, 'new incident')} and ${formatCount(regression.summary.volumeUpCount, 'volume-up incident')} in the candidate batch.`;
  }

  if ((timeline?.summary.newCount ?? 0) > 0 || (timeline?.summary.risingCount ?? 0) > 0) {
    return `Timeline Radar found ${formatCount(timeline.summary.newCount, 'new incident')} and ${formatCount(timeline.summary.risingCount, 'rising incident')} across ${formatCount(timeline.summary.snapshotCount, 'snapshot')}.`;
  }

  if (currentDigest) {
    return `Current digest found ${formatCount(currentDigest.groupCount, 'incident group')} across ${formatCount(currentDigest.totalTraces, 'trace')}.`;
  }

  return 'No runnable analyses were found in this incident pack.';
}

function buildTopFindings({ currentDigest, casebook, regression, timeline }) {
  const findings = [];

  if (casebook) {
    findings.push(
      `Casebook Radar matched ${formatCount(casebook.summary.knownCount, 'known incident')} and flagged ${formatCount(casebook.summary.novelCount, 'novel incident')}${casebook.summary.topCaseLabel ? `, with ${casebook.summary.topCaseLabel} as the closest prior case` : ''}.`,
    );
  }

  if (regression) {
    findings.push(
      `Regression Radar found ${formatCount(regression.summary.newCount, 'new incident')}, ${formatCount(regression.summary.volumeUpCount, 'volume-up incident')}, and ${formatCount(regression.summary.resolvedCount, 'resolved incident')} between baseline and candidate batches.`,
    );
  }

  if (timeline) {
    findings.push(
      `Timeline Radar found ${formatCount(timeline.summary.newCount, 'new incident')}, ${formatCount(timeline.summary.risingCount, 'rising incident')}, and ${formatCount(timeline.summary.resolvedCount, 'resolved incident')} across ${formatCount(timeline.summary.snapshotCount, 'snapshot')}.`,
    );
  }

  if (currentDigest) {
    const topHotspot = currentDigest.hotspots[0]?.label ? ` Top hotspot: ${currentDigest.hotspots[0].label}.` : '';
    findings.push(
      `Current digest found ${formatCount(currentDigest.groupCount, 'incident group')} across ${formatCount(currentDigest.totalTraces, 'trace')}.${topHotspot}`,
    );
  }

  return findings.length ? findings : ['No supported incident-pack analyses ran.'];
}

function buildChecklist({ currentDigest, casebook, regression, timeline, omissions }) {
  const checklist = [];

  if ((casebook?.summary.novelCount ?? 0) > 0) {
    checklist.push('Inspect novel incidents first so brand-new breakages do not hide behind known repeats.');
  }

  if ((casebook?.summary.knownCount ?? 0) > 0) {
    checklist.push('Compare known incident matches against the closest prior case to reuse the last fix or mitigation faster.');
  }

  if ((regression?.summary.newCount ?? 0) > 0) {
    checklist.push('Inspect candidate-only failures before widening the release or rollback window.');
  }

  if ((regression?.summary.volumeUpCount ?? 0) > 0) {
    checklist.push('Check payload shape, traffic segmentation, or rollout flags for incidents that spiked in the candidate batch.');
  }

  if ((timeline?.summary.newCount ?? 0) > 0) {
    checklist.push('Pause on the latest rollout snapshot until brand-new timeline incidents are understood.');
  }

  if ((timeline?.summary.risingCount ?? 0) > 0) {
    checklist.push('Compare early and late rollout snapshots for incidents that climbed with each step.');
  }

  if (!checklist.length && currentDigest) {
    checklist.push('Start with the top current incident group and confirm the culprit path against the strongest hotspot.');
  }

  if (!checklist.length && omissions.length) {
    checklist.push('Fill the missing pack sections called out in omissions, then rerun the incident pack briefing.');
  }

  return checklist.length ? [...new Set(checklist)].slice(0, 5) : ['Add at least one supported section with usable traces, then rerun the incident pack briefing.'];
}

function formatCount(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function formatList(items) {
  return items?.length ? items.join(', ') : 'none';
}

function escapeMarkdownText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, '&#96;');
}
