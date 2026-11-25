import { Component, inject } from '@angular/core';
import { MovieDetail } from './movie-detail';
import { MovieForm } from './movie-form';
import { MovieList } from './movie-list';
import { MovieStore } from './movie-store';

@Component({
  selector: 'app-root',
  imports: [MovieList, MovieDetail, MovieForm],
  template: `
    <header class="top">
      <div class="wrap">
        @if (view().name !== 'list') {
          <button type="button" class="back" (click)="store.go({ name: 'list' })">‹ All movies</button>
        }
        <h1>Holiday Romance <span>Scorecard</span></h1>
      </div>
    </header>
    <main class="wrap">
      @if (store.error()) {
        <p class="error" role="alert">{{ store.error() }}</p>
      }
      @let v = view();
      @if (v.name === 'detail') {
        <app-movie-detail [id]="v.id" />
      } @else if (v.name === 'edit') {
        <app-movie-form [id]="v.id" />
      } @else {
        <app-movie-list />
      }
    </main>
  `,
})
export class App {
  protected readonly store = inject(MovieStore);
  protected readonly view = this.store.view;
}
