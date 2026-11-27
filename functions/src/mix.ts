import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** The jingles, copied here from jingle/ by the build. A published version names the file it was made with. */
export const JINGLES = ['intro.wav', 'outro.wav'];
export const jinglePath = (file: string) => fileURLToPath(new URL(`./jingles/${file}`, import.meta.url));

/** How long a WAV file is, from its header. */
export async function wavSeconds(file: string): Promise<number> {
  const b = await readFile(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file} isn’t a WAV file`);
  let byteRate = 0;
  for (let at = 12; at + 8 <= b.length; ) {
    const id = b.toString('ascii', at, at + 4);
    const size = b.readUInt32LE(at + 4);
    if (id === 'fmt ') byteRate = b.readUInt32LE(at + 16);
    if (id === 'data') {
      if (!byteRate) break;
      return Math.min(size, b.length - at - 8) / byteRate;
    }
    at += 8 + size + (size & 1);
  }
  throw new Error(`Couldn’t tell how long ${file} is`);
}

/**
 * Where the intro, the recording and the outro start on the published version's timeline, given where
 * on the edited recording the intro ends and the outro starts. The intro ends at its spot, starting the
 * recording after some silence if it wouldn't otherwise fit. Must match mixPlan() in src/app/audio-edit.ts.
 */
export function mixOffsets(spots: { introEnd: number | null; outroStart: number | null }, lengths: { intro: number; outro: number }) {
  const lead = spots.introEnd != null ? Math.max(0, lengths.intro - spots.introEnd) : 0;
  return {
    lead,
    introAt: spots.introEnd != null ? lead + spots.introEnd - lengths.intro : null,
    outroAt: spots.outroStart != null ? lead + spots.outroStart : null,
  };
}
