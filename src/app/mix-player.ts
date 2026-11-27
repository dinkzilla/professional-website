import { Marks, MixPlan, Span, editedLength, mixPlan, spotsOf, toEdited } from './audio-edit';
import { JingleName, Jingles, audioContext, audioSession, jingleOutput, loadJingles, readyJingles } from './jingles';
import { SkipPlayer } from './skip-player';

/** A jingle is started this far ahead of when it's due, on the audio clock, which is exact. */
const LOOKAHEAD = 0.5;
/**
 * A jingle and the recording further apart than this means a jump, so the jingle is moved to match.
 * Anything less is the recording being a little slow to start or to get past a cut, and the jingle is
 * left alone, as moving the music is what sounds choppy; the recording carries on that little behind it.
 */
const JUMP = 0.4;
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

  /** 'loading' waits for the jingles before starting; 'before' is the intro's lead-in; 'after' the outro running past the end. */
  private phase: 'idle' | 'loading' | 'before' | 'main' | 'after' = 'idle';
  /** In the silence before the recording or after it, the mix's clock runs from here, on the audio clock the jingles play by. */
  private clockAt = { context: 0, mix: 0 };
  /** Whether the recording is really moving, rather than just asked to: its clock has gone on from where it was then. */
  private rolling = false;
  private stillAt = 0;
  /** How far behind the jingle that's sounding the recording is running. */
  private skew = 0;
  private readonly sounding = new Map<JingleName, Sounding>();
  private frame = 0;
  private ticker: ReturnType<typeof setInterval> | undefined;

  constructor(readonly audio: HTMLAudioElement) {
    this.skip = new SkipPlayer(audio);
    this.skip.onFinish = (atEnd) => this.recordingDone(atEnd);
    // A browser says it's playing a little before it can be heard, and again after each jump over a cut.
    audio.addEventListener('waiting', () => this.still());
    audio.addEventListener('seeking', () => this.still());
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
  /** True while the recording waits its turn: for the jingles to load, or during the intro's lead-in. */
  get waiting(): boolean {
    return this.phase === 'loading' || this.phase === 'before';
  }

  /** Where playing would start from a moment of the recording. */
  from(t: number): number | null {
    return this.skip.from(t);
  }

  private get jingles(): Jingles | null {
    return readyJingles();
  }

  private wantsJingles(): boolean {
    return this.marks.introEnd != null || this.marks.outroStart != null;
  }

  /** Loads the jingles, so they're ready when wanted. */
  prepare() {
    if (!this.jingles) loadJingles().catch(() => {});
  }

  private still() {
    this.rolling = false;
    this.stillAt = this.audio.currentTime;
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
    if (this.phase === 'loading') return 0;
    if (this.phase === 'before' || this.phase === 'after') {
      const t = this.clockAt.mix + (audioContext().currentTime - this.clockAt.context);
      const p = this.plan();
      return Math.min(t, this.phase === 'before' ? p.lead : p.length + this.skew);
    }
    return this.plan().lead + this.edited(this.audio.currentTime) + this.skew;
  }

  /**
   * Plays from where the recording is. From the very start of what's kept, that's from the start of
   * the intro, which may come first. Call it in answer to a tap, so the phone lets it sound.
   */
  play(): Promise<void> {
    void audioContext()
      .resume()
      .catch(() => {});
    if (this.wantsJingles()) audioSession('playback');
    this.still();
    this.skew = 0;
    if (this.wantsJingles() && !this.jingles) {
      // Starting without them would mean starting them part way through once they came.
      this.phase = 'loading';
      const from = this.audio.currentTime;
      this.unlock(from);
      this.onState(true);
      const go = () => {
        if (this.phase !== 'loading') return;
        if (!this.skip.suspended) this.audio.currentTime = from;
        this.begin().catch((e) => e?.name === 'AbortError' || this.onError(e));
      };
      // If they can't be had, it plays without them.
      loadJingles().then(go, go);
      return Promise.resolve();
    }
    return this.begin();
  }

  private begin(): Promise<void> {
    const p = this.plan();
    this.still();
    this.loop();
    if (p.lead > 0 && this.edited(this.audio.currentTime) < 0.01) {
      this.phase = 'before';
      this.clockAt = { context: audioContext().currentTime, mix: 0 };
      this.unlock(this.audio.currentTime);
      this.onState(true);
      this.sync();
      return Promise.resolve();
    }
    this.phase = 'main';
    this.onState(true);
    if (!this.skip.suspended) this.audio.muted = false;
    return this.audio.play().catch((e) => {
      this.halt();
      throw e;
    });
  }

  pause() {
    this.audio.pause();
    this.halt();
  }

  /** Moves to a moment of a file that plays whole, without cuts or jingles: a published version. */
  seek(t: number) {
    this.audio.currentTime = Math.max(0, t);
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
          if (!this.waiting || this.skip.suspended) return;
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
    this.still();
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
      this.clockAt = { context: audioContext().currentTime, mix: end + this.skew };
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
    this.skew = 0;
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
    if (this.phase === 'after' && this.time() >= this.plan().length + this.skew) {
      this.halt();
      this.onFinish();
      return;
    }
    this.sync();
    this.onTick();
  }

  /** Starts and stops each jingle as the mix's clock comes to it, and moves one only if the recording jumped. */
  private sync() {
    if (this.phase === 'idle' || this.skip.suspended || !this.jingles) return;
    const context = audioContext();
    const p = this.plan();
    const at = (name: JingleName) => (name === 'intro' ? p.introAt : p.outroAt);
    if (this.phase === 'main') {
      const a = this.audio;
      if (!this.rolling) {
        // Until the recording can be heard to move, the jingles carry on as they are.
        if (a.paused || a.seeking || a.currentTime - this.stillAt < 0.005) return;
        this.rolling = true;
      }
      // Keeps in step with the jingle that's sounding, by its own clock: a small difference is the recording running a little late.
      const base = p.lead + this.edited(a.currentTime);
      const name = NAMES.find((n) => this.sounding.has(n) && at(n) != null);
      if (name) {
        const into = context.currentTime - this.sounding.get(name)!.zero;
        const off = into - (base + this.skew - at(name)!);
        if (Math.abs(off) > JUMP) {
          for (const n of NAMES) this.silence(n);
          this.skew = 0;
        } else {
          this.skew += off;
        }
      } else {
        this.skew = 0;
      }
    }
    const m = this.time();
    for (const name of NAMES) {
      const start = at(name);
      const buffer = this.jingles[name];
      const into = start == null ? -Infinity : m - start;
      if (into < -LOOKAHEAD || into >= buffer.duration) {
        this.silence(name);
        continue;
      }
      if (this.sounding.has(name)) continue;
      const node = context.createBufferSource();
      node.buffer = buffer;
      node.connect(jingleOutput());
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
