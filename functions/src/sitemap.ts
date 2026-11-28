// No imports, so the app's tests can check it against src/app/criteria.ts.

/** The site's address. Only this one is listed, never the Firebase web.app one. */
export const SITE = 'https://yuleswoon.com';

/**
 * The keys of every rating criterion, in src/app/criteria.ts. A movie's page is public once all of them are
 * scored, so only those movies are listed. src/app/sitemap.spec.ts fails if the two lists differ.
 */
export const CRITERIA_KEYS = [
  'decor',
  'traditions',
  'originality',
  'better',
  'cheese',
  'couples',
  'kisses',
  'accents',
  'celebrity',
  'saved',
  'soundtrack',
  'horny',
];

/** Whether every criterion has a score, as the app's answered() counts them. */
export function fullyRated(scores: Record<string, unknown> | undefined): boolean {
  return CRITERIA_KEYS.every((k) => scores?.[k] != null);
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** The sitemap: the list, then each fully rated movie at /movie/<id>. */
export function sitemapXml(movieIds: string[]): string {
  const urls = [`${SITE}/`, ...movieIds.map((id) => `${SITE}/movie/${encodeURIComponent(id)}`)];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${escape(u)}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');
}
