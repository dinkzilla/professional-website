import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { CRITERIA, Movie, answered, blankMovie, fmt, fmtDate, matchesSearch, ranked, total, lastWatched } from './criteria';
import { LookupHit, MovieLookup } from './movie-lookup';
import { MovieStore } from './movie-store';
import { Poster } from './poster';

@Component({
  selector: 'app-movie-list',
  imports: [NgTemplateOutlet, Poster],
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

      <ng-template #sortChips>
        <div class="chips sort" role="group" aria-label="Sort">
          <button type="button" class="chip" [class.on]="sort() === 'score'" (click)="sort.set('score')">Top score</button>
          <button type="button" class="chip" [class.on]="sort() === 'date'" (click)="sort.set('date')">Latest watched</button>
        </div>
      </ng-template>

      <!-- Without the section headings, the sort sits across from the filter. -->
      @let sortBeside = !store.canWrite() && rated().length > 0;
      @if (networks().length > 1 || sortBeside) {
        <div class="section-head">
          @if (networks().length > 1) {
            <div class="chips" role="group" aria-label="Filter by network">
              <button type="button" class="chip" [class.on]="!network()" (click)="network.set('')">All</button>
              @for (n of networks(); track n) {
                <button type="button" class="chip" [class.on]="network() === n" (click)="network.set(n)">{{ n }}</button>
              }
            </div>
          }
          @if (sortBeside) {
            <ng-container [ngTemplateOutlet]="sortChips" />
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
          @if (store.canWrite()) {
            <div class="section-head">
              <h2>Rated <span class="count">{{ rated().length }}</span></h2>
              <ng-container [ngTemplateOutlet]="sortChips" />
            </div>
          }
          <ol class="cards">
            @for (r of rated(); track r.movie.id) {
              @let m = r.movie;
              <li>
                <button type="button" class="card" [class.champ]="sort() === 'score' && r.rank === 1" (click)="open(m)">
                  @if (sort() === 'score') {
                    <span class="rank">{{ r.rank }}</span>
                  }
                  <app-poster [url]="m.poster" [title]="m.title" />
                  <span class="card-text">
                    @if (sort() === 'score' && r.rank === 1) {
                      <span class="crown">★ Top of the tree</span>
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
