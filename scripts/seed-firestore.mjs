// One-off setup: copies seed/movies.json into the Firestore "movies" collection
// and, if public/tmdb-key.txt exists, stores the movie-search key in private/tmdb.
// Movies already in Firestore are left alone unless you pass --overwrite.
// Signs in as whoever `npx firebase login` is signed in as.
//
//   npm run seed -- <firebase-project-id> [--overwrite]
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const overwrite = args.includes('--overwrite');
const projectId = args.find((a) => !a.startsWith('--'));
if (!projectId) {
  console.error('Usage: npm run seed -- <firebase-project-id> [--overwrite]');
  process.exit(1);
}

// Borrow the Firebase CLI's sign-in so no separate Google Cloud credentials are needed.
const cli = createRequire(import.meta.url)('firebase-tools/lib/auth.js');
const account = cli.getGlobalDefaultAccount();
if (!account) {
  console.error('Not signed in. Run: npx firebase login');
  process.exit(1);
}
const { access_token } = await cli.getAccessToken(account.tokens.refresh_token, [
  'https://www.googleapis.com/auth/cloud-platform',
]);

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const headers = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

/** Plain JSON → Firestore's typed REST value. */
function value(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: fields(v) } };
}
const fields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, value(v)]));

async function exists(path) {
  const res = await fetch(`${base}/${path}`, { headers });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return true;
}

async function put(path, data) {
  const res = await fetch(`${base}/${path}`, { method: 'PATCH', headers, body: JSON.stringify({ fields: fields(data) }) });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
}

let added = 0;
let skipped = 0;
for (const { id, ...data } of JSON.parse(readFileSync('seed/movies.json', 'utf8'))) {
  const path = `movies/${encodeURIComponent(id)}`;
  if (!overwrite && (await exists(path))) {
    skipped++;
    continue;
  }
  await put(path, data);
  added++;
}
console.log(`movies: ${added} written, ${skipped} already there`);

if (existsSync('public/tmdb-key.txt')) {
  await put('private/tmdb', { key: readFileSync('public/tmdb-key.txt', 'utf8').trim() });
  console.log('private/tmdb: movie-search key stored');
}
