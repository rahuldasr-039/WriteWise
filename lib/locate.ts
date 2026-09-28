import { Issue } from "./schema";

export interface LocatedIssue {
  id: string;
  issue: Issue;
  start: number;
  end: number;
}

export interface LocateResult {
  located: LocatedIssue[];
  unlocated: Issue[];
}

/**
 * Score how well a candidate offset matches the LLM-provided context.
 */
function scoreContextMatch(
  text: string,
  candidateStart: number,
  candidateEnd: number,
  context: string
): number {
  if (!context || !context.trim()) return 0;

  const windowSize = Math.max(context.length + 20, 60);
  const winStart = Math.max(0, candidateStart - Math.floor(windowSize / 2));
  const winEnd = Math.min(text.length, candidateEnd + Math.floor(windowSize / 2));
  const textWindow = text.slice(winStart, winEnd).toLowerCase();
  const lowerContext = context.toLowerCase().trim();

  // Perfect match: the context string appears in the surrounding window
  if (textWindow.includes(lowerContext)) {
    return 100;
  }

  // Token-level match: count shared words
  const contextWords = lowerContext.split(/\s+/).filter((w) => w.length > 2);
  if (contextWords.length === 0) return 10;

  let matchedWords = 0;
  for (const word of contextWords) {
    if (textWindow.includes(word)) {
      matchedWords++;
    }
  }

  return Math.round((matchedWords / contextWords.length) * 80);
}

/**
 * Calculate deterministic character offsets for issues returned by the LLM.
 * Disambiguates duplicate phrases using context and reading order.
 */
export function locateIssues(text: string, issues: Issue[]): LocateResult {
  const located: LocatedIssue[] = [];
  const unlocated: Issue[] = [];

  // Track claimed ranges to avoid assigning identical issues to the same offset
  const claimedRanges: Array<{ start: number; end: number }> = [];

  issues.forEach((issue, issueIndex) => {
    const target = issue.original;
    if (!target) {
      unlocated.push(issue);
      return;
    }

    // Find all candidate indices of the exact original substring in text
    const candidateIndices: number[] = [];
    let searchPos = 0;
    while (searchPos < text.length) {
      const idx = text.indexOf(target, searchPos);
      if (idx === -1) break;
      candidateIndices.push(idx);
      searchPos = idx + 1;
    }

    if (candidateIndices.length === 0) {
      // Substring could not be located in source text
      unlocated.push(issue);
      return;
    }

    // Filter out indices that have already been completely claimed by identical issue
    const availableIndices = candidateIndices.filter((idx) => {
      const end = idx + target.length;
      return !claimedRanges.some(
        (claimed) => claimed.start === idx && claimed.end === end
      );
    });

    const pool = availableIndices.length > 0 ? availableIndices : candidateIndices;

    let bestIndex = pool[0];
    let highestScore = -1;

    for (const idx of pool) {
      const score = scoreContextMatch(text, idx, idx + target.length, issue.context);
      if (score > highestScore) {
        highestScore = score;
        bestIndex = idx;
      }
    }

    const start = bestIndex;
    const end = start + target.length;

    claimedRanges.push({ start, end });
    located.push({
      id: `issue-${issueIndex}-${start}-${end}`,
      issue,
      start,
      end,
    });
  });

  return { located, unlocated };
}

/**
 * DETERMINISTIC OVERLAP RESOLUTION STRATEGY:
 *
 * When two or more issue ranges overlap (e.g. [10, 25] and [15, 30]):
 * 1. Sort all candidates primarily by start offset ascending.
 * 2. If start offsets are identical, prefer longer spans (end - start descending).
 * 3. If lengths are also identical, maintain original LLM order.
 * 4. Iterate linearly through sorted candidates:
 *    - If the current candidate starts at or after the previous active issue's end,
 *      it does NOT overlap: add it to `active`.
 *    - If it starts before the previous active issue's end, it OVERLAPS:
 *      push to `overlapping` (excluded from inline underlines to prevent broken HTML,
 *      while preserving user access via the issues list).
 *
 * This guarantees zero nested/broken spans and complete rendering integrity.
 */
export function resolveOverlaps(located: LocatedIssue[]): {
  active: LocatedIssue[];
  overlapping: LocatedIssue[];
} {
  const sorted = [...located].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA; // longer first
    return a.id.localeCompare(b.id);
  });

  const active: LocatedIssue[] = [];
  const overlapping: LocatedIssue[] = [];
  let lastEnd = -1;

  for (const item of sorted) {
    if (item.start >= lastEnd) {
      active.push(item);
      lastEnd = item.end;
    } else {
      overlapping.push(item);
    }
  }

  return { active, overlapping };
}

export type TextSegment =
  | { type: "text"; text: string; key: string }
  | { type: "issue"; text: string; locatedIssue: LocatedIssue; key: string };

/**
 * Slice text into non-overlapping sequential segments for safe React rendering.
 */
export function buildTextSegments(
  text: string,
  activeIssues: LocatedIssue[]
): TextSegment[] {
  const segments: TextSegment[] = [];
  // Sort active issues ascending by start offset
  const sorted = [...activeIssues].sort((a, b) => a.start - b.start);
  let cursor = 0;

  for (const item of sorted) {
    if (item.start > cursor) {
      segments.push({
        type: "text",
        text: text.slice(cursor, item.start),
        key: `text-${cursor}-${item.start}`,
      });
    }

    segments.push({
      type: "issue",
      text: text.slice(item.start, item.end),
      locatedIssue: item,
      key: item.id,
    });

    cursor = item.end;
  }

  if (cursor < text.length) {
    segments.push({
      type: "text",
      text: text.slice(cursor),
      key: `text-${cursor}-${text.length}`,
    });
  }

  return segments;
}

/**
 * Replace a single located issue's original text with its suggestion.
 */
export function applySingleFix(text: string, target: LocatedIssue): string {
  if (target.start < 0 || target.end > text.length || target.start > target.end) {
    return text;
  }
  return text.slice(0, target.start) + target.issue.suggestion + text.slice(target.end);
}

/**
 * Replace all active (non-overlapping) issues safely from right to left.
 * Right-to-left replacement guarantees preceding offsets remain strictly constant.
 */
export function applyAllFixes(text: string, targets: LocatedIssue[]): string {
  // Sort descending by start offset
  const sortedDesc = [...targets].sort((a, b) => b.start - a.start);
  let result = text;

  for (const target of sortedDesc) {
    if (target.start >= 0 && target.end <= result.length && target.start <= target.end) {
      result =
        result.slice(0, target.start) +
        target.issue.suggestion +
        result.slice(target.end);
    }
  }

  return result;
}
