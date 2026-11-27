import { ffmpeg } from './ffmpeg.js';

/** A part of the recording to keep, in seconds. An end of null runs to the end of the file. */
export interface Segment {
  start: number;
  end: number | null;
}

/** A source laid on the output's timeline: the recording, and the intro and outro over it. */
export interface Track {
  file: string;
  /** Kept parts, joined end to end. */
  segments: Segment[];
  /** Where on the output's timeline it starts, in seconds. */
  offset: number;
}

/** Each join fades out and in over this long, so a cut doesn't click. */
const JOIN_FADE = 0.008;

const n = (t: number) => (Math.round(t * 1000) / 1000).toFixed(3);

/** Keeps only sensible segments: in order, not overlapping, and not empty. */
export function cleanSegments(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return [];
  const out: Segment[] = [];
  let at = 0;
  for (const s of raw) {
    const start = typeof s?.start === 'number' && Number.isFinite(s.start) ? Math.max(s.start, at) : NaN;
    const end = s?.end === null ? null : typeof s?.end === 'number' && Number.isFinite(s.end) ? s.end : NaN;
    if (Number.isNaN(start) || Number.isNaN(end as number)) continue;
    if (end !== null && end - start < 0.01) continue;
    out.push({ start, end });
    if (end === null) break;
    at = end;
  }
  return out;
}

/** The ffmpeg filter graph that cuts each track into its segments, joins them, and mixes the tracks. */
export function filterGraph(tracks: Track[]): string {
  const parts: string[] = [];
  const outs: string[] = [];
  tracks.forEach((track, ti) => {
    const pieces = track.segments.map((s, si) => {
      const label = `t${ti}s${si}`;
      const trim = s.end === null ? `atrim=start=${n(s.start)}` : `atrim=start=${n(s.start)}:end=${n(s.end)}`;
      const filters = [trim, 'asetpts=PTS-STARTPTS'];
      // Fades only at joins, so the very start and end of the recording are left as they are.
      if (si > 0) filters.push(`afade=t=in:d=${JOIN_FADE}`);
      if (si < track.segments.length - 1 && s.end !== null) filters.push(`afade=t=out:st=${n(Math.max(0, s.end - s.start - JOIN_FADE))}:d=${JOIN_FADE}`);
      parts.push(`[${ti}:a]${filters.join(',')}[${label}]`);
      return `[${label}]`;
    });
    let joined = pieces[0];
    if (pieces.length > 1) {
      joined = `[t${ti}]`;
      parts.push(`${pieces.join('')}concat=n=${pieces.length}:v=0:a=1${joined}`);
    }
    if (track.offset > 0) {
      const ms = Math.round(track.offset * 1000);
      parts.push(`${joined}adelay=delays=${ms}:all=1[t${ti}d]`);
      joined = `[t${ti}d]`;
    }
    if (tracks.length > 1) {
      // The jingles are stereo and the recording mono; mixing needs them alike.
      parts.push(`${joined}aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[t${ti}f]`);
      joined = `[t${ti}f]`;
    }
    outs.push(joined);
  });
  if (outs.length === 1) {
    parts.push(`${outs[0]}anull[out]`);
  } else {
    // Laid over each other at full level; the intro and outro carry their own fades.
    parts.push(`${outs.join('')}amix=inputs=${outs.length}:duration=longest:normalize=0,asetpts=N/SR/TB[out]`);
  }
  return parts.join(';');
}

/** The arguments to render tracks to an AAC file that podcast apps can play and start before it's all downloaded. */
export function renderArgs(tracks: Track[], output: string): string[] {
  return [
    ...tracks.flatMap((t) => ['-i', t.file]),
    '-filter_complex',
    filterGraph(tracks),
    '-map',
    '[out]',
    '-vn',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    '-f',
    'mp4',
    '-y',
    output,
  ];
}

/** Renders tracks to an .m4a file. Resolves with its length in seconds, as ffmpeg reports it. */
export async function render(tracks: Track[], output: string): Promise<number> {
  const log = await ffmpeg(renderArgs(tracks, output));
  const times = [...log.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const last = times[times.length - 1];
  return last ? +last[1] * 3600 + +last[2] * 60 + +last[3] : 0;
}
