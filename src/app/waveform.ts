/**
 * A recording's waveform: how loud each moment is, PEAKS_PER_SECOND times a second, from 0 to 255.
 * The backend works these out from each upload (functions/src/peaks.ts). This works them out in the
 * browser, for recordings that never reach the backend.
 */
export async function decodePeaks(url: string, perSecond: number): Promise<Uint8Array> {
  const data = await (await fetch(url)).arrayBuffer();
  // Decoded at a low rate, which is plenty for loudness and keeps memory down.
  let context: OfflineAudioContext;
  try {
    context = new OfflineAudioContext(1, 1, 8000);
  } catch {
    context = new OfflineAudioContext(1, 1, 22050);
  }
  const audio = await context.decodeAudioData(data);
  const step = audio.sampleRate / perSecond;
  const count = Math.ceil(audio.length / step);
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  const peaks = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    let loudest = 0;
    const end = Math.min(audio.length, Math.floor((i + 1) * step));
    for (const samples of channels) for (let j = Math.floor(i * step); j < end; j++) loudest = Math.max(loudest, Math.abs(samples[j]));
    peaks[i] = Math.min(255, Math.round(loudest * 255));
  }
  return peaks;
}

/** The loudest peak between two indexes, from 0 to 1. */
export function loudest(peaks: Uint8Array, from: number, to: number): number {
  const a = Math.max(0, Math.floor(from));
  const b = Math.min(peaks.length, Math.max(a + 1, Math.ceil(to)));
  let max = 0;
  for (let i = a; i < b; i++) if (peaks[i] > max) max = peaks[i];
  return max / 255;
}

/**
 * How tall to draw a peak, from 0 to 1. Voices recorded without automatic gain are often quiet, so
 * it's scaled to the recording's loudest moment and drawn on a decibel scale, as audio editors do.
 */
export function height(peak: number, top: number): number {
  if (peak <= 0 || top <= 0) return 0;
  const db = 20 * Math.log10(peak / top);
  return Math.max(0, 1 + db / 45);
}

/** The loudest peak of all, from 0 to 1. */
export function top(peaks: Uint8Array): number {
  return loudest(peaks, 0, peaks.length);
}
