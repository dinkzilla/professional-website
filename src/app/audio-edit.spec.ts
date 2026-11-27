import { changes, cleanMarks, clock, cut, editedLength, kept, mixPlan, normalize, playable, restore, sameMarks, segments, snapMark, spotsOf, toEdited, toOriginal, whole } from './audio-edit';

describe('normalize', () => {
  it('keeps a plain edit as it is', () => {
    expect(normalize({ start: 1, end: 9, cuts: [{ start: 3, end: 4 }] }, 10)).toEqual({ start: 1, end: 9, cuts: [{ start: 3, end: 4 }] });
  });

  it('clamps trims to the recording and puts them the right way round', () => {
    expect(normalize({ start: 12, end: -2, cuts: [] }, 10)).toEqual({ start: 0, end: 10, cuts: [] });
    expect(normalize({ start: 8, end: 2, cuts: [] }, 10)).toEqual({ start: 2, end: 8, cuts: [] });
  });

  it('sorts cuts, merges overlapping and touching ones, and drops slivers', () => {
    const n = normalize(
      {
        start: 0,
        end: 10,
        cuts: [
          { start: 6, end: 7 },
          { start: 2, end: 3 },
          { start: 2.5, end: 4 },
          { start: 7.02, end: 7.5 },
          { start: 5, end: 5.01 },
        ],
      },
      10,
    );
    expect(n.cuts).toEqual([
      { start: 2, end: 4 },
      { start: 6, end: 7.5 },
    ]);
  });

  it('clips cuts to the trims, and turns a cut at a trim into the trim', () => {
    expect(normalize({ start: 1, end: 9, cuts: [{ start: 0, end: 2 }] }, 10)).toEqual({ start: 2, end: 9, cuts: [] });
    expect(normalize({ start: 0, end: 10, cuts: [{ start: 8, end: 12 }] }, 10)).toEqual({ start: 0, end: 8, cuts: [] });
    expect(normalize({ start: 1, end: 9, cuts: [{ start: 9.5, end: 9.8 }] }, 10)).toEqual({ start: 1, end: 9, cuts: [] });
  });

  it('turns cuts written backwards around', () => {
    expect(normalize({ start: 0, end: 10, cuts: [{ start: 5, end: 4 }] }, 10).cuts).toEqual([{ start: 4, end: 5 }]);
  });

  it('rounds to the millisecond', () => {
    expect(normalize({ start: 1.23456, end: 9.87654, cuts: [] }, 10)).toEqual({ start: 1.235, end: 9.877, cuts: [] });
  });
});

describe('cut and restore', () => {
  it('adds and removes cuts', () => {
    const e = cut(whole(10), { start: 4, end: 2 }, 10);
    expect(e.cuts).toEqual([{ start: 2, end: 4 }]);
    expect(restore(e, { start: 2, end: 4 }, 10).cuts).toEqual([]);
  });

  it('refuses to cut everything that is left', () => {
    const e = cut(whole(10), { start: 2, end: 4 }, 10);
    expect(cut(e, { start: 0, end: 10 }, 10)).toBe(e);
    expect(cut({ start: 3, end: 6, cuts: [] }, { start: 2, end: 7 }, 10)).toEqual({ start: 3, end: 6, cuts: [] });
  });
});

describe('changes', () => {
  it('is false for no edit or the whole recording', () => {
    expect(changes(undefined, 10)).toBe(false);
    expect(changes(whole(10), 10)).toBe(false);
    expect(changes({ start: 0, end: 10.02, cuts: [] }, 10)).toBe(false);
  });

  it('is true for a trim or a cut', () => {
    expect(changes({ start: 1, end: 10, cuts: [] }, 10)).toBe(true);
    expect(changes({ start: 0, end: 10, cuts: [{ start: 3, end: 4 }] }, 10)).toBe(true);
  });
});

describe('kept parts and time', () => {
  const edit = { start: 1, end: 9, cuts: [{ start: 3, end: 5 }] };
  const spans = kept(edit, 10);

  it('lists what is kept', () => {
    expect(spans).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 9 },
    ]);
    expect(editedLength(spans)).toBe(6);
    expect(kept(undefined, 10)).toEqual([{ start: 0, end: 10 }]);
  });

  it('leaves the last part open when it runs to the end', () => {
    expect(segments(undefined, 10)).toEqual([{ start: 0, end: null }]);
    expect(segments(edit, 10)).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 9 },
    ]);
  });

  it('maps original time to edited time and back', () => {
    expect(toEdited(spans, 0)).toBe(0);
    expect(toEdited(spans, 2)).toBe(1);
    expect(toEdited(spans, 4)).toBe(2);
    expect(toEdited(spans, 6)).toBe(3);
    expect(toEdited(spans, 10)).toBe(6);
    expect(toOriginal(spans, 0)).toBe(1);
    expect(toOriginal(spans, 1)).toBe(2);
    expect(toOriginal(spans, 2)).toBe(5);
    expect(toOriginal(spans, 3)).toBe(6);
    expect(toOriginal(spans, 99)).toBe(9);
  });

  it('says where playing should be', () => {
    expect(playable(spans, 0)).toBe(1);
    expect(playable(spans, 2)).toBe(2);
    expect(playable(spans, 3)).toBe(5);
    expect(playable(spans, 4)).toBe(5);
    expect(playable(spans, 2.98, 0.03)).toBe(5);
    expect(playable(spans, 8.99, 0.03)).toBeNull();
    expect(playable(spans, 9)).toBeNull();
  });
});

describe('clock', () => {
  it('shows minutes and seconds, hours when needed, and tenths if asked', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(65.9)).toBe('1:05');
    expect(clock(3725)).toBe('1:02:05');
    expect(clock(65.94, true)).toBe('1:05.9');
    expect(clock(65.96, true)).toBe('1:06.0');
  });
});

describe('intro and outro', () => {
  const spans = [
    { start: 2, end: 10 },
    { start: 15, end: 30 },
  ];
  const lengths = { intro: 10, outro: 8 };

  it('puts marks on the edited clock', () => {
    expect(spotsOf({ introEnd: 12, outroStart: 20 }, spans)).toEqual({ introEnd: 8, outroStart: 13 });
    expect(spotsOf({}, spans)).toEqual({ introEnd: null, outroStart: null });
    expect(spotsOf({ introEnd: 0 }, spans).introEnd).toBe(0);
  });

  it('moves a mark in a cut to where it is heard', () => {
    expect(snapMark(spans, 12)).toBe(15);
    expect(snapMark(spans, 5)).toBe(5);
    expect(snapMark(spans, 0)).toBe(2);
    expect(snapMark(spans, 40)).toBe(30);
  });

  it('leaves out what has no spot', () => {
    expect(mixPlan(23, { introEnd: null, outroStart: null }, lengths)).toEqual({ lead: 0, introAt: null, outroAt: null, length: 23 });
  });

  it('ends the intro at its spot', () => {
    expect(mixPlan(23, { introEnd: 15, outroStart: null }, lengths)).toEqual({ lead: 0, introAt: 5, outroAt: null, length: 23 });
  });

  it('starts the recording late if the intro needs more room', () => {
    expect(mixPlan(23, { introEnd: 4, outroStart: 10 }, lengths)).toEqual({ lead: 6, introAt: 0, outroAt: 16, length: 29 });
  });

  it('lets the outro run past the end', () => {
    expect(mixPlan(23, { introEnd: null, outroStart: 20 }, lengths)).toEqual({ lead: 0, introAt: null, outroAt: 20, length: 28 });
  });

  it('keeps only real marks, inside the recording', () => {
    expect(cleanMarks({}, 30)).toBeUndefined();
    expect(cleanMarks({ introEnd: NaN, outroStart: 40 }, 30)).toEqual({ outroStart: 30 });
    expect(sameMarks(undefined, {})).toBe(true);
    expect(sameMarks({ introEnd: 1 }, {})).toBe(false);
  });
});
