// Activity analysis over a participant's Hackatime heartbeats — produces a
// timeline, breakdowns by editor/category, and a `filterable` index so the
// client can recompute active minutes when an activity type is excluded.

export type Heartbeat = {
  time: number;
  entity: string;
  type: string;
  project?: string;
  branch?: string;
  language?: string;
  editor?: string;
  operating_system?: string;
  user_agent?: string;
  category?: string;
  is_write?: boolean;
  lineno?: number;
  cursorpos?: number;
  lines?: number;
  line_additions?: number;
  line_deletions?: number;
};

export type Severity = 'none' | 'low' | 'high';

export type Analysis = {
  summary: {
    count: number;
    spanSeconds: number;
    activeMinutes: number;
    firstAt: number;
    lastAt: number;
    coveredDays: number;
    aiPercent: number;
    aiCount: number;
    pasteLikeCount: number;
  };
  editorBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  userAgents: Array<{ ua: string; count: number }>;
  anomalies: {
    autoClicker: { severity: Severity; evidence: string };
    macroTyper: { severity: Severity; evidence: string };
    offRepo: { count: number; sampleEntities: string[] };
  };
  // [times, lineNumbers, cursorPositions] for plotting.
  points: [number[], (number | null)[], (number | null)[]];
  // per-heartbeat (time, editor index, category index) for client-side
  // exclusion-driven active-minute recomputation.
  filterable: {
    editorList: string[];
    categoryList: string[];
    times: number[];
    editorIdx: number[];
    categoryIdx: number[];
  };
};

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function basename(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function entityMatchesRepo(
  entity: string,
  repoBasenames: Set<string>,
  repoPaths: Set<string>,
): boolean {
  if (!entity) return false;
  if (repoBasenames.has(basename(entity))) return true;
  const norm = entity.replace(/\\/g, '/');
  for (const p of repoPaths) {
    if (norm.endsWith(p)) return true;
  }
  return false;
}

const AI_EDITOR_RE =
  /\b(cursor|windsurf|cline|continue|aider|copilot|trae|zed-ai|tabnine|codeium|cody|amazonq|amazon-q|claude|claude-code|claudecode|anthropic)\b/i;
const AI_CATEGORY_RE = /\bai\b|copilot|cursor|aider|codeium|cody|claude|anthropic/i;
const LARGE_ADDITIONS_THRESHOLD = 30;

export function analyzeActivity(
  hb: Heartbeat[],
  repoFilePaths: Set<string> = new Set(),
): Analysis {
  const sorted = [...hb].sort((a, b) => a.time - b.time);
  const count = sorted.length;
  const firstAt = count > 0 ? sorted[0].time : 0;
  const lastAt = count > 0 ? sorted[count - 1].time : 0;
  const spanSeconds = Math.max(0, lastAt - firstAt);

  const repoBasenames = new Set<string>();
  for (const p of repoFilePaths) repoBasenames.add(basename(p));

  // active minutes via 2-min idle gap
  const minuteBuckets = new Map<number, Heartbeat[]>();
  for (const h of sorted) {
    const m = Math.floor(h.time / 60);
    const arr = minuteBuckets.get(m) ?? [];
    arr.push(h);
    minuteBuckets.set(m, arr);
  }
  let activeMinutes = 0;
  let lastT = -Infinity;
  for (const h of sorted) {
    if (h.time - lastT > 120) {
      activeMinutes += 1;
    } else {
      const lastMinute = Math.floor(lastT / 60);
      const thisMinute = Math.floor(h.time / 60);
      if (thisMinute !== lastMinute) activeMinutes += 1;
    }
    lastT = h.time;
  }

  const coveredDayKeys = new Set<string>();
  for (const h of sorted) {
    const d = new Date(h.time * 1000);
    coveredDayKeys.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`);
  }

  const editorBreakdown: Record<string, number> = {};
  const categoryBreakdown: Record<string, number> = {};
  const uaCounts = new Map<string, number>();
  for (const h of sorted) {
    const ed = h.editor ?? 'unknown';
    editorBreakdown[ed] = (editorBreakdown[ed] ?? 0) + 1;
    const cat = h.category ?? 'unknown';
    categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + 1;
    const ua = h.user_agent ?? 'unknown';
    uaCounts.set(ua, (uaCounts.get(ua) ?? 0) + 1);
  }

  let aiCount = 0;
  let pasteLikeCount = 0;
  for (const h of sorted) {
    const ed = (h.editor ?? '').toLowerCase();
    const cat = (h.category ?? '').toLowerCase();
    const ua = (h.user_agent ?? '').toLowerCase();
    const additions = h.line_additions ?? 0;
    const editorIsAi = AI_EDITOR_RE.test(ed) || AI_EDITOR_RE.test(ua);
    const categoryIsAi = AI_CATEGORY_RE.test(cat);
    const looksLikePaste = additions >= LARGE_ADDITIONS_THRESHOLD;
    if (editorIsAi || categoryIsAi || looksLikePaste) {
      aiCount += 1;
      if (!editorIsAi && !categoryIsAi && looksLikePaste) pasteLikeCount += 1;
    }
  }
  const aiPercent = count > 0 ? Math.round((aiCount / count) * 100) : 0;
  const userAgents = [...uaCounts.entries()]
    .map(([ua, c]) => ({ ua, count: c }))
    .sort((a, b) => b.count - a.count);

  // autoClicker: near-flat cursorpos across consecutive minutes with writes
  let flatStreak = 0;
  let flatStreakWithWrites = false;
  let observedFlatWithWrites = 0;
  const sortedBucketKeys = [...minuteBuckets.keys()].sort((a, b) => a - b);
  for (let i = 0; i < sortedBucketKeys.length; i++) {
    const k = sortedBucketKeys[i];
    const bucket = minuteBuckets.get(k) ?? [];
    const cps = bucket
      .map((b) => b.cursorpos)
      .filter((v): v is number => typeof v === 'number');
    const sd = stddev(cps);
    const hasWrites = bucket.some((b) => b.is_write === true);
    const consecutive = i > 0 && sortedBucketKeys[i - 1] === k - 1;
    if (sd < 5 && cps.length >= 2) {
      flatStreak = consecutive ? flatStreak + 1 : 1;
      if (hasWrites) flatStreakWithWrites = true;
    } else {
      if (flatStreak >= 3 && flatStreakWithWrites) {
        observedFlatWithWrites = Math.max(observedFlatWithWrites, flatStreak);
      }
      flatStreak = 0;
      flatStreakWithWrites = false;
    }
  }
  if (flatStreak >= 3 && flatStreakWithWrites) {
    observedFlatWithWrites = Math.max(observedFlatWithWrites, flatStreak);
  }
  const autoClicker: Analysis['anomalies']['autoClicker'] =
    observedFlatWithWrites >= 5
      ? {
          severity: 'high',
          evidence: `${observedFlatWithWrites} minutes of near-flat cursor with active writes`,
        }
      : observedFlatWithWrites >= 3
        ? {
            severity: 'low',
            evidence: `${observedFlatWithWrites} minutes of near-flat cursor with active writes`,
          }
        : { severity: 'none', evidence: '' };

  // macroTyper: sliding window of 20 inter-heartbeat intervals, near-constant
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i].time - sorted[i - 1].time);
  }
  let macroTyper: Analysis['anomalies']['macroTyper'] = {
    severity: 'none',
    evidence: '',
  };
  if (intervals.length >= 20) {
    let flagged: { start: number; end: number; m: number; sd: number } | null =
      null;
    for (let i = 0; i + 20 <= intervals.length; i++) {
      const win = intervals.slice(i, i + 20);
      const m = mean(win);
      const sd = stddev(win);
      if (m < 10 && sd < 0.3) {
        if (!flagged || sd < flagged.sd) {
          flagged = { start: sorted[i].time, end: sorted[i + 20].time, m, sd };
        }
      }
    }
    if (flagged) {
      macroTyper = {
        severity: flagged.sd < 0.1 ? 'high' : 'low',
        evidence: `cluster ${new Date(flagged.start * 1000).toISOString()} → ${new Date(
          flagged.end * 1000,
        ).toISOString()} (mean ${flagged.m.toFixed(2)}s, stddev ${flagged.sd.toFixed(3)}s)`,
      };
    }
  }

  // offRepo — only meaningful when we have a repo file tree (beest doesn't).
  const offEntities = new Set<string>();
  let offCount = 0;
  if (repoFilePaths.size > 0) {
    for (const h of sorted) {
      if (!entityMatchesRepo(h.entity, repoBasenames, repoFilePaths)) {
        offCount += 1;
        if (offEntities.size < 5) offEntities.add(h.entity);
      }
    }
  }

  // points downsample
  const maxPoints = 50_000;
  const stride = sorted.length > maxPoints ? Math.ceil(sorted.length / maxPoints) : 1;
  const xs: number[] = [];
  const lines: (number | null)[] = [];
  const cursors: (number | null)[] = [];
  for (let i = 0; i < sorted.length; i += stride) {
    const h = sorted[i];
    xs.push(h.time);
    lines.push(typeof h.lineno === 'number' ? h.lineno : null);
    cursors.push(typeof h.cursorpos === 'number' ? h.cursorpos : null);
  }

  // filterable per-heartbeat indices for client-side exclusion recompute
  const editorIndexMap = new Map<string, number>();
  const categoryIndexMap = new Map<string, number>();
  const editorList: string[] = [];
  const categoryList: string[] = [];
  const fTimes: number[] = [];
  const fEd: number[] = [];
  const fCat: number[] = [];
  const filterStride = sorted.length > 50_000 ? Math.ceil(sorted.length / 50_000) : 1;
  for (let i = 0; i < sorted.length; i += filterStride) {
    const h = sorted[i];
    const ed = h.editor ?? 'unknown';
    const cat = h.category ?? 'unknown';
    let eIdx = editorIndexMap.get(ed);
    if (eIdx === undefined) {
      eIdx = editorList.length;
      editorList.push(ed);
      editorIndexMap.set(ed, eIdx);
    }
    let cIdx = categoryIndexMap.get(cat);
    if (cIdx === undefined) {
      cIdx = categoryList.length;
      categoryList.push(cat);
      categoryIndexMap.set(cat, cIdx);
    }
    fTimes.push(h.time);
    fEd.push(eIdx);
    fCat.push(cIdx);
  }

  return {
    summary: {
      count,
      spanSeconds,
      activeMinutes,
      firstAt,
      lastAt,
      coveredDays: coveredDayKeys.size,
      aiPercent,
      aiCount,
      pasteLikeCount,
    },
    editorBreakdown,
    categoryBreakdown,
    userAgents,
    anomalies: {
      autoClicker,
      macroTyper,
      offRepo: { count: offCount, sampleEntities: [...offEntities] },
    },
    points: [xs, lines, cursors],
    filterable: {
      editorList,
      categoryList,
      times: fTimes,
      editorIdx: fEd,
      categoryIdx: fCat,
    },
  };
}
