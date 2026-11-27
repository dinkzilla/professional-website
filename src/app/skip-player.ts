import { Span, playable } from './audio-edit';

/** Jump this far before a cut, since a frame can come up to ~17ms late. */
const AHEAD = 0.03;

/**
 * Plays an edit of a recording through an audio element, without changing the recording: it jumps over
 * what's cut and stops where the end is trimmed. It checks every frame while playing, and on each
 * timeupdate too, which keeps coming when a phone's screen is off and frames stop.
 */
export class SkipPlayer {
  /** The parts to play, or null for all of it. */
  spans: Span[] | null = null;
  /** Where to stop, if before the end. */
  stopAt: number | null = null;
  /** While true, it leaves the element alone. */
  suspended = false;
  /** Called on reaching the end of what's kept, or stopAt, after pausing. */
  onFinish: () => void = () => {};

  private frame = 0;

  constructor(readonly audio: HTMLAudioElement) {
    audio.addEventListener('play', () => this.run());
    audio.addEventListener('timeupdate', () => this.check());
    audio.addEventListener('seeked', () => this.check());
  }

  /** Where playing would start from a moment: there if it's kept, the next kept part if not, or null if nothing's left. */
  from(t: number): number | null {
    return this.spans ? playable(this.spans, t) : t;
  }

  private run() {
    cancelAnimationFrame(this.frame);
    const step = () => {
      this.check();
      if (!this.audio.paused) this.frame = requestAnimationFrame(step);
    };
    step();
  }

  private check() {
    const a = this.audio;
    if (this.suspended || a.paused || a.seeking) return;
    const t = a.currentTime;
    if (this.stopAt != null && t >= this.stopAt - AHEAD / 2) return this.finish();
    if (!this.spans) return;
    const next = playable(this.spans, t, AHEAD);
    if (next == null) return this.finish();
    if (next - t > 0.001) a.currentTime = next;
  }

  private finish() {
    this.audio.pause();
    this.stopAt = null;
    this.onFinish();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
  }
}
