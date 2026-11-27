import { Marks, MixPlan, Span, editedLength, mixPlan, spotsOf, toEdited, toOriginal } from './audio-edit';
import { JingleName, Jingles, audioContext, audioSession, loadJingles } from './jingles';
import { SkipPlayer } from './skip-player';

/** A jingle is started this far ahead of when it's due, on the audio clock, which is exact. */
const LOOKAHEAD = 0.5;
/** How far a jingle can drift from the recording before it's put back in step. Phones are slow to start an audio element, and jumping the music sounds worse than being a little late. */
const TOLERANCE = 0.15;
const NAMES: JingleName[] = ['intro', 'outro'];

interface Sounding {
  node: AudioBufferSourceNode;
  /** The audio clock's time at the jingle's very start. */
  zero: number;
}

/**
 * Plays a recording as it will be published: edited, by a SkipPlayer, with the intro and outro laid
 * over it at Kiki's marks through Web Audio. Its clock is the finished mix's, so it carries on through
 * the silence before the recording, when the intro needs it, and through an outro that runs past the end.
 * Without marks it's just the SkipPlayer.
 */
export class MixPlayer {
  private readonly skip: SkipPlayer;
  /** Where the intro ends and the outro starts, on the original recording. */
  marks: Marks = {};
  /** The recording's length, used when it isn't edited. */
  length = 0;
  /** Called on reaching the end, or stopAt. */
  onFinish: () => void = () => {};
  /** Called when it starts or stops playing. */
  onState: (playing: boolean) => void = () => {};
  /** Called while playing, as its clock moves. */
  onTick: () => void = () => {};
  /** Called if the recording couldn't be started after the intro's lead-in. */
  onError: (e: unknown) => void = () => {};

  private jingles: Jingles | null = null;
  private phase: 'idle' | 'before' | 'main' | 'after' = 'idle';
  /** In the silence before the recording or after it, the mix's clock runs from here. */
  private clockAt = { wall: 0, mix: 0 };
  /** Whether the recording is really playing, rather than just asked to. */
  private rolling = false;
  private readonly sounding = new Map<JingleName, Sounding>();
  private frame = 0;
  private ticker: ReturnType<typeof setInterval> | undefined;

  constructor(readonly audio: HTMLAudioElement) {
    this.skip = new SkipPlayer(audio);
    this.skip.onFinish = (atEnd) => this.recordingDone(atEnd);
    audio.addEventListener('playing', () => {
      this.rolling = true;
      this.sync();
    });
    audio.addEventListener('waiting', () => (this.rolling = false));
    audio.addEventListener('seeked', () => this.sync());
    audio.addEventListener('timeupdate', () => this.sync());
    // The pause that comes with reaching the end is followed by ended.
    audio.addEventListener('pause', () => {
      this.rolling = false;
      if (this.phase === 'main' && !this.skip.suspended && !audio.ended) this.halt();
    });
    audio.addEventListener('ended', () => {
      if (this.phase === 'main' && !this.skip.suspended) this.recordingDone(true);
    });
  }

  /** The parts of the recording to play, or null for all of it. */
  get spans(): Span[] | null {
    return this.skip.spans;
  }
  set spans(spans: Span[] | null) {
    this.skip.spans = spans;
  }
  set stopAt(t: number | null) {
    this.skip.stopAt = t;
  }
  get suspended(): boolean {
    return this.skip.suspended;
  }
  set suspended(on: boolean) {
    this.skip.suspended = on;
  }
  get playing(): boolean {
    return this.phase !== 'idle';
  }
  /** True during the intro's lead-in, before the recording itself starts. */
  get waiting(): boolean {
    return this.phase === 'before';
  }

  /** Where playing would start from a moment of the recording. */
  from(t: number): number | null {
    return this.skip.from(t);
  }

  /** Loads the jingles, so they're ready when wanted. */
  prepare() {
    if (this.jingles) return;
    loadJingles().then(
      (j) => {
        this.jingles = j;
        this.sync();
      },
      () => {},
    );
  }

  private edited(t: number): number {
    return this.spans ? toEdited(this.spans, t) : t;
  }

  private recorded(): number {
    return this.spans ? editedLength(this.spans) : this.length;
  }

  /** The mix as it stands. Jingles that haven't loaded yet are left out. */
  plan(): MixPlan {
    const j = this.jingles;
    const spots = j ? spotsOf(this.marks, this.spans ?? [{ start: 0, end: this.length }]) : { introEnd: null, outroStart: null };
    return mixPlan(this.recorded(), spots, { intro: j?.intro.duration ?? 0, outro: j?.outro.duration ?? 0 });
  }

  /** Where it's got to in the mix. */
  time(): number {
    if (this.phase === 'before' || this.phase === 'after') {
      const t = this.clockAt.mix + (performance.now() - this.clockAt.wall) / 1000;
      const p = this.plan();
      return Math.min(t, this.phase === 'before' ? p.lead : p.length);
    }
    return this.plan().lead + this.edited(this.audio.currentTime);
  }

  /**
   * Plays from where the recording is. From the very start of what's kept, that's from the start of
   * the intro, which may come first. Call it in answer to a tap, so the phone lets it sound.
   */
  play(): Promise<void> {
    const context = audioContext();
    void context.resume().catch(() => {});
    const p = this.plan();
    if (p.introAt != null || p.outroAt != null) audioSession('playback');
    this.rolling = false;
    this.loop();
    if (p.lead > 0 && this.edited(this.audio.currentTime) < 0.01) {
      this.phase = 'before';
      this.clockAt = { wall: performance.now(), mix: 0 };
      this.unlock(this.audio.currentTime);
      this.onState(true);
      this.sync();
      return Promise.resolve();
    }
    this.phase = 'main';
    this.onState(true);
    return this.audio.play().catch((e) => {
      this.halt();
      throw e;
    });
  }

  pause() {
    this.audio.pause();
    this.halt();
  }

  /** Moves to a moment of the mix. Before the recording starts is its start, after it ends its end. */
  seek(mix: number) {
    const p = this.plan();
    const e = Math.min(Math.max(0, mix - p.lead), this.recorded());
    this.audio.currentTime = this.spans ? toOriginal(this.spans, e) : e;
    if (this.phase === 'before' || this.phase === 'after') this.startRecording();
    this.sync();
  }

  destroy() {
    this.halt();
    this.skip.destroy();
  }

  /** Phones only let an audio element play in answer to a tap, so it's started then, silently, and held until the intro's lead-in is over. */
  private unlock(at: number) {
    const a = this.audio;
    if (!a.paused) return;
    a.muted = true;
    a.play()
      .then(
        () => {
          if (this.phase !== 'before' || this.skip.suspended) return;
          a.pause();
          a.currentTime = at;
        },
        () => {},
      )
      .finally(() => {
        if (!this.skip.suspended) a.muted = false;
      });
  }

  private startRecording() {
    this.phase = 'main';
    if (this.skip.suspended) return;
    this.audio.muted = false;
    this.audio.play().catch((e) => {
      if (e?.name === 'AbortError') return;
      this.halt();
      this.onError(e);
    });
  }

  private recordingDone(atEnd: boolean) {
    if (this.phase !== 'main') return;
    const p = this.plan();
    const end = p.lead + this.recorded();
    if (atEnd && p.length > end + 0.02) {
      // The outro carries on after the recording.
      this.phase = 'after';
      this.clockAt = { wall: performance.now(), mix: end };
      this.sync();
      return;
    }
    this.halt();
    this.onFinish();
  }

  private halt() {
    cancelAnimationFrame(this.frame);
    clearInterval(this.ticker);
    for (const name of NAMES) this.silence(name);
    if (this.phase === 'idle') return;
    this.phase = 'idle';
    this.rolling = false;
    audioSession('auto');
    this.onState(false);
  }

  private loop() {
    cancelAnimationFrame(this.frame);
    clearInterval(this.ticker);
    const step = () => {
      this.tick();
      if (this.phase !== 'idle') this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
    // Frames stop when the screen is off; this keeps going, if more slowly.
    this.ticker = setInterval(() => this.tick(), 200);
  }

  private tick() {
    if (this.phase === 'idle') return;
    if (this.phase === 'before' && this.time() >= this.plan().lead) this.startRecording();
    if (this.phase === 'after' && this.time() >= this.plan().length) {
      this.halt();
      this.onFinish();
      return;
    }
    this.sync();
    this.onTick();
  }

  /** Starts, stops or moves each jingle to be where the mix's clock says. */
  private sync() {
    if (this.phase === 'idle' || this.skip.suspended || !this.jingles) return;
    // Until the recording really gets going, its clock stands still.
    const waitForRecording = this.phase === 'main' && (!this.rolling || this.audio.seeking || this.audio.paused);
    const context = audioContext();
    const p = this.plan();
    const m = this.time();
    for (const name of NAMES) {
      const at = name === 'intro' ? p.introAt : p.outroAt;
      const buffer = this.jingles[name];
      const now = this.sounding.get(name);
      const into = at == null ? -Infinity : m - at;
      if (into < -LOOKAHEAD || into >= buffer.duration) {
        if (now && !waitForRecording) this.silence(name);
        continue;
      }
      if (waitForRecording) continue;
      if (now) {
        if (Math.abs(context.currentTime - now.zero - into) <= TOLERANCE) continue;
        this.silence(name);
      }
      const node = context.createBufferSource();
      node.buffer = buffer;
      node.connect(context.destination);
      const zero = context.currentTime - into;
      if (into < 0) node.start(zero);
      else node.start(context.currentTime, into);
      this.sounding.set(name, { node, zero });
    }
  }

  private silence(name: JingleName) {
    const s = this.sounding.get(name);
    if (!s) return;
    this.sounding.delete(name);
    try {
      s.node.stop();
    } catch {}
    s.node.disconnect();
  }
}
