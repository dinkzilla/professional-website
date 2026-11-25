// One-off setup: copies seed/movies.json into the Firestore "movies" collection
// and, if public/tmdb-key.txt exists, stores the movie-search key in private/tmdb.
// Movies already in Firestore are left alone unless you pass --overwrite.
//
//   gcloud auth application-default login
//   npm run seed -- <firebase-project-id> [--overwrite]
import { existsSync, readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const overwrite = args.includes('--overwrite');
const projectId = args.find((a) => !a.startsWith('--'));
if (!projectId) {
  console.error('Usage: npm run seed -- <firebase-project-id> [--overwrite]');
  process.exit(1);
}

initializeApp({ projectId });
const db = getFirestore();

let added = 0;
let skipped = 0;
for (const { id, ...data } of JSON.parse(readFileSync('seed/movies.json', 'utf8'))) {
  const ref = db.doc(`movies/${id}`);
  if (!overwrite && (await ref.get()).exists) {
    skipped++;
    continue;
  }
  await ref.set(data);
  added++;
}
console.log(`movies: ${added} written, ${skipped} already there`);

if (existsSync('public/tmdb-key.txt')) {
  await db.doc('private/tmdb').set({ key: readFileSync('public/tmdb-key.txt', 'utf8').trim() });
  console.log('private/tmdb: movie-search key stored');
}
