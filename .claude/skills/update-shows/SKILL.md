---
name: update-shows
description: Find upcoming Richmond shows, offer ten flyer images to pick from, and put the five picked on the bulletin board of the personal side. Run when the user asks to update the shows, the fliers or the posters on the board.
---

# Update the fliers on the bulletin board

The board in the personal side's room has five fliers. Each is an image file in
`src/lib/assets/fliers/` and nothing else: no text is drawn and there is no stand-in. This skill
finds ten candidate flyers, lets the user pick five, and puts those five on the board.

Read `sources.md` beside this file first. It records where each source was actually found to
publish its shows, and what did not work. Update it at the end of every run.

## 1. Find candidates

Today's date decides what counts as upcoming, so check it before anything else.

**Always on the list of ten** (one option each, every run):

- **Sunday Soundtracks** at J&R's Music World: the next upcoming one, or the most recent if none
  is announced.
- **RVA Pro Wrestling**: the next upcoming show, or the most recent if none is announced.

If the show that should be offered has no flyer image, offer that organiser's most recent show
that does have one. These two are guaranteed a place on the list, not on the board: the user may
pick neither.

**The other eight** are metal shows in Richmond, Virginia, upcoming, ranked:

1. screamo and noise first,
2. then other metal and its neighbours (hardcore, powerviolence, grind, doom, sludge, black
   metal),
3. then soonest first within each.

If there are not eight upcoming metal shows with flyers, fill out the list with the nearest
thing (heavy punk, then recent metal shows just past) rather than offering fewer, and say so.

**Venue show lists come first.** Some venues post one poster listing all their coming shows: a
month's calendar, or the week's. Cobra Cabana and The Broadberry do so regularly. Whenever a
venue has a current one, grab it: it is a better thing to have on the board than a single
show's flyer, so it goes on the list ahead of the single shows, and a single show at that venue
is offered as well only if it is one of the strongest of the run. A list that has mostly passed
is not current.

**Check all of these every run:**

- Banditos
- Odin's Underground
- The Material Room
- Cobra Cabana
- The Green House
- Fuzzy Cactus
- The Broadberry
- The Camel
- Richmond Music Hall
- RVA Punk Shows on Instagram

Other Richmond venues and promoters are welcome too. Add any that turn out to be useful to
`sources.md`.

**Instagram** is where most of these flyers are, and it needs the user's logged-in Chrome. This
skill may take control of Chrome without asking: a standing exception, given on 2026-11-19, to
the user's rule that the browser is always asked for, and it covers this skill only. Work in a
new tab and close it at the end. Only read: visit the accounts in `sources.md` and the posts
they lead to, and save flyer images. No likes, follows, comments or messages, and nothing typed
anywhere but the search box.

## 2. The image rule

A candidate is its flyer image. A show whose actual flyer cannot be saved as an image file is
not a candidate, however good the show is. Never make a flyer, typeset one, or use a venue logo,
band photo or screenshot of a listing in its place.

Save the image at the largest size on offer, whole and uncropped. If a post is a carousel, the
flyer is usually the first image.

**A flier has to be readable.** On the board a flier is small; taken down, it fills the window,
and every line on it should then be legible, the small print of a show list included. So:

- Save every image at its full size, never a thumbnail or a scaled-down capture. Aim for 1200 px
  or more on the longer side; `npm run fliers` refuses anything under 900.
- Look at each saved image at full size before offering it. If its smallest text that matters
  (dates, band names) cannot be read, get a larger copy or drop the candidate.
- A show list set in a decorative border loses most of its pixels to the border. Crop to the
  list itself, capturing that part of the image at full size, so the text is as large as the
  source allows.

## 3. Lay the ten out

Save into `flier-candidates/` at the top of the repository (it is git-ignored), clearing out
what was there from the last run:

- `01.jpg` to `10.jpg` (whatever the image's own format is), with Sunday Soundtracks as 01 and
  RVA Pro Wrestling as 02, then the rest in rank order;
- `candidates.json`: for each number, the show, date, venue, lineup, the page it came from, and
  one line on why it is on the list;
- `index.html`: a contact sheet of the ten images, each under its number in large type, with the
  show, date, venue and a link to its page beneath. Plain and self-contained, reading the images
  from beside it.

Open the contact sheet for the user (`xdg-open flier-candidates/index.html`) and also give the
list in the terminal: number, show, date, venue.

## 4. The pick

Ask the user for five. They answer with numbers from the list, paths to image files of their
own, or a mix: "2, 5, 9" and two paths, say. Their own images are as good as any candidate and
need no show details.

The picks must come to exactly five. If they come to more or fewer, or a number is not on the
list, or a path is not a readable image, say which and ask again. Do not guess, pad the list or
keep an old flier to make up the number.

The order the user gives is the order on the board: top row left to right, then the bottom row.

## 5. Put them on the board

```
npm run fliers -- <first> <second> <third> <fourth> <fifth>
```

This resizes the five into `src/lib/assets/fliers/` as `1.webp` to `5.webp` and removes the old
ones. Then:

```
npm run check
npm run build
```

If either fails, stop, say what failed, and do not commit.

## 6. Publish

The user's pick in the terminal is their approval to publish. This is a standing exception,
agreed on 2026-11-19, to their rule that they make every commit themselves, and it covers this
and nothing wider:

- Stage only `src/lib/assets/fliers/`. If anything else in the working tree is changed, leave it
  unstaged and untouched, and mention it.
- Commit only if on `master` and the check and build passed. On any other branch, stop and ask.
- Commit message: `Fliers: ` and the week's date, with the usual attribution line.
- `git push origin master`. The push deploys the site.

Changes to this skill or `sources.md` are not covered: leave them for the user to commit.

If the user says not to publish this time, stop after step 5.

## 7. Record what was learned

Update `sources.md`: for each source, the address that actually had its shows, whether it needed
the logged-in browser, and anything that failed. Add new venues worth checking. Keep it to what
the next run needs.
