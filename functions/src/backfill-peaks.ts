/**
 * Makes the waveforms of recordings uploaded before the backend made them on upload. Run once:
 *
 *   gcloud auth application-default login
 *   npm --prefix functions run backfill-peaks
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { RECORDING, makePeaks } from './jobs.js';

initializeApp({ projectId: 'yule-swoon', storageBucket: 'yule-swoon.firebasestorage.app' });

const [files] = await getStorage().bucket().getFiles({ prefix: 'movies/' });
let made = 0;
for (const file of files) {
  const match = RECORDING.exec(file.name);
  if (!match) continue;
  const [, movie, review] = match;
  if ((await getFirestore().doc(`movies/${movie}/peaks/${review}`).get()).exists) continue;
  process.stdout.write(`${file.name} … `);
  try {
    await makePeaks(file.name);
    made++;
    console.log('done');
  } catch (e) {
    console.log('failed:', e instanceof Error ? e.message : e);
  }
}
console.log(`Made ${made} waveform${made === 1 ? '' : 's'}.`);
