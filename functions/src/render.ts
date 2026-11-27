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
  /** How much to turn it up or down, in dB. */
  gain?: number;
}

/**
 * How loud a published version is made, in LUFS: podcast apps expect -16 for stereo, and -19 for mono,
 * which sounds the same. The recording and the jingles are each brought to it, so they match.
 */
export const TARGET_STEREO = -16;
export const TARGET_MONO = -19;
/** The most any track is turned up or down, so a nearly silent one isn't made a roar of noise. */
const MAX_GAIN = 20;
/** The mix's peaks are kept under this, linear (about -2 dBFS), so turning it up doesn't clip. */
const PEAK_LIMIT = 0.79;

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

/**
 * Adds to parts the filters that cut a track into its segments, join them, and lay it on the timeline,
 * made stereo if asked. Returns the label of what comes out.
 */
function trackChain(track: Track, ti: number, stereo: boolean, parts: string[]): string {
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
  if (stereo) {
    // The jingles are stereo and the recording mono; mixing needs them alike.
    parts.push(`${joined}aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[t${ti}f]`);
    joined = `[t${ti}f]`;
  }
  if (track.gain) {
    parts.push(`${joined}volume=${track.gain.toFixed(2)}dB[t${ti}g]`);
    joined = `[t${ti}g]`;
  }
  return joined;
}

/** The ffmpeg filter graph that cuts each track into its segments, joins them, and mixes the tracks. */
export function filterGraph(tracks: Track[]): string {
  const parts: string[] = [];
  const outs = tracks.map((track, ti) => trackChain(track, ti, tracks.length > 1, parts));
  // Turning tracks up can push peaks over full scale, so a limiter catches them; it's otherwise untouched.
  const limit = `alimiter=limit=${PEAK_LIMIT}:attack=5:release=50:level=0:latency=1`;
  if (outs.length === 1) {
    parts.push(`${outs[0]}${limit}[out]`);
  } else {
    // Laid over each other at their own levels; the intro and outro carry their own fades.
    parts.push(`${outs.join('')}amix=inputs=${outs.length}:duration=longest:normalize=0,asetpts=N/SR/TB,${limit}[out]`);
  }
  return parts.join(';');
}

/**
 * How loud a track is, in LUFS (integrated, EBU R128), as it would be heard in the mix: just its kept
 * segments, mono or made stereo. Null if it's too quiet to tell.
 */
export async function loudness(track: Track, stereo: boolean): Promise<number | null> {
  const parts: string[] = [];
  const out = trackChain({ ...track, offset: 0, gain: 0 }, 0, stereo, parts);
  parts.push(`${out}ebur128=framelog=quiet[out]`);
  const log = await ffmpeg(['-i', track.file, '-filter_complex', parts.join(';'), '-map', '[out]', '-f', 'null', '-']);
  const found = [...log.matchAll(/I:\s+(-?\d+(?:\.\d+)?) LUFS/g)];
  const lufs = found.length ? +found[found.length - 1][1] : NaN;
  return Number.isFinite(lufs) && lufs > -70 ? lufs : null;
}

/** Sets each track's gain so it plays at the target loudness: the recording and jingles end up matched. */
export async function levelTracks(tracks: Track[]): Promise<Track[]> {
  const stereo = tracks.length > 1;
  const target = stereo ? TARGET_STEREO : TARGET_MONO;
  return Promise.all(
    tracks.map(async (t) => {
      const lufs = await loudness(t, stereo);
      const gain = lufs == null ? 0 : Math.max(-MAX_GAIN, Math.min(MAX_GAIN, target - lufs));
      return { ...t, gain };
    }),
  );
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
