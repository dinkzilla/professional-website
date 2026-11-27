let stopped = 0;
const started: { name: number; when: number; offset: number | undefined }[] = [];
const context = {
  currentTime: 0,
  state: 'running',
  destination: {},
  resume: () => Promise.resolve(),
  createGain: () => ({ gain: { value: 1 }, connect: () => {} }),
  createBufferSource() {
    const node = {
      buffer: null as { duration: number } | null,
      connect: () => {},
      disconnect: () => {},
      start: (when: number, offset?: number) => started.push({ name: node.buffer!.duration, when, offset }),
      stop: () => stopped++,
    };
    return node;
  },
};

(globalThis as any).AudioContext = function () {
  return context;
};
(context as any).decodeAudioData = (data: ArrayBuffer) => Promise.resolve({ duration: data.byteLength });
(globalThis as any).fetch = (url: URL) => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(String(url).includes('intro') ? 10 : 8)) });

import { MixPlayer } from './mix-player';

class FakeAudio extends EventTarget {
  currentTime = 0;
  paused = true;
  seeking = false;
  ended = false;
  muted = false;
  play() {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    queueMicrotask(() => this.dispatchEvent(new Event('playing')));
    return Promise.resolve();
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('MixPlayer', () => {
  beforeEach(() => {
    started.length = 0;
    stopped = 0;
    context.currentTime = 0;
  });

  // First, while the jingles haven't been loaded by anything yet.
  it('waits for the jingles to load, then plays them from the start', async () => {
    const audio = new FakeAudio();
    const mix = new MixPlayer(audio as unknown as HTMLAudioElement);
    mix.spans = [{ start: 0, end: 60 }];
    mix.length = 60;
    mix.marks = { introEnd: 3 };
    await mix.play();
    expect(mix.waiting).toBe(true);
    expect(started.length).toBe(0);
    await flush();
    expect(mix.waiting).toBe(true);
    expect(started.length).toBe(1);
    expect(started[0].offset ?? 0).toBeCloseTo(0);
    mix.destroy();
  });

  it('starts the intro when the recording reaches it', async () => {
    const audio = new FakeAudio();
    const mix = new MixPlayer(audio as unknown as HTMLAudioElement);
    mix.spans = [{ start: 0, end: 60 }];
    mix.length = 60;
    mix.marks = { introEnd: 20, outroStart: 40 };
    mix.prepare();
    await flush();
    await mix.play();
    await flush();
    audio.currentTime = 9.8;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(started.length).toBe(1);
    audio.currentTime = 39.9;
    audio.dispatchEvent(new Event('timeupdate'));
    expect(started.length).toBe(2);
    mix.destroy();
  });

  it('plays the intro first when it needs a lead-in', async () => {
    const audio = new FakeAudio();
    const mix = new MixPlayer(audio as unknown as HTMLAudioElement);
    mix.spans = [{ start: 0, end: 60 }];
    mix.length = 60;
    mix.marks = { introEnd: 3 };
    mix.prepare();
    await flush();
    await mix.play();
    await flush();
    expect(mix.waiting).toBe(true);
    expect(started.length).toBe(1);
    mix.destroy();
  });

  async function playing(marks: { introEnd?: number; outroStart?: number }, from = 0) {
    const audio = new FakeAudio();
    const mix = new MixPlayer(audio as unknown as HTMLAudioElement);
    mix.spans = [{ start: 0, end: 60 }];
    mix.length = 60;
    mix.marks = marks;
    mix.prepare();
    await flush();
    audio.currentTime = from;
    await mix.play();
    const at = (t: number, contextTime: number) => {
      audio.currentTime = t;
      context.currentTime = contextTime;
      audio.dispatchEvent(new Event('timeupdate'));
    };
    return { audio, mix, at };
  }

  it('waits for the recording to really move before starting a jingle', async () => {
    const { mix, at } = await playing({ introEnd: 20 }, 15);
    at(15, 0.2);
    expect(started.length).toBe(0);
    at(15.05, 0.25);
    expect(started.length).toBe(1);
    expect(started[0].offset).toBeCloseTo(5.05);
    mix.destroy();
  });

  it('leaves a jingle alone when the recording runs a little behind it', async () => {
    const { mix, at } = await playing({ introEnd: 20 }, 15);
    at(15.05, 0);
    expect(started.length).toBe(1);
    // A cut's jump held the recording up for a fifth of a second.
    at(16.85, 2);
    at(17.85, 3);
    expect(started.length).toBe(1);
    expect(stopped).toBe(0);
    mix.destroy();
  });

  it('moves a jingle when the recording jumps', async () => {
    const { audio, mix, at } = await playing({ introEnd: 20 }, 15);
    at(15.05, 0);
    // As a browser does: the new time, then the event.
    audio.currentTime = 12;
    audio.dispatchEvent(new Event('seeking'));
    at(12, 1);
    at(12.1, 1.1);
    expect(stopped).toBe(1);
    expect(started.length).toBe(2);
    expect(started[1].offset).toBeCloseTo(2.1);
    mix.destroy();
  });
});
