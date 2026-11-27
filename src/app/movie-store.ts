import { Injectable, computed, inject, signal } from '@angular/core';
import { collection, collectionGroup, deleteDoc, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { AuthService } from './auth';
import { Movie, MovieData, normalize } from './criteria';
import { firestore } from './firebase';
import { ReviewStore } from './review-store';
import { freeSlug } from './slug';
import { View, urlFor, viewFor } from './routes';

const LOCAL_KEY = 'holiday-romance-movies';
const SEEDED_KEY = 'holiday-romance-seeded';
/** The last list received from Firestore, shown on the next visit until the live one arrives. */
const SNAPSHOT_KEY = 'yule-swoon-movies';
/** How long a save waits to hear from the server before carrying on without it, in milliseconds. */
const SYNC_WAIT = 2000;

function viewFromAddress(): View {
  return viewFor(location.pathname, document.baseURI);
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
  private readonly reviews = inject(ReviewStore);

  private readonly saved = signal<Movie[]>([]);
  /** What's been changed while previewing the editor's side: each movie by id, or null if deleted. Never saved anywhere. */
  private readonly pretend = signal<ReadonlyMap<string, Movie | null>>(new Map());
  readonly movies = computed<Movie[]>(() => {
    const saved = this.saved();
    if (!this.auth.previewing()) return saved;
    const pretend = this.pretend();
    const ids = new Set(saved.map((m) => m.id));
    return [
      ...saved.map((m) => (pretend.has(m.id) ? pretend.get(m.id)! : m)),
      ...[...pretend].filter(([id]) => !ids.has(id)).map(([, m]) => m),
    ].filter((m): m is Movie => !!m);
  });
  readonly status = signal<'loading' | 'ready' | 'unavailable'>('loading');
  readonly slow = signal(false);
  /** True until the live list arrives. Until then, any list showing is one remembered from the last visit. */
  readonly stale = signal(!!firestore);
  /** True when changes have been waiting a while to reach the server. They are safe on this device meanwhile. */
  readonly unsynced = signal(false);
  private syncTimer: ReturnType<typeof setTimeout> | undefined;
  /** Whether to show the add, edit and delete controls. Never on a remembered list: saving an out-of-date movie would undo newer changes. */
  readonly canWrite = computed(() => this.auth.isEditor() && !this.stale());
  readonly error = signal('');
  readonly view = signal<View>(viewFromAddress());

  /** What's typed in the list's search box, kept here so it survives opening a movie and coming back. */
  readonly search = signal('');
  /** How the list is sorted, and the network it's filtered to or ''. Kept here for the same reason. */
  readonly sort = signal<'score' | 'date' | 'watches'>('score');
  readonly network = signal('');

  /** The movies with a finished, published audio review, by id. Empty without Firebase. */
  readonly hasAudio = signal<ReadonlySet<string>>(new Set());

  private readonly db = firestore;

  constructor() {
    // The browser's back and forward buttons.
    window.addEventListener('popstate', () => {
      this.error.set('');
      this.view.set(viewFromAddress());
    });
    void this.init();
  }

  /** Shows a view and puts its address in the address bar. With replace, Back skips the view being left. */
  go(view: View, replace = this.view().name === 'signin') {
    this.error.set('');
    this.view.set(view);
    const url = urlFor(view, document.baseURI);
    if (url !== location.pathname) {
      if (replace) history.replaceState(null, '', url);
      else history.pushState(null, '', url);
    }
    window.scrollTo(0, 0);
  }

  byId(id: string): Movie | undefined {
    return this.movies().find((m) => m.id === id);
  }

  private async init() {
    const db = this.db;
    if (!db) {
      const saved = this.readMovies(LOCAL_KEY);
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
      else this.saved.set(merged);
      this.status.set('ready');
      return;
    }
    // Only finished episodes are public, and rules aren't filters, so the query has to ask for just those.
    // Without them the badges just don't show: they're not worth an error.
    onSnapshot(
      query(collectionGroup(db, 'published'), where('status', '==', 'done')),
      (snap) => this.hasAudio.set(new Set(snap.docs.map((d) => d.ref.parent.parent!.id))),
      () => {},
    );
    const remembered = this.readMovies(SNAPSHOT_KEY);
    if (remembered.length) {
      this.saved.set(remembered);
      this.status.set('ready');
    }
    const timer = setTimeout(() => this.slow.set(true), 10_000);
    onSnapshot(
      collection(db, 'movies'),
      // Otherwise the server confirming a list that hasn't changed isn't reported, nor a save reaching it.
      { includeMetadataChanges: true },
      (snap) => {
        this.watchSync(snap.metadata.hasPendingWrites);
        if (!snap.metadata.fromCache) this.stale.set(false);
        // Offline, Firestore reports an empty list of its own, which doesn't mean there are no movies.
        if (this.stale() && snap.empty) return;
        this.saved.set(snap.docs.map((d) => normalize(d.id, d.data())));
        this.status.set('ready');
        if (!snap.metadata.fromCache) {
          clearTimeout(timer);
          this.slow.set(false);
          this.remember(this.saved());
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

  /** Says so if changes are still waiting to reach the server after a while. */
  private watchSync(pending: boolean) {
    if (!pending) {
      clearTimeout(this.syncTimer);
      this.syncTimer = undefined;
      this.unsynced.set(false);
    } else if (this.syncTimer === undefined) {
      this.syncTimer = setTimeout(() => this.unsynced.set(true), SYNC_WAIT);
    }
  }

  /**
   * Creates (id null) or replaces a movie. Resolves with its id, or null if the save was refused.
   * Offline, Firestore keeps a change and sends it later rather than failing, so this doesn't wait
   * long for the server: unsynced says when a change hasn't got there. Calls confirmed once it has.
   */
  async save(id: string | null, data: MovieData, confirmed?: () => void): Promise<string | null> {
    this.error.set('');
    const db = this.db;
    // Until the list has arrived, a new movie's id could be one that's already taken, and saving would replace that movie.
    if (!id && db && !this.auth.previewing() && this.status() !== 'ready') {
      this.error.set('The list is still loading. Try again in a moment.');
      return null;
    }
    // A new movie's id is made from its title, so its address and folders are readable. It stays the same if the title changes.
    const newId = id ?? freeSlug(data.title, this.movies().map((m) => m.id));
    if (!db) {
      const rest = this.movies().filter((m) => m.id !== newId);
      this.writeLocal([...rest, { ...data, id: newId }]);
      confirmed?.();
      return newId;
    }
    if (this.auth.previewing()) {
      this.setPretend(newId, { ...data, id: newId });
      confirmed?.();
      return newId;
    }
    const ref = doc(db, 'movies', newId);
    const write = setDoc(ref, data).then(
      () => {
        confirmed?.();
        return true;
      },
      (e: any) => {
        // However long it took to be refused, and whatever is showing by then.
        this.fail(e, `save “${data.title}”`);
        return false;
      },
    );
    const wait = new Promise<boolean>((resolve) => setTimeout(() => resolve(true), SYNC_WAIT));
    return (await Promise.race([write, wait])) ? ref.id : null;
  }

  /** Deletes a movie and its audio reviews. Resolves false if that failed. */
  async remove(id: string): Promise<boolean> {
    this.error.set('');
    const db = this.db;
    if (this.reviews.saving(id)) {
      this.error.set('One of this movie’s recordings is still being saved. Try again when it’s done.');
      return false;
    }
    try {
      await this.withRetry(() => this.reviews.removeAll(id));
    } catch (e: any) {
      this.fail(e, 'delete');
      return false;
    }
    if (!db) {
      this.writeLocal(this.movies().filter((m) => m.id !== id));
      return true;
    }
    if (this.auth.previewing()) {
      this.setPretend(id, null);
      return true;
    }
    try {
      await this.withRetry(() => deleteDoc(doc(db, 'movies', id)));
      this.reviews.forget(id);
      return true;
    } catch (e: any) {
      this.fail(e, 'delete');
      return false;
    }
  }

  private setPretend(id: string, movie: Movie | null) {
    this.pretend.update((p) => new Map(p).set(id, movie));
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
    if (['permission-denied', 'unauthenticated', 'storage/unauthorized', 'storage/unauthenticated'].includes(e?.code)) {
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

  /** The starter list served beside the app. */
  private async fetchSeed(): Promise<Movie[]> {
    try {
      const rows = await (await fetch('seed/movies.json')).json();
      return Array.isArray(rows) ? rows.map((r) => normalize(String(r.id), r)) : [];
    } catch {
      return [];
    }
  }

  private remember(movies: Movie[]) {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(movies));
    } catch {}
  }

  private readMovies(key: string): Movie[] {
    try {
      const rows = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(rows) ? rows.map((r) => normalize(String(r.id), r)) : [];
    } catch {
      return [];
    }
  }

  private writeLocal(movies: Movie[]) {
    this.saved.set(movies);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(movies));
    } catch {
      this.error.set('This browser is blocking storage, so changes won’t be kept.');
    }
  }
}
