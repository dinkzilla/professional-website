import { randomUUID } from 'node:crypto';
import { rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { PEAKS_PER_SECOND, peaks } from './peaks.js';
import { JINGLES, jinglePath, mixOffsets, wavSeconds } from './mix.js';
import { Track, cleanSegments, levelTracks, render } from './render.js';

/** Where recordings are kept: movies/<movie>/recordings/<recording>.<extension>, named the same as their details' document. */
export const RECORDING = /^movies\/([^/]+)\/recordings\/([^/.]+)(\.[a-z0-9]+)?$/;
/** Firestore's limit on a document, less room for the other fields. */
const MAX_PEAKS = 1_000_000;

async function scratch<T>(use: (file: string) => Promise<T>): Promise<T> {
  const file = join(tmpdir(), randomUUID());
  try {
    return await use(file);
  } finally {
    await rm(file, { force: true });
  }
}

/** Works out a recording's waveform and keeps it at movies/<movie>/waveforms/<recording>, where the editor reads it. */
export async function makePeaks(path: string) {
  const match = RECORDING.exec(path);
  if (!match) return;
  const [, movie, review] = match;
  await scratch(async (file) => {
    await getStorage().bucket().file(path).download({ destination: file });
    let data = await peaks(file);
    if (data.length > MAX_PEAKS) data = data.subarray(0, MAX_PEAKS);
    await getFirestore().doc(`movies/${movie}/waveforms/${review}`).set({ data, perSecond: PEAKS_PER_SECOND, madeAt: new Date().toISOString() });
  });
}

/** Makes a waveform for every recording that hasn't got one, saying how each went. */
export async function makeMissingWaveforms() {
  const [files] = await getStorage().bucket().getFiles({ prefix: 'movies/' });
  let made = 0;
  let failed = 0;
  for (const file of files) {
    const match = RECORDING.exec(file.name);
    if (!match) continue;
    const [, movie, recording] = match;
    if ((await getFirestore().doc(`movies/${movie}/waveforms/${recording}`).get()).exists) continue;
    process.stdout.write(`  ${file.name} … `);
    try {
      await makePeaks(file.name);
      made++;
      console.log('done');
    } catch (e) {
      failed++;
      console.log('failed:', e instanceof Error ? e.message : e);
    }
  }
  console.log(`  Made ${made} waveform${made === 1 ? '' : 's'}${failed ? `; ${failed} failed, so run this again` : ''}.`);
}

class Problem extends Error {}

/** A jingle a published version asks for: one that's here, and where it goes on the edited recording. */
function jingle(raw: unknown, key: 'end' | 'start'): { file: string; at: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { file, [key]: at } = raw as Record<string, unknown>;
  if (typeof file !== 'string' || !JINGLES.includes(file)) throw new Problem('This version asks for an intro or outro that isn’t here any more.');
  if (typeof at !== 'number' || !Number.isFinite(at) || at < 0) throw new Problem('This version’s intro or outro mark isn’t right. Set it again and republish.');
  return { file: jinglePath(file), at };
}

/**
 * Makes a published version's file from the recording it was published from, cut as it was then,
 * and keeps it at movies/<movie>/published/<episode>.m4a. Only acts on a version waiting to be made,
 * and claims it first, so two runs can't make the same one.
 */
export async function renderPublished(movie: string, episode: string) {
  const db = getFirestore();
  const ref = db.doc(`movies/${movie}/published/${episode}`);
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get('status') !== 'pending') return null;
    tx.update(ref, { status: 'processing', error: FieldValue.delete() });
    return snap.data()!;
  });
  if (!claimed) return;

  const bucket = getStorage().bucket();
  const out = `movies/${movie}/published/${episode}.m4a`;
  try {
    const source = claimed['source'] ?? {};
    const path = typeof source.path === 'string' ? source.path : '';
    if (!path.startsWith(`movies/${movie}/recordings/`) || !RECORDING.test(path)) throw new Problem('This version doesn’t say which recording it’s from.');
    const segments = cleanSegments(source.segments);
    if (!segments.length) throw new Problem('Nothing of the recording was kept to publish.');
    const original = bucket.file(path);
    const [exists] = await original.exists();
    if (!exists) throw new Problem('The recording was deleted before this version could be made.');

    const intro = jingle(source.intro, 'end');
    const outro = jingle(source.outro, 'start');
    const lengths = { intro: intro ? await wavSeconds(intro.file) : 0, outro: outro ? await wavSeconds(outro.file) : 0 };
    const at = mixOffsets({ introEnd: intro?.at ?? null, outroStart: outro?.at ?? null }, lengths);

    await scratch((input) =>
      scratch(async (output) => {
        await original.download({ destination: input });
        const tracks: Track[] = [{ file: input, segments, offset: at.lead }];
        const whole = [{ start: 0, end: null }];
        if (intro && at.introAt != null) tracks.push({ file: intro.file, segments: whole, offset: at.introAt });
        if (outro && at.outroAt != null) tracks.push({ file: outro.file, segments: whole, offset: at.outroAt });
        const seconds = await render(await levelTracks(tracks), output);
        const { size } = await stat(output);
        await bucket.upload(output, {
          destination: out,
          contentType: 'audio/mp4',
          metadata: {
            // Each version has a file of its own that's never replaced, so it can be kept for good.
            cacheControl: 'public, max-age=31536000, immutable',
            metadata: { firebaseStorageDownloadTokens: randomUUID() },
          },
        });
        // Deleted while it was being made: don't leave its file behind.
        if (!(await ref.get()).exists) {
          await bucket.file(out).delete({ ignoreNotFound: true });
          return;
        }
        await ref.update({
          status: 'done',
          path: out,
          mime: 'audio/mp4',
          seconds: Math.round(seconds * 1000) / 1000,
          bytes: size,
          publishedAt: new Date().toISOString(),
        });
      }),
    );
  } catch (e) {
    console.error(`Couldn’t make movies/${movie}/published/${episode}`, e);
    const error = e instanceof Problem ? e.message : 'Couldn’t make this version’s file. Try again.';
    if ((await ref.get()).exists) await ref.update({ status: 'error', error });
  }
}
