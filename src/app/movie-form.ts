import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CRITERIA, Criterion, DEFAULT_NETWORKS, MovieData, PEOPLE, answered, fmt, total, groupStart, watchDates } from './criteria';
import { RatingIcons } from './rating-icons';
import { MovieStore } from './movie-store';

@Component({
  selector: 'app-movie-form',
  imports: [RatingIcons],
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
            <h3 class="group-head">{{ g }}</h3>
          }
          <section class="crit" [class.sub]="c.bonusOf" [class.grouped]="c.group" role="group" [attr.aria-label]="c.label">
            <h3>{{ c.label }}</h3>
            @if (c.hint) {
              <p class="muted">{{ c.hint }}</p>
            }

            @if (c.kind === 'scale') {
              <div class="scale">
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <button type="button" [class.on]="d.scores[c.key] === n" [attr.aria-pressed]="d.scores[c.key] === n" [attr.aria-label]="n + ' out of 5'" (click)="pick(c, n)">
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
                  <button type="button" [class.on]="d.scores[c.key] === o.value" [attr.aria-pressed]="d.scores[c.key] === o.value" (click)="pick(c, o.value)">
                    <span>{{ o.label }}</span>
                    <b>{{ o.value > 0 ? '+' : '' }}{{ num(o.value) }}</b>
                  </button>
                }
              </div>
            } @else {
              <div class="stepper">
                <button type="button" [attr.aria-label]="'Lower ' + c.label" (click)="step(c, -1)">−</button>
                <output [class.unset]="d.scores[c.key] == null">{{ d.scores[c.key] == null ? '—' : num(d.scores[c.key]!) }}</output>
                <button type="button" [attr.aria-label]="'Raise ' + c.label" (click)="step(c, 1)">+</button>
                @if (d.scores[c.key] != null) {
                  <button type="button" class="clear" (click)="pick(c, d.scores[c.key]!)">Clear</button>
                }
              </div>
            }
          </section>
        }

        <div class="savebar">
          <p>
            <strong>{{ sum() }} pts</strong>
            <span class="muted">{{ count() }} of {{ criteria.length }} scored</span>
          </p>
          <button type="button" class="btn quiet" (click)="cancel()">Cancel</button>
          <button type="submit" class="btn primary" [disabled]="saving() || !d.title.trim()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    } @else {
      <p class="empty">That movie isn’t in the list any more.</p>
    }
  `,
})
export class MovieForm implements OnInit {
  protected readonly store = inject(MovieStore);
  readonly id = input.required<string>();

  protected readonly groupStart = groupStart;
  protected readonly criteria = CRITERIA;
  protected readonly people = PEOPLE;
  protected readonly draft = signal<MovieData | null>(null);
  protected readonly saving = signal(false);

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
    const size = c.step ?? 1;
    let next = cur == null ? (dir > 0 ? size : 0) : cur + dir * size;
    if (c.min != null) next = Math.max(c.min, next);
    this.patch({ scores: { ...d.scores, [c.key]: Math.round(next * 2) / 2 } });
  }

  protected cancel() {
    const rated = answered(this.store.byId(this.id())?.scores ?? {}) > 0;
    this.store.go(rated ? { name: 'detail', id: this.id() } : { name: 'list' });
  }

  protected async save(event: Event) {
    event.preventDefault();
    const d = this.draft();
    if (!d || this.saving()) return;
    this.saving.set(true);
    const id = await this.store.save(this.id(), { ...d, title: d.title.trim(), network: d.network.trim(), watched: watchDates(d.watched) });
    this.saving.set(false);
    if (id) this.store.go({ name: 'detail', id });
  }
}
