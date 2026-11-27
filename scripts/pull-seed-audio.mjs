// Copies the published versions from the live site, with the recordings they were made from (edits,
// marks and all), into the local seed: their details into seed/audio.json and their files under
// seed/audio/, at the same paths as in Storage, and their movies into seed/movies.json if missing. Preview as Kiki and the no-Firebase local mode then
// list and play them. Only reads from the live site; changes nothing there.
// Signs in as whoever `npx firebase login` is signed in as.
//
//   npm run pull-seed-audio -- <firebase-project-id>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const projectId = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!projectId) {
  console.error('Usage: npm run pull-seed-audio -- <firebase-project-id>');
  process.exit(1);
}
const bucket = `${projectId}.firebasestorage.app`;

// Borrow the Firebase CLI's sign-in so no separate Google Cloud credentials are needed.
const cli = createRequire(import.meta.url)('firebase-tools/lib/auth.js');
const account = cli.getGlobalDefaultAccount();
if (!account) {
  console.error('Not signed in. Run: npx firebase login');
  process.exit(1);
}
const { access_token } = await cli.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const headers = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };
const root = `projects/${projectId}/databases/(default)/documents`;
const api = `https://firestore.googleapis.com/v1/${root}`;

/** Firestore's typed REST value → plain JSON. */
function plain(v) {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(plain);
  if ('mapValue' in v) return fields(v.mapValue.fields ?? {});
  throw new Error(`Can’t copy a value like ${JSON.stringify(v)}`);
}
const fields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, plain(v)]));

async function get(url, options = {}) {
  const res = await fetch(url, { headers, ...options });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
  return res;
}

// Every published version, of every movie.
const rows = await (
  await get(`${api}:runQuery`, {
    method: 'POST',
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'published', allDescendants: true }] } }),
  })
).json();
const published = rows.filter((r) => r.document).map((r) => r.document);

const movies = new Map();
const entry = (movieId) => movies.get(movieId) ?? movies.set(movieId, { movieId, recordings: [], published: [] }).get(movieId);
const files = new Set();

for (const d of published) {
  // .../documents/movies/<movie>/published/<id>
  const [, movieId, , id] = d.name.slice(d.name.indexOf('/documents/') + '/documents/'.length).split('/');
  const p = { id, ...fields(d.fields ?? {}) };
  entry(movieId).published.push(p);
  if (p.path) files.add(p.path);
  const reviewId = p.source?.reviewId;
  if (!reviewId || entry(movieId).recordings.some((r) => r.id === reviewId)) continue;
  const res = await fetch(`${api}/movies/${encodeURIComponent(movieId)}/recordings/${encodeURIComponent(reviewId)}`, { headers });
  if (res.status === 404) {
    console.log(`  ${movieId}: recording ${reviewId} has been deleted; copying only its published version`);
    continue;
  }
  if (!res.ok) throw new Error(`${reviewId}: ${res.status} ${await res.text()}`);
  const r = await res.json();
  const recording = { id: reviewId, ...fields(r.fields ?? {}) };
  entry(movieId).recordings.push(recording);
  if (recording.path) files.add(recording.path);
}

for (const path of files) {
  const res = await get(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`);
  const out = `seed/audio/${path}`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`  ${out}`);
}

// Local mode lists only the seed's movies, so any of these that isn't one is added, as it is on the live site.
const seedMovies = JSON.parse(readFileSync('seed/movies.json', 'utf8'));
for (const movieId of movies.keys()) {
  if (seedMovies.some((m) => m.id === movieId)) continue;
  const doc = await (await get(`${api}/movies/${encodeURIComponent(movieId)}`)).json();
  seedMovies.push({ id: movieId, ...fields(doc.fields ?? {}) });
  console.log(`  seed/movies.json: added ${movieId}`);
}
writeFileSync('seed/movies.json', JSON.stringify(seedMovies, null, 2) + '\n');

const all = [...movies.values()].sort((a, b) => a.movieId.localeCompare(b.movieId));
writeFileSync('seed/audio.json', JSON.stringify(all, null, 2) + '\n');
const count = (key) => all.reduce((n, m) => n + m[key].length, 0);
console.log(`seed/audio.json: ${count('published')} published versions and ${count('recordings')} recordings, of ${all.length} movie${all.length === 1 ? '' : 's'}`);
