import { datedName, extension, freeSlug, slug, stamp } from './slug';

describe('slug', () => {
  it('makes a readable id from a title', () => {
    expect(slug('A Danish Christmas')).toBe('a-danish-christmas');
    expect(slug('The Night’s Before Christmas!')).toBe('the-nights-before-christmas');
    expect(slug('Holiday Touchdown: A Bears Love Story')).toBe('holiday-touchdown-a-bears-love-story');
    expect(slug('Noël & Joy')).toBe('noel-and-joy');
    expect(slug('  --  ')).toBe('movie');
  });

  it('keeps it short', () => {
    expect(slug('a'.repeat(30) + ' ' + 'b'.repeat(40)).length).toBeLessThanOrEqual(60);
  });

  it('numbers a title that is taken', () => {
    expect(freeSlug('Guarding Stars', [])).toBe('guarding-stars');
    expect(freeSlug('Guarding Stars', ['guarding-stars'])).toBe('guarding-stars-2');
    expect(freeSlug('Guarding Stars', ['guarding-stars', 'guarding-stars-2'])).toBe('guarding-stars-3');
  });
});

describe('dated names', () => {
  const at = new Date(2026, 10, 27, 14, 30, 59);

  it('names by movie and local time', () => {
    expect(stamp(at)).toBe('2026-11-27-1430');
    expect(datedName('a-danish-christmas', at, [])).toBe('a-danish-christmas-2026-11-27-1430');
    expect(datedName('a-danish-christmas', at, ['a-danish-christmas-2026-11-27-1430'])).toBe('a-danish-christmas-2026-11-27-1430-2');
  });

  it('gives each kind of audio its usual extension', () => {
    expect(extension('audio/mp4')).toBe('.m4a');
    expect(extension('audio/webm;codecs=opus')).toBe('.webm');
    expect(extension('audio/wav')).toBe('');
  });
});
