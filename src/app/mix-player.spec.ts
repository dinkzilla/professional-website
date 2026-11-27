const started: { name: number; when: number; offset: number | undefined }[] = [];
const context = {
  currentTime: 0,
  state: 'running',
  destination: {},
  resume: () => Promise.resolve(),
  createBufferSource() {
    const node = {
      buffer: null as { duration: number } | null,
      connect: () => {},
      disconnect: () => {},
      stop: () => {},
      start: (when: number, offset?: number) => started.push({ name: node.buffer!.duration, when, offset }),
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
    context.currentTime = 0;
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
});
