/**
 * One-off move to readable names, as the app now gives everything new:
 *
 *   - A movie with a random Firestore id gets one made from its title. Its address changes from
 *     /movie/<random> to /movie/<title>.
 *   - Recordings move from movies/<id>/reviews to movies/<id>/recordings, in Firestore and in Storage,
 *     and are named for the movie and when they were made: <movie>-2026-11-27-1430.m4a.
 *   - Published versions are named the same way.
 *   - Then every recording without a waveform gets one, as the backend makes for each new upload.
 *
 * Everything is copied before anything is deleted, so if it stops partway, running it again finishes
 * the job. It shows what it would do unless given --apply:
 *
 *   gcloud auth application-default login
 *   npm --prefix functions run migrate-ids             # look first
 *   npm --prefix functions run migrate-ids -- --apply  # then do it
 */
import { initializeApp } from 'firebase-admin/app';
import { DocumentData, DocumentReference, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { makeMissingWaveforms } from './jobs.js';

initializeApp({ projectId: 'yule-swoon', storageBucket: 'yule-swoon.firebasestorage.app' });
const db = getFirestore();
const bucket = getStorage().bucket();
const apply = process.argv.includes('--apply');

/** Must match slug() in src/app/slug.ts. */
function slug(title: string): string {
  return (
    title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’‘`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'movie'
  );
}

/** Must match stamp() in src/app/slug.ts. Uses this computer's time zone, which should be Kiki's. */
function stamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
}

/** Must match extension() in src/app/slug.ts. */
function extension(type: string): string {
  const t = type.split(';')[0].trim();
  return t === 'audio/mp4' || t === 'audio/x-m4a' || t === 'audio/aac' ? '.m4a' : t === 'audio/webm' ? '.webm' : t === 'audio/ogg' ? '.ogg' : t === 'audio/mpeg' ? '.mp3' : '';
}

function numbered(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
  taken.add(name);
  return name;
}

/** Firestore's own ids are 20 letters and digits, mixed case. Readable ones are lower case. */
const random = (id: string) => /^[A-Za-z0-9]{20}$/.test(id) && /[A-Z]/.test(id);
/** A name this script or the app gave: the movie's id and a time. */
const dated = (id: string, movie: string) => id.startsWith(`${movie}-`) && /-\d{4}-\d{2}-\d{2}-\d{4}(-\d+)?$/.test(id);

const say = (line: string) => console.log((apply ? '' : '[would] ') + line);

async function copyFile(from: string, to: string): Promise<boolean> {
  if (from === to) return true;
  const [exists] = await bucket.file(from).exists();
  if (!exists) {
    // Already moved by an earlier run that stopped partway, perhaps.
    const [there] = await bucket.file(to).exists();
    if (!there) console.log(`  ! no file at ${from}`);
    return there;
  }
  say(`  copy ${from} → ${to}`);
  if (apply) await bucket.file(from).copy(bucket.file(to));
  return true;
}

const plan: (() => Promise<void>)[] = [];
const later: (() => Promise<void>)[] = [];

function write(ref: DocumentReference, data: DocumentData) {
  say(`  write ${ref.path}`);
  plan.push(async () => void (await ref.set(data)));
}
function removeDoc(ref: DocumentReference) {
  say(`  delete ${ref.path}`);
  later.push(async () => void (await ref.delete()));
}
function removeFile(path: string) {
  say(`  delete ${path}`);
  later.push(async () => void (await bucket.file(path).delete({ ignoreNotFound: true })));
}

const movies = (await db.collection('movies').get()).docs;
const takenMovies = new Set(movies.map((m) => m.id));
let changed = 0;

for (const movie of movies) {
  const oldId = movie.id;
  const title = String(movie.get('title') ?? '');
  const newId = random(oldId) ? numbered(slug(title), takenMovies) : oldId;
  const target = db.collection('movies').doc(newId);
  const get = async (name: string) => (await movie.ref.collection(name).get()).docs;
  const [reviews, recordings, published] = await Promise.all([get('reviews'), get('recordings'), get('published')]);

  const header = `\n${title || '(untitled)'}: ${newId === oldId ? oldId : `${oldId} → ${newId}`}`;
  let shown = false;
  const show = () => {
    if (!shown) console.log(header);
    shown = true;
  };
  if (newId !== oldId) {
    show();
    write(target, movie.data());
    removeDoc(movie.ref);
  }

  // Recordings, under the old name or the new
  const takenRecordings = new Set<string>([...recordings].filter((r) => newId === oldId && dated(r.id, newId)).map((r) => r.id));
  const renamed = new Map<string, string>();
  const movedPaths = new Map<string, string>();
  for (const r of [...reviews, ...recordings].sort((a, b) => String(a.get('createdAt')).localeCompare(String(b.get('createdAt'))))) {
    const inPlace = r.ref.parent.id === 'recordings' && newId === oldId && dated(r.id, newId);
    const id = inPlace ? r.id : numbered(`${newId}-${stamp(new Date(String(r.get('createdAt'))))}`, takenRecordings);
    const from = String(r.get('path') ?? '');
    const to = `movies/${newId}/recordings/${id}${extension(String(r.get('type') ?? ''))}`;
    if (inPlace && from === to) continue;
    show();
    if (from && !(await copyFile(from, to))) continue;
    renamed.set(r.id, id);
    if (from) movedPaths.set(from, to);
    const ref = target.collection('recordings').doc(id);
    write(ref, { ...r.data(), path: to });
    if (ref.path !== r.ref.path) removeDoc(r.ref);
    if (from && from !== to) removeFile(from);
  }

  // Published versions
  const takenPublished = new Set<string>(published.filter((p) => newId === oldId && dated(p.id, newId)).map((p) => p.id));
  for (const p of [...published].sort((a, b) => String(a.get('createdAt')).localeCompare(String(b.get('createdAt'))))) {
    const inPlace = newId === oldId && dated(p.id, newId);
    const data = p.data();
    const source = { ...(data['source'] ?? {}) };
    const sourceChanges = renamed.has(source.reviewId) || movedPaths.has(source.path);
    if (inPlace && !sourceChanges) continue;
    show();
    const id = inPlace ? p.id : numbered(`${newId}-${stamp(new Date(String(data['createdAt'])))}`, takenPublished);
    if (renamed.has(source.reviewId)) source.reviewId = renamed.get(source.reviewId);
    if (movedPaths.has(source.path)) source.path = movedPaths.get(source.path);
    const next: DocumentData = { ...data, movieId: newId, source };
    if (typeof data['path'] === 'string' && data['path']) {
      const to = `movies/${newId}/published/${id}.m4a`;
      if (await copyFile(data['path'], to)) {
        next['path'] = to;
        if (data['path'] !== to) removeFile(data['path']);
      }
    }
    write(target.collection('published').doc(id), next);
    if (id !== p.id || newId !== oldId) removeDoc(p.ref);
  }
  if (shown) changed++;
}

async function run() {
  // Copies and writes first; only once they're all done do the old copies go.
  for (const step of plan) await step();
  for (const step of later) await step();
}

if (apply) await run();
console.log(changed ? `\n${apply ? 'Moved' : 'Would move'} ${changed} movie${changed === 1 ? '' : 's'}.` : 'Nothing to move.');
if (!apply) {
  if (changed) console.log('Run again with --apply to do it, and to make the recordings’ waveforms.');
} else {
  console.log('\nWaveforms:');
  await makeMissingWaveforms();
}
