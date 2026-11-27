/** A stretch of a recording, in seconds from the start of the original file. */
export interface Span {
  start: number;
  end: number;
}

/** What's been trimmed and cut from a recording. The recording itself is never changed. */
export interface Cuts {
  /** Everything before this is trimmed off. */
  start: number;
  /** Everything after this is trimmed off. */
  end: number;
  /** Stretches removed from the middle. */
  cuts: Span[];
}

/** A recording's saved edit. */
export interface Edit extends Cuts {
  /** ISO date and time it was saved */
  updatedAt: string;
}

/** A part of the recording that's kept. An end of null runs to the end of the file, however long it really is. */
export interface Segment {
  start: number;
  end: number | null;
}

/** Shortest cut or kept stretch worth keeping as its own. Anything shorter is dropped or merged. */
const SHORTEST = 0.05;

/** Rounds to the millisecond. */
export function ms(t: number): number {
  return Math.round(t * 1000) / 1000;
}

/** No edit: the whole recording. */
export function whole(duration: number): Cuts {
  return { start: 0, end: ms(duration), cuts: [] };
}

/**
 * Puts an edit in order: the trims inside the recording and the right way round, and the cuts
 * sorted, inside the trims, with overlapping or touching ones merged and slivers dropped.
 */
export function normalize(edit: Cuts, duration: number): Cuts {
  const clamp = (t: number) => ms(Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), duration));
  let start = clamp(edit.start);
  let end = clamp(Number.isFinite(edit.end) ? edit.end : duration);
  if (end < start) [start, end] = [end, start];
  if (end - start < SHORTEST) return whole(duration);
  const trims = { start, end };
  const sorted = edit.cuts
    .map((c) => ({ start: Math.max(clamp(Math.min(c.start, c.end)), start), end: Math.min(clamp(Math.max(c.start, c.end)), end) }))
    .filter((c) => c.end - c.start >= SHORTEST)
    .sort((a, b) => a.start - b.start);
  const cuts: Span[] = [];
  for (const c of sorted) {
    const last = cuts[cuts.length - 1];
    // A kept sliver between two cuts goes too.
    if (last && c.start - last.end < SHORTEST) last.end = Math.max(last.end, c.end);
    else cuts.push({ ...c });
  }
  // A cut that reaches a trim, or nearly, just moves the trim.
  while (cuts.length && cuts[0].start - start < SHORTEST) start = cuts.shift()!.end;
  while (cuts.length && end - cuts[cuts.length - 1].end < SHORTEST) end = cuts.pop()!.start;
  // Cuts that leave nothing are dropped. cut() refuses to make them.
  if (end - start < SHORTEST) return { ...trims, cuts: [] };
  return { start, end, cuts };
}

/** Whether an edit changes anything. */
export function changes(edit: Cuts | undefined, duration: number): boolean {
  if (!edit) return false;
  const n = normalize(edit, duration);
  return n.start > 0 || n.end < duration - SHORTEST || n.cuts.length > 0;
}

export function sameCuts(a: Cuts, b: Cuts): boolean {
  return a.start === b.start && a.end === b.end && a.cuts.length === b.cuts.length && a.cuts.every((c, i) => c.start === b.cuts[i].start && c.end === b.cuts[i].end);
}

/** The parts of the recording that are kept, in order. */
export function kept(edit: Cuts | undefined, duration: number): Span[] {
  const n = normalize(edit ?? whole(duration), duration);
  const spans: Span[] = [];
  let at = n.start;
  for (const c of n.cuts) {
    spans.push({ start: at, end: c.start });
    at = c.end;
  }
  spans.push({ start: at, end: n.end });
  return spans;
}

/** The kept parts as the server is to render them: one that runs to the end is left open, as the file may be a little longer than timed. */
export function segments(edit: Cuts | undefined, duration: number): Segment[] {
  return kept(edit, duration).map((s, i, all) => ({ start: s.start, end: i === all.length - 1 && s.end >= duration - SHORTEST ? null : s.end }));
}

/** How long the edited recording is. */
export function editedLength(spans: Span[]): number {
  return spans.reduce((sum, s) => sum + s.end - s.start, 0);
}

/** Where a moment of the recording comes in the edited version. A moment that's cut comes where the cut is. */
export function toEdited(spans: Span[], t: number): number {
  let sum = 0;
  for (const s of spans) {
    if (t <= s.start) return sum;
    if (t < s.end) return sum + t - s.start;
    sum += s.end - s.start;
  }
  return sum;
}

/** Which moment of the recording comes at a time in the edited version. */
export function toOriginal(spans: Span[], e: number): number {
  let left = Math.max(0, e);
  for (const s of spans) {
    const len = s.end - s.start;
    if (left < len) return s.start + left;
    left -= len;
  }
  return spans.length ? spans[spans.length - 1].end : 0;
}

/**
 * Where playing should be at a moment: the moment itself if it's kept, otherwise the start of the next
 * kept part, or null once past the last. Within `ahead` of a part's end counts as past it, so a jump
 * can be made a little early rather than late.
 */
export function playable(spans: Span[], t: number, ahead = 0): number | null {
  for (const s of spans) {
    if (t < s.start) return s.start;
    if (t < s.end - ahead) return t;
  }
  return null;
}

/** The cut that a moment is in, if any. */
export function cutAt(edit: Cuts, t: number): Span | undefined {
  return edit.cuts.find((c) => t >= c.start && t <= c.end);
}

/** Removes a stretch, as a new edit. */
export function cut(edit: Cuts, span: Span, duration: number): Cuts {
  const a = Math.min(span.start, span.end);
  const b = Math.max(span.start, span.end);
  const spans = kept(edit, duration);
  const removed = spans.reduce((sum, s) => sum + Math.max(0, Math.min(s.end, b) - Math.max(s.start, a)), 0);
  // Nothing would be left.
  if (editedLength(spans) - removed < SHORTEST) return edit;
  return normalize({ ...edit, cuts: [...edit.cuts, { start: a, end: b }] }, duration);
}

/** Puts back a cut, as a new edit. */
export function restore(edit: Cuts, span: Span, duration: number): Cuts {
  return normalize({ ...edit, cuts: edit.cuts.filter((c) => c.start !== span.start || c.end !== span.end) }, duration);
}

/** m:ss, or h:mm:ss for an hour or more, with tenths if asked. */
export function clock(seconds: number, tenths = false): string {
  const t = tenths ? Math.round(Math.max(0, seconds) * 10) / 10 : Math.max(0, seconds);
  const whole = Math.floor(t);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  const tail = tenths ? '.' + Math.round((t - whole) * 10) : '';
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}${tail}` : `${m}:${s}${tail}`;
}
