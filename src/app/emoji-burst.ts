import { Component, signal } from '@angular/core';
import { RatingIcons } from './rating-icons';

interface Bit {
  id: number;
  criterion: string;
  /** Where it starts, and how far it flies, in viewport pixels. */
  x: number;
  y: number;
  dx: number;
  dy: number;
  spin: number;
  size: number;
  ms: number;
  delay: number;
}

const PER_BURST = 28;
/** Fast tapping stacks bursts; past this many the oldest icons are dropped. */
const MAX_BITS = 160;

/** Sprays a criterion's icon from a point out across the whole screen. Purely decorative. */
@Component({
  selector: 'app-emoji-burst',
  imports: [RatingIcons],
  host: { 'aria-hidden': 'true' },
  template: `
    @for (b of bits(); track b.id) {
      <span
        class="bit"
        [style.left.px]="b.x"
        [style.top.px]="b.y"
        [style.--dx.px]="b.dx"
        [style.--dy.px]="b.dy"
        [style.--spin.deg]="b.spin"
        [style.--size]="b.size"
        [style.animation-duration.ms]="b.ms"
        [style.animation-delay.ms]="b.delay"
        (animationend)="drop(b.id)"
      >
        <app-rating-icons [criterion]="b.criterion" [value]="1" single />
      </span>
    }
  `,
})
export class EmojiBurst {
  protected readonly bits = signal<Bit[]>([]);
  private nextId = 0;

  /** Fires a burst of `criterion`'s icon out of the middle of `from`. */
  fire(criterion: string, from: Element) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = from.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    const fresh: Bit[] = Array.from({ length: PER_BURST }, () => ({
      id: this.nextId++,
      criterion,
      x,
      y,
      // Land anywhere on the screen, a little past the edges included.
      dx: rand(-0.05, 1.05) * innerWidth - x,
      dy: rand(-0.05, 1.05) * innerHeight - y,
      spin: rand(-540, 540),
      size: rand(0.7, 1.9),
      ms: rand(900, 1700),
      delay: rand(0, 120),
    }));
    this.bits.update((old) => [...old, ...fresh].slice(-MAX_BITS));
  }

  protected drop(id: number) {
    this.bits.update((old) => old.filter((b) => b.id !== id));
  }
}
