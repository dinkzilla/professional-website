import { Component, computed, inject } from '@angular/core';
import { AuthService } from './auth';
import { MovieDetail } from './movie-detail';
import { MovieForm } from './movie-form';
import { MovieList } from './movie-list';
import { MovieStore } from './movie-store';
import { ReviewStore } from './review-store';
import { SignIn } from './sign-in';

@Component({
  selector: 'app-root',
  imports: [MovieList, MovieDetail, MovieForm, SignIn],
  template: `
    <header class="top" [class.sub]="view().name !== 'list'">
      <div class="wrap">
        @if (view().name !== 'list') {
          <button type="button" class="back" (click)="store.go({ name: 'list' })">‹<span class="back-text"> All Movies</span></button>
        }
        <h1><span class="kikis">Kiki’s</span> Yule <span>Swoon</span></h1>
      </div>
    </header>
    <main class="wrap">
      @if (store.error()) {
        <p class="error" role="alert">{{ store.error() }}</p>
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
  `,
})
export class App {
  protected readonly store = inject(MovieStore);
  protected readonly auth = inject(AuthService);
  protected readonly view = this.store.view;
  private readonly reviews = inject(ReviewStore);
  /** A recording that failed to save after its form was left. On the form, its own row says so. */
  protected readonly unsaved = computed(() => {
    const v = this.view();
    return this.reviews.uploads().find((u) => u.problem && !(v.name === 'edit' && v.id === u.movieId));
  });
}
