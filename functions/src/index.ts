import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { RECORDING, makePeaks, renderPublished } from './jobs.js';

initializeApp();

/** Must be the Storage bucket's region, or the upload trigger can't be deployed. */
setGlobalOptions({ region: 'us-east1', maxInstances: 3 });

/** Makes the waveform of each recording uploaded, for the editor. */
export const recordingUploaded = onObjectFinalized({ memory: '512MiB', timeoutSeconds: 300 }, async (event) => {
  const { name, contentType } = event.data;
  if (!RECORDING.test(name) || !contentType?.startsWith('audio/')) return;
  await makePeaks(name);
});

/** Makes the file of each version published, and again when one is retried. */
export const publishedWritten = onDocumentWritten({ document: 'movies/{movie}/published/{episode}', memory: '1GiB', timeoutSeconds: 540 }, async (event) => {
  if (event.data?.after.get('status') !== 'pending') return;
  await renderPublished(event.params.movie, event.params.episode);
});
