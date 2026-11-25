# Yule Swoon

Ratings for holiday romance movies. Anyone can view them; only Kiki can add, rate, edit or delete, after signing in with Google at `/kiki`.

## How access works

- Movies live in the Firestore collection `movies`, read live by every visitor.
- `firestore.rules` lets anyone read and only a verified `venablekd@gmail.com` Google sign-in write. That rule is the real protection; the app just hides the controls from everyone else.
- To change the editor, update the email in both `firestore.rules` and `src/app/firebase.ts`, then redeploy.
- The TMDB movie-search key is the `key` field of the Firestore document `private/tmdb`, readable only by the editor.
- While `src/app/firebase.ts` has no settings, the app keeps everything in the browser's own storage and shows every control (handy for trying things out, useless for sharing).

## One-time Firebase setup

1. Create a project at <https://console.firebase.google.com> (no Analytics needed).
2. Build → Authentication → Sign-in method: enable **Google**.
3. Build → Firestore Database: create a database in production mode.
4. Project settings → Your apps → add a **Web** app, and paste its `apiKey`, `authDomain`, `projectId` and `appId` into `src/app/firebase.ts`.
5. Sign in and pick the project:

   ```bash
   npx firebase login
   npx firebase use --add
   ```

6. Load the starter movies and the TMDB key (from `public/tmdb-key.txt`, if present):

   ```bash
   npm run seed -- <project-id>
   ```

7. Deploy the site and the rules:

   ```bash
   npm run deploy
   ```

8. Hosting → Add custom domain, and add the DNS records it shows. Then check the domain is listed under Authentication → Settings → Authorized domains, or sign-in will be refused there.

## Development

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.31.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

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

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
