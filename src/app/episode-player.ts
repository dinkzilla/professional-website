import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { AnalyticsService } from './analytics';
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
      <div class="dock" [class.on]="!paused()" role="region" aria-label="Audio review player">
        <span class="dock-wreath" aria-hidden="true"></span>
        <span class="dock-lit" aria-hidden="true"></span>
        <svg class="dock-bow" viewBox="0 0 68 54" aria-hidden="true">
          <g stroke="#a8770f" stroke-width="2" stroke-linejoin="round"><path fill="#e0a526" d="M31 24L18 50L26 46L31 52L36 28Z"/><path fill="#e0a526" d="M37 24L50 50L42 46L37 52L32 28Z"/><path fill="#f4c542" d="M34 20C24 4 6 2 4 10C2 20 4 32 10 33C18 34 28 28 34 22Z"/><path fill="#f4c542" d="M34 20C44 4 62 2 64 10C66 20 64 32 58 33C50 34 40 28 34 22Z"/><path fill="none" d="M12 12Q20 16 28 20M56 12Q48 16 40 20"/><rect x="27" y="14" width="14" height="15" rx="5" fill="#ffdd7a"/></g>
        </svg>
        <audio
          #audio
          preload="metadata"
          [attr.src]="src() || null"
          (play)="played()"
          (pause)="paused.set(true)"
          (timeupdate)="timeUpdate(audio.currentTime)"
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
  private readonly analytics = inject(AnalyticsService);
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
        this.listening = false;
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
    this.seekFrom ??= this.position();
    this.heard = NaN;
    a.currentTime = +value;
    this.position.set(+value);
    // Dragging the slider seeks many times; it's counted once, from where it was picked up to where it was let go.
    clearTimeout(this.seekTimer);
    this.seekTimer = setTimeout(() => this.seeked(+value), 800);
  }

  protected onDuration(d: number) {
    this.duration.set(Number.isFinite(d) ? d : 0);
  }

  protected ended() {
    if (this.listening) this.analytics.log('podcast_complete', this.about());
    this.listening = false;
    const a = this.audio()?.nativeElement;
    if (a) a.currentTime = 0;
    this.position.set(0);
    this.paused.set(true);
  }

  // What's sent to Analytics. A listen starts with the first play and lasts until the end is reached, so pausing
  // and carrying on is one listen, and playing it again after the end, or on another visit, is another.
  // Each listen sends podcast_start, then podcast_progress at every tenth heard, then podcast_complete.

  /** Whether a listen is under way. */
  private listening = false;
  /** The tenths heard so far in this listen. */
  private reached = new Set<number>();
  /** Where it was last heard playing, or NaN just after a seek, so jumping ahead isn't counted as hearing it. */
  private heard = NaN;
  private seekFrom: number | undefined;
  private seekTimer: ReturnType<typeof setTimeout> | undefined;

  protected played() {
    this.paused.set(false);
    if (this.listening) return;
    const ep = this.current();
    if (!ep) return;
    this.listening = true;
    this.reached.clear();
    this.heard = NaN;
    const count = countPlay(ep.id);
    this.analytics.log('podcast_start', { ...this.about(), play_count: count, replay: count > 1 });
  }

  protected timeUpdate(t: number) {
    this.position.set(t);
    const len = this.length();
    const was = this.heard;
    this.heard = t;
    // Only steady playing counts: a seek, or the clock jumping more than a few seconds, doesn't.
    if (!this.listening || !len || !(t > was && t - was < 3)) return;
    for (let tenth = 1; tenth <= 9; tenth++) {
      const at = (len * tenth) / 10;
      if (was < at && t >= at && !this.reached.has(tenth)) {
        this.reached.add(tenth);
        this.analytics.log('podcast_progress', { ...this.about(), percent: tenth * 10 });
      }
    }
  }

  private seeked(to: number) {
    const from = this.seekFrom ?? to;
    this.seekFrom = undefined;
    const len = this.length();
    if (!len || Math.abs(to - from) < 2) return;
    this.analytics.log('podcast_seek', {
      ...this.about(),
      direction: to < from ? 'back' : 'forward',
      from_sec: Math.round(from),
      to_sec: Math.round(to),
      from_percent: Math.round((from / len) * 100),
      to_percent: Math.round((to / len) * 100),
    });
  }

  /** Which review, for every event about it. */
  private about() {
    const ep = this.current()!;
    return {
      podcast_id: ep.id,
      podcast_title: this.title(ep),
      movie_id: ep.movieId,
      movie_title: ep.movieTitle,
      duration_sec: Math.round(this.length()),
    };
  }
}

const PLAYS_KEY = 'yule-swoon-plays';

/** How many times this browser has started a review, this time included. */
function countPlay(id: string): number {
  try {
    const plays: Record<string, number> = JSON.parse(localStorage.getItem(PLAYS_KEY) || '{}');
    plays[id] = (plays[id] || 0) + 1;
    localStorage.setItem(PLAYS_KEY, JSON.stringify(plays));
    return plays[id];
  } catch {
    return 1;
  }
}
