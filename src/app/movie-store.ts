import { Injectable, inject, signal } from '@angular/core';
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AuthService } from './auth';
import { Movie, MovieData, normalize } from './criteria';
import { firestore } from './firebase';

export type View = { name: 'list' | 'signin' } | { name: 'detail' | 'edit'; id: string };

const LOCAL_KEY = 'holiday-romance-movies';
const SEEDED_KEY = 'holiday-romance-seeded';

/** True when the address bar is on the sign-in page, /kiki. */
function onSignInPath(): boolean {
  return /\/kiki\/?$/.test(location.pathname);
}

/**
 * Holds the movie list. With Firebase set up it is the shared Firestore
 * "movies" collection, which anyone can read and only the signed-in editor can
 * change. Without it (src/app/firebase.ts left blank) it falls back to this
 * browser's storage.
 */
@Injectable({ providedIn: 'root' })
export class MovieStore {
  private readonly auth = inject(AuthService);

  readonly movies = signal<Movie[]>([]);
  readonly status = signal<'loading' | 'ready' | 'unavailable'>('loading');
  readonly slow = signal(false);
  /** Whether to show the add, edit and delete controls. */
  readonly canWrite = this.auth.isEditor;
  readonly error = signal('');
  readonly view = signal<View>({ name: onSignInPath() ? 'signin' : 'list' });

  /** What's typed in the list's search box, kept here so it survives opening a movie and coming back. */
  readonly search = signal('');

  private readonly db = firestore;

  constructor() {
    void this.init();
  }

  go(view: View) {
    this.error.set('');
    this.view.set(view);
    // Keep the address bar on /kiki only while the sign-in page is showing.
    if ((view.name === 'signin') !== onSignInPath()) {
      history.replaceState(null, '', new URL(view.name === 'signin' ? 'kiki' : '.', document.baseURI));
    }
    window.scrollTo(0, 0);
  }

  byId(id: string): Movie | undefined {
    return this.movies().find((m) => m.id === id);
  }

  private async init() {
    const db = this.db;
    if (!db) {
      const saved = this.readLocal();
      const seed = await this.fetchSeed();
      const seedById = new Map(seed.map((m) => [m.id, m]));
      // Starter movies pick up details added to the seed file later; scores are never touched.
      const merged = saved.map((m) => {
        const s = seedById.get(m.id);
        return s
          ? {
              ...m,
              poster: m.poster || s.poster,
              released: m.released || s.released,
              overview: m.overview || s.overview,
              director: m.director || s.director,
              stars: m.stars.length ? m.stars : s.stars,
            }
          : m;
      });
      if (!this.localSeeded()) {
        const have = new Set(saved.map((m) => m.id));
        merged.push(...seed.filter((m) => !have.has(m.id)));
        if (seed.length) this.markSeeded();
      }
      if (seed.length) this.writeLocal(merged);
      else this.movies.set(merged);
      this.status.set('ready');
      return;
    }
    const timer = setTimeout(() => this.slow.set(true), 10_000);
    onSnapshot(
      collection(db, 'movies'),
      (snap) => {
        this.movies.set(snap.docs.map((d) => normalize(d.id, d.data())));
        this.status.set('ready');
        if (!snap.metadata.fromCache) {
          clearTimeout(timer);
          this.slow.set(false);
        }
      },
      () => {
        clearTimeout(timer);
        this.slow.set(false);
        if (this.status() === 'loading') this.status.set('unavailable');
        else this.error.set('Lost the connection to the ratings. Reopen the page to reconnect.');
      },
    );
  }

  /** Creates (id null) or replaces a movie. Resolves with its id, or null if the save failed. */
  async save(id: string | null, data: MovieData): Promise<string | null> {
    this.error.set('');
    const db = this.db;
    if (!db) {
      const newId = id ?? 'm' + Date.now().toString(36);
      const rest = this.movies().filter((m) => m.id !== newId);
      this.writeLocal([...rest, { ...data, id: newId }]);
      return newId;
    }
    try {
      return await this.withRetry(async () => {
        if (id) {
          await setDoc(doc(db, 'movies', id), data);
          return id;
        }
        return (await addDoc(collection(db, 'movies'), data)).id;
      });
    } catch (e: any) {
      this.fail(e, 'save');
      return null;
    }
  }

  async remove(id: string): Promise<boolean> {
    this.error.set('');
    const db = this.db;
    if (!db) {
      this.writeLocal(this.movies().filter((m) => m.id !== id));
      return true;
    }
    try {
      await this.withRetry(() => deleteDoc(doc(db, 'movies', id)));
      return true;
    } catch (e: any) {
      this.fail(e, 'delete');
      return false;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: any) {
      if (e?.code !== 'unavailable') throw e;
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
      return fn();
    }
  }

  private fail(e: any, verb: string) {
    if (e?.code === 'permission-denied' || e?.code === 'unauthenticated') {
      this.error.set('Only Kiki can change this list. Sign in again and retry.');
    } else if (e?.code === 'resource-exhausted') {
      this.error.set('The ratings database has hit its daily limit. Try again tomorrow.');
    } else {
      this.error.set(`Couldn’t ${verb}. Check your connection and try again.`);
    }
  }

  /** True once this browser has had the starter list, so deleting everything stays deleted. */
  private localSeeded(): boolean {
    try {
      return localStorage.getItem(SEEDED_KEY) !== null;
    } catch {
      return false;
    }
  }

  private markSeeded() {
    try {
      localStorage.setItem(SEEDED_KEY, '1');
    } catch {}
  }

  /** The starter list served beside the app when it runs outside claude.ai. */
  private async fetchSeed(): Promise<Movie[]> {
    try {
      const rows = await (await fetch('seed/movies.json')).json();
      return Array.isArray(rows) ? rows.map((r) => normalize(String(r.id), r)) : [];
    } catch {
      return [];
    }
  }

  private readLocal(): Movie[] {
    try {
      const rows = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
      return Array.isArray(rows) ? rows.map((r) => normalize(String(r.id), r)) : [];
    } catch {
      return [];
    }
  }

  private writeLocal(movies: Movie[]) {
    this.movies.set(movies);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(movies));
    } catch {
      this.error.set('This browser is blocking storage, so changes won’t be kept.');
    }
  }
}
