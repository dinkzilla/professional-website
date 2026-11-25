import { Component, computed, inject, signal } from '@angular/core';
import { CRITERIA, Movie, answered, blankMovie, fmt, fmtDate, total, lastWatched } from './criteria';
import { LookupHit, MovieLookup } from './movie-lookup';
import { MovieStore } from './movie-store';
import { Poster } from './poster';

@Component({
  selector: 'app-movie-list',
  imports: [Poster],
  template: `
    @if (store.canWrite()) {
      <form class="add" (submit)="addTyped($event)">
        <label for="new-title">Add a movie</label>
        <div class="add-row">
          <input
            id="new-title"
            type="text"
            autocomplete="off"
            enterkeyhint="done"
            [placeholder]="lookup.ready ? 'Search by title' : 'Movie title'"
            [value]="query()"
            (input)="onQuery($any($event.target).value)"
          />
          <button class="btn primary" type="submit" [disabled]="!query().trim() || adding()">Add</button>
        </div>
        @if (searchNote()) {
          <p class="note">{{ searchNote() }}</p>
        }
        @if (hits().length) {
          <ul class="hits">
            @for (h of hits(); track h.tmdbId) {
              <li>
                <button type="button" class="hit" (click)="addHit(h)" [disabled]="adding()">
                  <app-poster [url]="h.poster" [title]="h.title" />
                  <span class="hit-text">
                    <strong>{{ h.title }}</strong>
                    <span class="muted">{{ h.year || 'Year unknown' }}</span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </form>
    }

    @if (store.status() === 'loading') {
      <p class="empty">
        {{ store.slow() ? 'Still trying to reach your saved ratings…' : 'Loading your ratings…' }}
      </p>
    } @else if (store.status() === 'unavailable') {
      <p class="empty">Your saved ratings can’t be reached from this view. Open the page while signed in to Claude.</p>
    } @else if (!store.movies().length) {
      <p class="empty">No movies yet. Add a title above, then tap it to rate it.</p>
    } @else {
      @if (store.slow()) {
        <p class="note">This list may be out of date. Still reconnecting…</p>
      }

      @if (networks().length > 1) {
        <div class="chips" role="group" aria-label="Filter by network">
          <button type="button" class="chip" [class.on]="!network()" (click)="network.set('')">All</button>
          @for (n of networks(); track n) {
            <button type="button" class="chip" [class.on]="network() === n" (click)="network.set(n)">{{ n }}</button>
          }
        </div>
      }

      @if (toRate().length) {
        <section>
          <h2>To rate <span class="count">{{ toRate().length }}</span></h2>
          <ul class="cards">
            @for (m of toRate(); track m.id) {
              <li>
                <button type="button" class="card" (click)="open(m)">
                  <app-poster [url]="m.poster" [title]="m.title" />
                  <span class="card-text">
                    <strong>{{ m.title }}</strong>
                    <span class="muted">{{ meta(m) }}</span>
                    <span class="tag">{{ progress(m) }}</span>
                  </span>
                </button>
              </li>
            }
          </ul>
        </section>
      }

      @if (rated().length) {
        <section>
          <div class="section-head">
            <h2>Rated <span class="count">{{ rated().length }}</span></h2>
            <div class="chips" role="group" aria-label="Sort">
              <button type="button" class="chip" [class.on]="sort() === 'score'" (click)="sort.set('score')">Top score</button>
              <button type="button" class="chip" [class.on]="sort() === 'date'" (click)="sort.set('date')">Latest watched</button>
            </div>
          </div>
          <ol class="cards">
            @for (m of rated(); track m.id; let i = $index) {
              <li>
                <button type="button" class="card" (click)="open(m)">
                  <app-poster [url]="m.poster" [title]="m.title" />
                  <span class="card-text">
                    @if (sort() === 'score') {
                      <span class="rank">{{ i === 0 ? '★ Top of the tree' : 'No. ' + (i + 1) }}</span>
                    }
                    <strong>{{ m.title }}</strong>
                    <span class="muted">{{ meta(m) }}</span>
                  </span>
                  <span class="score">{{ score(m) }}<small>pts</small></span>
                </button>
              </li>
            }
          </ol>
        </section>
      }
    }
  `,
})
export class MovieList {
  protected readonly store = inject(MovieStore);
  protected readonly lookup = inject(MovieLookup);

  protected readonly sort = signal<'score' | 'date'>('score');
  protected readonly network = signal('');
  protected readonly query = signal('');
  protected readonly hits = signal<LookupHit[]>([]);
  protected readonly searchNote = signal('');
  protected readonly adding = signal(false);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private abort: AbortController | undefined;

  protected readonly networks = computed(() =>
    [...new Set(this.store.movies().map((m) => m.network).filter(Boolean))].sort(),
  );

  private readonly visible = computed(() => {
    const n = this.network();
    return this.store.movies().filter((m) => !n || m.network === n);
  });

  protected readonly toRate = computed(() =>
    this.visible()
      .filter((m) => answered(m.scores) < CRITERIA.length)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  );

  protected readonly rated = computed(() => {
    const done = this.visible().filter((m) => answered(m.scores) === CRITERIA.length);
    return this.sort() === 'score'
      ? done.sort((a, b) => total(b.scores) - total(a.scores) || a.title.localeCompare(b.title))
      : done.sort((a, b) => (lastWatched(b) || '0').localeCompare(lastWatched(a) || '0'));
  });

  protected score(m: Movie) {
    return fmt(total(m.scores));
  }

  protected progress(m: Movie) {
    const n = answered(m.scores);
    return n ? `${n} of ${CRITERIA.length} scored · ${fmt(total(m.scores))} pts so far` : 'Not rated yet';
  }

  protected meta(m: Movie) {
    return [m.network, fmtDate(lastWatched(m)) + (m.watched.length > 1 ? ` (watched ${m.watched.length} times)` : ''), m.viewers.join(' and ')].filter(Boolean).join(' · ');
  }

  protected open(m: Movie) {
    const unrated = answered(m.scores) === 0 && this.store.canWrite();
    this.store.go({ name: unrated ? 'edit' : 'detail', id: m.id });
  }

  protected onQuery(value: string) {
    this.query.set(value);
    clearTimeout(this.timer);
    this.abort?.abort();
    this.searchNote.set('');
    const q = value.trim();
    if (!this.lookup.ready || q.length < 3) {
      this.hits.set([]);
      return;
    }
    this.timer = setTimeout(async () => {
      this.abort = new AbortController();
      try {
        const hits = await this.lookup.search(q, this.abort.signal);
        this.hits.set(hits);
        this.searchNote.set(hits.length ? '' : 'No matches. Tap Add to use the title as typed.');
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        this.hits.set([]);
        this.searchNote.set(
          e?.message === 'key'
            ? 'Movie search rejected the TMDB key in public/tmdb-key.txt. Tap Add to use the title as typed.'
            : 'Movie search isn’t reachable right now. Tap Add to use the title as typed.',
        );
      }
    }, 350);
  }

  protected async addTyped(event: Event) {
    event.preventDefault();
    const title = this.query().trim();
    if (title) await this.create(blankMovie(title));
  }

  protected async addHit(h: LookupHit) {
    this.adding.set(true);
    const details = await this.lookup.details(h.tmdbId);
    await this.create({
      ...blankMovie(h.title),
      ...details,
      poster: h.poster,
      released: h.released,
      overview: h.overview,
    });
  }

  private async create(data: ReturnType<typeof blankMovie>) {
    this.adding.set(true);
    const id = await this.store.save(null, data);
    this.adding.set(false);
    if (id) {
      this.query.set('');
      this.hits.set([]);
      this.searchNote.set('');
    }
  }
}
