import { NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { Marks, Span, changes, clock, editedLength, kept, mixPlan, normalize, sameCuts, sameMarks, spotsOf, whole } from './audio-edit';
import { AudioEditor } from './audio-editor';
import { MovieStore } from './movie-store';
import { Published, Review, ReviewStore, Upload } from './review-store';
import { jingleLengths, loadJingles } from './jingles';
import { MixPlayer } from './mix-player';

/** A guard against a recording nobody stopped. Recording stops and saves here. */
const MAX_SECONDS = 45 * 60;
const BITS_PER_SECOND = 128_000;
const MIC_KEY = 'yule-swoon-mic';

/** MP4 first because every browser plays it; not every one records it. */
const TYPES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus'];

interface Mic {
  id: string;
  label: string;
}

/** Remembered by name too, because some browsers change a mic's id between visits. */
function rememberedMic(): Mic | null {
  try {
    const m = JSON.parse(localStorage.getItem(MIC_KEY) ?? 'null');
    return typeof m?.id === 'string' && typeof m?.label === 'string' ? m : null;
  } catch {
    return null;
  }
}

/** Something the list can play: a recording, edited or not, or a published version. */
interface Playable {
  id: string;
  path: string;
  seconds: number;
  /** What's kept of a recording that's edited; null to play it all. */
  spans: Span[] | null;
  /** Where its intro and outro go, if it has any. */
  marks: Marks | null;
  /** How long it plays for, jingles and all. */
  length: number;
  label: string;
}

/** A recording's length: as timed while recording, or further if an edit was made against the file's own length. */
function lengthOfRecording(r: Review): number {
  return Math.max(r.seconds, r.edit && Number.isFinite(r.edit.end) ? r.edit.end : 0);
}

/** Records, lists, plays, edits, publishes and deletes a movie's audio reviews. */
@Component({
  selector: 'app-audio-reviews',
  imports: [AudioEditor, NgTemplateOutlet],
  host: { class: 'crit', role: 'group', 'aria-labelledby': 'audio-title' },
  template: `
    <h3 id="audio-title">Audio Reviews</h3>

    <!-- Pinned to the corner of the screen, so it's in reach wherever the form is scrolled to. -->
    <div class="rec" [class.on]="store.recording()" role="group" aria-label="Audio review recorder">
      <span class="rec-wreath" aria-hidden="true"></span>
      <svg class="rec-bow" viewBox="0 0 68 54" aria-hidden="true">
        <g stroke="#a8770f" stroke-width="2" stroke-linejoin="round"><path fill="#e0a526" d="M31 24L18 50L26 46L31 52L36 28Z"/><path fill="#e0a526" d="M37 24L50 50L42 46L37 52L32 28Z"/><path fill="#f4c542" d="M34 20C24 4 6 2 4 10C2 20 4 32 10 33C18 34 28 28 34 22Z"/><path fill="#f4c542" d="M34 20C44 4 62 2 64 10C66 20 64 32 58 33C50 34 40 28 34 22Z"/><path fill="none" d="M12 12Q20 16 28 20M56 12Q48 16 40 20"/><rect x="27" y="14" width="14" height="15" rx="5" fill="#ffdd7a"/></g>
      </svg>
      @if (store.recording()) {
        <button type="button" class="rec-key" aria-label="Stop recording" title="Stop" [style.--level]="level()" (click)="stop()">
          <span class="rec-square" aria-hidden="true"></span>
        </button>
        <span class="rec-time" [class.ending]="elapsed() >= maxSeconds - 60">{{ clock(elapsed()) }}</span>
      } @else {
        <button
          type="button"
          class="rec-key"
          title="Record"
          [attr.aria-label]="reviews().length || uploads().length ? 'Record another review' : 'Record a review'"
          [disabled]="starting() || access() === 'blocked' || access() === 'unsupported'"
          (click)="record()"
        >
          <span class="rec-circle" aria-hidden="true"></span>
        </button>
        @if (access() === 'ask') {
          <button type="button" class="rec-allow" [disabled]="starting()" (click)="allow()">Allow mic</button>
        } @else {
          <span class="rec-mic" [class.off]="access() !== 'granted'" [title]="micName()">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5M8.5 21.5h7" />
              @if (access() === 'blocked' || access() === 'unsupported' || access() === 'none') {
                <path d="M4 3l16 18" />
              }
            </svg>
            @if (access() === 'granted') {
              <!-- Invisible over the icon, so a tap opens the device's own picker. -->
              <select aria-label="Microphone" [disabled]="starting()" (change)="choose($any($event.target).value)">
                @for (m of mics(); track m.id) {
                  <option [value]="m.id" [selected]="m.id === mic()">{{ m.label }}</option>
                }
              </select>
            }
          </span>
        }
      }
      @if (note()) {
        <p class="rec-note" role="status">{{ note() }}</p>
      }
    </div>

    @if (listMessage()) {
      <p class="note" role="alert">{{ listMessage() }}</p>
    }
    <p class="sr-only" role="status">{{ announcement() }}</p>

    <h4 class="audio-sub">Recordings</h4>
    @if (uploads().length || reviews().length) {
      <ul class="recordings">
        @for (u of uploads(); track u.id) {
          <li>
            @if (u.problem) {
              <p class="error" role="alert">{{ u.problem }} ({{ clock(u.seconds) }})</p>
              <span class="confirm">
                <button type="button" class="btn" (click)="store.retry(u)">Try again</button>
                <button type="button" class="btn quiet" (click)="store.discard(u)">Discard</button>
              </span>
            } @else {
              <span class="muted">Saving… {{ clock(u.seconds) }}</span>
              <progress [value]="u.progress" max="1" aria-label="Saving recording"></progress>
            }
          </li>
        }
        @for (r of reviews(); track r.id) {
          @let spans = spansOf(r);
          <li>
            <div class="recording-head">
              <span class="muted">
                {{ when(r.createdAt) }} ·
                @if (spans || r.marks) {
                  {{ clock(finalLength(r)) }} of {{ clock(r.seconds) }}
                } @else {
                  {{ clock(r.seconds) }}
                }
              </span>
              @if (spans) {
                <span class="tag">Edited</span>
              }
              @if (r.marks?.introEnd != null) {
                <span class="tag">Intro</span>
              }
              @if (r.marks?.outroStart != null) {
                <span class="tag">Outro</span>
              }
              @if (publishedAs(r); as state) {
                <span class="tag" [class.quiet]="state === 'changed'">{{ state === 'same' ? 'Published' : 'Changed since published' }}</span>
              }
            </div>
            @if (confirming() === r.id) {
              <span class="confirm">
                Delete this recording? Published versions are kept.
                <button type="button" class="btn danger" [disabled]="busy()" (click)="remove(r)">Delete</button>
                <button type="button" class="btn quiet" [disabled]="busy()" (click)="confirming.set('')">Keep</button>
              </span>
            } @else if (publishing() === r.id) {
              <form class="publish" (submit)="publish($event, r)">
                <p class="muted">Publishes the recording as it’s edited now, {{ clock(finalLength(r)) }} long, as a new episode.</p>
                <label for="pub-title">Title</label>
                <input id="pub-title" type="text" required [value]="pubTitle()" (input)="pubTitle.set($any($event.target).value)" />
                <label for="pub-notes">Notes</label>
                <textarea id="pub-notes" rows="3" [value]="pubNotes()" (input)="pubNotes.set($any($event.target).value)"></textarea>
                <span class="confirm">
                  <button type="submit" class="btn primary" [disabled]="busy() || !pubTitle().trim()">{{ busy() ? 'Publishing…' : 'Publish' }}</button>
                  <button type="button" class="btn quiet" [disabled]="busy()" (click)="publishing.set('')">Cancel</button>
                </span>
              </form>
            } @else {
              @let item = { id: r.id, path: r.path, seconds: r.seconds, spans: spans, marks: r.marks ?? null, length: finalLength(r), label: 'recording from ' + when(r.createdAt) };
              <ng-container *ngTemplateOutlet="player; context: { $implicit: item }" />
              <div class="recording-actions">
                <button type="button" class="btn" [disabled]="store.recording()" (click)="edit(r)">Edit</button>
                <button
                  type="button"
                  class="btn"
                  [disabled]="!store.canPublish()"
                  [title]="store.canPublish() ? '' : 'Publishing needs the live site'"
                  (click)="startPublishing(r)"
                >
                  Publish
                </button>
                <button type="button" class="btn quiet" [attr.aria-label]="'Delete recording from ' + when(r.createdAt)" (click)="confirming.set(r.id)">Delete</button>
              </div>
            }
          </li>
        }
      </ul>
    }
    @if (store.status() === 'ready' && !uploads().length && !reviews().length) {
      <p class="note">No recordings yet.</p>
    }
    @if (store.status() === 'loading' && store.slow()) {
      <p class="note">Still trying to reach the saved recordings…</p>
    }
    @if (store.status() === 'unavailable') {
      <p class="note">The saved recordings can’t be reached right now. Check your connection and reopen this page.</p>
    }
    @if (!store.canPublish() && reviews().length) {
      <p class="note">Publishing needs the live site, so it’s off while previewing.</p>
    }

    @if (store.published().length) {
      <h4 class="audio-sub">Published</h4>
      <ul class="recordings">
        @for (p of store.published(); track p.id) {
          <li>
            <div class="recording-head">
              <strong class="published-title">{{ p.title || 'Untitled' }}</strong>
              <span class="muted">{{ when(p.publishedAt || p.createdAt) }} · {{ clock(p.seconds || p.source.seconds) }}</span>
            </div>
            @if (p.description) {
              <p class="published-notes muted">{{ p.description }}</p>
            }
            @if (confirming() === p.id) {
              <span class="confirm">
                Delete this published version? The recording is kept.
                <button type="button" class="btn danger" [disabled]="busy()" (click)="removePublished(p)">Delete</button>
                <button type="button" class="btn quiet" [disabled]="busy()" (click)="confirming.set('')">Keep</button>
              </span>
            } @else {
              @if (p.status === 'done') {
                @let item = { id: p.id, path: p.path, seconds: p.seconds, spans: null, marks: null, length: p.seconds, label: p.title || 'published version' };
                <ng-container *ngTemplateOutlet="player; context: { $implicit: item }" />
              } @else if (p.status === 'error') {
                <p class="error" role="alert">{{ p.error || 'Couldn’t make this version’s file.' }}</p>
              } @else if (stuck(p)) {
                <p class="error" role="alert">This is taking far too long. Try again.</p>
              } @else {
                <span class="muted">Publishing… this takes a minute or so.</span>
                <progress aria-label="Publishing"></progress>
              }
              <div class="recording-actions">
                @if (p.status === 'error' || stuck(p)) {
                  <button type="button" class="btn" [disabled]="busy()" (click)="retryPublish(p)">Try again</button>
                }
                <button type="button" class="btn quiet" [attr.aria-label]="'Delete published version ' + p.title" (click)="confirming.set(p.id)">Delete</button>
              </div>
            }
          </li>
        }
      </ul>
    }

    <ng-template #player let-item>
      @let current = playing() === item.id;
      @let length = item.length;
      @let at = current ? position() : 0;
      <div class="player">
        <button type="button" class="player-key" [disabled]="store.recording()" [attr.aria-label]="(current && !paused() ? 'Pause ' : 'Play ') + item.label" (click)="toggle(item)">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            @if (current && !paused()) {
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            } @else {
              <path d="M8 4.5v15l12-7.5z" />
            }
          </svg>
        </button>
        <input
          type="range"
          min="0"
          step="0.1"
          [max]="length"
          [value]="at"
          [disabled]="!current"
          aria-label="Position"
          [attr.aria-valuetext]="clock(at)"
          (input)="seek($any($event.target).value)"
        />
        <span class="player-time">{{ clock(at) }}</span>
      </div>
    </ng-template>

    @if (editing(); as e) {
      <!-- Loaded when first opened, as only Kiki ever needs it. -->
      @defer (on immediate) {
        <app-audio-editor [movieId]="movieId()" [review]="e.review" [url]="e.url" (closed)="editing.set(null)" />
      } @loading (minimum 0ms) {
        <p class="note" role="status">Opening the editor…</p>
      }
    }
  `,
})
export class AudioReviews implements OnInit, OnDestroy {
  protected readonly store = inject(ReviewStore);
  readonly movieId = input.required<string>();

  protected readonly maxSeconds = MAX_SECONDS;
  protected readonly reviews = computed(() => this.store.list(this.movieId()));
  protected readonly uploads = computed(() => this.store.uploads().filter((u: Upload) => u.movieId === this.movieId()));
  /** Shown with the recording controls. */
  protected readonly message = signal('');
  /** Shown with the list of recordings. */
  protected readonly listMessage = signal('');
  protected readonly announcement = signal('');

  // Recording
  protected readonly access = signal<'checking' | 'ask' | 'granted' | 'blocked' | 'none' | 'unsupported'>('checking');
  protected readonly mics = signal<Mic[]>([]);
  /** The chosen mic's id. */
  protected readonly mic = signal('');
  protected readonly starting = signal(false);
  protected readonly elapsed = signal(0);
  /** How loud the mic is, from 0 to 1. */
  protected readonly level = signal(0);
  protected readonly micName = computed(() => this.mics().find((m) => m.id === this.mic())?.label ?? '');
  /** What to say under the recording controls, if anything. */
  protected readonly note = computed(() => {
    switch (this.access()) {
      case 'blocked':
        return 'Microphone blocked. Allow it in this site’s browser settings, then reload.';
      case 'unsupported':
        return 'This browser can’t record here. Use an up-to-date browser on the live site.';
      case 'none':
        return 'No microphone found. Plug one in and try again.';
      default:
        return this.message();
    }
  });
  private recorder: MediaRecorder | undefined;
  private destroyed = false;

  // Playing: one player for every row, so only one can sound at a time.
  protected readonly playing = signal('');
  protected readonly paused = signal(true);
  protected readonly position = signal(0);
  private readonly audio = new Audio();
  /** Set while finding the length of a file that doesn't state it, which Chrome can't seek in otherwise. */
  private measuring = false;

  /** Plays recordings as they'll be published, cut and with their jingles. */
  private readonly mix = new MixPlayer(this.audio);

  protected readonly confirming = signal('');
  protected readonly busy = signal(false);

  // Editing and publishing
  private readonly movies = inject(MovieStore);
  protected readonly editing = signal<{ review: Review; url: string } | null>(null);
  /** The recording whose publish form is open. */
  protected readonly publishing = signal('');
  protected readonly pubTitle = signal('');
  protected readonly pubNotes = signal('');

  private readonly onDevices = () => void this.checkAccess();

  constructor() {
    effect((onCleanup) => onCleanup(this.store.watch(this.movieId())));
    // Safari only plays in direct answer to a tap, so the addresses have to be ready beforehand.
    effect(() => {
      for (const r of this.reviews()) this.store.url(r).catch(() => {});
      for (const p of this.store.published()) if (p.status === 'done' && p.path) this.store.url(p).catch(() => {});
    });
    let saving: string[] = [];
    effect(() => {
      const saved = new Set(this.reviews().map((r) => r.id));
      if (saving.some((id) => saved.has(id))) this.announcement.set('Recording saved.');
      saving = this.uploads().map((u) => u.id);
    });
    // Their lengths are needed to show how long recordings with them are, and they should be ready to play.
    effect(() => {
      if (this.reviews().some((r) => r.marks)) loadJingles().catch(() => {});
    });
    this.setUpPlayer();
  }

  ngOnInit() {
    navigator.mediaDevices?.addEventListener('devicechange', this.onDevices);
    void this.checkAccess();
  }

  /** Leaving mid-recording keeps what was recorded: stopping it hands it to the store, which uploads it. */
  ngOnDestroy() {
    this.destroyed = true;
    navigator.mediaDevices?.removeEventListener('devicechange', this.onDevices);
    this.stop();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.mix.destroy();
  }

  /** What's kept of a recording, or null if it isn't edited. */
  protected spansOf(r: Review): Span[] | null {
    const d = lengthOfRecording(r);
    return r.edit && changes(r.edit, d) ? kept(r.edit, d) : null;
  }

  /** How long a recording plays for as it'd be published, edited and with its jingles once they're loaded. */
  protected finalLength(r: Review): number {
    const d = lengthOfRecording(r);
    const spans = kept(r.edit, d);
    const lengths = jingleLengths();
    const recorded = editedLength(spans);
    return lengths ? mixPlan(recorded, spotsOf(r.marks, spans), lengths).length : recorded;
  }

  /** Whether a recording has been published, and if so whether it's been edited since. */
  protected publishedAs(r: Review): 'same' | 'changed' | null {
    const latest = this.store.published().find((p) => p.source.reviewId === r.id);
    if (!latest) return null;
    const d = lengthOfRecording(r);
    return sameCuts(normalize(latest.source.edit, d), normalize(r.edit ?? whole(d), d)) && sameMarks(latest.source.marks, r.marks) ? 'same' : 'changed';
  }

  protected async edit(r: Review) {
    this.listMessage.set('');
    if (this.playing()) this.stopPlaying();
    try {
      const url = this.store.knownUrl(r.id) ?? (await this.store.url(r));
      if (!this.destroyed) this.editing.set({ review: r, url });
    } catch {
      this.listMessage.set('Couldn’t open that recording. Check your connection and try again.');
    }
  }

  protected startPublishing(r: Review) {
    this.confirming.set('');
    this.pubTitle.set(this.movies.byId(this.movieId())?.title ?? '');
    this.pubNotes.set('');
    this.publishing.set(r.id);
  }

  protected async publish(event: Event, r: Review) {
    event.preventDefault();
    const title = this.pubTitle().trim();
    if (!title || this.busy()) return;
    this.busy.set(true);
    this.listMessage.set('');
    try {
      const details = { title, description: this.pubNotes().trim(), movieTitle: this.movies.byId(this.movieId())?.title ?? '' };
      // Offline, it's kept on the device and sent later, so there's no need to wait.
      await Promise.race([this.store.publish(this.movieId(), r, details, lengthOfRecording(r)), new Promise((ok) => setTimeout(ok, 4000))]);
      this.publishing.set('');
      this.announcement.set('Publishing. It’s listed under Published.');
    } catch {
      this.listMessage.set('Couldn’t publish that recording. Sign in again if you were signed out, and try again.');
    }
    this.busy.set(false);
  }

  /** Whether a version has been waiting longer than the backend ever takes, which means it stopped. */
  protected stuck(p: Published): boolean {
    return p.status !== 'done' && p.status !== 'error' && Date.now() - +new Date(p.requestedAt) > 15 * 60_000;
  }

  protected async retryPublish(p: Published) {
    this.listMessage.set('');
    try {
      await this.store.retryPublish(p);
    } catch {
      this.listMessage.set('Couldn’t try again. Check your connection.');
    }
  }

  protected async removePublished(p: Published) {
    this.busy.set(true);
    this.listMessage.set('');
    if (this.playing() === p.id) this.stopPlaying();
    try {
      await this.store.removePublished(this.movieId(), p);
      this.announcement.set('Published version deleted.');
    } catch {
      this.listMessage.set('Couldn’t delete that published version. Check your connection and try again.');
    }
    this.busy.set(false);
    this.confirming.set('');
  }

  protected readonly clock = clock;

  protected when(iso: string): string {
    const d = new Date(iso);
    if (isNaN(+d)) return 'Unknown date';
    const day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${day} at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }

  /** Finds out whether the mic may be used, and which there are. Never asks. */
  private async checkAccess() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.access.set('unsupported');
      return;
    }
    try {
      if (await this.loadMics()) {
        this.access.set('granted');
        return;
      }
    } catch {}
    // Once allowed, it stays allowed here even if the browser goes back to hiding mic names.
    if (this.access() === 'granted') return;
    this.access.set((await this.denied()) ? 'blocked' : 'ask');
  }

  private async denied(): Promise<boolean> {
    try {
      return (await navigator.permissions.query({ name: 'microphone' as PermissionName })).state === 'denied';
    } catch {
      return false;
    }
  }

  /** Lists the mics and settles on one. False if the browser isn't giving their names, which it only does once allowed. */
  private async loadMics(): Promise<boolean> {
    const found = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput' && d.deviceId !== 'communications');
    if (!found.some((d) => d.label)) return false;
    const mics = found.map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
    this.mics.set(mics);
    const wanted = rememberedMic();
    const match = wanted && (mics.find((m) => m.id === wanted.id) ?? mics.find((m) => m.label === wanted.label));
    // Browsers list the default first.
    const use = match || mics[0];
    if (wanted && !match && this.mic() !== use.id) this.message.set(`“${wanted.label}” isn’t connected. Using ${use.label} instead.`);
    else if (match && this.mic() !== use.id) this.message.set('');
    this.mic.set(use.id);
    return true;
  }

  protected choose(id: string) {
    this.mic.set(id);
    this.message.set('');
    const chosen = this.mics().find((m) => m.id === id);
    try {
      if (chosen) localStorage.setItem(MIC_KEY, JSON.stringify(chosen));
    } catch {}
  }

  /** Has the browser ask for the mic, without recording. */
  protected async allow() {
    if (this.starting()) return;
    this.starting.set(true);
    this.message.set('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Names are certain to be given while the mic is open.
      const named = await this.loadMics().catch(() => false);
      stream.getTracks().forEach((t) => t.stop());
      if (!named) {
        this.mics.set([{ id: '', label: 'Default microphone' }]);
        this.mic.set('');
      }
      this.access.set('granted');
      if (!this.message()) this.message.set('Pick your mic, then record.');
    } catch (e) {
      await this.explain(e);
    } finally {
      this.starting.set(false);
    }
  }

  protected async record() {
    if (this.starting() || this.store.recording()) return;
    // The first press only asks, so the first recording can't be made on the wrong mic.
    if (this.access() !== 'granted') return this.allow();
    this.starting.set(true);
    this.message.set('');
    this.mix.pause();
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(this.mic() ? { deviceId: { exact: this.mic() } } : {}),
          channelCount: 1,
          // These clean up calls on poor mics and make a good one sound worse.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (this.destroyed) stream.getTracks().forEach((t) => t.stop());
      else this.begin(stream);
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      await this.explain(e);
    } finally {
      this.starting.set(false);
    }
  }

  private begin(stream: MediaStream) {
    const movieId = this.movieId();
    const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: BITS_PER_SECOND });
    const parts: Blob[] = [];
    const meter = this.meter(stream);
    const started = performance.now();
    let seconds = 0;
    let wakeLock: WakeLockSentinel | undefined;
    const tick = () => {
      seconds = (performance.now() - started) / 1000;
      this.elapsed.set(seconds);
      this.level.set(meter.level());
      if (seconds >= MAX_SECONDS) {
        this.message.set('Stopped at the 45-minute limit. Record another to keep going.');
        this.stop();
      }
    };

    recorder.ondataavailable = (e) => {
      if (e.data.size) parts.push(e.data);
    };
    recorder.onstop = () => {
      clearInterval(timer);
      seconds = (performance.now() - started) / 1000;
      stream.getTracks().forEach((t) => t.stop());
      meter.close();
      void wakeLock?.release().catch(() => {});
      this.recorder = undefined;
      this.store.recording.set(false);
      if (parts.length) {
        this.store.add(movieId, new Blob(parts, { type: recorder.mimeType || mimeType || 'audio/webm' }), seconds);
        this.announcement.set('Recording stopped. Saving.');
      } else {
        this.message.set('Nothing was recorded. Check the mic and try again.');
      }
    };
    // Unplugged, or taken away by the system. The recorder stops by itself and keeps what it has.
    stream.getAudioTracks()[0].onended = () => {
      this.message.set('The microphone was disconnected, so recording stopped there.');
      this.stop();
    };

    recorder.start();
    this.recorder = recorder;
    this.elapsed.set(0);
    this.level.set(0);
    this.store.recording.set(true);
    this.announcement.set('Recording started.');
    const timer = setInterval(tick, 100);
    // A phone that locks its screen stops the recording.
    navigator.wakeLock?.request('screen').then(
      (lock) => {
        if (recorder.state === 'inactive') void lock.release();
        else wakeLock = lock;
      },
      () => {},
    );
  }

  protected stop() {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
  }

  /** Measures how loud the mic is, from 0 to 1. Recording goes on without it if the browser won't. */
  private meter(stream: MediaStream) {
    try {
      const context = new AudioContext();
      void context.resume().catch(() => {});
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      return {
        level: () => {
          analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
          const decibels = 20 * Math.log10(rms || 1e-6);
          return Math.min(1, Math.max(0, (decibels + 60) / 50));
        },
        close: () => void context.close().catch(() => {}),
      };
    } catch {
      return { level: () => 0, close: () => {} };
    }
  }

  private async explain(e: unknown) {
    const name = (e as { name?: string } | null)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      const blocked = await this.denied();
      this.access.set(blocked ? 'blocked' : 'ask');
      if (!blocked) this.message.set('The microphone wasn’t allowed. Tap Allow mic to try again.');
    } else if (name === 'OverconstrainedError' || name === 'NotFoundError') {
      // The chosen mic has gone. Pick another and say so, instead of quietly recording with it.
      const any = await this.loadMics().catch(() => false);
      if (!any) this.access.set('none');
      else if (!this.message()) this.message.set('That microphone isn’t available. Choose one and press Record again.');
    } else if (name === 'NotReadableError') {
      this.message.set('The microphone couldn’t be opened. Close any other app using it and try again.');
    } else {
      this.message.set('Couldn’t start recording. Try again.');
    }
  }

  private setUpPlayer() {
    const a = this.audio;
    this.mix.onState = (on) => this.paused.set(!on);
    this.mix.onTick = () => this.position.set(this.mix.time());
    this.mix.onError = () => {
      this.stopPlaying();
      this.listMessage.set('Couldn’t play that recording. Check your connection and try again.');
    };
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration)) return;
      this.measuring = true;
      this.mix.suspended = true;
      a.muted = true;
      a.currentTime = Number.MAX_SAFE_INTEGER;
    };
    const measured = () => {
      this.measuring = false;
      this.mix.suspended = false;
      a.currentTime = 0;
      a.muted = false;
      // During the intro's lead-in, the recording waits its turn.
      if (this.mix.waiting) a.pause();
      else void a.play().catch(() => {});
    };
    a.onseeked = () => {
      if (this.measuring) measured();
    };
    a.ontimeupdate = () => {
      if (!this.measuring) this.position.set(this.mix.time());
    };
    const ended = () => {
      this.paused.set(true);
      this.position.set(0);
      a.currentTime = 0;
    };
    // Reaching the end is the mix player's to report, as an outro may still be playing.
    a.onended = () => {
      if (this.measuring) measured();
    };
    this.mix.onFinish = ended;
    a.onerror = () => {
      if (!a.getAttribute('src')) return;
      this.measuring = false;
      this.mix.suspended = false;
      a.muted = false;
      this.mix.pause();
      this.playing.set('');
      this.paused.set(true);
      this.listMessage.set('Couldn’t play that recording. Check your connection and try again.');
    };
  }

  protected async toggle(r: Playable) {
    const a = this.audio;
    this.listMessage.set('');
    this.mix.spans = r.spans;
    this.mix.marks = r.marks ?? {};
    this.mix.length = r.seconds;
    if (r.marks) this.mix.prepare();
    if (this.playing() === r.id) {
      if (!this.mix.playing) void this.mix.play().catch(() => {});
      else this.mix.pause();
      return;
    }
    this.mix.pause();
    this.measuring = false;
    a.muted = false;
    this.playing.set(r.id);
    this.position.set(0);
    try {
      // Not awaited when already known, so that Safari still counts this as answering the tap.
      const url = this.store.knownUrl(r.id) ?? (await this.store.url(r));
      if (this.playing() !== r.id || this.destroyed) return;
      a.src = url;
      await this.mix.play();
    } catch (e: any) {
      // Pausing or switching recordings before it gets going isn't a problem.
      if (e?.name === 'AbortError' || this.playing() !== r.id) return;
      this.stopPlaying();
      this.listMessage.set('Couldn’t play that recording. Check your connection and try again.');
    }
  }

  /** Moves to a place on the slider, which runs on the finished version's clock. */
  protected seek(value: string) {
    if (this.measuring) return;
    this.mix.seek(+value);
    this.position.set(this.mix.time());
  }

  private stopPlaying() {
    this.mix.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.playing.set('');
    this.position.set(0);
    this.paused.set(true);
  }

  protected async remove(r: Review) {
    this.busy.set(true);
    this.listMessage.set('');
    if (this.playing() === r.id) this.stopPlaying();
    try {
      await this.store.remove(this.movieId(), r);
      this.announcement.set('Recording deleted.');
    } catch {
      this.listMessage.set('Couldn’t delete that recording. Check your connection and try again.');
    }
    this.busy.set(false);
    this.confirming.set('');
  }
}
