import { Component, computed, input } from '@angular/core';
import { fmt } from './criteria';

/**
 * A choice score as a thermometer shaped like a candy cane on its side. Options run coldest (the hook end)
 * to hottest; the striped part stops at a marker on the chosen one, fading blue, green, red, orange along the way, and every level shows its label and points.
 */
@Component({
  selector: 'app-thermometer',
  template: `
    <!-- The whole cane: outline, hook, and the bare shaft. -->
    <svg class="cane-meter" aria-hidden="true">
      <g fill="none" stroke-linecap="round">
        <!-- Outline first, then bodies, then stripes, so no outline shows where hook and shaft meet. -->
        <line class="cm-edge" x1="35" y1="11" x2="100%" y2="11" transform="translate(-11 0)" />
        <path class="cm-edge" d="M33 35h-9a12 12 0 0 1 0-24" />
        <line class="cm-empty" x1="35" y1="11" x2="100%" y2="11" transform="translate(-11 0)" />
        <path class="cm-body" d="M33 35h-9a12 12 0 0 1 0-24" />
        <path class="cm-stripe cm-hook" d="M33 35h-9a12 12 0 0 1 0-24" />
      </g>
    </svg>
    <!-- The scale: starts clear of the hook and lines up with the labels, so percentages here are levels. -->
    <svg class="cane-meter cane-scale" aria-hidden="true">
      <defs>
        <linearGradient id="cm-fade" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100%" y2="0">
          <stop offset="0.125" stop-color="#2f7df6" />
          <stop offset="0.375" stop-color="#1fa85a" />
          <stop offset="0.625" stop-color="#e0263f" />
          <stop offset="0.875" stop-color="#ff9a1f" />
        </linearGradient>
      </defs>
      <g fill="none" stroke-linecap="round">
        <line class="cm-body cm-flat" x1="-22" y1="11" [attr.x2]="reach()" y2="11" />
        <line class="cm-stripe" stroke="url(#cm-fade)" x1="-22" y1="11" [attr.x2]="reach()" y2="11" />
        <line class="cm-mark" [attr.x1]="reach()" y1="1" [attr.x2]="reach()" y2="21" />
      </g>
    </svg>
    <ol class="thermo">
      @for (o of options(); track o.value) {
        <li [class.on]="o.value === value()" [attr.aria-current]="o.value === value() ? 'true' : null">
          <b>{{ o.value > 0 ? '+' : '' }}{{ num(o.value) }}</b>
          <span>{{ o.label }}</span>
        </li>
      }
    </ol>
  `,
})
export class Thermometer {
  readonly options = input.required<{ value: number; label: string }[]>();
  readonly value = input.required<number>();

  /** How far along the cane the red stripes run: to the middle of the chosen level. */
  protected readonly reach = computed(() => {
    const n = this.options().length;
    const i = this.options().findIndex((o) => o.value === this.value());
    return `${((i + 0.5) / n) * 100}%`;
  });

  protected num(v: number) {
    return fmt(v);
  }
}
