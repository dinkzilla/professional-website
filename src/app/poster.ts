import { Component, booleanAttribute, computed, input, linkedSignal } from '@angular/core';
import { safePoster, thumbPoster } from './criteria';

@Component({
  selector: 'app-poster',
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="title() + ' poster'" loading="lazy" (error)="failed()" />
    } @else {
      <span class="poster-blank" aria-hidden="true">{{ title().charAt(0) }}</span>
    }
    @if (coal()) {
      <span class="stamp"><span>Coal!</span></span>
    }
  `,
  host: { class: 'poster' },
})
export class Poster {
  readonly url = input('');
  readonly title = input('');
  /** Stamp it as not recommended. */
  readonly coal = input(false, { transform: booleanAttribute });
  /** Use the smaller picture, as in lists. */
  readonly thumb = input(false, { transform: booleanAttribute });
  private readonly full = computed(() => safePoster(this.url()));
  /** The picture showing, or '' if none could be loaded. Starts over when another takes its place. */
  protected readonly src = linkedSignal(() => (this.thumb() ? thumbPoster(this.full()) : this.full()));

  /** Not every poster has a smaller picture, so try the full one before giving up. */
  protected failed() {
    this.src.set(this.src() === this.full() ? '' : this.full());
  }
}
