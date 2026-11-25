import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { AuthService } from './auth';
import { CRITERIA, Criterion, answered, fmt, fmtDate, groupStart, ranked, total } from './criteria';
import { MovieStore } from './movie-store';
import { Poster } from './poster';
import { RatingIcons } from './rating-icons';
import { Thermometer } from './thermometer';

@Component({
  selector: 'app-movie-detail',
  imports: [Poster, RatingIcons, Thermometer],
  template: `
    @if (movie(); as m) {
      <article class="detail">
        <header class="detail-head">
          <app-poster [url]="m.poster" [title]="m.title" />
          <h2>{{ m.title }}</h2>
          <dl class="facts">
            <div>
              <dt>Total Score</dt>
              <dd class="big-stat">{{ score() }} <small>{{ complete() ? 'pts' : 'pts so far' }}</small></dd>
            </div>
            <div>
              <dt>Current Ranking</dt>
              @if (ranking(); as r) {
                <dd class="big-stat place" [class.first]="r.place === 1">#{{ r.place }} <small>of {{ r.of }}</small></dd>
              } @else {
                <dd class="unset">Not ranked yet</dd>
              }
            </div>
            @if (m.viewers.length) {
              <div><dt>Watched By</dt><dd>{{ m.viewers.join(' and ') }}</dd></div>
            }
            @if (m.watched.length) {
              <div>
                <dt>Watched On</dt>
                <dd>
                  <ul class="dates">
                    @for (w of m.watched; track w) {
                      <li>{{ date(w) }}</li>
                    }
                  </ul>
                </dd>
              </div>
            }
          </dl>
          @if (!m.recommend) {
            <p class="stamp"><span>Not <b>Recommended</b></span></p>
          }
        </header>

        @if (m.network || m.director || m.stars.length || m.released) {
          <dl class="credits">
            @if (m.stars.length) {
              <div><dt>Starring</dt><dd>{{ m.stars.join(' and ') }}</dd></div>
            }
            @if (m.director) {
              <div><dt>Director</dt><dd>{{ m.director }}</dd></div>
            }
            @if (m.released) {
              <div><dt>Released</dt><dd>{{ date(m.released) }}</dd></div>
            }
            @if (m.network) {
              <div><dt>Network</dt><dd>{{ m.network }}</dd></div>
            }
          </dl>
        }

        @if (m.overview) {
          <p class="overview">{{ m.overview }}</p>
        }

        <h3 class="scorecard-title">Kiki’s Scorecard</h3>
        <dl class="breakdown">
          @for (c of criteria; track c.key) {
            @if (groupStart($index); as g) {
              <div class="row group-head"><dt>{{ g }}</dt></div>
            }
            <div class="row" [class.sub]="c.bonusOf" [class.grouped]="c.group" [class.thermo-row]="c.kind === 'choice' && m.scores[c.key] != null">
              <dt>{{ c.label }}</dt>
              @if (c.kind === 'choice' && m.scores[c.key] != null) {
                <dd><app-thermometer [options]="c.options ?? []" [value]="m.scores[c.key]!" /></dd>
              } @else if (m.scores[c.key] != null && (c.kind === 'scale' || (['kisses', 'couples', 'accents', 'celebrity', 'saved', 'soundtrack', 'better'].includes(c.key) && m.scores[c.key]! > 0))) {
                <dd class="canes"><app-rating-icons [criterion]="c.key" [value]="m.scores[c.key]!" /></dd>
              } @else {
                <dd [class.unset]="m.scores[c.key] == null">{{ show(c, m.scores[c.key]) }}</dd>
              }
            </div>
          }
        </dl>

        @if (store.canWrite()) {
          <div class="actions">
            <button type="button" class="btn primary" (click)="store.go({ name: 'edit', id: m.id })">
              {{ complete() ? 'Edit rating' : 'Finish rating' }}
            </button>
            @if (!confirming()) {
              <button type="button" class="btn quiet" (click)="confirming.set(true)">Delete</button>
            } @else {
              <span class="confirm">
                Delete this movie and its scores?
                <button type="button" class="btn danger" [disabled]="busy()" (click)="remove(m.id)">Delete</button>
                <button type="button" class="btn quiet" (click)="confirming.set(false)">Keep</button>
              </span>
            }
          </div>
        }
      </article>
    } @else if (store.status() === 'unavailable') {
      <p class="empty">The ratings can’t be reached right now. Check your connection and reload the page.</p>
    } @else if (store.status() === 'loading' || (found() && !auth.checked())) {
      <p class="empty">{{ store.slow() ? 'Still trying to reach the ratings…' : 'Loading the rating…' }}</p>
    } @else if (found()) {
      <p class="empty">This movie hasn’t been fully rated yet.</p>
    } @else {
      <p class="empty">That movie isn’t in the list any more.</p>
    }
  `,
})
export class MovieDetail {
  protected readonly store = inject(MovieStore);
  protected readonly auth = inject(AuthService);
  readonly id = input.required<string>();

  protected readonly criteria = CRITERIA;
  protected readonly groupStart = groupStart;
  /** Whether Delete is asking to be confirmed. Starts over when Back or Forward swaps in another movie. */
  protected readonly confirming = linkedSignal({ source: () => this.id(), computation: () => false });
  protected readonly busy = signal(false);

  protected readonly found = computed(() => this.store.byId(this.id()));
  /** The movie to show. As in the list, only the editor sees one that isn't fully rated. */
  protected readonly movie = computed(() => {
    const m = this.found();
    return m && (this.store.canWrite() || answered(m.scores) === CRITERIA.length) ? m : undefined;
  });
  protected readonly score = computed(() => fmt(total(this.movie()?.scores ?? {})));
  protected readonly complete = computed(() => answered(this.movie()?.scores ?? {}) === CRITERIA.length);
  /** Its place among all the fully rated movies, whatever the list is filtered to. Unset until it is fully rated. */
  protected readonly ranking = computed(() => {
    const all = ranked(this.store.movies());
    const place = all.findIndex((m) => m.id === this.id()) + 1;
    return place ? { place, of: all.length } : undefined;
  });

  protected date(iso: string) {
    return fmtDate(iso);
  }

  protected show(c: Criterion, v: number | null): string {
    if (v == null) return 'Not scored';
    if (c.kind === 'choice') {
      const label = c.options?.find((o) => o.value === v)?.label ?? '';
      return v === 0 ? label : `${label} ${v > 0 ? '+' : ''}${fmt(v)}`;
    }
    return v === 0 ? '—' : fmt(v);
  }

  protected async remove(id: string) {
    this.busy.set(true);
    const ok = await this.store.remove(id);
    this.busy.set(false);
    if (ok) this.store.go({ name: 'list' }, true);
  }
}
