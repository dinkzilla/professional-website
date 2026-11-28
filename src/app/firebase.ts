import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

/**
 * The Firebase web app's settings. Paste them from the Firebase console:
 * Project settings → General → Your apps → SDK setup and configuration.
 * None of these values are secret; access is decided by firestore.rules and storage.rules.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyABGVJvX1ZB9R1KD7EWhNrfUqf3qr9DaAE',
  authDomain: 'yule-swoon.firebaseapp.com',
  projectId: 'yule-swoon',
  storageBucket: 'yule-swoon.firebasestorage.app',
  appId: '1:842316071349:web:f7c7df4c543dd7f3b459fc',
  /** The Google Analytics data stream, used by analytics.ts. */
  measurementId: 'G-J8QJXVYF51',
};

/** The Google accounts allowed to add, edit and delete, Kiki's first. Must match firestore.rules and storage.rules. */
export const EDITOR_EMAILS = ['venablekd@gmail.com', 'dinkzilla@gmail.com'];

/** False until the settings above are filled in; the app then keeps everything in this browser. */
export const firebaseReady = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

export const firebaseApp = firebaseReady ? initializeApp(firebaseConfig) : null;
/** Kept on the device, so changes made offline survive closing the page and are sent the next time it's open. */
export const firestore = firebaseApp
  ? initializeFirestore(firebaseApp, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null;
