import { Injectable, computed, inject, signal } from '@angular/core';
import { collection, deleteDoc, doc, getDocsFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import { AuthService } from './auth';
import { firebaseApp, firestore } from './firebase';

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
}

/** A recording on its way to being saved. It keeps its id when it becomes a Review. */
export interface Upload extends Review {
  movieId: string;
  blob: Blob;
  /** 0 to 1 */
  progress: number;
  /** Why it couldn't be saved, or '' while it is being saved. */
  problem: string;
}

function toReview(id: string, raw: Record<string, unknown>): Review {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    id,
    path: str(raw['path']),
    type: str(raw['type']),
    seconds: typeof raw['seconds'] === 'number' ? raw['seconds'] : 0,
    createdAt: str(raw['createdAt']),
  };
}

/** Cloud Storage, downloaded only when it's first needed, so visitors never fetch it. */
async function cloud() {
  const sdk = await import('firebase/storage');
  return { sdk, storage: sdk.getStorage(firebaseApp!) };
}

/**
 * Kiki's audio reviews. The audio is in Cloud Storage and its details are in
 * the Firestore subcollection movies/<id>/reviews, apart from the movie itself
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
  /** Saved reviews of the movie being watched. */
  private readonly saved = signal<Review[]>([]);
  /** Playable addresses by review id. */
  private readonly urls = new Map<string, string>();

  constructor() {
    window.addEventListener('beforeunload', (e) => {
      if (this.recording() || this.uploads().length) e.preventDefault();
    });
  }

  /** Keeps the list up to date with one movie's saved reviews. Returns a function that stops it. */
  watch(movieId: string): () => void {
    this.saved.set([]);
    if (this.inMemory()) {
      this.status.set('ready');
      return () => {};
    }
    this.status.set('loading');
    this.slow.set(false);
    const timer = setTimeout(() => this.slow.set(true), 10_000);
    let confirmed = false;
    const stop = onSnapshot(
      collection(firestore!, 'movies', movieId, 'reviews'),
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
    return () => {
      clearTimeout(timer);
      stop();
    };
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

  /** Looks up the address to play a review from. */
  async url(review: Review): Promise<string> {
    const known = this.urls.get(review.id);
    if (known) return known;
    const { sdk, storage } = await cloud();
    const url = await sdk.getDownloadURL(sdk.ref(storage, review.path));
    this.urls.set(review.id, url);
    return url;
  }

  add(movieId: string, blob: Blob, seconds: number) {
    const id = crypto.randomUUID();
    const upload: Upload = {
      id,
      movieId,
      blob,
      path: `movies/${movieId}/reviews/${id}`,
      type: blob.type.split(';')[0] || 'audio/webm',
      seconds,
      createdAt: new Date().toISOString(),
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
    // The audio may have arrived even though its details didn't.
    void this.removeFile(upload.path).catch(() => {});
  }

  /** Deletes one review. Throws if that fails. */
  async remove(movieId: string, review: Review) {
    if (this.inMemory()) {
      URL.revokeObjectURL(this.urls.get(review.id) ?? '');
      this.setMemory(movieId, (this.memory().get(movieId) ?? []).filter((r) => r.id !== review.id));
    } else {
      // Audio first: if this stops halfway, the review is still listed and can be deleted again.
      await this.removeFile(review.path);
      await deleteDoc(doc(firestore!, 'movies', movieId, 'reviews', review.id));
    }
    this.urls.delete(review.id);
  }

  /** Whether any of a movie's recordings is still being uploaded. */
  saving(movieId: string): boolean {
    return this.uploads().some((u) => u.movieId === movieId && !u.problem);
  }

  /** Deletes everything saved for a movie, which Firebase doesn't do when the movie is deleted. Throws if that fails. */
  async removeAll(movieId: string) {
    const all = this.inMemory()
      ? (this.memory().get(movieId) ?? [])
      : (await getDocsFromServer(collection(firestore!, 'movies', movieId, 'reviews'))).docs.map((d) => toReview(d.id, d.data()));
    for (const review of all) await this.remove(movieId, review);
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
      await setDoc(doc(firestore!, 'movies', movieId, 'reviews', id), { path, type, seconds, createdAt });
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
