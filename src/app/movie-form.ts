import { Component, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { AudioReviews } from './audio-reviews';
import { BASE, CRITERIA, Criterion, DEFAULT_NETWORKS, MovieData, PEOPLE, answered, choiceColor, fmt, total, groupStart, watchDates } from './criteria';
import { EmojiBurst } from './emoji-burst';
import { OrnamentCheck } from './ornament-check';
import { RatingIcons } from './rating-icons';
import { MovieStore } from './movie-store';
import { ReviewStore } from './review-store';

@Component({
  selector: 'app-movie-form',
  imports: [AudioReviews, RatingIcons, EmojiBurst, OrnamentCheck],
  template: `
    @if (draft(); as d) {
      <form class="form" (submit)="save($event)">
        <div class="field">
          <label for="f-title">Title</label>
          <input id="f-title" type="text" required [value]="d.title" (input)="patch({ title: $any($event.target).value })" />
        </div>

        <div class="field">
          <label for="f-network">Network</label>
          <input id="f-network" type="text" [value]="d.network" (input)="patch({ network: $any($event.target).value })" />
          <div class="chips">
            @for (n of networks(); track n) {
              <button type="button" class="chip" [class.on]="d.network === n" (click)="patch({ network: n })">{{ n }}</button>
            }
          </div>
        </div>

        <div class="field" role="group" aria-labelledby="f-watched">
          <span class="label" id="f-watched">Dates watched</span>
          @for (w of d.watched; track $index) {
            <div class="date-row">
              <input type="date" [value]="w" [attr.aria-label]="'Watch date ' + ($index + 1)" (input)="setDate($index, $any($event.target).value)" />
              @if (d.watched.length > 1) {
                <button type="button" class="clear" (click)="removeDate($index)">Remove</button>
              }
            </div>
          }
          <button type="button" class="chip add-date" (click)="addDate()">+ Add another date</button>
        </div>

        <div class="field" role="group" aria-labelledby="f-viewers">
          <span class="label" id="f-viewers">Who watched</span>
          <div class="chips">
            @for (p of people; track p) {
              <button type="button" class="chip" [class.on]="d.viewers.includes(p)" [attr.aria-pressed]="d.viewers.includes(p)" (click)="toggleViewer(p)">
                {{ p }}
              </button>
            }
          </div>
        </div>

        @for (c of criteria; track c.key) {
          @if (groupStart($index); as g) {
            <h3 class="divider" [class.base]="g === base">{{ g }}</h3>
          }
          <section class="crit" [class.sub]="c.bonusOf" role="group" [attr.aria-label]="c.label">
            <h3 [class.divider]="c.kind === 'choice'" [style.color]="choiceColor(c, d.scores[c.key])">@if (c.bonusOf) {<b class="bonus">BONUS:</b>&ngsp;}{{ c.label }}</h3>
            @if (c.hint) {
              <p class="muted">{{ c.hint }}</p>
            }

            @if (c.kind === 'scale') {
              <div class="scale">
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <button type="button" [class.on]="d.scores[c.key] === n" [attr.aria-pressed]="d.scores[c.key] === n" [attr.aria-label]="n + ' out of 5'" (click)="pick(c, n); burst(c, $event)">
                    <app-rating-icons [criterion]="c.key" single [off]="d.scores[c.key] == null || n > d.scores[c.key]!" />
                  </button>
                }
              </div>
              <div class="notes">
                <p class="note low"><b>1</b>{{ c.low }}</p>
                <p class="note high"><b>5</b>{{ c.high }}</p>
              </div>
            } @else if (c.kind === 'choice') {
              <div class="choices">
                @for (o of c.options; track o.value) {
                  <button type="button" [class.on]="d.scores[c.key] === o.value" [attr.aria-pressed]="d.scores[c.key] === o.value" (click)="pick(c, o.value); burst(c, $event)">
                    <span>{{ o.label }}</span>
                    <b>{{ o.value > 0 ? '+' : '' }}{{ num(o.value) }}</b>
                  </button>
                }
              </div>
            } @else {
              <div class="stepper">
                <button type="button" [attr.aria-label]="'Lower ' + c.label" (click)="step(c, -1); burst(c, $event)">−</button>
                <output [class.unset]="d.scores[c.key] == null">{{ d.scores[c.key] == null ? '—' : num(d.scores[c.key]!) }}</output>
                <button type="button" [attr.aria-label]="'Raise ' + c.label" (click)="step(c, 1); burst(c, $event)">+</button>
                @if (d.scores[c.key] != null) {
                  <button type="button" class="clear" (click)="pick(c, d.scores[c.key]!)">Clear</button>
                }
              </div>
            }
          </section>
        }

        <app-audio-reviews [movieId]="id()" />

        <div class="savebar">
          <app-ornament-check [checked]="d.recommend" (checkedChange)="patch({ recommend: $event })" />
          <p>
            <strong>{{ sum() }} pts</strong>
            <span class="muted">{{ reviews.recording() ? 'Stop recording first' : count() + ' of ' + criteria.length + ' scored' }}</span>
          </p>
          <button type="button" class="btn quiet" [disabled]="reviews.recording()" (click)="cancel()">Cancel</button>
          <button type="submit" class="btn primary" [disabled]="saving() || reviews.recording() || !d.title.trim()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
      <app-emoji-burst />
    } @else {
      <p class="empty">That movie isn’t in the list any more.</p>
    }
  `,
})
export class MovieForm implements OnInit {
  protected readonly store = inject(MovieStore);
  protected readonly reviews = inject(ReviewStore);
  readonly id = input.required<string>();

  protected readonly groupStart = groupStart;
  protected readonly base = BASE;
  protected readonly choiceColor = choiceColor;
  protected readonly criteria = CRITERIA;
  protected readonly people = PEOPLE;
  protected readonly draft = signal<MovieData | null>(null);
  protected readonly saving = signal(false);
  private readonly bursts = viewChild(EmojiBurst);

  protected readonly sum = computed(() => fmt(total(this.draft()?.scores ?? {})));
  protected readonly count = computed(() => answered(this.draft()?.scores ?? {}));
  protected readonly networks = computed(() => [
    ...new Set([...DEFAULT_NETWORKS, ...this.store.movies().map((m) => m.network).filter(Boolean)]),
  ]);

  ngOnInit() {
    const m = this.store.byId(this.id());
    if (m) {
      const { id: _id, ...data } = m;
      // Always offer one date box, even before anything has been watched.
      this.draft.set({ ...data, watched: data.watched.length ? [...data.watched] : [''], viewers: [...data.viewers], scores: { ...data.scores } });
    }
  }

  protected num(n: number) {
    return fmt(n);
  }

  protected patch(change: Partial<MovieData>) {
    this.draft.update((d) => (d ? { ...d, ...change } : d));
  }

  protected setDate(i: number, value: string) {
    const d = this.draft();
    if (d) this.patch({ watched: d.watched.map((w, j) => (j === i ? value : w)) });
  }

  protected addDate() {
    const d = this.draft();
    if (d) this.patch({ watched: [...d.watched, ''] });
  }

  protected removeDate(i: number) {
    const d = this.draft();
    if (d) this.patch({ watched: d.watched.filter((_, j) => j !== i) });
  }

  protected toggleViewer(p: string) {
    const d = this.draft();
    if (!d) return;
    const has = d.viewers.includes(p);
    // Keep the names in a fixed order however they were tapped.
    this.patch({ viewers: PEOPLE.filter((x) => (x === p ? !has : d.viewers.includes(x))) });
  }

  /** Sets a score; picking the current value again clears it. */
  protected pick(c: Criterion, value: number) {
    const d = this.draft();
    if (!d) return;
    this.patch({ scores: { ...d.scores, [c.key]: d.scores[c.key] === value ? null : value } });
  }

  protected step(c: Criterion, dir: 1 | -1) {
    const d = this.draft();
    if (!d) return;
    const cur = d.scores[c.key];
    // The first tap on minus records a zero; from there it goes negative.
    const next = cur == null ? (dir > 0 ? 0.5 : 0) : cur + dir * 0.5;
    this.patch({ scores: { ...d.scores, [c.key]: Math.round(next * 2) / 2 } });
  }

  /** Showers the screen with the criterion's icon from the button that was pressed. */
  protected burst(c: Criterion, event: Event) {
    this.bursts()?.fire(c.key, event.currentTarget as Element);
  }

  protected cancel() {
    const rated = answered(this.store.byId(this.id())?.scores ?? {}) > 0;
    this.store.go(rated ? { name: 'detail', id: this.id() } : { name: 'list' });
  }

  protected async save(event: Event) {
    event.preventDefault();
    const d = this.draft();
    if (!d || this.saving() || this.reviews.recording()) return;
    this.saving.set(true);
    const id = await this.store.save(this.id(), { ...d, title: d.title.trim(), network: d.network.trim(), watched: watchDates(d.watched) });
    this.saving.set(false);
    if (id) this.store.go({ name: 'detail', id });
  }
}
