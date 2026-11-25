import { Injectable, signal } from '@angular/core';
import { Movie, MovieData, normalize } from './criteria';

declare global {
  interface Window {
    claude?: { use(name: string): Promise<any> };
  }
}

export type View = { name: 'list' } | { name: 'detail' | 'edit'; id: string };

const LOCAL_KEY = 'holiday-romance-movies';
const SEEDED_KEY = 'holiday-romance-seeded';

/**
 * Holds the movie list. On claude.ai it reads and writes the artifact's shared
 * database; anywhere else (ng serve) it falls back to this browser's storage.
 */
@Injectable({ providedIn: 'root' })
export class MovieStore {
  readonly movies = signal<Movie[]>([]);
  readonly status = signal<'loading' | 'ready' | 'unavailable'>('loading');
  readonly slow = signal(false);
  readonly canWrite = signal(true);
  readonly error = signal('');
  readonly view = signal<View>({ name: 'list' });
  /** True when hosted as a claude.ai artifact (no outside network access). */
  readonly hosted = typeof window !== 'undefined' && !!window.claude?.use;

  private db: any = null;

  constructor() {
    void this.init();
  }

  go(view: View) {
    this.error.set('');
    this.view.set(view);
    window.scrollTo(0, 0);
  }

  byId(id: string): Movie | undefined {
    return this.movies().find((m) => m.id === id);
  }

  private async init() {
    if (!this.hosted) {
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
    const [db, user] = await Promise.all([window.claude!.use('db'), window.claude!.use('user')]);
    if (!db) {
      this.status.set('unavailable');
      return;
    }
    this.db = db;
    if ((await user?.can?.('data.write')) === false) this.canWrite.set(false);

    const timer = setTimeout(() => this.slow.set(true), 10_000);
    db.collection('movies').onSnapshot(
      (snap: any) => {
        this.movies.set(snap.docs.map((d: any) => normalize(d.id, d.data())));
        this.status.set('ready');
        if (!snap.metadata?.fromCache) {
          clearTimeout(timer);
          this.slow.set(false);
        }
      },
      () => {
        clearTimeout(timer);
        this.slow.set(false);
        if (this.status() === 'loading') this.status.set('unavailable');
        else this.error.set('Lost the connection to your saved ratings. Reopen the page to reconnect.');
      },
    );
  }

  /** Creates (id null) or replaces a movie. Resolves with its id, or null if the save failed. */
  async save(id: string | null, data: MovieData): Promise<string | null> {
    this.error.set('');
    if (!this.db) {
      const newId = id ?? 'm' + Date.now().toString(36);
      const rest = this.movies().filter((m) => m.id !== newId);
      this.writeLocal([...rest, { ...data, id: newId }]);
      return newId;
    }
    try {
      return await this.withRetry(async () => {
        if (id) {
          await this.db.doc('movies/' + id).set(data);
          return id;
        }
        return (await this.db.collection('movies').add(data)).id as string;
      });
    } catch (e: any) {
      this.fail(e, 'save');
      return null;
    }
  }

  async remove(id: string): Promise<boolean> {
    this.error.set('');
    if (!this.db) {
      this.writeLocal(this.movies().filter((m) => m.id !== id));
      return true;
    }
    try {
      await this.withRetry(() => this.db.doc('movies/' + id).delete());
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
    if (e?.code === 'invalid_argument' || e?.code === 'not_granted' || e?.code === 'revoked') {
      this.canWrite.set(false);
      this.error.set('You can view this list but you don’t have access to change it.');
    } else if (e?.code === 'quota_exceeded') {
      this.error.set('Storage is full. Delete a movie to make room.');
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
