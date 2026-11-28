# Yule Swoon

Ratings for holiday romance movies. Anyone can view them; only Kiki can add, rate, edit or delete, after signing in with Google at `/kiki`. Each movie's scores have their own address, `/movie/<id>`, where `<id>` is its Firestore document id.

## How access works

- Movies live in the Firestore collection `movies`, read live by every visitor.
- `firestore.rules` lets anyone read and only a verified `venablekd@gmail.com` Google sign-in write. That rule is the real protection; the app just hides the controls from everyone else.
- A movie's id is made from its title when it's added (`a-danish-christmas`), and stays the same if the title changes.
- Kiki's audio reviews are files in Cloud Storage at `movies/<id>/recordings/`, with their details in the Firestore subcollection `movies/<id>/recordings`. Only Kiki can read or change either (`storage.rules` and `firestore.rules`).
- Published versions of them are files at `movies/<id>/published/`, with their details in `movies/<id>/published`. Both kinds of file are named for the movie and when they were made, like `a-danish-christmas-2026-11-27-1430.m4a`. Recordings' waveforms are in `movies/<id>/waveforms`, one document each, named the same as its recording. Only Kiki can see these for now, and only the backend makes them.
- To change the editor, update the email in `firestore.rules`, `storage.rules` and `src/app/firebase.ts`, then redeploy.
- The TMDB movie-search key is the `key` field of the Firestore document `private/tmdb`, readable only by the editor.
- While `src/app/firebase.ts` has no settings, the app keeps everything in the browser's own storage and shows every control (handy for trying things out, useless for sharing).

## One-time Firebase setup

1. Create a project at <https://console.firebase.google.com>.
2. Build → Authentication → Sign-in method: enable **Google**.
3. Build → Firestore Database: create a database in production mode.
4. Project settings → Your apps → add a **Web** app, and paste its `apiKey`, `authDomain`, `projectId`, `storageBucket` and `appId` into `src/app/firebase.ts`.
5. Sign in and pick the project:

   ```bash
   npx firebase login
   npx firebase use --add
   ```

6. Load the starter movies and the TMDB key (from `public/tmdb-key.txt`, if present):

   ```bash
   npm run seed -- <project-id>
   ```

7. Storage → Get started: create the default bucket, which needs the pay-as-you-go (Blaze) plan. Pick `us-central1`, `us-east1` or `us-west1` for the free allowance. Until it exists, `npm run deploy` stops before publishing anything.
8. Deploy the site and the rules:

   ```bash
   npm run deploy
   ```

9. Hosting → Add custom domain, and add the DNS records it shows. Then check the domain is listed under Authentication → Settings → Authorized domains, or sign-in will be refused there.

## Editing and publishing audio reviews

Each recording has **Edit**, **Publish** and **Delete** buttons.

- **Edit** opens a full-screen editor. Drag the waveform under the playhead, pinch to zoom, and trim the ends by dragging the yellow handles, or with **Mark Start** and **Mark End**, which trim to the playhead. To cut, use **Start Cut** and **End Cut**, or hold and drag on the waveform, then **Cut**. Tap a cut to restore it or to hear the join. The recording is never changed: the edit is saved with it as time ranges (`edit` on its Firestore document), and playing it skips what's cut.
- **Intro Ends** and **Outro Starts**, in the editor, lay the fixed intro and outro over the recording: the intro finishes playing at its mark, and the outro starts at its. Either can overlap the speech. If the intro is longer than what comes before its mark, the recording starts after enough silence for it, and the outro can run on past the end. One without a mark is left out. The marks are saved with the recording (`marks` on its Firestore document), and playing the recording, in the editor or the list, plays them as they'll be published.
- **Publish** makes a new published version from the recording as it's edited at that moment, with a title and notes, ready to be a podcast episode. The backend makes its file. Publishing again makes another; it never replaces one. Recordings and published versions are deleted separately.

The backend is two Cloud Functions in `functions/`, using ffmpeg:

- `recordingUploaded` makes the waveform of each recording uploaded.
- `publishedWritten` makes the file of each version published, and again when Kiki retries one that failed.

The intro and outro are `jingle/intro.wav` and `jingle/outro.wav`, made by `jingle/build.sh` from the other files there. The site serves copies at `/jingles/` (set in `angular.json`) for playing, and the functions' build copies them into the functions to make published versions with, so a deploy updates both. They're mixed in at full level, with no fades added, since the files have their own.

They run in `us-east1`, set in `functions/src/index.ts`. That has to be the Storage bucket's region; change it there if the bucket is elsewhere.

They deploy with everything else (see Deploys). The first deploy also turns on the Google Cloud services they need, and may need running again if it fails while those finish setting up. After that first deploy, move what was saved before readable names to them: movies added in the app get an id from their title (so their address changes), and recordings move from `reviews` to `recordings` with dated names. It shows what it would do first:

```bash
gcloud auth application-default login
npm --prefix functions run migrate-ids
npm --prefix functions run migrate-ids -- --apply
```

With `--apply`, it also makes a waveform for every recording that hasn't got one. If one is ever missing later, `npm --prefix functions run backfill-waveforms` makes just those.

## Deploys

Deploys are by hand. `npm run deploy` builds the site and deploys it, `firestore.rules`, `storage.rules` and the functions. Firebase skips functions that haven't changed.

## Development

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.31.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

To see Kiki's side without signing in, open `/kiki` on the local server and choose **Preview as Kiki**. It shows the live movies with all her controls, but changes stay in the page and go away on reload. Recordings made then can be edited, with their waveform worked out in the browser, but not published. It lasts until you stop it or close the tab, and the production build turns it off. The live site's published versions and the recordings they came from, with their edits and intro and outro marks, are copied into `seed/audio.json` and `seed/audio/` by `npm run pull-seed-audio -- <project-id>` (it only reads from the live site), and are listed there too. Only the development build serves them; the production build leaves them out, and Hosting skips `seed/` anyway. Movie search uses the key in `public/tmdb-key.txt`.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

To build the functions, run `npm --prefix functions run build`.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Search engines

Movie cards on the list are real links to `/movie/<id>`, so search engines can find each movie's page. `/sitemap.xml` lists `https://yuleswoon.com/` and every fully rated movie. It's made by the `sitemap` Cloud Function (`functions/src/sitemap.ts`, sent there by `firebase.json`) straight from Firestore, so new ratings show up without a deploy, at most an hour late. `public/robots.txt` points search engines to it. The function keeps its own list of the rating criteria; `src/app/sitemap.spec.ts` fails if it no longer matches `src/app/criteria.ts`.

## Traffic analytics

The site sends visits and listening to Google Analytics through Firebase (`src/app/analytics.ts`). Kiki's own visits aren't counted: nothing is sent while she's signed in, or while previewing as her. `ng serve` prints events to the browser console (`[analytics]`, at the Verbose level) instead of sending them.

To turn it on, open Project settings → Integrations → Google Analytics in the Firebase console, link or create an Analytics property, and deploy. The app reads the property from Firebase, so `src/app/firebase.ts` needs no change.

What's sent:

- `page_view` for each view: the list, a movie (`/movie/<id>`, titled with the movie) and sign-in.
- `list_options` when the list's filter or sort changes, with `sort` and `filter`.
- For audio reviews, each with `podcast_id`, `podcast_title`, `movie_id`, `movie_title` and `duration_sec`:
  - `podcast_start` when a listen starts, with `play_count` (how many times this browser has started this review) and `replay` (whether it's more than once). Pausing and carrying on is one listen. Starting again after the end, or on another visit, is another.
  - `podcast_progress` at each tenth heard during a listen, with `percent` (10–90). Only steady playing counts, so skipping ahead doesn't. Dividing each `percent`'s count by the starts shows how far people listen.
  - `podcast_complete` when the end is reached.
  - `podcast_seek` when the slider is moved by more than two seconds, with `direction` (`back` or `forward`), `from_sec`, `to_sec`, `from_percent` and `to_percent`. Going back shows what gets heard again; going forward shows what gets skipped.

Analytics reports show event parameters only once they're registered: Analytics → Admin → Custom definitions → Create custom dimension, event-scoped, for `podcast_title`, `movie_title`, `percent`, `direction`, `to_percent`, `play_count`, `replay`, `sort` and `filter`. They count only from when they're registered. Explore → Free form, with event name and `percent` as rows and event count as the value, filtered to one `podcast_title`, gives the drop-off curve. Linking BigQuery (Admin → BigQuery links) keeps every event with all its parameters, registered or not.

