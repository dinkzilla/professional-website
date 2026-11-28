import { CRITERIA_KEYS, fullyRated, sitemapXml } from '../../functions/src/sitemap';
import { CRITERIA } from './criteria';

describe('sitemap', () => {
  it('knows every criterion, so it lists the same movies the site shows', () => {
    expect(CRITERIA_KEYS).toEqual(CRITERIA.map((c) => c.key));
  });

  it('lists only fully rated movies', () => {
    const all = Object.fromEntries(CRITERIA_KEYS.map((k) => [k, 0]));
    expect(fullyRated(all)).toBe(true);
    expect(fullyRated({ ...all, horny: null })).toBe(false);
    expect(fullyRated(undefined)).toBe(false);
  });

  it('lists the home page and each movie on yuleswoon.com', () => {
    const xml = sitemapXml(['a-danish-christmas', 'noel-and-joy']);
    expect(xml).toContain('<loc>https://yuleswoon.com/</loc>');
    expect(xml).toContain('<loc>https://yuleswoon.com/movie/a-danish-christmas</loc>');
    expect(xml).toContain('<loc>https://yuleswoon.com/movie/noel-and-joy</loc>');
    expect(xml).not.toContain('web.app');
  });
});
