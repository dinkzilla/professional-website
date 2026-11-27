import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { clock } from './audio-edit';
import { fmtDate } from './criteria';
import { Published, ReviewStore } from './review-store';

/**
 * Plays a movie's published audio reviews for anyone, from a garland docked along the bottom of the
 * screen. Only the newest is played. Shows nothing until one is finished.
 */
@Component({
  selector: 'app-episode-player',
  template: `
    @if (current(); as ep) {
      <div class="dock" role="region" aria-label="Audio review player">
        <span class="lights" aria-hidden="true"></span>
        <audio
          #audio
          preload="metadata"
          [attr.src]="src() || null"
          (play)="paused.set(false)"
          (pause)="paused.set(true)"
          (timeupdate)="position.set(audio.currentTime)"
          (durationchange)="onDuration(audio.duration)"
          (ended)="ended()"
          (error)="src() && failed.set(true)"
        ></audio>
        <div class="dock-row">
          <button
            type="button"
            class="dock-play"
            [disabled]="!src() || failed()"
            [attr.aria-label]="(paused() ? 'Play ' : 'Pause ') + title(ep)"
            (click)="toggle()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              @if (paused()) {
                <path d="M8.5 5v14l11-7z" />
              } @else {
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              }
            </svg>
          </button>

          <div class="dock-body">
            <p class="dock-title">
              <strong>{{ title(ep) }}</strong>
              <span class="dock-sub">
                {{ date(ep) }}
              </span>
            </p>
            @if (failed()) {
              <p class="dock-problem" role="status">Couldn’t load this review. Check your connection.</p>
            } @else {
              <div class="dock-scrub">
                <span class="dock-bar" [style.--done]="length() ? Math.min(1, position() / length()) : 0">
                  <input
                    type="range"
                    autocomplete="off"
                    min="0"
                    step="0.1"
                    [max]="length()"
                    [value]="position()"
                    [disabled]="!src()"
                    aria-label="Position"
                    [attr.aria-valuetext]="clock(position()) + ' of ' + clock(length())"
                    (input)="seek($any($event.target).value)"
                  />
                </span>
                <span class="dock-time">{{ clock(position()) }} / {{ clock(length()) }}</span>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class EpisodePlayer {
  private readonly store = inject(ReviewStore);
  readonly movieId = input.required<string>();

  protected readonly clock = clock;
  protected readonly Math = Math;
  /** Finished published versions, newest first. */
  private readonly episodes = signal<Published[]>([]);
  /** The newest, the only one played. */
  protected readonly current = computed(() => this.episodes()[0]);

  protected readonly src = signal('');
  protected readonly paused = signal(true);
  protected readonly position = signal(0);
  private readonly duration = signal(0);
  protected readonly failed = signal(false);
  /** The file's own length once it's known, or the one saved when it was made. */
  protected readonly length = computed(() => this.duration() || this.current()?.seconds || 0);

  private readonly audio = viewChild<ElementRef<HTMLAudioElement>>('audio');

  constructor() {
    // Each movie starts over on its newest review.
    effect((onCleanup) => {
      const id = this.movieId();
      untracked(() => this.episodes.set([]));
      onCleanup(this.store.watchFinished(id, (eps) => this.episodes.set(eps)));
    });

    // A different review is loaded from its start, paused.
    let asked = 0;
    effect(() => {
      const ep = this.current();
      const id = ep?.id;
      untracked(() => {
        if (id === this.loadedId) return;
        this.loadedId = id;
        this.audio()?.nativeElement.pause();
        this.src.set('');
        this.paused.set(true);
        this.position.set(0);
        this.duration.set(0);
        this.failed.set(false);
        if (!ep) return;
        const ask = ++asked;
        this.store.url(ep).then(
          (url) => ask === asked && this.src.set(url),
          () => ask === asked && this.failed.set(true),
        );
      });
    });

    // Leaving the page stops it, even if the element lingers.
    inject(DestroyRef).onDestroy(() => this.audio()?.nativeElement.pause());
  }

  private loadedId: string | undefined;

  protected title(p: Published) {
    return p.title.trim() || 'Untitled';
  }

  protected date(p: Published) {
    return fmtDate(p.publishedAt || p.createdAt);
  }

  protected toggle() {
    const a = this.audio()?.nativeElement;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }

  protected seek(value: string) {
    const a = this.audio()?.nativeElement;
    if (!a) return;
    a.currentTime = +value;
    this.position.set(+value);
  }

  protected onDuration(d: number) {
    this.duration.set(Number.isFinite(d) ? d : 0);
  }

  protected ended() {
    const a = this.audio()?.nativeElement;
    if (a) a.currentTime = 0;
    this.position.set(0);
    this.paused.set(true);
  }
}
