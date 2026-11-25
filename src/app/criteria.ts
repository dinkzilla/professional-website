export interface Criterion {
  key: string;
  label: string;
  kind: 'scale' | 'stepper' | 'choice';
  hint?: string;
  /** scale: what a 1 and a 5 mean */
  low?: string;
  high?: string;
  /** stepper */
  step?: number;
  min?: number;
  /** choice */
  options?: { value: number; label: string }[];
  /** Key of the criterion this one is a bonus to; it is shown attached to that one. */
  bonusOf?: string;
  /** Heading that consecutive criteria are gathered under. */
  group?: string;
}

const BONUS = 'Bonus Points';

export const CRITERIA: Criterion[] = [
  {
    key: 'decor',
    label: 'Holiday Decorations and Scenery',
    kind: 'scale',
    low: 'Can barely tell it’s a holiday movie',
    high: 'I think this was filmed in an @Home store / Macy’s is taking notes for their windows',
  },
  {
    key: 'traditions',
    label: 'Holiday Traditions',
    kind: 'scale',
    low: 'Do these people even know it is a holiday?',
    high: 'I may add some of these to my family’s traditions',
  },
  {
    key: 'originality',
    label: 'Originality',
    kind: 'scale',
    low: 'No originality',
    high: 'Extremely original',
  },
  {
    key: 'better',
    label: 'Bonus: Did It Better',
    kind: 'stepper',
    hint: 'Not original, but a better version. Not full points, just a bonus.',
    step: 1,
    bonusOf: 'originality',
  },
  {
    key: 'cheese',
    label: 'Cheese Factor',
    kind: 'scale',
    low: 'Hate it and not a good cheese',
    high: 'Love the squeaky cheese',
  },
  {
    key: 'couples',
    group: BONUS,
    label: 'Successful Relationships',
    kind: 'stepper',
    hint: '1 pt for every couple at the end of the movie',
    step: 1,
    min: 0,
  },
  {
    key: 'kisses',
    group: BONUS,
    label: 'Max People That 1 Person Gets to Kiss',
    kind: 'stepper',
    step: 0.5,
    min: 0,
  },
  { key: 'accents', group: BONUS, label: 'Accents', kind: 'stepper', step: 0.5, min: 0 },
  { key: 'celebrity', group: BONUS, label: 'Legit Celebrity', kind: 'stepper', step: 1, min: 0 },
  {
    key: 'saved',
    group: BONUS,
    label: 'Saved a Nice/Thwarted a Naughty Business',
    kind: 'stepper',
    step: 1,
    min: 0,
  },
  { key: 'soundtrack', group: BONUS, label: 'Soundtrack', kind: 'stepper', step: 1, min: 0 },
  {
    key: 'horny',
    label: 'Horny?',
    kind: 'choice',
    options: [
      { value: -1, label: 'No horny. Disappointed.' },
      { value: 0, label: 'Appropriate horny.' },
      { value: 1, label: 'Pleasantly more horny than expected.' },
      { value: -2, label: 'Cool it mister! Too horny.' },
    ],
  },
];

export const PEOPLE = ['Kiki', 'Matt'];
export const DEFAULT_NETWORKS = ['Hallmark', 'Netflix'];

export type Scores = Record<string, number | null>;

export interface MovieData {
  title: string;
  network: string;
  /** Every date it was watched, as ISO dates (yyyy-mm-dd), oldest first. */
  watched: string[];
  viewers: string[];
  scores: Scores;
  /** Poster image URL, or '' */
  poster: string;
  /** ISO release date or '' */
  released: string;
  overview: string;
  director: string;
  /** The two top-billed cast members. */
  stars: string[];
  addedAt: string;
}

export interface Movie extends MovieData {
  id: string;
}

export function blankMovie(title: string): MovieData {
  return {
    title,
    network: '',
    watched: [],
    viewers: [],
    scores: {},
    poster: '',
    released: '',
    overview: '',
    director: '',
    stars: [],
    addedAt: new Date().toISOString(),
  };
}

export function normalize(id: string, raw: Record<string, unknown> | undefined): Movie {
  const r = raw ?? {};
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const scores: Scores = {};
  const rs = (r['scores'] ?? {}) as Record<string, unknown>;
  for (const c of CRITERIA) {
    const v = rs[c.key];
    scores[c.key] = typeof v === 'number' && Number.isFinite(v) ? v : null;
  }
  return {
    id,
    title: str(r['title']) || 'Untitled',
    network: str(r['network']),
    watched: watchDates(r['watched']),
    viewers: Array.isArray(r['viewers']) ? r['viewers'].filter((v) => typeof v === 'string') : [],
    scores,
    poster: str(r['poster']),
    released: str(r['released']),
    overview: str(r['overview']),
    director: str(r['director']),
    stars: Array.isArray(r['stars']) ? r['stars'].filter((v) => typeof v === 'string') : [],
    addedAt: str(r['addedAt']),
  };
}

/** Lower case with accents and punctuation dropped, so "Noël's" is found by typing "noels". */
function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f'’]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** True when every word typed appears in the movie's title, network, director, stars or release year. */
export function matchesSearch(m: Movie, query: string): boolean {
  const words = searchable(query).split(' ').filter(Boolean);
  const text = searchable([m.title, m.network, m.director, ...m.stars, m.released.slice(0, 4)].join(' '));
  return words.every((w) => text.includes(w));
}

export function answered(scores: Scores): number {
  return CRITERIA.filter((c) => scores[c.key] != null).length;
}

export function total(scores: Scores): number {
  return CRITERIA.reduce((sum, c) => sum + (scores[c.key] ?? 0), 0);
}

/** Every fully rated movie, best score first, ties by title. A movie's ranking is its place in this order. */
export function ranked<T extends MovieData>(movies: T[]): T[] {
  return movies
    .filter((m) => answered(m.scores) === CRITERIA.length)
    .sort((a, b) => total(b.scores) - total(a.scores) || a.title.localeCompare(b.title));
}

export function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('-', '−');
}

export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Only https and same-site image paths are ever used as a poster source. */
export function safePoster(url: string): string {
  return /^https:\/\//.test(url) || /^(\/_blob\/|posters\/)[\w./-]+$/.test(url) ? url : '';
}

/** The group heading to show above the criterion at this position, if it starts a group. */
export function groupStart(i: number): string | undefined {
  const g = CRITERIA[i].group;
  return g && CRITERIA[i - 1]?.group !== g ? g : undefined;
}

/** Tidies watch dates: real dates only, no repeats, oldest first. Older saves hold a single date string. */
export function watchDates(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [raw];
  const dates = list.filter((v): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
  return [...new Set(dates)].sort();
}

/** The most recent watch date, or '' if it hasn't been watched. */
export function lastWatched(m: { watched: string[] }): string {
  return m.watched[m.watched.length - 1] ?? '';
}
