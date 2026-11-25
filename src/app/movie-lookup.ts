import { Injectable, effect, inject, signal } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore';
import { AuthService } from './auth';
import { firestore } from './firebase';

export interface LookupHit {
  tmdbId: number;
  title: string;
  year: string;
  released: string;
  overview: string;
  poster: string;
}

export interface LookupDetails {
  network: string;
  director: string;
  stars: string[];
}

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w342';

/**
 * Movie search backed by The Movie Database (TMDB), for the editor only.
 * With Firebase set up, the TMDB API key is the "key" field of the Firestore
 * document private/tmdb, which only the signed-in editor can read. Without
 * Firebase it comes from public/tmdb-key.txt (git-ignored, never deployed).
 */
@Injectable({ providedIn: 'root' })
export class MovieLookup {
  private readonly auth = inject(AuthService);
  readonly key = signal('');

  constructor() {
    if (!firestore) void this.loadKeyFile();
    else effect(() => void this.loadKeyDoc(this.auth.email()));
  }

  get ready(): boolean {
    return !!this.key();
  }

  async search(query: string, signal: AbortSignal): Promise<LookupHit[]> {
    const url = `${API}/search/movie?api_key=${encodeURIComponent(this.key())}&query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(res.status === 401 ? 'key' : 'network');
    const body = await res.json();
    return (body.results ?? []).slice(0, 6).map((r: any) => ({
      tmdbId: r.id,
      title: String(r.title ?? ''),
      year: String(r.release_date ?? '').slice(0, 4),
      released: String(r.release_date ?? ''),
      overview: String(r.overview ?? ''),
      poster: r.poster_path ? IMG + r.poster_path : '',
    }));
  }

  /** Network (best guess from the production companies), director and the two leads. */
  async details(tmdbId: number): Promise<LookupDetails> {
    const empty: LookupDetails = { network: '', director: '', stars: [] };
    try {
      const res = await fetch(
        `${API}/movie/${tmdbId}?api_key=${encodeURIComponent(this.key())}&append_to_response=credits`,
      );
      if (!res.ok) return empty;
      const body = await res.json();
      const companies: string[] = (body.production_companies ?? []).map((c: any) => String(c.name));
      const network =
        ['Hallmark', 'Netflix', 'Lifetime', 'Great American'].find((known) =>
          companies.some((n) => n.toLowerCase().includes(known.toLowerCase())),
        ) ?? '';
      const director = (body.credits?.crew ?? [])
        .filter((c: any) => c.job === 'Director')
        .map((c: any) => String(c.name))
        .join(', ');
      const stars = [...(body.credits?.cast ?? [])]
        .sort((x: any, y: any) => (x.order ?? 99) - (y.order ?? 99))
        .slice(0, 2)
        .map((c: any) => String(c.name));
      return { network, director, stars };
    } catch {
      return empty;
    }
  }

  private async loadKeyDoc(email: string) {
    if (!email) {
      this.key.set('');
      return;
    }
    try {
      const snap = await getDoc(doc(firestore!, 'private/tmdb'));
      this.setKey(String(snap.data()?.['key'] ?? ''));
    } catch {}
  }

  private async loadKeyFile() {
    try {
      const res = await fetch('tmdb-key.txt');
      this.setKey(res.ok ? await res.text() : '');
    } catch {}
  }

  private setKey(text: string) {
    this.key.set(/^[\w.-]{16,}$/.test(text.trim()) ? text.trim() : '');
  }
}
