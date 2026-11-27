import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { Cuts, Marks, Span, clock, cut, cutAt, editedLength, kept, mixPlan, normalize, restore, sameCuts, sameMarks, snapMark, spotsOf, toEdited, toOriginal, whole } from './audio-edit';
import { jingleLengths } from './jingles';
import { MixPlayer } from './mix-player';
import { MovieStore } from './movie-store';
import { PEAKS_PER_SECOND, Review, ReviewStore } from './review-store';
import { height, loudest, top } from './waveform';

/** Most pixels a second of recording can be zoomed to. */
const MAX_ZOOM = 400;
/** How close, in pixels, a finger has to come to a handle to take it. */
const REACH = 24;
/** How long a finger has to rest to start selecting. */
const LONG_PRESS = 450;
/** How far a finger can wander and still count as a tap or a long press. */
const SLOP = 8;
/** How much is heard either side of a cut by "Hear the join". */
const AROUND = 2;
/** Shortest stretch a handle can leave between itself and the one it faces. */
const GAP = 0.1;
const HANDLE = '#f4c542';
/** An end this close to the end of the file is the end of the file. */
const END_SLACK = 0.05;
/** The intro and outro's marks and how far they reach. */
const JINGLE = '#5b4bb7';

type Drag =
  | { kind: 'wait'; x: number; y: number; at: number; timer: ReturnType<typeof setTimeout> }
  | { kind: 'scrub'; x: number; at: number; lastX: number; lastT: number; velocity: number; resume: boolean }
  | { kind: 'select'; anchor: number }
  | { kind: 'start' | 'end'; base: Cuts }
  | { kind: 'cut'; base: Cuts; index: number; edge: 'start' | 'end' }
  | { kind: 'selection'; edge: 'start' | 'end' }
  | { kind: 'pinch'; distance: number; zoom: number };

/**
 * Full-screen editor for trimming and cutting a recording, made for a phone. The waveform slides under
 * a fixed playhead: drag it to move through, pinch to zoom, hold and drag to select. Yellow handles
 * trim the ends. Nothing is done to the recording itself; the edit is saved with it as time ranges.
 */
@Component({
  selector: 'app-audio-editor',
  host: { class: 'editor', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'editor-title' },
  template: `
    <div class="editor-readout">
      <output class="editor-clock" aria-label="Playhead">{{ clock(playhead(), true) }}</output>
      <span class="muted">
        @if (selection(); as s) {
          Selected {{ clock(s.end - s.start, true) }}
        } @else {
          {{ changed() ? 'Edited to ' + clock(finalLength()) + ' of ' + clock(duration()) : clock(duration()) + ' long' }}
        }
      </span>
    </div>

    <canvas #overview class="editor-overview" aria-hidden="true" (pointerdown)="overviewDown($event)" (pointermove)="overviewMove($event)"></canvas>
    <div class="editor-wave" tabindex="0" role="slider" aria-label="Position in recording" [attr.aria-valuemin]="0" [attr.aria-valuemax]="duration()" [attr.aria-valuenow]="playhead()" [attr.aria-valuetext]="clock(playhead(), true)" (keydown)="key($event)">
      <canvas
        #wave
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up($event)"
        (pointercancel)="up($event)"
        (lostpointercapture)="up($event)"
        (contextmenu)="$event.preventDefault()"
      ></canvas>
    </div>
    <div class="editor-transport" role="toolbar" aria-label="Playback">
      <!-- The main button keeps the middle, whatever is either side of it. -->
      <div class="editor-side start">
        @if (playing()) {
          <button type="button" class="editor-step" aria-label="Back to where playing started" title="Back to where playing started" (click)="replay()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h2.5v14H5zM19.5 5v14L8.5 12z" /></svg>
          </button>
        } @else {
          <button type="button" class="editor-step" aria-label="Play from the beginning" title="Play from the beginning" (click)="playFromBeginning()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h2.5v14H5zM19.5 5v14L8.5 12z" /></svg>
          </button>
          <button type="button" class="editor-step" aria-label="Back a tenth of a second" (click)="nudge(-0.1)">−0.1</button>
        }
      </div>
      @if (playing()) {
        <button type="button" class="player-key editor-play" aria-label="Stop, back to where playing started" (pointerdown)="now($event, stop)" (click)="stop()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
        </button>
      } @else {
        <button type="button" class="player-key editor-play" aria-label="Play edited recording" (click)="play()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.5v15l12-7.5z" /></svg>
        </button>
      }
      <div class="editor-side end">
        @if (playing()) {
          <button type="button" class="editor-step" aria-label="Pause" title="Pause" (pointerdown)="now($event, pauseHere)" (click)="pauseHere()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
          </button>
        } @else {
          <button type="button" class="editor-step" aria-label="Forward a tenth of a second" (click)="nudge(0.1)">+0.1</button>
        }
      </div>
    </div>

    @if (!peaks()) {
      <p class="editor-hint muted">The waveform isn’t ready yet. You can still edit.</p>
    }

    <div class="editor-tools" role="toolbar" aria-label="Cut">
      @if (mark() != null) {
        <!-- Moving the playhead stretches the selection from the mark. -->
        <button type="button" class="btn primary" [disabled]="!selection()" (click)="markEnd()">End Cut</button>
        <button type="button" class="btn quiet" (click)="mark.set(null)">Clear</button>
      } @else if (selection(); as s) {
        <button type="button" class="btn primary" (click)="cutSelection()">Cut</button>
        <button type="button" class="btn" (click)="hear(s, true)">Hear without</button>
        <button type="button" class="btn quiet" (click)="clearSelection()">Clear</button>
      } @else if (chosenCut(); as c) {
        <button type="button" class="btn" (click)="putBack(c)">Restore</button>
        <button type="button" class="btn" (click)="hear(c, false)">Hear the join</button>
        <button type="button" class="btn quiet" (click)="chosenCut.set(null)">Close</button>
      } @else {
        <button type="button" class="btn" (click)="markStart()">Start Cut</button>
      }
    </div>

    <div class="editor-tools editor-pairs" role="toolbar" aria-label="Start and end">
      <span class="editor-pair">
        <button type="button" class="btn" title="Start the recording at the playhead, trimming what’s before" (click)="trimStart()">Mark Start</button>
        @if (view().start > 0) {
          <button type="button" class="btn quiet editor-x" aria-label="Untrim the start" title="Untrim the start" (click)="untrimStart()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
        }
      </span>
      <span class="editor-pair">
        <button type="button" class="btn" title="End the recording at the playhead, trimming what’s after" (click)="trimEnd()">Mark End</button>
        @if (trimmedEnd()) {
          <button type="button" class="btn quiet editor-x" aria-label="Untrim the end" title="Untrim the end" (click)="untrimEnd()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
        }
      </span>
    </div>

    <div class="editor-tools editor-pairs" role="toolbar" aria-label="Intro and outro">
      <span class="editor-pair">
        <button type="button" class="btn" title="The intro finishes playing at the playhead" (click)="setIntro()">{{ marks().introEnd == null ? 'Intro Ends' : 'Move Intro End' }}</button>
        @if (marks().introEnd != null) {
          <button type="button" class="btn quiet editor-x" aria-label="Leave out the intro" title="Leave out the intro" (click)="removeMark('introEnd')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
        }
      </span>
      <span class="editor-pair">
        <button type="button" class="btn" title="The outro starts playing at the playhead" (click)="setOutro()">{{ marks().outroStart == null ? 'Outro Starts' : 'Move Outro Start' }}</button>
        @if (marks().outroStart != null) {
          <button type="button" class="btn quiet editor-x" aria-label="Leave out the outro" title="Leave out the outro" (click)="removeMark('outroStart')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg></button>
        }
      </span>
    </div>

    @if (message()) {
      <p class="error" role="alert">{{ message() }}</p>
    }
    <!-- Held at the foot of the screen; the controls above are centred in what's left. -->
    <footer class="editor-foot">
      <h2 id="editor-title">
        Editing Recording
        @if (movieTitle()) {
          for <span class="editor-movie">{{ movieTitle() }}</span>
        }
      </h2>
      <div class="editor-actions">
        @if (confirmingClose()) {
          <span class="editor-ask">Discard your changes?</span>
          <button type="button" class="btn danger" (click)="close()">Discard</button>
          <button type="button" class="btn quiet" (click)="confirmingClose.set(false)">Keep editing</button>
        } @else {
          <button type="button" class="btn quiet" [disabled]="saving()" (click)="cancel()">Cancel</button>
          <button type="button" class="btn primary" [disabled]="saving()" (click)="done()">{{ saving() ? 'Saving…' : 'Save' }}</button>
        }
      </div>
    </footer>
    <p class="sr-only" role="status">{{ announcement() }}</p>
  `,
})
export class AudioEditor implements OnInit, AfterViewInit, OnDestroy {
  private readonly store = inject(ReviewStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly movies = inject(MovieStore);
  readonly movieId = input.required<string>();
  readonly review = input.required<Review>();
  readonly url = input.required<string>();
  readonly closed = output<void>();

  protected readonly clock = clock;
  protected readonly movieTitle = computed(() => this.movies.byId(this.movieId())?.title ?? '');

  /** Timed while recording at first, then the file's own length once it's known. */
  protected readonly duration = signal(1);
  /** An end of Infinity is untrimmed, whatever the file's length turns out to be. */
  protected readonly edit = signal<Cuts>({ start: 0, end: Infinity, cuts: [] });
  private initial: Cuts = { start: 0, end: Infinity, cuts: [] };

  protected readonly view = computed(() => normalize(this.edit(), this.duration()));
  protected readonly spans = computed(() => kept(this.view(), this.duration()));
  protected readonly length = computed(() => editedLength(this.spans()));
  /** Where the intro ends and the outro starts, on the original recording. */
  protected readonly marks = signal<Marks>({});
  private initialMarks: Marks = {};
  private readonly hasMarks = computed(() => this.marks().introEnd != null || this.marks().outroStart != null);
  /** Whether the end is trimmed off, not just where the file ends. */
  protected readonly trimmedEnd = computed(() => this.view().end < this.duration() - END_SLACK);
  protected readonly changed = computed(() => this.hasMarks() || !sameCuts(this.view(), whole(this.duration())));
  /** How long the published version would be, jingles and all, once their lengths are known. */
  protected readonly finalLength = computed(() => {
    const lengths = jingleLengths();
    return lengths ? mixPlan(this.length(), spotsOf(this.marks(), this.spans()), lengths).length : this.length();
  });
  /** Each jingle's mark, where it's heard, and the stretch of the recording it plays over. */
  private readonly bands = computed(() => {
    const spans = this.spans();
    const m = this.marks();
    const lengths = jingleLengths();
    const total = editedLength(spans);
    const out: { label: string; mark: number; from: number; to: number }[] = [];
    if (m.introEnd != null) {
      const e = toEdited(spans, m.introEnd);
      const mark = snapMark(spans, m.introEnd);
      const early = lengths ? lengths.intro - e : 0;
      out.push({ label: early > 0.05 ? `Intro · ${clock(early, true)} before the recording` : 'Intro', mark, from: lengths ? toOriginal(spans, Math.max(0, e - lengths.intro)) : mark, to: mark });
    }
    if (m.outroStart != null) {
      const e = toEdited(spans, m.outroStart);
      const mark = snapMark(spans, m.outroStart);
      const late = lengths ? e + lengths.outro - total : 0;
      out.push({ label: late > 0.05 ? `Outro · ${clock(late, true)} after the end` : 'Outro', mark, from: mark, to: lengths ? toOriginal(spans, Math.min(total, e + lengths.outro)) : mark });
    }
    return out;
  });

  protected readonly playhead = signal(0);
  /** Pixels per second. */
  private readonly zoom = signal(0);
  protected readonly playing = signal(false);
  protected readonly peaks = signal<Uint8Array | null>(null);
  private readonly loudestPeak = computed(() => {
    const p = this.peaks();
    return p ? top(p) : 0;
  });

  /** Where "Start Cut" was pressed; the selection runs from here to the playhead until "End Cut". */
  protected readonly mark = signal<number | null>(null);
  private readonly fixedSelection = signal<Span | null>(null);
  protected readonly selection = computed<Span | null>(() => {
    const m = this.mark();
    if (m != null) {
      const p = this.playhead();
      return Math.abs(p - m) > 0 ? { start: Math.min(m, p), end: Math.max(m, p) } : null;
    }
    return this.fixedSelection();
  });
  protected readonly chosenCut = signal<Span | null>(null);

  protected readonly confirmingClose = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly announcement = signal('');

  private readonly waveRef = viewChild.required<ElementRef<HTMLCanvasElement>>('wave');
  private readonly overviewRef = viewChild.required<ElementRef<HTMLCanvasElement>>('overview');

  private readonly audio = new Audio();
  private readonly player = new MixPlayer(this.audio);
  private measuring = false;
  private frame = 0;
  private fling = 0;
  private dirty = true;
  private width = 0;
  private colors = { ink: '#000', muted: '#888', accent: '#c00', line: '#ddd', surface: '#fff', holly: '#1a7a4a' };
  private hatch: CanvasPattern | null = null;
  private resize: ResizeObserver | undefined;
  private stopPeaks: () => void = () => {};
  private readonly pointers = new Map<number, number>();
  private drag: Drag | null = null;
  /** Where the playhead was when Play was pressed. */
  private readonly returnTo = signal<number | null>(null);
  /** Where Pause left the playhead, so playing on from there counts as the same play. */
  private readonly pausedAt = signal<number | null>(null);
  /** Where playing started, marked on the waveform while it's playing or paused. */
  private readonly startMark = computed(() => (this.playing() || this.pausedAt() != null ? this.returnTo() : null));

  constructor() {
    // Redraws on the next frame whenever anything drawn changes.
    effect(() => {
      this.view();
      this.playhead();
      this.zoom();
      this.peaks();
      this.selection();
      this.chosenCut();
      this.mark();
      this.startMark();
      this.bands();
      this.dirty = true;
    });
    effect(() => {
      this.player.spans = this.spans();
      this.player.marks = this.marks();
      this.player.length = this.duration();
    });
    effect(() => {
      if (this.hasMarks()) this.player.prepare();
    });
  }

  ngOnInit() {
    const r = this.review();
    this.duration.set(Math.max(r.seconds, 0.1));
    // An end saved where the recording ended, as far as was known then, is no trim: the file may turn out a little longer.
    const end = r.edit && r.edit.end < r.seconds - END_SLACK ? r.edit.end : Infinity;
    this.initial = r.edit ? { start: r.edit.start, end, cuts: r.edit.cuts } : { start: 0, end: Infinity, cuts: [] };
    this.edit.set(this.initial);
    this.initialMarks = r.marks ?? {};
    this.marks.set(this.initialMarks);
    this.playhead.set(this.view().start);
    this.stopPeaks = this.store.watchPeaks(this.movieId(), r, (p) => this.peaks.set(p));
    this.setUpAudio();
    document.documentElement.classList.add('editing');
  }

  ngAfterViewInit() {
    const css = getComputedStyle(this.host.nativeElement);
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    this.colors = { ink: v('--ink', '#000'), muted: v('--muted', '#888'), accent: v('--accent', '#c00'), line: v('--line', '#ddd'), surface: v('--surface', '#fff'), holly: v('--holly', '#1a7a4a') };

    this.host.nativeElement.addEventListener('click', this.onClick, true);
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this.host.nativeElement);
    this.measure();
    const loop = () => {
      if (this.playing() && !this.measuring && !this.audio.seeking) this.playhead.set(this.audio.currentTime);
      if (this.dirty) this.draw();
      this.frame = requestAnimationFrame(loop);
    };
    loop();
    this.host.nativeElement.querySelector<HTMLElement>('.editor-wave')?.focus({ preventScroll: true });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.fling);
    this.resize?.disconnect();
    this.stopPeaks();
    this.player.destroy();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    document.documentElement.classList.remove('editing');
  }

  private setUpAudio() {
    const a = this.audio;
    a.preload = 'auto';
    this.player.onState = (on) => this.playing.set(on);
    this.player.onError = () => this.message.set('Couldn’t play the recording. Check your connection.');
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration)) return this.known(a.duration);
      // Chrome can't tell how long some recordings are without going to the end.
      this.measuring = true;
      this.player.suspended = true;
      a.currentTime = Number.MAX_SAFE_INTEGER;
    };
    a.onseeked = () => {
      if (!this.measuring) return;
      this.measuring = false;
      this.player.suspended = false;
      if (Number.isFinite(a.duration)) this.known(a.duration);
      a.currentTime = this.playhead();
    };
    a.ondurationchange = () => {
      if (!this.measuring && Number.isFinite(a.duration)) this.known(a.duration);
    };
    a.onerror = () => {
      if (a.getAttribute('src')) this.message.set('Couldn’t load the recording. Check your connection and reopen the editor.');
    };
    this.listen();
    a.src = this.url();
  }

  private known(seconds: number) {
    if (seconds > 0 && Math.abs(seconds - this.duration()) > 0.001) {
      this.duration.set(seconds);
      this.measure();
    }
  }

  // Sizes and zoom

  private measure() {
    const canvases = [this.waveRef().nativeElement, this.overviewRef().nativeElement];
    const ratio = devicePixelRatio || 1;
    for (const c of canvases) {
      const box = c.getBoundingClientRect();
      c.width = Math.round(box.width * ratio);
      c.height = Math.round(box.height * ratio);
    }
    const first = !this.width;
    this.width = canvases[0].getBoundingClientRect().width || 300;
    // Starts showing about half a minute, which is close enough to cut by word.
    this.zoom.set(first || !this.zoom() ? Math.max(this.fit(), this.width / 30) : this.clampZoom(this.zoom()));
    this.dirty = true;
  }

  /** The zoom that shows the whole recording. */
  private fit() {
    return this.width / this.duration();
  }

  private clampZoom(z: number) {
    return Math.min(MAX_ZOOM, Math.max(this.fit(), z));
  }

  /** The recording's time at a point across the waveform. */
  private timeAt(x: number) {
    return this.playhead() + (x - this.width / 2) / this.zoom();
  }

  private xOf(t: number) {
    return this.width / 2 + (t - this.playhead()) * this.zoom();
  }

  private clampTime(t: number) {
    return Math.min(Math.max(t, 0), this.duration());
  }

  // Drawing

  private draw() {
    this.dirty = false;
    this.drawWave();
    this.drawOverview();
  }

  private drawWave() {
    const canvas = this.waveRef().nativeElement;
    const g = canvas.getContext('2d');
    if (!g) return;
    const ratio = canvas.width / (this.width || 1);
    const w = this.width;
    const h = canvas.height / ratio;
    const c = this.colors;
    const e = this.view();
    const d = this.duration();
    const zoom = this.zoom();
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);

    const ruler = 18;
    const mid = ruler + (h - ruler) / 2;
    const half = (h - ruler) / 2 - 6;

    // Seconds along the top
    const every = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200].find((s) => s * zoom >= 64) ?? 1800;
    g.font = '600 11px system-ui, sans-serif';
    g.textBaseline = 'top';
    g.fillStyle = c.muted;
    g.strokeStyle = c.line;
    g.lineWidth = 1;
    for (let t = Math.max(0, Math.floor(this.timeAt(0) / every) * every); t <= Math.min(d, this.timeAt(w)); t += every) {
      const x = Math.round(this.xOf(t)) + 0.5;
      g.beginPath();
      g.moveTo(x, ruler - 5);
      g.lineTo(x, ruler);
      g.stroke();
      g.fillText(clock(t, every < 1), x + 3, 2);
    }

    // Bars
    const peaks = this.peaks();
    const loudestPeak = this.loudestPeak();
    const sel = this.selection();
    const step = 3;
    for (let x = 0; x < w; x += step) {
      const t0 = this.timeAt(x);
      const t1 = this.timeAt(x + step);
      if (t1 < 0 || t0 > d) continue;
      const tm = (t0 + t1) / 2;
      const size = peaks ? height(loudest(peaks, t0 * PEAKS_PER_SECOND, t1 * PEAKS_PER_SECOND), loudestPeak) : 0.04;
      const bar = Math.max(1, size * half);
      const gone = tm < e.start || tm > e.end || !!cutAt(e, tm);
      g.fillStyle = sel && tm >= sel.start && tm <= sel.end ? c.accent : gone ? c.muted : c.ink;
      g.globalAlpha = gone ? 0.35 : 1;
      g.fillRect(x, mid - bar, step - 1, bar * 2);
    }
    g.globalAlpha = 1;

    // Trimmed ends, shaded
    g.fillStyle = c.muted;
    g.globalAlpha = 0.18;
    const left = this.xOf(e.start);
    const right = this.xOf(e.end);
    if (left > 0) g.fillRect(Math.max(0, this.xOf(0)), ruler, left - Math.max(0, this.xOf(0)), h - ruler);
    if (right < w) g.fillRect(right, ruler, Math.min(w, this.xOf(d)) - right, h - ruler);
    g.globalAlpha = 1;

    // Cuts, hatched
    this.hatch ??= this.makeHatch(g, c.accent);
    for (const cutSpan of e.cuts) {
      const a = this.xOf(cutSpan.start);
      const b = this.xOf(cutSpan.end);
      if (b < 0 || a > w) continue;
      const chosen = this.chosenCut();
      const isChosen = !!chosen && chosen.start === cutSpan.start && chosen.end === cutSpan.end;
      g.globalAlpha = isChosen ? 0.6 : 0.35;
      g.fillStyle = this.hatch ?? c.accent;
      g.fillRect(a, ruler, b - a, h - ruler);
      g.globalAlpha = 1;
      g.fillStyle = c.accent;
      g.fillRect(a - 1, ruler, 2, h - ruler);
      g.fillRect(b - 1, ruler, 2, h - ruler);
      if (isChosen) {
        this.grip(g, a, h, c.accent);
        this.grip(g, b, h, c.accent);
      }
    }

    // The intro and outro: a tint over what they play over, and a line at the mark
    g.font = '600 11px system-ui, sans-serif';
    for (const band of this.bands()) {
      const a = this.xOf(band.from);
      const b = this.xOf(band.to);
      const mx = Math.round(this.xOf(band.mark));
      g.fillStyle = JINGLE;
      g.globalAlpha = 0.14;
      if (b > a) g.fillRect(a, ruler, b - a, h - ruler);
      g.globalAlpha = 1;
      if (mx < -200 || mx > w + 200) continue;
      g.fillRect(mx - 1, ruler, 2, h - ruler);
      const text = band.label;
      const tw = g.measureText(text).width + 10;
      // The label sits on the side the jingle plays.
      const lx = band.to > band.mark || band.from === band.mark ? mx : mx - tw;
      g.beginPath();
      g.roundRect(lx, ruler + 2, tw, 16, 4);
      g.fill();
      g.fillStyle = '#fff';
      g.fillText(text, lx + 5, ruler + 4);
    }

    // Selection
    if (sel) {
      const a = this.xOf(sel.start);
      const b = this.xOf(sel.end);
      g.fillStyle = c.accent;
      g.globalAlpha = 0.15;
      g.fillRect(a, ruler, b - a, h - ruler);
      g.globalAlpha = 1;
      g.fillRect(a - 1, ruler, 2, h - ruler);
      g.fillRect(b - 1, ruler, 2, h - ruler);
      if (this.mark() == null) {
        this.grip(g, a, h, c.accent);
        this.grip(g, b, h, c.accent);
      }
    }

    // Trim handles: tabs that sit outside what's kept, like Voice Memos.
    g.fillStyle = HANDLE;
    g.strokeStyle = '#a8770f';
    for (const [x, side] of [
      [left, -1],
      [right, 1],
    ] as const) {
      if (x < -20 || x > w + 20) continue;
      g.fillRect(x - 1.5, ruler, 3, h - ruler);
      g.beginPath();
      g.roundRect(side < 0 ? x - 14 : x, mid - 22, 14, 44, side < 0 ? [8, 0, 0, 8] : [0, 8, 8, 0]);
      g.fill();
      g.stroke();
      g.fillStyle = '#a8770f';
      for (const dy of [-6, 0, 6]) g.fillRect(side < 0 ? x - 10 : x + 4, mid + dy - 1, 6, 2);
      g.fillStyle = HANDLE;
    }

    // Where playing started: a green flag
    const started = this.startMark();
    if (started != null) {
      const sx = Math.round(this.xOf(started));
      if (sx >= -10 && sx <= w + 10) {
        g.strokeStyle = c.holly;
        g.lineWidth = 2;
        g.setLineDash([5, 4]);
        g.beginPath();
        g.moveTo(sx, ruler);
        g.lineTo(sx, h);
        g.stroke();
        g.setLineDash([]);
        g.lineWidth = 1;
        g.fillStyle = c.holly;
        g.beginPath();
        g.moveTo(sx, ruler);
        g.lineTo(sx + 11, ruler + 6);
        g.lineTo(sx, ruler + 12);
        g.fill();
      }
    }

    // Playhead, fixed in the middle
    g.fillStyle = c.accent;
    g.fillRect(w / 2 - 1, ruler - 2, 2, h - ruler + 2);
    g.beginPath();
    g.moveTo(w / 2 - 6, ruler - 6);
    g.lineTo(w / 2 + 6, ruler - 6);
    g.lineTo(w / 2, ruler + 2);
    g.fill();
  }

  /** A round grip at the foot of an edge that can be dragged. */
  private grip(g: CanvasRenderingContext2D, x: number, h: number, color: string) {
    g.beginPath();
    g.arc(x, h - 10, 8, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = this.colors.surface;
    g.lineWidth = 2;
    g.stroke();
    g.lineWidth = 1;
  }

  private makeHatch(g: CanvasRenderingContext2D, color: string) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 8;
    const t = tile.getContext('2d');
    if (!t) return null;
    t.strokeStyle = color;
    t.lineWidth = 2;
    t.beginPath();
    t.moveTo(-2, 10);
    t.lineTo(10, -2);
    t.stroke();
    return g.createPattern(tile, 'repeat');
  }

  private drawOverview() {
    const canvas = this.overviewRef().nativeElement;
    const g = canvas.getContext('2d');
    if (!g) return;
    const w = canvas.getBoundingClientRect().width || this.width;
    const ratio = canvas.width / (w || 1);
    const h = canvas.height / ratio;
    const c = this.colors;
    const d = this.duration();
    const e = this.view();
    const peaks = this.peaks();
    const loudestPeak = this.loudestPeak();
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, w, h);
    const x = (t: number) => (t / d) * w;
    for (let px = 0; px < w; px += 2) {
      const t0 = (px / w) * d;
      const t1 = ((px + 2) / w) * d;
      const tm = (t0 + t1) / 2;
      const size = peaks ? height(loudest(peaks, t0 * PEAKS_PER_SECOND, t1 * PEAKS_PER_SECOND), loudestPeak) : 0.1;
      const bar = Math.max(1, (size * h) / 2 - 2);
      const gone = tm < e.start || tm > e.end || !!cutAt(e, tm);
      g.fillStyle = gone ? c.accent : c.ink;
      g.globalAlpha = gone ? 0.35 : 0.8;
      g.fillRect(px, h / 2 - bar, 1.5, bar * 2);
    }
    g.globalAlpha = 1;
    // What the waveform below is showing
    const a = x(this.timeAt(0));
    const b = x(this.timeAt(this.width));
    g.strokeStyle = c.ink;
    g.lineWidth = 2;
    g.strokeRect(Math.max(1, a), 1, Math.max(4, Math.min(w - 1, b) - Math.max(1, a)), h - 2);
    g.fillStyle = c.accent;
    for (const band of this.bands()) {
      g.fillStyle = JINGLE;
      g.globalAlpha = 0.25;
      g.fillRect(x(band.from), 0, Math.max(0, x(band.to) - x(band.from)), h);
      g.globalAlpha = 1;
      g.fillRect(x(band.mark) - 1, 0, 2, h);
    }
    const started = this.startMark();
    if (started != null) {
      g.fillStyle = c.holly;
      g.fillRect(x(started) - 1, 0, 2, h);
    }
    g.fillStyle = c.accent;
    g.fillRect(x(this.playhead()) - 1, 0, 2, h);
  }

  // Gestures on the waveform

  private localX(e: PointerEvent) {
    return e.clientX - this.waveRef().nativeElement.getBoundingClientRect().left;
  }

  protected down(e: PointerEvent) {
    // Touching the waveform stops the sound at once, whatever the touch turns out to be.
    if (this.playing()) this.pauseHere();
    const canvas = this.waveRef().nativeElement;
    canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, this.localX(e));
    cancelAnimationFrame(this.fling);
    if (this.pointers.size === 2) {
      this.endDrag(false);
      const [a, b] = [...this.pointers.values()];
      this.drag = { kind: 'pinch', distance: Math.max(10, Math.abs(a - b)), zoom: this.zoom() };
      return;
    }
    if (this.pointers.size > 2) return;
    const x = this.localX(e);
    const hit = this.hit(x);
    if (hit) {
      this.drag = hit;
      this.pause();
      return;
    }
    const timer = setTimeout(() => {
      if (this.drag?.kind !== 'wait') return;
      const anchor = this.clampTime(this.timeAt(this.drag.x));
      this.mark.set(null);
      this.chosenCut.set(null);
      this.fixedSelection.set({ start: anchor, end: anchor });
      this.drag = { kind: 'select', anchor };
      navigator.vibrate?.(10);
    }, LONG_PRESS);
    this.drag = { kind: 'wait', x, y: e.clientY, at: this.playhead(), timer };
  }

  /** Which handle, if any, is within reach of a point. */
  private hit(x: number): Drag | null {
    const e = this.view();
    const found: { distance: number; drag: Drag }[] = [];
    const near = (t: number, drag: Drag) => {
      const distance = Math.abs(this.xOf(t) - x);
      if (distance <= REACH) found.push({ distance, drag });
    };
    const sel = this.fixedSelection();
    if (sel && this.mark() == null) {
      near(sel.start, { kind: 'selection', edge: 'start' });
      near(sel.end, { kind: 'selection', edge: 'end' });
    }
    const chosen = this.chosenCut();
    e.cuts.forEach((c, index) => {
      if (chosen && chosen.start === c.start && chosen.end === c.end) {
        near(c.start, { kind: 'cut', base: e, index, edge: 'start' });
        near(c.end, { kind: 'cut', base: e, index, edge: 'end' });
      }
    });
    // The trim tabs stick out, so reach them a little further out than in.
    near(e.start - 7 / this.zoom(), { kind: 'start', base: e });
    near(e.end + 7 / this.zoom(), { kind: 'end', base: e });
    found.sort((a, b) => a.distance - b.distance);
    return found[0]?.drag ?? null;
  }

  protected move(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) return;
    const x = this.localX(e);
    this.pointers.set(e.pointerId, x);
    const drag = this.drag;
    if (!drag) return;
    const t = this.clampTime(this.timeAt(x));
    switch (drag.kind) {
      case 'pinch': {
        const [a, b] = [...this.pointers.values()];
        if (b === undefined) return;
        this.zoom.set(this.clampZoom((drag.zoom * Math.max(10, Math.abs(a - b))) / drag.distance));
        return;
      }
      case 'wait':
        if (Math.abs(x - drag.x) > SLOP || Math.abs(e.clientY - drag.y) > SLOP) {
          clearTimeout(drag.timer);
          const resume = this.playing();
          this.pause();
          this.drag = { kind: 'scrub', x: drag.x, at: drag.at, lastX: x, lastT: e.timeStamp, velocity: 0, resume };
          this.move(e);
        }
        return;
      case 'scrub': {
        this.seekTo(drag.at - (x - drag.x) / this.zoom());
        const dt = e.timeStamp - drag.lastT;
        if (dt > 0) drag.velocity = 0.8 * ((x - drag.lastX) / dt) + 0.2 * drag.velocity;
        drag.lastX = x;
        drag.lastT = e.timeStamp;
        return;
      }
      case 'select':
        this.fixedSelection.set({ start: Math.min(drag.anchor, t), end: Math.max(drag.anchor, t) });
        return;
      case 'selection': {
        const s = this.fixedSelection();
        if (!s) return;
        this.fixedSelection.set(drag.edge === 'start' ? { start: Math.min(t, s.end - GAP), end: s.end } : { start: s.start, end: Math.max(t, s.start + GAP) });
        return;
      }
      case 'start':
        this.edit.set({ ...drag.base, start: Math.max(0, Math.min(t, drag.base.end - GAP)) });
        return;
      case 'end':
        this.edit.set({ ...drag.base, end: Math.min(this.duration(), Math.max(t, drag.base.start + GAP)) });
        return;
      case 'cut': {
        const cuts = drag.base.cuts.map((c, i) => {
          if (i !== drag.index) return c;
          return drag.edge === 'start' ? { start: Math.max(drag.base.start, Math.min(t, c.end - GAP)), end: c.end } : { start: c.start, end: Math.min(drag.base.end, Math.max(t, c.start + GAP)) };
        });
        this.edit.set({ ...drag.base, cuts });
        this.chosenCut.set(cuts[drag.index]);
        return;
      }
    }
  }

  protected up(e: PointerEvent) {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.drag?.kind === 'pinch') {
      // The other finger carries on as nothing, until it's lifted too.
      if (!this.pointers.size) this.drag = null;
      return;
    }
    this.endDrag(e.type === 'pointerup');
  }

  private endDrag(lifted: boolean) {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    switch (drag.kind) {
      case 'wait':
        clearTimeout(drag.timer);
        if (lifted) this.tap(drag.x);
        return;
      case 'scrub':
        if (lifted && Math.abs(drag.velocity) > 0.3) this.coast(drag.velocity, drag.resume);
        else if (drag.resume) this.play();
        return;
      case 'select': {
        const s = this.fixedSelection();
        if (!s || s.end - s.start < GAP) this.fixedSelection.set(null);
        else this.announcement.set(`Selected ${clock(s.end - s.start, true)}.`);
        return;
      }
      case 'start':
      case 'end':
      case 'cut': {
        const done = normalize(this.edit(), this.duration());
        this.edit.set(drag.base);
        this.apply(done);
        // The cut that was dragged may have merged with another.
        const moved = this.chosenCut();
        if (drag.kind === 'cut') this.chosenCut.set((moved && done.cuts.find((c) => c.start <= moved.end && c.end >= moved.start)) ?? null);
        return;
      }
    }
  }

  /** A tap on a cut picks it; anywhere else lets it go. */
  private tap(x: number) {
    const t = this.timeAt(x);
    const c = cutAt(this.view(), t);
    if (c) {
      this.fixedSelection.set(null);
      this.mark.set(null);
      this.chosenCut.set(c);
      this.announcement.set(`Cut of ${clock(c.end - c.start, true)} chosen.`);
    } else {
      this.chosenCut.set(null);
      const s = this.fixedSelection();
      if (s && (t < s.start || t > s.end)) this.fixedSelection.set(null);
    }
  }

  /** Keeps sliding after a flick, slowing down. */
  private coast(velocity: number, resume: boolean) {
    let v = velocity;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      this.seekTo(this.playhead() - (v * dt) / this.zoom());
      v *= Math.pow(0.94, dt / 16);
      if (Math.abs(v) > 0.02 && this.playhead() > 0 && this.playhead() < this.duration()) this.fling = requestAnimationFrame(step);
      else if (resume) this.play();
    };
    this.fling = requestAnimationFrame(step);
  }

  // The overview strip

  protected overviewDown(e: PointerEvent) {
    if (this.playing()) this.pauseHere();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    this.overviewMove(e);
  }

  protected overviewMove(e: PointerEvent) {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const box = (e.target as HTMLElement).getBoundingClientRect();
    cancelAnimationFrame(this.fling);
    this.seekTo(((e.clientX - box.left) / box.width) * this.duration());
  }

  protected key(e: KeyboardEvent) {
    const by = e.shiftKey ? 0.1 : 1;
    if (e.key === 'ArrowLeft') this.nudge(-by);
    else if (e.key === 'ArrowRight') this.nudge(by);
    else if (e.key === ' ') this.togglePlay();
    else if (e.key === '+' || e.key === '=') this.zoom.set(this.clampZoom(this.zoom() * 1.5));
    else if (e.key === '-') this.zoom.set(this.clampZoom(this.zoom() / 1.5));
    else return;
    e.preventDefault();
  }

  // Moving and playing

  private seekTo(t: number) {
    const to = this.clampTime(t);
    this.playhead.set(to);
    if (!this.measuring) this.audio.currentTime = to;
  }

  protected nudge(by: number) {
    this.seekTo(this.playhead() + by);
  }

  protected togglePlay() {
    if (this.playing()) this.pauseHere();
    else this.play();
  }

  /** Set when a button has already acted as the finger came down, so the click that follows is ignored. */
  private swallowClick = false;
  private readonly onClick = (e: MouseEvent) => {
    if (!this.swallowClick) return;
    this.swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  };

  /**
   * Acts as soon as the finger touches, rather than when it lifts as a click does, so stopping is
   * instant. The click that follows, which would land on the Play button that replaces this one, is
   * ignored. Keys still work through the click.
   */
  protected now(e: PointerEvent, act: () => void) {
    if (e.button !== 0) return;
    act.call(this);
    this.swallowClick = true;
    setTimeout(() => (this.swallowClick = false), 800);
  }

  /** Stops where it is. Playing on from there keeps the place it first started from, for Stop. */
  protected pauseHere() {
    this.pause();
    this.pausedAt.set(this.playhead());
  }

  /** Jumps back to where playing started, and plays on from there. */
  protected replay() {
    const back = this.returnTo();
    if (back == null) return;
    // From the top, the intro's lead-in comes again too.
    this.pause();
    this.play(back);
  }

  protected playFromBeginning() {
    this.play(this.spans()[0]?.start ?? 0);
  }

  /** Stopping goes back to where playing started, so the same stretch can be heard again. */
  protected stop() {
    const back = this.returnTo();
    this.pausedAt.set(null);
    this.pause();
    if (back != null) this.seekTo(back);
  }

  protected play(from = this.playhead()) {
    this.message.set('');
    const resuming = this.pausedAt() != null && Math.abs(from - this.pausedAt()!) < 0.001 && this.returnTo() != null;
    if (!resuming) this.returnTo.set(from);
    this.pausedAt.set(null);
    this.listen();
    // Plays from the playhead, or from the top if it's past what's kept.
    const start = this.player.from(from) ?? this.spans()[0]?.start ?? 0;
    this.seekTo(start);
    this.player.play().catch((e) => {
      if (e?.name !== 'AbortError') this.message.set('Couldn’t play the recording. Check your connection.');
    });
  }

  private pause() {
    this.player.pause();
  }

  /** Back to playing the edit as it is, after hearing around a cut. */
  private listen() {
    this.player.spans = this.spans();
    this.player.stopAt = null;
    this.player.onFinish = () => this.finished();
  }

  /** Reaching the end goes back to where playing started, as Stop does. */
  private finished() {
    this.pausedAt.set(null);
    const back = this.returnTo();
    if (back != null) this.seekTo(back);
    this.listen();
  }

  /** Plays either side of a stretch: a cut, or the selection as if it were cut. */
  protected hear(span: Span, asIfCut: boolean) {
    const d = this.duration();
    const e = this.view();
    const spans = asIfCut ? kept(cut(e, span, d), d) : this.spans();
    const from = Math.max(0, span.start - AROUND);
    this.returnTo.set(this.playhead());
    this.player.spans = spans;
    this.player.stopAt = Math.min(d, span.end + AROUND);
    this.pausedAt.set(null);
    this.player.onFinish = () => this.finished();
    const start = this.player.from(from);
    if (start == null) return;
    this.seekTo(start);
    void this.player.play().catch(() => {});
  }

  // Editing

  private apply(next: Cuts) {
    this.edit.set(next);
  }

  protected markStart() {
    this.chosenCut.set(null);
    this.fixedSelection.set(null);
    this.mark.set(this.playhead());
    this.announcement.set(`Cut starts at ${clock(this.playhead(), true)}. Move to where the cut ends, then press End Cut.`);
  }

  protected markEnd() {
    const s = this.selection();
    this.mark.set(null);
    if (s && s.end - s.start >= GAP) this.fixedSelection.set(s);
  }

  protected clearSelection() {
    this.fixedSelection.set(null);
    this.mark.set(null);
  }

  protected cutSelection() {
    const s = this.selection();
    if (!s) return;
    const next = cut(this.view(), s, this.duration());
    if (next === this.view()) {
      this.message.set('That would cut everything that’s left.');
      return;
    }
    this.apply(next);
    this.clearSelection();
    this.seekTo(s.start);
    this.announcement.set(`Cut ${clock(s.end - s.start, true)}.`);
  }

  protected putBack(c: Span) {
    this.apply(restore(this.view(), c, this.duration()));
    this.chosenCut.set(null);
    this.announcement.set('Cut restored.');
  }

  protected trimStart() {
    const e = this.view();
    const t = this.playhead();
    if (t >= e.end - GAP) return this.message.set('Move the playhead before the end first.');
    this.apply({ ...e, start: t });
    this.announcement.set(`Recording now starts at ${clock(t, true)}.`);
  }

  protected untrimStart() {
    this.apply({ ...this.view(), start: 0 });
    this.announcement.set('The start is back.');
  }

  protected untrimEnd() {
    // Untrimmed, whatever the file's length turns out to be.
    this.apply({ ...this.view(), end: Infinity });
    this.announcement.set('The end is back.');
  }

  protected trimEnd() {
    const e = this.view();
    const t = this.playhead();
    if (t <= e.start + GAP) return this.message.set('Move the playhead after the start first.');
    this.apply({ ...e, end: t });
    this.announcement.set(`Recording now ends at ${clock(t, true)}.`);
  }

  protected setIntro() {
    const t = snapMark(this.spans(), this.playhead());
    this.marks.update((m) => ({ ...m, introEnd: t }));
    this.announcement.set(`The intro now ends at ${clock(t, true)}.`);
  }

  protected setOutro() {
    const t = snapMark(this.spans(), this.playhead());
    this.marks.update((m) => ({ ...m, outroStart: t }));
    this.announcement.set(`The outro now starts at ${clock(t, true)}.`);
  }

  protected removeMark(which: keyof Marks) {
    this.marks.update((m) => {
      const { [which]: _, ...rest } = m;
      return rest;
    });
    this.announcement.set(which === 'introEnd' ? 'No intro.' : 'No outro.');
  }

  // Leaving

  private unsaved() {
    const d = this.duration();
    return !sameCuts(this.view(), normalize(this.initial, d)) || !sameMarks(this.marks(), this.initialMarks);
  }

  protected cancel() {
    if (this.unsaved()) this.confirmingClose.set(true);
    else this.close();
  }

  protected close() {
    this.closed.emit();
  }

  protected async done() {
    if (!this.unsaved()) return this.close();
    this.saving.set(true);
    this.message.set('');
    try {
      // Offline, the save waits to be sent; it's kept on the device, so there's no need to wait here.
      await Promise.race([this.store.saveEdit(this.movieId(), this.review(), this.view(), this.duration(), this.marks()), new Promise((r) => setTimeout(r, 4000))]);
      this.close();
    } catch {
      this.message.set('Couldn’t save the edit. Sign in again if you were signed out, and try again.');
    } finally {
      this.saving.set(false);
    }
  }
}

