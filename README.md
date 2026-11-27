# Yule Swoon

Ratings for holiday romance movies. Anyone can view them; only Kiki can add, rate, edit or delete, after signing in with Google at `/kiki`. Each movie's scores have their own address, `/movie/<id>`, where `<id>` is its Firestore document id.

## How access works

- Movies live in the Firestore collection `movies`, read live by every visitor.
- `firestore.rules` lets anyone read and only a verified `venablekd@gmail.com` Google sign-in write. That rule is the real protection; the app just hides the controls from everyone else.
- Kiki's audio reviews are files in Cloud Storage at `movies/<id>/reviews/`, with their details in the Firestore subcollection `movies/<id>/reviews`. Only Kiki can read or change either (`storage.rules` and `firestore.rules`).
- Published versions of them are files at `movies/<id>/published/<episode>.m4a`, with their details in `movies/<id>/published`. Recordings' waveforms are in `movies/<id>/peaks`. Only Kiki can see these for now, and only the backend makes them.
- To change the editor, update the email in `firestore.rules`, `storage.rules` and `src/app/firebase.ts`, then redeploy.
- The TMDB movie-search key is the `key` field of the Firestore document `private/tmdb`, readable only by the editor.
- While `src/app/firebase.ts` has no settings, the app keeps everything in the browser's own storage and shows every control (handy for trying things out, useless for sharing).

## One-time Firebase setup

1. Create a project at <https://console.firebase.google.com> (no Analytics needed).
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
- **Publish** makes a new published version from the recording as it's edited at that moment, with a title and notes, ready to be a podcast episode. The backend makes its file. Publishing again makes another; it never replaces one. Recordings and published versions are deleted separately.

The backend is two Cloud Functions in `functions/`, using ffmpeg:

- `recordingUploaded` makes the waveform of each recording uploaded.
- `publishedWritten` makes the file of each version published, and again when Kiki retries one that failed.

They run in `us-central1`, set in `functions/src/index.ts`. That has to be the Storage bucket's region; change it there if the bucket is elsewhere.

The first time, deploy them by hand as the project's owner, which also turns on the Google Cloud services they need:

```bash
npx firebase deploy --only functions,storage,firestore:rules
```

Then make waveforms for the recordings made before there was a backend:

```bash
gcloud auth application-default login
npm --prefix functions run backfill-peaks
```

## Deploys

Every push to `main` builds the site and deploys it, `firestore.rules`, `storage.rules` and the functions (`.github/workflows/deploy.yml`). It can also be run by hand from the repo's Actions tab.

GitHub signs in to Google Cloud without a stored key. To set that up, once, or to move to a different repo, or after it gains permissions (as it did for deploying the functions):

```bash
scripts/setup-github-deploy.sh <google-account> <github-owner>/<repo>
```

## Development

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.31.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

To see Kiki's side without signing in, open `/kiki` on the local server and choose **Preview as Kiki**. It shows the live movies with all her controls, but changes stay in the page and go away on reload. Recordings made then can be edited, with their waveform worked out in the browser, but not published. It lasts until you stop it or close the tab, and the production build turns it off. Movie search uses the key in `public/tmdb-key.txt`.

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
