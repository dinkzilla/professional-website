import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { RECORDING, makePeaks, renderPublished } from './jobs.js';
import { fullyRated, sitemapXml } from './sitemap.js';

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

/**
 * /sitemap.xml (firebase.json sends it here): the list and every fully rated movie, read fresh from Firestore,
 * so new ratings are listed without a deploy. Kept for an hour by Hosting's cache.
 */
export const sitemap = onRequest({ memory: '256MiB', maxInstances: 1 }, async (_req, res) => {
  const snap = await getFirestore().collection('movies').select('scores').get();
  const ids = snap.docs.filter((d) => fullyRated(d.get('scores'))).map((d) => d.id).sort();
  res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.type('application/xml').send(sitemapXml(ids));
});
