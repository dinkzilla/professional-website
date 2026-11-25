import { Component, booleanAttribute, computed, input, signal } from '@angular/core';
import { safePoster } from './criteria';

@Component({
  selector: 'app-poster',
  template: `
    @if (src() && !broken()) {
      <img [src]="src()" [alt]="title() + ' poster'" loading="lazy" (error)="broken.set(true)" />
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
  protected readonly broken = signal(false);
  protected readonly src = computed(() => safePoster(this.url()));
}
