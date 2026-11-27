/**
 * Makes a waveform for every recording that hasn't got one. migrate-ids does this too, so this is
 * only needed if a waveform is ever missing:
 *
 *   gcloud auth application-default login
 *   npm --prefix functions run backfill-waveforms
 */
import { initializeApp } from 'firebase-admin/app';
import { makeMissingWaveforms } from './jobs.js';

initializeApp({ projectId: 'yule-swoon', storageBucket: 'yule-swoon.firebasestorage.app' });
await makeMissingWaveforms();
