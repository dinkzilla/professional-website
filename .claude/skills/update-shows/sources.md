# Where the shows are found

Last checked 2026-11-19.

## Without the browser

- **The Auricular**, `theauricular.com/news`: the weekly "RVA Shows You Must See This Week"
  column, out on Wednesdays. One flyer image per show, with date, venue and genre notes. The
  best public source. Take the image address and drop the `-819x1024` style suffix for the full
  size. Check each image: now and then it is a band photo, not a flyer.
- **RVA Pro Wrestling**, `rvaprowrestling.com`: the home page has the next show and its poster.
- Nothing useful: Songkick's Richmond metal listing (no flyers, loose genre filter), RVA
  Magazine's roundups (no per-show flyers), dmvprowrestling.com, the venues' own sites
  (fuzzycactusrva.com/calendar is stale since 2024, banditosburritolounge.com/event-calendar
  reads as empty, Cobra Cabana and J&R's have no working site). Web search finds none of these
  venues' shows.

## Instagram accounts

- Sunday Soundtracks / J&R's Music World: `j_rs_music_world`. The shows are at Révéler
  Experiences. There is also sundaysoundtracks.com, not yet looked at.
- RVA Pro Wrestling: `rvaprowrestling` (not needed while their site has the poster).
- Banditos: `banditoslounge.rva`. A flyer per show, plenty of metal and hardcore.
- Odin's Underground: `odinsunderground` (also called Odin's House of Sound). Posts are
  irregular; nothing upcoming on 2026-11-19.
- Cobra Cabana: `thecobracabanarva`. The show list is the pinned first post.
- Fuzzy Cactus: `fuzzycactusrva`. Mostly DJ nights and drag; the odd metal show.
- The Broadberry: `thebroadberry`. The monthly list is a pinned post, and covers Richmond Music
  Hall, The Camel and The National too, so those need no separate visit for the list.
- Fallout: `falloutrva`. Posts a weekly events list (pinned) and flyers; some metal.

## Other sources, found 2026-11-19

- Canal Club: `thecanalclub` on Instagram. The best metal source so far: a "Coming Up" list
  every week or two, and a flyer per show.
- The Camel: `thecamelrva`. Pinned monthly list, a "This Week" list, and flyers.
- Richmond Music Hall: `richmondmusichall`. Flyers months ahead, little of it metal.
- The Apoth: `theapothrva`. Few posts; nothing upcoming on 2026-11-19.
- The National: `thenationalrva` is an empty account, not theirs. Not yet found; its shows are on
  The Broadberry's monthly list.
- Freakscene: the site `freakscene.diy`, not its Instagram. Needs the user's logged-in browser.
  Richmond's events are at `freakscene.diy/events/calendar/47/`. One event listed on
  2026-11-19 (Dec 4 at the Material Room). Its picture could not be saved: it is not an
  ordinary large image on the event's page. Work out how next time.

## Not found

- **RVA Punk Shows**: no account under `rvapunkshows`, and search for "rva punk shows" and
  "rvapunk" finds nothing that fits. Ask the user for the handle.
- **The Material Room** and **The Green House**: no Instagram account found. The Material Room's
  shows turn up on Freakscene. Ask the user for the handles.
- `rvamustseeshows` exists but is stale. `rvashowscentral` and `showadayrva` were seen in search
  and not yet looked at.

## Getting things out of Instagram

- Find accounts with the search box at the top of `instagram.com/explore/`. Calling Instagram's
  own search address from script is refused.
- A profile's grid is best read from a screenshot: the image descriptions say only "poster and
  text". List the post codes from the grid's links to match them to what is seen.
- Script that returns an image's address is blocked, and the public `/embed/` page is a login
  wall. To save a flyer: open the post, have the page send itself to the first large image
  (`location.href = img.currentSrc`, returning nothing), set the image to fill the window from
  the top left corner and report its size on the page, move the pointer off it, then take a
  `zoom` screenshot of exactly that region with `save_to_disk` at full scale. That gives about
  1000 to 1250 px on the long side. A scaled-down zoom saves the scaled-down picture.
- On a post's page, pick the large image nearest the top of the page: the first large image in
  the page is sometimes one of the "more posts" below. Look at every capture before using it.
- Moving the image so that only part of it fills the window, to capture a show list without its
  border, did not come out at the size worked out (2026-11-19). Capture the whole image and crop
  the saved file instead.
