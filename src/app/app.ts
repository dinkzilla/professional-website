import { Component, computed, inject } from '@angular/core';
import { AnalyticsService } from './analytics';
import { AuthService } from './auth';
import { MovieDetail } from './movie-detail';
import { MovieForm } from './movie-form';
import { MovieList } from './movie-list';
import { MovieStore } from './movie-store';
import { ReviewStore } from './review-store';
import { SignIn } from './sign-in';
import { ThemeService } from './theme';

@Component({
  selector: 'app-root',
  imports: [MovieList, MovieDetail, MovieForm, SignIn],
  template: `
    <header class="top" [class.sub]="view().name !== 'list'">
      <div class="wrap">
        @if (view().name !== 'list') {
          <button type="button" class="back" (click)="store.go({ name: 'list' })"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 8H2.5M7.5 3l-5 5 5 5" /></svg><span class="back-text">All Movies</span></button>
        }
        <h1><span class="kikis">Kiki’s</span> Yule <span>Swoon</span></h1>
      </div>
    </header>
    <main class="wrap">
      @if (view().name === 'list') {
        @let label = theme.dark() ? 'Switch to light mode' : 'Switch to dark mode';
        <button type="button" class="theme-switch" [attr.aria-label]="label" [title]="label" (click)="theme.toggle()">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            @if (!theme.dark()) {
              <circle cx="8" cy="8" r="3" />
              <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1.1 1.1M11.9 11.9L13 13M3 13l1.1-1.1M11.9 4.1L13 3" />
            } @else {
              <path d="M13.5 9.6A6 6 0 1 1 6.4 2.5a4.8 4.8 0 0 0 7.1 7.1Z" />
            }
          </svg>
        </button>
      }
      @if (store.error()) {
        <p class="error" role="alert">{{ store.error() }}</p>
      }
      @if (store.unsynced() && auth.isEditor()) {
        <p class="note" role="status">Saved on this device, not synced yet. It will sync when the connection is back.</p>
      }
      @if (unsaved(); as u) {
        <p class="error" role="alert">
          A recording for {{ store.byId(u.movieId)?.title ?? 'a movie' }} couldn’t be saved.
          <button type="button" class="clear" (click)="store.go({ name: 'edit', id: u.movieId })">Go to it</button>
        </p>
      }
      @let v = view();
      @if (v.name === 'detail') {
        <app-movie-detail [id]="v.id" />
      } @else if (v.name === 'edit') {
        @if (store.canWrite()) {
          <app-movie-form [id]="v.id" />
        } @else {
          <app-movie-detail [id]="v.id" />
        }
      } @else if (v.name === 'signin') {
        <app-sign-in />
      } @else {
        <app-movie-list />
      }
      @if (auth.enabled && auth.email() && v.name === 'list') {
        <p class="whoami">
          Signed in as {{ auth.email() }}
          <button type="button" class="btn quiet" (click)="auth.signOut()">Sign out</button>
        </p>
      } @else if (auth.previewing() && v.name === 'list') {
        <p class="whoami">
          Previewing as Kiki
          <button type="button" class="btn quiet" (click)="auth.preview(false)">Stop</button>
        </p>
      }
    </main>
    @if (v.name === 'detail' || (v.name === 'edit' && !store.canWrite())) {
      <footer class="wrap foot">
        <button type="button" class="back" (click)="store.go({ name: 'list' })"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 8H2.5M7.5 3l-5 5 5 5" /></svg>All Movies</button>
      </footer>
    }
  `,
})
export class App {
  protected readonly store = inject(MovieStore);
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly view = this.store.view;
  private readonly reviews = inject(ReviewStore);
  /** Started here so every view is counted, whichever is opened first. */
  private readonly analytics = inject(AnalyticsService);
  /**
   * A recording that failed to save after its form was left. Not mentioned on any form: its own has a row for
   * it, and going to it from another movie's would swap the movie out from under what's been filled in.
   */
  protected readonly unsaved = computed(() =>
    this.view().name === 'edit' ? undefined : this.reviews.uploads().find((u) => u.problem),
  );
}
