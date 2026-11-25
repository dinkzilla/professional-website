import { Injectable, inject, signal } from '@angular/core';
import { MovieStore } from './movie-store';

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
 * Movie search backed by The Movie Database (TMDB). Needs a free TMDB API key
 * in public/tmdb-key.txt. Not available on claude.ai hosting, which blocks
 * requests to outside services.
 */
@Injectable({ providedIn: 'root' })
export class MovieLookup {
  private store = inject(MovieStore);
  readonly supported = !this.store.hosted;
  readonly key = signal('');

  constructor() {
    if (this.supported) void this.loadKey();
  }

  get ready(): boolean {
    return this.supported && !!this.key();
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

  /** Reads the key from public/tmdb-key.txt (git-ignored); search stays off without it. */
  private async loadKey() {
    try {
      const res = await fetch('tmdb-key.txt');
      const text = res.ok ? (await res.text()).trim() : '';
      if (/^[\w.-]{16,}$/.test(text)) this.key.set(text);
    } catch {}
  }
}
