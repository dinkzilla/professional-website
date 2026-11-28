import { Injectable, computed, signal } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { EDITOR_EMAILS, firebaseApp } from './firebase';
import { viewFor } from './routes';

// Set by the Angular build: false in production.
declare const ngDevMode: unknown;

const PREVIEW_KEY = 'yule-swoon-preview';

function rememberedPreview(): boolean {
  try {
    return sessionStorage.getItem(PREVIEW_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * What getAuth() sets up, except that only the sign-in page gets the pop-up helper up front. On phones
 * the helper loads Google's script and an iframe before sign-in state is known, and Firestore waits for
 * that, so elsewhere it would hold up the movie list. The sign-in page needs it loaded before the button
 * is tapped, or Safari may block the pop-up.
 */
function startAuth(app: NonNullable<typeof firebaseApp>): Auth {
  const signingIn = viewFor(location.pathname, document.baseURI).name === 'signin';
  return initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    popupRedirectResolver: signingIn ? browserPopupRedirectResolver : undefined,
  });
}

function isEditorUser(user: User | null): boolean {
  return !!user?.emailVerified && EDITOR_EMAILS.includes(user.email?.toLowerCase() ?? '');
}

/**
 * Google sign-in. Only EDITOR_EMAILS stay signed in; any other account is
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
  /** Whether this build can show the editor's side without signing in: only `ng serve`, never the deployed site. */
  readonly canPreview = (typeof ngDevMode === 'undefined' || !!ngDevMode) && !!firebaseApp;
  /** True while showing the editor's side without being signed in. Changes made then never leave the page. */
  readonly previewing = signal(this.canPreview && rememberedPreview());
  readonly isEditor = computed(() => !this.enabled || !!this.email() || this.previewing());

  private readonly auth: Auth | null = firebaseApp ? startAuth(firebaseApp) : null;

  constructor() {
    if (!this.auth) return;
    onAuthStateChanged(this.auth, (user) => {
      const allowed = isEditorUser(user);
      if (user && !allowed) {
        this.error.set(`${user.email ?? 'That account'} can’t edit this list. Sign in with Kiki’s Google account.`);
        void signOut(this.auth!);
        return;
      }
      if (allowed) this.preview(false);
      this.email.set(allowed ? user!.email! : '');
      this.checked.set(true);
    });
  }

  /** Starts or stops showing the editor's side without signing in. Lasts as long as this tab, reloads included. */
  preview(on: boolean) {
    if (!this.canPreview) return;
    this.previewing.set(on);
    try {
      if (on) sessionStorage.setItem(PREVIEW_KEY, '1');
      else sessionStorage.removeItem(PREVIEW_KEY);
    } catch {}
  }

  /** Opens the Google sign-in window. Resolves true when the editor ends up signed in. */
  async signIn(): Promise<boolean> {
    if (!this.auth || this.busy()) return false;
    this.error.set('');
    this.busy.set(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ login_hint: EDITOR_EMAILS[0], prompt: 'select_account' });
      const { user } = await signInWithPopup(this.auth, provider, browserPopupRedirectResolver);
      return isEditorUser(user);
    } catch (e: any) {
      const code = String(e?.code ?? '');
      if (code === 'auth/popup-blocked') {
        this.error.set('Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.');
      } else if (code === 'auth/unauthorized-domain') {
        this.error.set('This web address isn’t on the Firebase list of authorized domains yet.');
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        this.error.set('Couldn’t sign in. Check your connection and try again.');
      }
      return false;
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
