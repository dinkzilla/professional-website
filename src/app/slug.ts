/**
 * A readable id made from a title, for a movie's address and its folders: "The Night's Before
 * Christmas!" becomes the-nights-before-christmas. Must match slug() in functions/src/migrate-ids.ts.
 */
export function slug(title: string): string {
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

/** A readable id for a title that none of the taken ids already is: the slug, or the slug with -2, -3 and so on. */
export function freeSlug(title: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slug(title);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** A local date and time as part of a name: 2026-11-27-1430. */
export function stamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
}

/** A readable name for something of a movie's made at a moment: the movie's id and the time, numbered if taken. */
export function datedName(movieId: string, date: Date, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = `${movieId}-${stamp(date)}`;
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** The file extension for a type of audio, or '' if there's no usual one. Must match functions/src/migrate-ids.ts. */
export function extension(type: string): string {
  const t = type.split(';')[0].trim();
  return t === 'audio/mp4' || t === 'audio/x-m4a' || t === 'audio/aac' ? '.m4a' : t === 'audio/webm' ? '.webm' : t === 'audio/ogg' ? '.ogg' : t === 'audio/mpeg' ? '.mp3' : '';
}
