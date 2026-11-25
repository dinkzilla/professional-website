import { Component, input, output, signal } from '@angular/core';

interface Shard {
  path: string;
  /** Which way it flies, in the drawing's units, and how far it turns. */
  dx: number;
  dy: number;
  spin: number;
}

const CX = 60;
const CY = 84;
const R = 46;
/** Where the ball is struck, a little off centre, and the uneven cracks running out from there. */
const HIT = { x: 65, y: 77 };
const CRACKS = [8, 47, 82, 128, 161, 205, 243, 290, 324];
const KNEES = [17, 25, 15, 23, 18, 27, 16, 24, 20];

function shards(): Shard[] {
  const n = CRACKS.length;
  const at = (deg: number, r: number, from: { x: number; y: number }) => ({
    x: from.x + r * Math.cos((deg * Math.PI) / 180),
    y: from.y + r * Math.sin((deg * Math.PI) / 180),
  });
  const knee = CRACKS.map((a, i) => at(a, KNEES[i], HIT));
  // Each crack bends on its way from the knee to the rim.
  const bend = CRACKS.map((a, i) => at(a + (i % 2 ? 9 : -9), 33, { x: (CX + HIT.x) / 2, y: (CY + HIT.y) / 2 }));
  const rim = CRACKS.map((a) => at(a, R, { x: CX, y: CY }));
  const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

  return CRACKS.flatMap((a, i) => {
    const j = (i + 1) % n;
    const away = (a + (j ? CRACKS[j] : CRACKS[0] + 360)) / 2;
    const outer = `M${pt(knee[i])}L${pt(bend[i])}L${pt(rim[i])}A${R} ${R} 0 0 1 ${pt(rim[j])}L${pt(bend[j])}L${pt(knee[j])}Z`;
    const inner = `M${pt(HIT)}L${pt(knee[i])}L${pt(knee[j])}Z`;
    const far = at(away, 46 + (i % 3) * 12, { x: 0, y: 0 });
    const near = at(away + 14, 24 + (i % 4) * 9, { x: 0, y: 0 });
    return [
      { path: outer, dx: far.x, dy: far.y - 14, spin: (i % 2 ? 1 : -1) * (150 + i * 24) },
      { path: inner, dx: near.x, dy: near.y - 22, spin: (i % 2 ? -1 : 1) * (240 + i * 30) },
    ];
  });
}

/** A checkbox that is a glass ball ornament: whole when checked, shattered when not. */
@Component({
  selector: 'app-ornament-check',
  template: `
    <span class="ornament" [class.flipped]="flipped()">
      <input type="checkbox" aria-label="Recommend" [checked]="checked()" (change)="flip($any($event.target).checked)" />
      <svg viewBox="10 8 100 128" aria-hidden="true">
        <defs>
          <radialGradient id="oc-glass" gradientUnits="userSpaceOnUse" cx="44" cy="66" r="66">
            <stop offset="0" stop-color="#ff8c9d" />
            <stop offset="0.42" stop-color="#d81f41" />
            <stop offset="1" stop-color="#73091f" />
          </radialGradient>
          <linearGradient id="oc-brass">
            <stop offset="0" stop-color="#a8770f" />
            <stop offset="0.35" stop-color="#ffe9a3" />
            <stop offset="0.6" stop-color="#e0ac2c" />
            <stop offset="1" stop-color="#8f6208" />
          </linearGradient>
        </defs>
        @if (checked()) {
          <g class="oc-ball">
            <circle cx="60" cy="84" r="46" fill="url(#oc-glass)" />
            <ellipse cx="42" cy="58" rx="12" ry="7" fill="#fff" opacity="0.85" transform="rotate(-35 42 58)" />
            <!-- "recommend" in Figtree ExtraBold, its outlines projected onto the ball so it wraps round with the glass. -->
            <path fill="#fff" d="M18.5 88.7Q18.8 85.1 19.6 81.6Q20.5 78 21.9 74.5Q22.1 74.7 22.4 75Q22.7 75.2 23.1 75.4Q22.6 76.8 22.1 78.1Q22.8 76.9 23.5 76.6Q24.2 76.2 24.6 76.4Q24.2 77.5 23.9 78.6Q23.5 79.7 23.2 80.8Q22.8 80.5 22.4 80.6Q21.9 80.6 21.5 81Q21.2 81.5 20.9 82.4Q20.5 84.2 20.2 86.1Q19.9 87.9 19.8 89.8Q19.5 89.5 19.1 89.2Q18.8 89 18.5 88.7ZM25 93.2Q24.5 92.9 24.1 92.5Q23.8 92.1 23.5 91.4Q23.2 90.7 23 89.9Q22.8 89.1 22.7 88.2Q22.6 87.2 22.7 86.2Q22.8 85.1 23 84Q23.3 82.9 23.6 81.9Q24 81 24.4 80.3Q24.8 79.5 25.3 79Q25.7 78.4 26.2 78.1Q26.6 77.8 27.1 77.8Q27.5 77.7 28 77.9Q28.4 78.1 28.7 78.5Q28.9 79 29.1 79.6Q29.3 80.2 29.4 81.1Q29.5 81.9 29.4 83Q29.4 84.1 29.3 85.4Q29.1 86.6 28.9 88.1Q27.7 87.7 26.6 87.2Q25.5 86.7 24.5 86.1Q24.4 87.4 24.6 88.3Q24.9 89.3 25.4 89.5Q25.8 89.7 26.2 89.4Q26.6 89 26.8 88.4Q27.2 88.9 27.6 89.4Q28 90 28.4 90.5Q28 91.7 27.4 92.4Q26.9 93.1 26.3 93.3Q25.6 93.5 25 93.2ZM25.2 83.1Q25.7 83.4 26.3 83.7Q26.9 83.9 27.4 84.2Q27.6 83.3 27.5 82.7Q27.5 82.1 27.3 81.8Q27.1 81.5 26.9 81.3Q26.7 81.2 26.4 81.3Q26.1 81.4 25.8 81.9Q25.5 82.3 25.2 83.1ZM32.9 96.2Q32.3 96 31.8 95.6Q31.3 95.2 30.9 94.5Q30.4 93.9 30.1 93.1Q29.9 92.3 29.7 91.4Q29.6 90.4 29.6 89.4Q29.6 88.3 29.8 87.2Q30 86.1 30.3 85.1Q30.6 84.1 31.1 83.3Q31.5 82.6 32 82Q32.5 81.4 33 81Q33.5 80.7 34.1 80.6Q34.6 80.5 35.2 80.7Q35.7 80.8 36.1 81.2Q36.5 81.7 36.9 82.4Q37.2 83.1 37.4 84Q37.6 85 37.6 86.1Q37 86.4 36.4 86.6Q35.7 86.8 35.1 87Q35.1 86.3 34.8 85.7Q34.5 85.1 34.1 85Q33.6 84.9 33.2 85.2Q32.8 85.5 32.5 86.2Q32.1 87 32 88Q31.8 89 31.9 89.8Q32 90.6 32.3 91.2Q32.6 91.7 33.1 91.8Q33.6 92 34 91.6Q34.4 91.3 34.7 90.5Q35.2 91.1 35.7 91.6Q36.3 92.1 36.8 92.6Q36.5 93.7 36.1 94.4Q35.6 95.2 35.1 95.6Q34.6 96.1 34 96.2Q33.5 96.3 32.9 96.2ZM41.8 98.2Q41.1 98.1 40.6 97.8Q40 97.4 39.5 96.8Q39 96.2 38.7 95.5Q38.3 94.7 38.1 93.8Q37.9 92.9 37.9 91.8Q37.8 90.8 38 89.6Q38.1 88.5 38.4 87.5Q38.7 86.5 39.1 85.7Q39.5 84.8 40 84.2Q40.4 83.6 41 83.2Q41.6 82.8 42.1 82.6Q42.7 82.5 43.3 82.6Q43.9 82.7 44.4 83Q45 83.4 45.4 83.9Q45.8 84.5 46.1 85.3Q46.4 86 46.6 87Q46.8 87.9 46.8 89Q46.9 90 46.8 91.2Q46.7 92.3 46.5 93.3Q46.3 94.3 46 95.2Q45.6 96 45.2 96.6Q44.7 97.2 44.2 97.7Q43.7 98.1 43.1 98.2Q42.5 98.4 41.8 98.2ZM42 94Q42.5 94.1 43 93.7Q43.4 93.4 43.7 92.6Q44 91.8 44.1 90.8Q44.1 89.7 44 88.9Q43.9 88.1 43.5 87.5Q43.2 87 42.7 86.9Q42.2 86.8 41.7 87.2Q41.3 87.6 41 88.4Q40.6 89.1 40.5 90.2Q40.4 91.2 40.6 92.1Q40.7 92.9 41.1 93.4Q41.5 93.9 42 94ZM48 98.8Q48.1 95.1 48.3 91.4Q48.6 87.6 49 83.7Q50.2 83.9 51.4 84Q51.4 84.9 51.4 85.9Q51.9 84.8 52.5 84.3Q53.1 83.7 53.9 83.8Q54.9 83.8 55.6 84.7Q56.2 85.5 56.5 87.1Q57 85.6 57.7 84.8Q58.4 84 59.2 84Q60 84 60.6 84.4Q61.1 84.8 61.5 85.6Q61.9 86.5 62.2 87.8Q62.4 89.1 62.4 90.9Q62.4 93 62.5 95.2Q62.5 97.3 62.5 99.4Q61.8 99.4 61 99.4Q60.3 99.4 59.6 99.4Q59.6 97.6 59.6 95.7Q59.6 93.7 59.6 91.8Q59.6 90.6 59.4 89.9Q59.3 89.2 59 88.8Q58.7 88.5 58.3 88.4Q57.6 88.4 57.2 89.2Q56.8 89.9 56.7 91.5Q56.7 93.5 56.7 95.5Q56.6 97.5 56.6 99.4Q55.9 99.3 55.2 99.3Q54.5 99.3 53.7 99.2Q53.8 97.4 53.8 95.5Q53.8 93.6 53.9 91.6Q54 90.4 53.8 89.7Q53.7 89 53.4 88.6Q53.2 88.3 52.8 88.2Q52.1 88.1 51.6 88.9Q51.2 89.6 51.1 91.2Q51 93.2 50.9 95.2Q50.9 97.1 50.8 99Q50.1 99 49.4 98.9Q48.7 98.8 48 98.8ZM64.5 99.3Q64.4 95.7 64.3 91.9Q64.3 88.1 64.1 84.3Q65.4 84.2 66.6 84.1Q66.7 85.1 66.8 86Q67.2 84.9 67.7 84.3Q68.3 83.6 69 83.6Q70 83.5 70.8 84.2Q71.5 84.9 72 86.4Q72.2 84.9 72.8 84Q73.3 83.1 74.1 83Q74.9 82.9 75.5 83.2Q76.1 83.5 76.6 84.3Q77 85.1 77.4 86.3Q77.8 87.6 77.9 89.4Q78.2 91.5 78.3 93.6Q78.5 95.8 78.6 97.8Q77.9 97.9 77.2 98.1Q76.5 98.2 75.9 98.3Q75.8 96.4 75.7 94.5Q75.6 92.6 75.4 90.7Q75.3 89.5 75.1 88.8Q74.9 88.1 74.6 87.8Q74.3 87.5 73.9 87.5Q73.2 87.6 72.9 88.4Q72.6 89.2 72.7 90.8Q72.8 92.8 72.9 94.8Q73 96.7 73.1 98.6Q72.4 98.7 71.7 98.8Q71 98.9 70.2 98.9Q70.2 97.1 70.1 95.2Q70.1 93.3 70 91.3Q69.9 90.1 69.7 89.4Q69.5 88.7 69.2 88.4Q68.9 88.1 68.5 88.1Q67.8 88.1 67.4 88.9Q67.1 89.8 67.1 91.3Q67.2 93.3 67.3 95.3Q67.3 97.3 67.3 99.2Q66.6 99.2 65.9 99.3Q65.2 99.3 64.5 99.3ZM84.3 96.9Q83.7 97.1 83.1 97Q82.5 96.9 82 96.5Q81.5 96.1 81.1 95.5Q80.6 94.9 80.3 94.1Q80 93.3 79.7 92.3Q79.5 91.3 79.4 90.2Q79.3 89 79.3 88Q79.3 86.9 79.4 85.9Q79.5 85 79.8 84.2Q80 83.5 80.4 82.9Q80.8 82.3 81.2 81.9Q81.7 81.5 82.2 81.4Q82.8 81.2 83.3 81.4Q83.8 81.5 84.3 81.9Q84.8 82.3 85.3 83Q85.8 83.6 86.2 84.5Q86.7 85.5 87 86.7Q87.3 87.9 87.5 89.4Q86.3 89.8 84.9 90.1Q83.5 90.5 82.1 90.8Q82.3 92.1 82.9 92.7Q83.4 93.4 84.1 93.2Q84.7 93.1 85 92.5Q85.4 91.9 85.4 91.1Q86 91.3 86.5 91.5Q87.1 91.7 87.6 91.9Q87.5 93.3 87 94.4Q86.5 95.5 85.8 96.1Q85.1 96.7 84.3 96.9ZM81.8 87.7Q82.5 87.5 83.3 87.3Q84 87.2 84.7 87Q84.5 86.1 84.2 85.6Q83.9 85.2 83.5 85Q83.2 84.9 82.9 84.9Q82.6 85 82.3 85.3Q82 85.6 81.9 86.2Q81.7 86.8 81.8 87.7ZM89.3 95.1Q89.1 91.5 88.5 87.8Q87.9 84.1 86.9 80.4Q87.9 80.1 88.8 79.7Q89.1 80.6 89.4 81.6Q89.4 80.4 89.7 79.6Q89.9 78.9 90.5 78.6Q91.2 78.3 91.9 78.8Q92.5 79.3 93.2 80.7Q93.8 82 94.4 84.3Q94.8 86.4 95.1 88.5Q95.4 90.5 95.5 92.6Q95.1 92.8 94.6 93Q94.1 93.2 93.6 93.5Q93.5 91.6 93.3 89.8Q93 87.9 92.7 86Q92.5 84.8 92.2 84.2Q91.9 83.5 91.6 83.3Q91.4 83.1 91.1 83.2Q90.5 83.4 90.4 84.2Q90.2 85.1 90.5 86.6Q90.9 88.6 91.1 90.5Q91.3 92.5 91.4 94.3Q90.9 94.6 90.4 94.7Q89.8 94.9 89.3 95.1ZM98.9 91Q98.5 91.2 98.2 91.2Q97.9 91.2 97.6 90.9Q97.3 90.6 97 90.1Q96.7 89.5 96.5 88.8Q96.2 88 96 87Q95.7 86 95.5 84.9Q95.2 83.7 95.1 82.6Q94.9 81.5 94.8 80.6Q94.7 79.7 94.7 78.9Q94.7 78.2 94.8 77.6Q94.9 77 95.1 76.6Q95.3 76.2 95.6 76Q96 75.7 96.5 76Q97 76.3 97.5 77.1Q96.9 75.3 96.1 73.5Q95.4 71.7 94.5 69.9Q94.8 69.7 95 69.5Q95.3 69.2 95.6 69Q98.1 73.7 99.6 78.7Q101.1 83.7 101.5 88.7Q100.9 89.2 100.2 89.7Q100.2 88.8 100 87.9Q100 89.1 99.6 89.9Q99.3 90.7 98.9 91ZM98.8 86.6Q99.1 86.5 99.2 85.9Q99.4 85.4 99.4 84.6Q99.4 83.8 99.2 83Q99.1 82.6 99 82.2Q98.8 81.4 98.5 80.8Q98.2 80.2 97.9 79.9Q97.6 79.7 97.3 79.8Q97 80 96.9 80.6Q96.8 81.2 96.9 82Q97 82.9 97.2 83.9Q97.4 84.9 97.7 85.6Q97.9 86.3 98.2 86.5Q98.5 86.8 98.8 86.6Z" />
          </g>
        } @else {
          <!-- What's left: a jagged collar still hanging from the cap, and splinters on the floor. -->
          <path fill="url(#oc-glass)" class="oc-glass" d="M40 42.5A46 46 0 0 1 81 43L85 50L77 49L73 60L66 52L60 66L54 54L47 59L45 50L37 53Z" />
          <g class="oc-debris">
            <path fill="url(#oc-glass)" class="oc-glass" d="M12 132L24 112L34 121L30 133Z" />
            <path fill="url(#oc-glass)" class="oc-glass" d="M36 134L42 122L58 127L52 135Z" />
            <path fill="url(#oc-glass)" class="oc-glass" d="M62 134L70 108L84 119L82 133Z" />
            <path fill="url(#oc-glass)" class="oc-glass" d="M86 134L96 124L110 133Z" />
            <path fill="url(#oc-glass)" class="oc-glass" d="M54 119L60 112L64 121Z" />
          </g>
          @if (flipped()) {
            @for (s of shards; track $index) {
              <path fill="url(#oc-glass)" class="oc-glass oc-shard" [attr.d]="s.path" [style.--dx.px]="s.dx" [style.--dy.px]="s.dy" [style.--spin.deg]="s.spin" />
            }
          }
        }
        <circle cx="60" cy="18" r="8" fill="none" stroke="#c9982a" stroke-width="3" />
        <rect x="46" y="26" width="28" height="17" rx="3" fill="url(#oc-brass)" />
        <path d="M52 28v14M58 28v14M64 28v14M70 28v14" stroke="#5a3700" stroke-opacity="0.3" stroke-width="1.5" />
      </svg>
    </span>
  `,
})
export class OrnamentCheck {
  readonly checked = input.required<boolean>();
  readonly checkedChange = output<boolean>();

  protected readonly shards = shards();
  /** Set once it has been clicked, so a movie opened already unchecked doesn't shatter on sight. */
  protected readonly flipped = signal(false);

  protected flip(on: boolean) {
    this.flipped.set(true);
    this.checkedChange.emit(on);
  }
}
