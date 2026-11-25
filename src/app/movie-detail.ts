import { Component, computed, inject, input, signal } from '@angular/core';
import { CRITERIA, Criterion, answered, fmt, fmtDate, groupStart, total } from './criteria';
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
          <div class="detail-text">
            <h2>{{ m.title }}</h2>
            <p class="muted">{{ meta() }}</p>
            <p class="big-score">
              {{ score() }}<small>{{ complete() ? 'pts' : 'pts so far' }}</small>
            </p>
          </div>
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
    } @else {
      <p class="empty">That movie isn’t in the list any more.</p>
    }
  `,
})
export class MovieDetail {
  protected readonly store = inject(MovieStore);
  readonly id = input.required<string>();

  protected readonly criteria = CRITERIA;
  protected readonly groupStart = groupStart;
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);

  protected readonly movie = computed(() => this.store.byId(this.id()));
  protected readonly score = computed(() => fmt(total(this.movie()?.scores ?? {})));
  protected readonly complete = computed(() => answered(this.movie()?.scores ?? {}) === CRITERIA.length);
  protected readonly meta = computed(() => {
    const m = this.movie();
    if (!m) return '';
    return [m.watched.length && 'Watched ' + m.watched.map(fmtDate).join(', '), m.viewers.join(' and ')]
      .filter(Boolean)
      .join(' · ');
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
    if (ok) this.store.go({ name: 'list' });
  }
}
