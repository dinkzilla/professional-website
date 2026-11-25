import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { Review, ReviewStore, Upload } from './review-store';

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

/** Records, lists, plays and deletes a movie's audio reviews. */
@Component({
  selector: 'app-audio-reviews',
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
          @let current = playing() === r.id;
          <li>
            <div class="recording-head">
              <span class="muted">{{ when(r) }} · {{ clock(r.seconds) }}</span>
              @if (confirming() !== r.id) {
                <button type="button" class="clear" [attr.aria-label]="'Delete recording from ' + when(r) + ', ' + clock(r.seconds)" (click)="confirming.set(r.id)">Delete</button>
              }
            </div>
            @if (confirming() === r.id) {
              <span class="confirm">
                Delete this recording?
                <button type="button" class="btn danger" [disabled]="busy()" (click)="remove(r)">Delete</button>
                <button type="button" class="btn quiet" [disabled]="busy()" (click)="confirming.set('')">Keep</button>
              </span>
            } @else {
              <div class="player">
                <button type="button" class="player-key" [disabled]="store.recording()" [attr.aria-label]="(current && !paused() ? 'Pause' : 'Play') + ' recording from ' + when(r)" (click)="toggle(r)">
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
                  [max]="r.seconds"
                  [value]="current ? position() : 0"
                  [disabled]="!current"
                  aria-label="Position in recording"
                  [attr.aria-valuetext]="clock(current ? position() : 0)"
                  (input)="seek($any($event.target).value)"
                />
                <span class="player-time">{{ clock(current ? position() : 0) }}</span>
              </div>
            }
          </li>
        }
      </ul>
    }
    @if (store.status() === 'ready' && !uploads().length && !reviews().length) {
      <p class="note">No recordings yet.</p>
    }
    @if (store.status() === 'unavailable') {
      <p class="note">The saved recordings can’t be reached right now. Check your connection and reopen this page.</p>
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

  protected readonly confirming = signal('');
  protected readonly busy = signal(false);

  private readonly onDevices = () => void this.checkAccess();

  constructor() {
    effect((onCleanup) => onCleanup(this.store.watch(this.movieId())));
    // Safari only plays in direct answer to a tap, so the addresses have to be ready beforehand.
    effect(() => {
      for (const r of this.reviews()) this.store.url(r).catch(() => {});
    });
    let saving: string[] = [];
    effect(() => {
      const saved = new Set(this.reviews().map((r) => r.id));
      if (saving.some((id) => saved.has(id))) this.announcement.set('Recording saved.');
      saving = this.uploads().map((u) => u.id);
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
  }

  protected clock(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  protected when(r: Review): string {
    const d = new Date(r.createdAt);
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
    this.audio.pause();
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
    a.onplay = a.onpause = () => this.paused.set(a.paused);
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration)) return;
      this.measuring = true;
      a.muted = true;
      a.currentTime = Number.MAX_SAFE_INTEGER;
    };
    const measured = () => {
      this.measuring = false;
      a.currentTime = 0;
      a.muted = false;
      void a.play().catch(() => {});
    };
    a.onseeked = () => {
      if (this.measuring) measured();
    };
    a.ontimeupdate = () => {
      if (!this.measuring) this.position.set(a.currentTime);
    };
    a.onended = () => {
      if (this.measuring) return measured();
      this.paused.set(true);
      this.position.set(0);
      a.currentTime = 0;
    };
    a.onerror = () => {
      if (!a.getAttribute('src')) return;
      this.measuring = false;
      a.muted = false;
      this.playing.set('');
      this.paused.set(true);
      this.listMessage.set('Couldn’t play that recording. Check your connection and try again.');
    };
  }

  protected async toggle(r: Review) {
    const a = this.audio;
    this.listMessage.set('');
    if (this.playing() === r.id) {
      if (a.paused) void a.play().catch(() => {});
      else a.pause();
      return;
    }
    a.pause();
    this.measuring = false;
    a.muted = false;
    this.playing.set(r.id);
    this.position.set(0);
    try {
      // Not awaited when already known, so that Safari still counts this as answering the tap.
      const url = this.store.knownUrl(r.id) ?? (await this.store.url(r));
      if (this.playing() !== r.id || this.destroyed) return;
      a.src = url;
      await a.play();
    } catch (e: any) {
      // Pausing or switching recordings before it gets going isn't a problem.
      if (e?.name === 'AbortError' || this.playing() !== r.id) return;
      this.stopPlaying();
      this.listMessage.set('Couldn’t play that recording. Check your connection and try again.');
    }
  }

  protected seek(value: string) {
    if (this.measuring) return;
    this.audio.currentTime = +value;
    this.position.set(+value);
  }

  private stopPlaying() {
    this.audio.pause();
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
