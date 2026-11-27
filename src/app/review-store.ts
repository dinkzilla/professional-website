import { Injectable, computed, inject, signal } from '@angular/core';
import { Bytes, collection, deleteDoc, deleteField, doc, getDocsFromServer, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { Cuts, Edit, Marks, Segment, changes, cleanMarks, editedLength, kept, mixPlan, ms, normalize, segments, spotsOf } from './audio-edit';
import { AuthService } from './auth';
import { firebaseApp, firestore } from './firebase';
import { JINGLE_FILES, jingleLengths, loadJingles } from './jingles';
import { datedName, extension } from './slug';
import { decodePeaks } from './waveform';

/** One saved audio review of a movie. */
export interface Review {
  id: string;
  /** Where the audio is in Cloud Storage. */
  path: string;
  type: string;
  /** Its length as timed while recording; some browsers leave the length out of the file. */
  seconds: number;
  /** ISO date and time */
  createdAt: string;
  /** The last edit saved, if any. */
  edit?: Edit;
  /** Where the intro ends and the outro starts, if Kiki has put them in. */
  marks?: Marks;
}

/**
 * A published version of a recording, at movies/<id>/published/<id>: the recording as edited when
 * Publish was pressed, made into a file of its own by the backend (functions/src/index.ts). It doesn't
 * depend on the recording, so either can be deleted without the other. Its id, the movie's id and when it was published, is the podcast episode's, and names its file.
 */
export interface Published {
  id: string;
  movieId: string;
  movieTitle: string;
  title: string;
  description: string;
  /** What it's made from, as it was when published. */
  source: {
    reviewId: string;
    path: string;
    edit: Cuts;
    segments: Segment[];
    /** How long the finished version is, as far as could be told when publishing. */
    seconds: number;
    /** The recording's marks then, in its own time. */
    marks?: Marks;
    /** The jingles laid over it, by file, and where on the edited recording's clock the intro ends and the outro starts. */
    intro?: { file: string; end: number };
    outro?: { file: string; start: number };
  };
  /** ISO date and time Publish was pressed */
  createdAt: string;
  /** ISO date and time it was last asked for: when published, or retried. */
  requestedAt: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  error: string;
  /** Set once the file is made. */
  path: string;
  mime: string;
  seconds: number;
  bytes: number;
  publishedAt: string;
}

/** Peaks per second in a waveform, each the loudest moment in its stretch from 0 to 255. Must match functions/src/peaks.ts. */
export const PEAKS_PER_SECOND = 50;

/** A recording on its way to being saved. It keeps its id when it becomes a Review. */
export interface Upload extends Review {
  movieId: string;
  blob: Blob;
  /** 0 to 1 */
  progress: number;
  /** Why it couldn't be saved, or '' while it is being saved. */
  problem: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

function toCuts(raw: unknown): Cuts {
  const e = obj(raw);
  const cuts = Array.isArray(e['cuts']) ? e['cuts'].map(obj).map((c) => ({ start: num(c['start']), end: num(c['end']) })) : [];
  return { start: num(e['start']), end: num(e['end']), cuts };
}

function toMarks(raw: unknown): Marks | undefined {
  const m = obj(raw);
  return cleanMarks({ introEnd: m['introEnd'] as number, outroStart: m['outroStart'] as number }, Infinity);
}

function toReview(id: string, raw: Record<string, unknown>): Review {
  const review: Review = {
    id,
    path: str(raw['path']),
    type: str(raw['type']),
    seconds: num(raw['seconds']),
    createdAt: str(raw['createdAt']),
  };
  if (raw['edit']) review.edit = { ...toCuts(raw['edit']), updatedAt: str(obj(raw['edit'])['updatedAt']) };
  const marks = toMarks(raw['marks']);
  if (marks) review.marks = marks;
  return review;
}

const STATUSES = ['pending', 'processing', 'done', 'error'] as const;

function toPublished(id: string, raw: Record<string, unknown>): Published {
  const source = obj(raw['source']);
  const status = STATUSES.find((s) => s === raw['status']) ?? 'pending';
  return {
    id,
    movieId: str(raw['movieId']),
    movieTitle: str(raw['movieTitle']),
    title: str(raw['title']),
    description: str(raw['description']),
    source: {
      reviewId: str(source['reviewId']),
      path: str(source['path']),
      edit: toCuts(source['edit']),
      segments: Array.isArray(source['segments'])
        ? source['segments'].map(obj).map((s) => ({ start: num(s['start']), end: typeof s['end'] === 'number' ? s['end'] : null }))
        : [],
      seconds: num(source['seconds']),
      marks: toMarks(source['marks']),
    },
    createdAt: str(raw['createdAt']),
    requestedAt: str(raw['requestedAt']) || str(raw['createdAt']),
    status,
    error: str(raw['error']),
    path: str(raw['path']),
    mime: str(raw['mime']),
    seconds: num(raw['seconds']),
    bytes: num(raw['bytes']),
    publishedAt: str(raw['publishedAt']),
  };
}

/** Cloud Storage, downloaded only when it's first needed, so visitors never fetch it. */
async function cloud() {
  const sdk = await import('firebase/storage');
  return { sdk, storage: sdk.getStorage(firebaseApp!) };
}

/**
 * Kiki's audio reviews. The audio is in Cloud Storage and its details are in
 * the Firestore subcollection movies/<id>/recordings, apart from the movie itself
 * because saving the rating form replaces that whole document. While
 * previewing, or without Firebase, recordings last until the page reloads.
 *
 * Uploads live here rather than in the form so they carry on if she leaves it.
 */
@Injectable({ providedIn: 'root' })
export class ReviewStore {
  private readonly auth = inject(AuthService);

  /** True while a recording is being made. */
  readonly recording = signal(false);
  readonly uploads = signal<Upload[]>([]);
  readonly status = signal<'loading' | 'ready' | 'unavailable'>('loading');
  /** True when the saved reviews are taking a long time to arrive. */
  readonly slow = signal(false);

  private readonly inMemory = computed(() => !firestore || this.auth.previewing());
  private readonly memory = signal<ReadonlyMap<string, Review[]>>(new Map());
  private readonly memoryPublished = signal<ReadonlyMap<string, Published[]>>(new Map());
  /** Copies of live recordings and published versions for trying things out (scripts/pull-seed-audio.mjs), served beside the app in development only. */
  private seed: Promise<{ movieId: string; recordings: Record<string, unknown>[]; published: Record<string, unknown>[] }[]> | undefined;
  private readonly seeded = new Set<string>();
  /** Saved reviews of the movie being watched. */
  private readonly saved = signal<Review[]>([]);
  /** Published versions of the movie being watched, newest first. */
  readonly published = signal<Published[]>([]);
  /** Whether publishing can be done here: not while previewing, or without Firebase. */
  readonly canPublish = computed(() => !this.inMemory());
  /** Playable addresses by review or published id. */
  private readonly urls = new Map<string, string>();

  constructor() {
    window.addEventListener('beforeunload', (e) => {
      if (this.recording() || this.uploads().length) e.preventDefault();
    });
  }

  /** Keeps the list up to date with one movie's saved reviews. Returns a function that stops it. */
  watch(movieId: string): () => void {
    this.saved.set([]);
    this.published.set([]);
    if (this.inMemory()) {
      this.status.set('ready');
      let stopped = false;
      void this.fromSeed(movieId).then(() => stopped || this.published.set(this.memoryPublished().get(movieId) ?? []));
      return () => (stopped = true);
    }
    this.status.set('loading');
    this.slow.set(false);
    const timer = setTimeout(() => this.slow.set(true), 10_000);
    let confirmed = false;
    const stop = onSnapshot(
      collection(firestore!, 'movies', movieId, 'recordings'),
      // Otherwise the server confirming there are none isn't reported.
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.metadata.fromCache) {
          confirmed = true;
          clearTimeout(timer);
          this.slow.set(false);
        }
        // Offline, Firestore reports an empty list of its own, which doesn't mean there are none.
        if (!confirmed && snap.empty) return;
        this.saved.set(snap.docs.map((d) => toReview(d.id, d.data())));
        this.status.set('ready');
      },
      () => {
        clearTimeout(timer);
        this.slow.set(false);
        this.status.set('unavailable');
      },
    );
    const stopPublished = onSnapshot(
      collection(firestore!, 'movies', movieId, 'published'),
      (snap) => this.published.set(snap.docs.map((d) => toPublished(d.id, d.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
      () => {},
    );
    return () => {
      clearTimeout(timer);
      stop();
      stopPublished();
    };
  }

  /** Puts the seed's recordings and published versions of a movie in with the ones made here, once. */
  private async fromSeed(movieId: string) {
    if (this.seeded.has(movieId)) return;
    this.seed ??= fetch('seed/audio.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => (Array.isArray(rows) ? rows : []))
      // In a build without it, the address gives the page instead.
      .catch(() => []);
    const entry = (await this.seed).find((m) => m.movieId === movieId);
    if (this.seeded.has(movieId)) return;
    this.seeded.add(movieId);
    if (!entry) return;
    const recordings = entry.recordings.map((r) => toReview(String(r['id']), r));
    const published = entry.published.map((p) => toPublished(String(p['id']), p)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const item of [...recordings, ...published]) if (item.path) this.urls.set(item.id, `seed/audio/${item.path}`);
    const mine = this.memory().get(movieId) ?? [];
    this.setMemory(movieId, [...mine, ...recordings.filter((r) => !mine.some((m) => m.id === r.id))]);
    this.memoryPublished.update((m) => new Map(m).set(movieId, published));
  }

  /**
   * Keeps up with a movie's finished published versions, newest first, for anyone to play. Apart from
   * published, which the editor's list keeps for the movie being edited. Returns a function that stops it.
   */
  watchFinished(movieId: string, found: (episodes: Published[]) => void): () => void {
    if (!firestore) {
      found([]);
      return () => {};
    }
    const newest = (p: Published) => p.publishedAt || p.createdAt;
    return onSnapshot(
      // Only finished ones are public, and rules aren't filters, so the query has to ask for just those.
      query(collection(firestore, 'movies', movieId, 'published'), where('status', '==', 'done')),
      (snap) => found(snap.docs.map((d) => toPublished(d.id, d.data())).filter((p) => p.path).sort((a, b) => newest(b).localeCompare(newest(a)))),
      () => found([]),
    );
  }

  /** A movie's saved reviews, newest first. */
  list(movieId: string): Review[] {
    const all = this.inMemory() ? (this.memory().get(movieId) ?? []) : this.saved();
    // Firestore shows a new document before the server has accepted it; until then it's still an upload.
    const saving = new Set(this.uploads().map((u) => u.id));
    return all.filter((r) => !saving.has(r.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** An address to play a review from, if it has been looked up already. */
  knownUrl(id: string): string | undefined {
    return this.urls.get(id);
  }

  /** Looks up the address to play a review, or a published version, from. */
  async url(item: { id: string; path: string }): Promise<string> {
    const known = this.urls.get(item.id);
    if (known) return known;
    const { sdk, storage } = await cloud();
    const url = await sdk.getDownloadURL(sdk.ref(storage, item.path));
    this.urls.set(item.id, url);
    return url;
  }

  /**
   * Keeps a recording's waveform coming: PEAKS_PER_SECOND loudness values, or null while there are
   * none yet. The backend makes them after an upload. While previewing, or without Firebase, they're
   * worked out here instead. Returns a function that stops it.
   */
  watchPeaks(movieId: string, review: Review, found: (peaks: Uint8Array | null) => void): () => void {
    if (this.inMemory()) {
      let stopped = false;
      found(null);
      // Decoding a long recording all at once can run a phone out of memory.
      if (review.seconds > 15 * 60) return () => {};
      decodePeaks(this.urls.get(review.id) ?? '', PEAKS_PER_SECOND).then(
        (peaks) => stopped || found(peaks),
        () => {},
      );
      return () => (stopped = true);
    }
    return onSnapshot(
      doc(firestore!, 'movies', movieId, 'waveforms', review.id),
      (snap) => {
        const data = snap.data()?.['data'];
        found(data instanceof Bytes ? data.toUint8Array() : null);
      },
      () => found(null),
    );
  }

  /** Saves the edit made to a recording, or clears it if it changes nothing. Throws if that fails. */
  async saveEdit(movieId: string, review: Review, edit: Cuts, duration: number, marks: Marks = {}) {
    const keep = changes(edit, duration);
    const saved: Edit | undefined = keep ? { ...normalize(edit, duration), updatedAt: new Date().toISOString() } : undefined;
    const spots = cleanMarks(marks, duration);
    if (this.inMemory()) {
      this.setMemory(
        movieId,
        (this.memory().get(movieId) ?? []).map((r) => {
          if (r.id !== review.id) return r;
          const { edit: _, marks: __, ...rest } = r;
          return { ...rest, ...(saved ? { edit: saved } : {}), ...(spots ? { marks: spots } : {}) };
        }),
      );
      return;
    }
    await updateDoc(doc(firestore!, 'movies', movieId, 'recordings', review.id), { edit: saved ?? deleteField(), marks: spots ?? deleteField() });
  }

  /** Publishes a recording as it's edited now. The backend then makes its file. Throws if that fails. */
  async publish(movieId: string, review: Review, details: { title: string; description: string; movieTitle: string }, duration: number) {
    if (this.inMemory()) throw new Error('Publishing needs the live site.');
    const edit = normalize(review.edit ?? { start: 0, end: duration, cuts: [] }, duration);
    const spans = kept(edit, duration);
    const marks = cleanMarks(review.marks, duration);
    const spots = spotsOf(marks, spans);
    // Only for showing how long it'll be until it's made, so it can do without the jingles' lengths.
    const lengths = jingleLengths() ?? (marks ? await loadJingles().then(() => jingleLengths(), () => null) : null);
    const seconds = mixPlan(editedLength(spans), lengths ? spots : { introEnd: null, outroStart: null }, lengths ?? { intro: 0, outro: 0 }).length;
    // Firestore won't take a field that's undefined, so what's left out is left out.
    const source: Record<string, unknown> = { reviewId: review.id, path: review.path, edit, segments: segments(edit, duration), seconds: ms(seconds) };
    if (marks) source['marks'] = marks;
    if (spots.introEnd != null) source['intro'] = { file: JINGLE_FILES.intro, end: spots.introEnd };
    if (spots.outroStart != null) source['outro'] = { file: JINGLE_FILES.outro, start: spots.outroStart };
    const at = new Date();
    const id = datedName(movieId, at, this.published().map((p) => p.id));
    const now = at.toISOString();
    await setDoc(doc(firestore!, 'movies', movieId, 'published', id), {
      movieId,
      movieTitle: details.movieTitle,
      title: details.title,
      description: details.description,
      source,
      createdAt: now,
      requestedAt: now,
      status: 'pending',
    });
  }

  /** Has the backend try again to make a published version's file. */
  async retryPublish(p: Published) {
    await updateDoc(doc(firestore!, 'movies', p.movieId, 'published', p.id), { status: 'pending', requestedAt: new Date().toISOString(), error: deleteField() });
  }

  /** Deletes a published version, leaving the recording. Throws if that fails. */
  async removePublished(movieId: string, p: Published) {
    if (this.inMemory()) {
      const left = (this.memoryPublished().get(movieId) ?? []).filter((q) => q.id !== p.id);
      this.memoryPublished.update((m) => new Map(m).set(movieId, left));
      this.published.set(left);
      this.urls.delete(p.id);
      return;
    }
    // File first: if this stops halfway, it's still listed and can be deleted again.
    if (p.path) await this.removeFile(p.path);
    await deleteDoc(doc(firestore!, 'movies', movieId, 'published', p.id));
    this.urls.delete(p.id);
  }

  add(movieId: string, blob: Blob, seconds: number) {
    const now = new Date();
    // Named for the movie and when it was made, so it's easy to tell apart in Storage and once downloaded.
    const taken = [...(this.inMemory() ? (this.memory().get(movieId) ?? []) : this.saved()), ...this.uploads()].map((r) => r.id);
    const id = datedName(movieId, now, taken);
    const type = blob.type.split(';')[0] || 'audio/webm';
    const upload: Upload = {
      id,
      movieId,
      blob,
      path: `movies/${movieId}/recordings/${id}${extension(type)}`,
      type,
      seconds,
      createdAt: now.toISOString(),
      progress: 0,
      problem: '',
    };
    if (this.inMemory()) {
      const { id, path, type, seconds, createdAt } = upload;
      this.urls.set(id, URL.createObjectURL(blob));
      this.setMemory(movieId, [...(this.memory().get(movieId) ?? []), { id, path, type, seconds, createdAt }]);
      return;
    }
    this.uploads.update((all) => [upload, ...all]);
    void this.send(upload);
  }

  retry(upload: Upload) {
    this.patch(upload.id, { progress: 0, problem: '' });
    void this.send(upload);
  }

  /** Gives up on a recording that couldn't be saved. */
  discard(upload: Upload) {
    this.uploads.update((all) => all.filter((u) => u.id !== upload.id));
    // The audio may have arrived even though its details didn't, and then its waveform will be made.
    void this.removeFile(upload.path).catch(() => {});
    if (firestore) void deleteDoc(doc(firestore, 'movies', upload.movieId, 'waveforms', upload.id)).catch(() => {});
  }

  /** Deletes one review. Throws if that fails. */
  async remove(movieId: string, review: Review) {
    if (this.inMemory()) {
      URL.revokeObjectURL(this.urls.get(review.id) ?? '');
      this.setMemory(movieId, (this.memory().get(movieId) ?? []).filter((r) => r.id !== review.id));
    } else {
      // Audio first: if this stops halfway, the review is still listed and can be deleted again.
      await this.removeFile(review.path);
      await deleteDoc(doc(firestore!, 'movies', movieId, 'waveforms', review.id));
      await deleteDoc(doc(firestore!, 'movies', movieId, 'recordings', review.id));
    }
    this.urls.delete(review.id);
  }

  /** Whether any of a movie's recordings is still being uploaded. */
  saving(movieId: string): boolean {
    return this.uploads().some((u) => u.movieId === movieId && !u.problem);
  }

  /** Deletes everything saved for a movie, published versions too, which Firebase doesn't do when the movie is deleted. Throws if that fails. */
  async removeAll(movieId: string) {
    const all = this.inMemory()
      ? (this.memory().get(movieId) ?? [])
      : (await getDocsFromServer(collection(firestore!, 'movies', movieId, 'recordings'))).docs.map((d) => toReview(d.id, d.data()));
    for (const review of all) await this.remove(movieId, review);
    if (this.inMemory()) {
      for (const p of this.memoryPublished().get(movieId) ?? []) await this.removePublished(movieId, p);
      return;
    }
    const published = (await getDocsFromServer(collection(firestore!, 'movies', movieId, 'published'))).docs.map((d) => toPublished(d.id, d.data()));
    for (const p of published) await this.removePublished(movieId, p);
    // Waveforms of recordings whose details never arrived.
    for (const d of (await getDocsFromServer(collection(firestore!, 'movies', movieId, 'waveforms'))).docs) await deleteDoc(d.ref);
  }

  /** Drops the unsaved recordings of a movie that has been deleted. */
  forget(movieId: string) {
    for (const u of this.uploads()) if (u.movieId === movieId) this.discard(u);
  }

  private async send({ id, movieId, blob, path, type, seconds, createdAt }: Upload) {
    try {
      const { sdk, storage } = await cloud();
      const task = sdk.uploadBytesResumable(sdk.ref(storage, path), blob, { contentType: type });
      task.on('state_changed', (s) => this.patch(id, { progress: s.totalBytes ? s.bytesTransferred / s.totalBytes : 0 }));
      await task;
      await setDoc(doc(firestore!, 'movies', movieId, 'recordings', id), { path, type, seconds, createdAt });
      this.uploads.update((all) => all.filter((u) => u.id !== id));
    } catch (e: any) {
      const denied = ['storage/unauthorized', 'storage/unauthenticated', 'permission-denied', 'unauthenticated'].includes(e?.code);
      this.patch(id, {
        problem: denied
          ? 'Couldn’t save this recording. Only Kiki can, so sign in again and retry.'
          : 'Couldn’t save this recording. Check your connection.',
      });
    }
  }

  private patch(id: string, change: Partial<Upload>) {
    this.uploads.update((all) => all.map((u) => (u.id === id ? { ...u, ...change } : u)));
  }

  private setMemory(movieId: string, reviews: Review[]) {
    this.memory.update((m) => new Map(m).set(movieId, reviews));
  }

  private async removeFile(path: string) {
    const { sdk, storage } = await cloud();
    try {
      await sdk.deleteObject(sdk.ref(storage, path));
    } catch (e: any) {
      if (e?.code !== 'storage/object-not-found') throw e;
    }
  }
}
