/**
 * Pure highlighting helpers — no browser API or React dependencies.
 * Exported here so they can be tested with the Node.js built-in test runner.
 */

export type HighlightSegment =
  | { type: "normal"; text: string }
  | { type: "error"; text: string; suggestion: string };

type Correction = {
  timestamp_ms_from_call_start: number;
  issue: string;
  suggestion: string;
};

/**
 * Splits `content` into ordered segments where each `correction.issue`
 * substring is marked as an "error" segment (with its suggestion).
 * Matching is case-insensitive; original casing is preserved in the output.
 * Overlapping matches are skipped (first-wins by position).
 */
export const buildHighlightSegments = (
  content: string,
  corrections: Correction[]
): HighlightSegment[] => {
  if (corrections.length === 0) {
    return [{ type: "normal", text: content }];
  }

  // Find all non-overlapping match positions
  type Match = { start: number; end: number; suggestion: string };
  const matches: Match[] = [];
  const lower = content.toLowerCase();

  for (const c of corrections) {
    if (!c.issue) continue;
    const issueLower = c.issue.toLowerCase();
    let searchFrom = 0;
    while (searchFrom < lower.length) {
      const idx = lower.indexOf(issueLower, searchFrom);
      if (idx === -1) break;
      const end = idx + c.issue.length;
      // Skip if overlaps with an already-recorded match
      if (matches.some(m => idx < m.end && end > m.start)) {
        searchFrom = idx + 1;
        continue;
      }
      matches.push({ start: idx, end, suggestion: c.suggestion });
      searchFrom = end;
    }
  }

  if (matches.length === 0) {
    return [{ type: "normal", text: content }];
  }

  // Sort by start position
  matches.sort((a, b) => a.start - b.start);

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (cursor < m.start) {
      segments.push({ type: "normal", text: content.slice(cursor, m.start) });
    }
    segments.push({ type: "error", text: content.slice(m.start, m.end), suggestion: m.suggestion });
    cursor = m.end;
  }
  if (cursor < content.length) {
    segments.push({ type: "normal", text: content.slice(cursor) });
  }

  return segments;
};
