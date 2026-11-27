import { ffmpeg } from './ffmpeg.js';

/** Peaks per second. Must match PEAKS_PER_SECOND in src/app/review-store.ts. */
export const PEAKS_PER_SECOND = 50;
/** Decoded this low for speed; it's plenty for loudness. */
const RATE = 8000;
const PER_PEAK = RATE / PEAKS_PER_SECOND;

/**
 * A recording's waveform: how loud each fiftieth of a second is, as the loudest sample in it from
 * 0 to 255. About 135KB for 45 minutes, small enough to keep in a Firestore document.
 */
export async function peaks(file: string): Promise<Buffer> {
  const out: number[] = [];
  let loudest = 0;
  let count = 0;
  let carry: Buffer | null = null;
  await ffmpeg(['-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-acodec', 'pcm_s16le', 'pipe:1'], (chunk) => {
    let data = chunk;
    if (carry) {
      data = Buffer.concat([carry, chunk]);
      carry = null;
    }
    const whole = data.length - (data.length % 2);
    if (whole < data.length) carry = data.subarray(whole);
    for (let i = 0; i < whole; i += 2) {
      const s = Math.abs(data.readInt16LE(i));
      if (s > loudest) loudest = s;
      if (++count === PER_PEAK) {
        out.push(Math.min(255, Math.round((loudest / 32768) * 255)));
        loudest = 0;
        count = 0;
      }
    }
  });
  if (count) out.push(Math.min(255, Math.round((loudest / 32768) * 255)));
  return Buffer.from(out);
}
