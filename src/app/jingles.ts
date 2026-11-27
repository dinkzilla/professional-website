import { signal } from '@angular/core';
import { JingleLengths } from './audio-edit';

/**
 * The fixed intro and outro, laid over recordings at the spots Kiki picks. They're made in jingle/
 * (see build.sh there) and served with the site at /jingles/. The backend has its own copies, from the
 * same folder, to make published versions with. Published versions name the file they used.
 */
export const JINGLE_FILES = { intro: 'intro.wav', outro: 'outro.wav' } as const;
export type JingleName = keyof typeof JINGLE_FILES;

export interface Jingles {
  intro: AudioBuffer;
  outro: AudioBuffer;
}

/** How long they are, once they've been loaded. */
export const jingleLengths = signal<JingleLengths | null>(null);

let context: AudioContext | undefined;
let loading: Promise<Jingles> | undefined;
let loaded: Jingles | null = null;

/** The jingles, if they've been loaded already; null until then. */
export function readyJingles(): Jingles | null {
  return loaded;
}

/** The one audio context for the page, made when first needed. */
export function audioContext(): AudioContext {
  context ??= new AudioContext();
  return context;
}

/** Fetches and decodes the jingles, once. A failure lets a later call try again. */
export function loadJingles(): Promise<Jingles> {
  loading ??= (async () => {
    const decode = async (file: string) => {
      const response = await fetch(new URL(`jingles/${file}`, document.baseURI));
      if (!response.ok) throw new Error(`Couldn’t load ${file}`);
      return audioContext().decodeAudioData(await response.arrayBuffer());
    };
    const [intro, outro] = await Promise.all([decode(JINGLE_FILES.intro), decode(JINGLE_FILES.outro)]);
    loaded = { intro, outro };
    jingleLengths.set({ intro: intro.duration, outro: outro.duration });
    return loaded;
  })();
  loading.catch(() => (loading = undefined));
  return loading;
}

/**
 * Lets the jingles be heard on an iPhone with its ring switch on silent, as the recording is: Web Audio
 * otherwise follows the switch. Set back to 'auto' when nothing's playing, so it doesn't get in the
 * way of recording.
 */
export function audioSession(type: 'playback' | 'auto') {
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  try {
    if (session) session.type = type;
  } catch {}
}
