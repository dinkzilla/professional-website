import { Component, inject } from '@angular/core';
import { AuthService } from './auth';
import { MovieStore } from './movie-store';

/** The page at /kiki: Google sign-in for the one person who edits the list. */
@Component({
  selector: 'app-sign-in',
  template: `
    <section class="signin">
      <h2>Kiki’s door</h2>
      @if (!auth.enabled) {
        <p class="muted">Sign-in isn’t set up yet. Add the Firebase settings in src/app/firebase.ts.</p>
      } @else if (!auth.checked()) {
        <p class="muted">Checking…</p>
      } @else if (auth.email()) {
        <p class="muted">Signed in as {{ auth.email() }}. You can add, rate and delete movies.</p>
        <button type="button" class="btn primary" (click)="store.go({ name: 'list' })">Go to the movies</button>
        <button type="button" class="btn quiet" (click)="auth.signOut()">Sign out</button>
      } @else if (auth.previewing()) {
        <p class="muted">Previewing as Kiki. Changes are never saved and go away when the page reloads.</p>
        <button type="button" class="btn primary" (click)="store.go({ name: 'list' })">Go to the movies</button>
        <button type="button" class="btn quiet" (click)="auth.preview(false)">Stop previewing</button>
      } @else {
        <p class="muted">Sign in to add and rate movies. Everyone else can only look.</p>
        <button type="button" class="btn primary" [disabled]="auth.busy()" (click)="signIn()">
          {{ auth.busy() ? 'Waiting for Google…' : 'Sign in with Google' }}
        </button>
        @if (auth.canPreview) {
          <button type="button" class="btn quiet" (click)="preview()">Preview as Kiki (local only)</button>
        }
      }
      @if (auth.error()) {
        <p class="error" role="alert">{{ auth.error() }}</p>
      }
    </section>
  `,
})
export class SignIn {
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(MovieStore);

  /** A successful sign-in goes straight back to the movie list. */
  protected async signIn() {
    if (await this.auth.signIn()) this.store.go({ name: 'list' });
  }

  protected preview() {
    this.auth.preview(true);
    this.store.go({ name: 'list' });
  }
}
