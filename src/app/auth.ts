import { Injectable, computed, signal } from '@angular/core';
import { Auth, GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { EDITOR_EMAIL, firebaseApp } from './firebase';

/**
 * Google sign-in. Only EDITOR_EMAIL stays signed in; any other account is
 * signed straight back out. This only decides which controls are shown:
 * firestore.rules is what actually stops anyone else from changing the list.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /** False when Firebase isn't set up, where the app is a single-browser scratchpad. */
  readonly enabled = !!firebaseApp;
  /** The signed-in editor's email, or '' when nobody is signed in. */
  readonly email = signal('');
  /** True once the browser's remembered sign-in has been checked. */
  readonly checked = signal(!firebaseApp);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly isEditor = computed(() => !this.enabled || !!this.email());

  private readonly auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

  constructor() {
    if (!this.auth) return;
    onAuthStateChanged(this.auth, (user) => {
      const allowed = !!user?.emailVerified && user.email?.toLowerCase() === EDITOR_EMAIL;
      if (user && !allowed) {
        this.error.set(`${user.email ?? 'That account'} can’t edit this list. Sign in with Kiki’s Google account.`);
        void signOut(this.auth!);
        return;
      }
      this.email.set(allowed ? user!.email! : '');
      this.checked.set(true);
    });
  }

  async signIn() {
    if (!this.auth || this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ login_hint: EDITOR_EMAIL, prompt: 'select_account' });
      await signInWithPopup(this.auth, provider);
    } catch (e: any) {
      const code = String(e?.code ?? '');
      if (code === 'auth/popup-blocked') {
        this.error.set('Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.');
      } else if (code === 'auth/unauthorized-domain') {
        this.error.set('This web address isn’t on the Firebase list of authorized domains yet.');
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        this.error.set('Couldn’t sign in. Check your connection and try again.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  async signOut() {
    if (!this.auth) return;
    this.error.set('');
    await signOut(this.auth);
  }
}
