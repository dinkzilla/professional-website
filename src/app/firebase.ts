import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

/**
 * The Firebase web app's settings. Paste them from the Firebase console:
 * Project settings → General → Your apps → SDK setup and configuration.
 * None of these values are secret; access is decided by firestore.rules.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyABGVJvX1ZB9R1KD7EWhNrfUqf3qr9DaAE',
  authDomain: 'yule-swoon.firebaseapp.com',
  projectId: 'yule-swoon',
  appId: '1:842316071349:web:f7c7df4c543dd7f3b459fc',
};

/** The one Google account allowed to add, edit and delete. Must match firestore.rules. */
export const EDITOR_EMAIL = 'venablekd@gmail.com';

/** False until the settings above are filled in; the app then keeps everything in this browser. */
export const firebaseReady = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

export const firebaseApp = firebaseReady ? initializeApp(firebaseConfig) : null;
export const firestore = firebaseApp ? initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true }) : null;
