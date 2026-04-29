const CULPRIT_WEIGHT = 3;
const SUPPORT_WEIGHT = 1;

const STATUS_PRIORITY = {
  'volume-up': 0,
  new: 1,
  'volume-down': 2,
  resolved: 3,
};

export function buildHotspots(reports) {
  const entries = new Map();

  for (const report of reports ?? []) {
    addFrame(entries, report?.culpritFrame, 'culprit');
    for (const frame of report?.supportFrames ?? []) {
      addFrame(entries, frame, 'support');
    }
  }

  const hotspots = [...entries.values()].map((entry) => ({
    path: entry.path,
    culpritCount: entry.culpritCount,
    supportCount: entry.supportCount,
    score: (entry.culpritCount * CULPRIT_WEIGHT) + (entry.supportCount * SUPPORT_WEIGHT),
  }));

  const labelsByPath = buildUniqueLabels(hotspots.map((hotspot) => hotspot.path));

  return hotspots
    .map((hotspot) => ({
      ...hotspot,
      label: labelsByPath.get(hotspot.path) ?? hotspot.path,
    }))
    .sort(compareHotspots);
}

export function buildHotspotShifts({ baseline, candidate }) {
  const baselineByPath = new Map((baseline ?? []).map((hotspot) => [hotspot.path, hotspot]));
  const candidateByPath = new Map((candidate ?? []).map((hotspot) => [hotspot.path, hotspot]));

  return [...new Set([...baselineByPath.keys(), ...candidateByPath.keys()])]
    .map((path) => {
      const baselineHotspot = baselineByPath.get(path);
      const candidateHotspot = candidateByPath.get(path);
      const baselineScore = baselineHotspot?.score ?? 0;
      const candidateScore = candidateHotspot?.score ?? 0;
      const delta = candidateScore - baselineScore;

      if (delta === 0) {
        return null;
      }

      return {
        path,
        label: candidateHotspot?.label ?? baselineHotspot?.label ?? path,
        baselineScore,
        candidateScore,
        delta,
        status: classifyShift(baselineScore, candidateScore),
      };
    })
    .filter(Boolean)
    .sort(compareHotspotShifts);
}

function addFrame(entries, frame, role) {
  const path = normalizeFramePath(frame);
  if (!path) {
    return;
  }

  const existing = entries.get(path) ?? {
    path,
    culpritCount: 0,
    supportCount: 0,
  };

  if (role === 'culprit') {
    existing.culpritCount += 1;
  } else {
    existing.supportCount += 1;
  }

  entries.set(path, existing);
}

function normalizeFramePath(frame) {
  if (!frame?.file || frame.internal) {
    return null;
  }

  return String(frame.file)
    .replace(/^[A-Za-z]:/i, '')
    .replace(/^file:\/\//, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

function buildUniqueLabels(paths) {
  const segmentsByPath = new Map(paths.map((path) => [path, path.split('/').filter(Boolean)]));
  const widthsByPath = new Map(paths.map((path) => [path, 1]));

  let changed = true;
  while (changed) {
    changed = false;
    const seen = new Map();

    for (const path of paths) {
      const width = widthsByPath.get(path) ?? 1;
      const label = buildLabel(segmentsByPath.get(path) ?? [], width);
      const collisions = seen.get(label) ?? [];
      collisions.push(path);
      seen.set(label, collisions);
    }

    for (const collisions of seen.values()) {
      if (collisions.length < 2) {
        continue;
      }

      for (const path of collisions) {
        const segments = segmentsByPath.get(path) ?? [];
        const currentWidth = widthsByPath.get(path) ?? 1;
        if (currentWidth < segments.length) {
          widthsByPath.set(path, currentWidth + 1);
          changed = true;
        }
      }
    }
  }

  return new Map(paths.map((path) => {
    const width = widthsByPath.get(path) ?? 1;
    return [path, buildLabel(segmentsByPath.get(path) ?? [], width)];
  }));
}

function buildLabel(segments, width) {
  if (!segments.length) {
    return 'unknown-path';
  }

  return segments.slice(-Math.max(1, width)).join('/');
}

function compareHotspots(left, right) {
  return right.score - left.score
    || right.culpritCount - left.culpritCount
    || right.supportCount - left.supportCount
    || left.path.localeCompare(right.path);
}

function classifyShift(baselineScore, candidateScore) {
  if (baselineScore === 0 && candidateScore > 0) {
    return 'new';
  }

  if (baselineScore > 0 && candidateScore === 0) {
    return 'resolved';
  }

  return candidateScore > baselineScore ? 'volume-up' : 'volume-down';
}

function compareHotspotShifts(left, right) {
  return Math.abs(right.delta) - Math.abs(left.delta)
    || (STATUS_PRIORITY[left.status] ?? Number.MAX_SAFE_INTEGER) - (STATUS_PRIORITY[right.status] ?? Number.MAX_SAFE_INTEGER)
    || right.candidateScore - left.candidateScore
    || right.baselineScore - left.baselineScore
    || left.path.localeCompare(right.path);
}
