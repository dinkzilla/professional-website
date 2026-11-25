import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { CRITERIA, Movie, answered, blankMovie, fmt, matchesSearch, ranked, total, lastWatched } from './criteria';
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
            [placeholder]="lookup.ready ? 'Look up a title to add' : 'Movie title'"
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
      <p class="empty">The ratings can’t be reached right now. Check your connection and reload the page.</p>
    } @else if (!listed().length) {
      <p class="empty">{{ store.canWrite() ? 'No movies yet. Add a title above, then tap it to rate it.' : 'No movies have been rated yet.' }}</p>
    } @else {
      @if (store.slow()) {
        <p class="note">This list may be out of date. Still reconnecting…</p>
      }

      <div class="find" role="search">
        <div class="ice">
          <input
            #find
            type="search"
            autocomplete="off"
            enterkeyhint="search"
            placeholder="Search Movies"
            aria-label="Search Movies"
            [value]="store.search()"
            (input)="store.search.set(find.value)"
            (keydown.enter)="find.blur()"
          />
          @if (store.search()) {
            <button type="button" class="clear" (click)="store.search.set(''); find.focus()">Clear</button>
          }
        </div>
        <p class="muted" role="status">{{ found() }}</p>
      </div>

      @if (networks().length > 1 || rated().length) {
        <div class="section-head">
          @if (networks().length > 1) {
            <div class="tray" role="group" aria-labelledby="filter-label">
              <span class="tray-tag" id="filter-label">Filter</span>
              <div class="tray-keys">
                <button type="button" class="chip" [class.on]="!network()" [attr.aria-pressed]="!network()" (click)="network.set('')">All</button>
                @for (n of networks(); track n) {
                  <button type="button" class="chip" [class.on]="network() === n" [attr.aria-pressed]="network() === n" (click)="network.set(n)">{{ n }}</button>
                }
              </div>
            </div>
          }
          @if (rated().length) {
            <div class="tray sort" role="group" aria-labelledby="sort-label">
              <span class="tray-tag" id="sort-label">Sort</span>
              <div class="tray-keys">
                <button type="button" class="chip" [class.on]="sort() === 'score'" [attr.aria-pressed]="sort() === 'score'" (click)="sort.set('score')">Top score</button>
                <button type="button" class="chip" [class.on]="sort() === 'date'" [attr.aria-pressed]="sort() === 'date'" (click)="sort.set('date')">Latest</button>
                <button type="button" class="chip" [class.on]="sort() === 'watches'" [attr.aria-pressed]="sort() === 'watches'" (click)="sort.set('watches')">Most watched</button>
              </div>
            </div>
          }
        </div>
      }

      @if (toRate().length) {
        <section>
          <h2>To Rate <span class="count">{{ toRate().length }}</span></h2>
          <ul class="cards">
            @for (m of toRate(); track m.id) {
              <li>
                <button type="button" class="card" (click)="open(m)">
                  <app-poster [url]="m.poster" [title]="m.title" [coal]="!m.recommend" />
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
          @if (store.canWrite()) {
            <h2>Rated <span class="count">{{ rated().length }}</span></h2>
          }
          <ol class="cards">
            @for (r of rated(); track r.movie.id) {
              @let m = r.movie;
              <li>
                <button type="button" class="card" [class.champ]="sort() === 'score' && r.rank === 1" (click)="open(m)">
                  @if (sort() === 'score') {
                    <span class="rank">{{ r.rank }}</span>
                  }
                  <app-poster [url]="m.poster" [title]="m.title" [coal]="!m.recommend" />
                  <span class="card-text">
                    @if (sort() === 'score' && r.rank === 1) {
                      <span class="crown">★ Top of the tree</span>
                    }
                    <strong>{{ m.title }}</strong>
                    <span class="muted">{{ meta(m) }}</span>
                  </span>
                  @let angel = sort() === 'score' && r.rank === 1 && m.recommend;
                  <span class="score" [class.angel]="angel" [class.broken]="!m.recommend">
                    @if (angel) {
                      <svg class="topper" viewBox="0 0 100 116" aria-hidden="true">
                        <defs>
                          <linearGradient id="topper-gown" x1="0" x2="1">
                            <stop offset="0" stop-color="#f0b429" />
                            <stop offset="0.4" stop-color="#ffe9a3" />
                            <stop offset="1" stop-color="#e09a1a" />
                          </linearGradient>
                        </defs>
                        <g fill="#fffdf6" stroke="#c9982a" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
                          <path d="M44 48C34 26 16 17 4 20C1 30 3 38 8 43C5 49 8 56 14 59C14 65 20 70 27 70C35 70 41 62 44 54Z" />
                          <path d="M56 48C66 26 84 17 96 20C99 30 97 38 92 43C95 49 92 56 86 59C86 65 80 70 73 70C65 70 59 62 56 54Z" />
                          <path fill="none" d="M8 43C18 46 30 47 41 50M14 59C23 60 33 58 41 54M92 43C82 46 70 47 59 50M86 59C77 60 67 58 59 54" />
                        </g>
                        <path
                          d="M42 46Q50 41 58 46C62 56 86 66 90 106Q81.5 114 75.3 108.5Q69 116 62.7 110Q56.3 117 50 110.5Q43.7 117 37.3 110Q31 116 24.7 108.5Q18.5 114 10 106C14 66 38 56 42 46Z"
                          fill="url(#topper-gown)"
                          stroke="#a8770f"
                          stroke-width="1.6"
                          stroke-linejoin="round"
                        />
                        <g stroke="#a8770f" stroke-width="1.4" stroke-linejoin="round">
                          <path fill="#ffe9a3" d="M43 46C36 48 32 56 32 63Q37 67 41 64L50 59L48 54L42 56Z" />
                          <path fill="#ffe9a3" d="M57 46C64 48 68 56 68 63Q63 67 59 64L50 59L52 54L58 56Z" />
                        </g>
                        <ellipse cx="50" cy="56.5" rx="3.6" ry="4" fill="#f3c19c" />
                        <path fill="#7a4522" d="M50 17C39 17 35 25 36 33C36 39 33 42 35 46Q42 48 50 46Q58 48 65 46C67 42 64 39 64 33C65 25 61 17 50 17Z" />
                        <ellipse cx="50" cy="33" rx="10.5" ry="11.5" fill="#f3c19c" />
                        <path fill="#7a4522" d="M39 32C40 24 45 20 50 20C55 20 60 24 61 32C57 30 53 28 50 24C47 28 43 30 39 32Z" />
                        <g fill="none" stroke="#3b1030" stroke-width="1.4" stroke-linecap="round">
                          <path d="M43.5 34Q45.2 35.8 47 34M53 34Q54.8 35.8 56.5 34M47 39Q50 41.5 53 39" />
                        </g>
                        <g fill="#f2798f" opacity="0.6">
                          <circle cx="43" cy="37.5" r="1.8" />
                          <circle cx="57" cy="37.5" r="1.8" />
                        </g>
                        <ellipse cx="50" cy="10" rx="14" ry="4.5" fill="none" stroke="#c9982a" stroke-width="4" />
                        <ellipse cx="50" cy="10" rx="14" ry="4.5" fill="none" stroke="#ffd84a" stroke-width="2.2" />
                      </svg>
                    }
                    @if (m.recommend) {
                      {{ score(m) }}<small>pts</small>
                    } @else {
                      <!-- Each half is the whole ball cut off along the break. The points are on the lower one. -->
                      <span class="half top"><span class="glass"></span></span>
                      <span class="half bottom">
                        <span class="glass">{{ score(m) }}<small>pts</small></span>
                      </span>
                      <span class="sr-only">, not recommended</span>
                    }
                  </span>
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

  protected readonly sort = signal<'score' | 'date' | 'watches'>('score');
  /** The network picked as a filter, dropped if signing out takes its chip away. */
  protected readonly network = linkedSignal<string[], string>({
    source: () => this.networks(),
    computation: (networks, prev) => (prev && networks.length > 1 && networks.includes(prev.value) ? prev.value : ''),
  });
  protected readonly query = signal('');
  protected readonly hits = signal<LookupHit[]>([]);
  protected readonly searchNote = signal('');
  protected readonly adding = signal(false);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private abort: AbortController | undefined;

  /** Every movie for the editor; everyone else only sees the fully rated ones. */
  protected readonly listed = computed(() =>
    this.store.canWrite() ? this.store.movies() : this.store.movies().filter((m) => answered(m.scores) === CRITERIA.length),
  );

  protected readonly networks = computed(() =>
    [...new Set(this.listed().map((m) => m.network).filter(Boolean))].sort(),
  );

  private readonly visible = computed(() => {
    const n = this.network();
    return this.listed().filter((m) => !n || m.network === n);
  });

  protected readonly toRate = computed(() =>
    this.visible()
      .filter((m) => answered(m.scores) < CRITERIA.length && matchesSearch(m, this.store.search()))
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  );

  protected readonly rated = computed(() => {
    const done = ranked(this.visible());
    if (this.sort() === 'date') done.sort((a, b) => (lastWatched(b) || '0').localeCompare(lastWatched(a) || '0'));
    // A rated movie with no dates was still watched once. Movies watched equally often stay in score order.
    if (this.sort() === 'watches') done.sort((a, b) => Math.max(1, b.watched.length) - Math.max(1, a.watched.length));
    // Ranked before searching, so a movie found by search keeps its place in the full list.
    return done.map((movie, i) => ({ movie, rank: i + 1 })).filter((r) => matchesSearch(r.movie, this.store.search()));
  });

  /** How many movies the search turned up, or '' when nothing is being searched for. */
  protected readonly found = computed(() => {
    const q = this.store.search().trim();
    if (!q) return '';
    const n = this.toRate().length + this.rated().length;
    const kind = this.network() ? this.network() + ' ' : '';
    if (!n) return `No ${kind}movies match “${q}”.`;
    return n === 1 ? `1 ${kind}movie found` : `${n} ${kind}movies found`;
  });

  protected score(m: Movie) {
    return fmt(total(m.scores));
  }

  protected progress(m: Movie) {
    const n = answered(m.scores);
    return n ? `${n} of ${CRITERIA.length} scored · ${fmt(total(m.scores))} pts so far` : 'Not rated yet';
  }

  protected meta(m: Movie) {
    const times = m.watched.length > 1 ? ` (${m.watched.length} times)` : '';
    // Viewers are saved with Kiki first; here it reads "Matt and Kiki".
    const watchedBy = m.viewers.length ? `Watched by: ${[...m.viewers].reverse().join(' and ')}${times}` : '';
    return [m.network, watchedBy].filter(Boolean).join(' · ');
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
            ? 'Movie search rejected the TMDB key. Tap Add to use the title as typed.'
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
