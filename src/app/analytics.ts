import { Injectable, effect, inject, untracked } from '@angular/core';
import type { Analytics as GA } from 'firebase/analytics';
import { AuthService } from './auth';
import { firebaseApp } from './firebase';
import { MovieStore } from './movie-store';

type Params = Record<string, string | number | boolean | undefined>;

/** Built by `ng serve` rather than for the deployed site. Events are printed to the console there instead of sent. */
const dev = typeof ngDevMode === 'undefined' || !!ngDevMode;

/**
 * Google Analytics, through Firebase. Sends a page view for each view shown (the app changes views without
 * loading pages, so Analytics can't see them on its own), changes to the list's filter and sort, and whatever
 * else is passed to log(). Kiki's own visits aren't counted: nothing is sent until the remembered sign-in has
 * been checked, and nothing at all while she's signed in. The SDK is loaded only once it's needed.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly auth = inject(AuthService);
  private readonly store = inject(MovieStore);

  /** Events waiting for the sign-in check and the SDK. */
  private queue: { name: string; params: Params }[] = [];
  private ga: Promise<GA | null> | undefined;

  constructor() {
    // A page view for each view, named for its movie once the movie is known.
    let lastPath = '';
    effect(() => {
      const view = this.store.view();
      const title = 'id' in view ? this.store.byId(view.id)?.title : undefined;
      untracked(() => {
        const path = location.pathname;
        if (path === lastPath) return;
        if ('id' in view && !title && this.store.status() === 'loading') return; // Wait for the movie's title.
        lastPath = path;
        this.log('page_view', {
          page_path: path,
          page_location: location.href,
          page_title: title ? `${title} · Yule Swoon` : document.title,
          view: view.name,
        });
      });
    });

    // The list's filter and sort, when they change, not as they start.
    let first = true;
    effect(() => {
      const sort = this.store.sort();
      const network = this.store.network();
      const audio = this.store.audioOnly();
      if (first) {
        first = false;
        return;
      }
      untracked(() => this.log('list_options', { sort, filter: audio ? 'audio' : network || 'all' }));
    });

    // Whatever was waiting goes out once the sign-in has been checked, or is dropped if it's Kiki.
    effect(() => {
      if (!this.auth.checked()) return;
      const excluded = this.excluded();
      untracked(() => this.flush(excluded));
    });
  }

  /** Records an event. Parameter names and values should stay short: Analytics cuts them off at 40 and 100. */
  log(name: string, params: Params = {}) {
    this.queue.push({ name, params });
    if (this.auth.checked()) this.flush(this.excluded());
  }

  private excluded() {
    return !!this.auth.email() || this.auth.previewing();
  }

  private flush(excluded: boolean) {
    const events = this.queue;
    this.queue = [];
    if (excluded || !events.length) return;
    if (dev) {
      for (const e of events) console.debug('[analytics]', e.name, e.params);
      return;
    }
    void this.load().then(async (ga) => {
      if (!ga) return;
      const { logEvent } = await import('firebase/analytics');
      for (const e of events) logEvent(ga, e.name, e.params);
    });
  }

  private load(): Promise<GA | null> {
    return (this.ga ??= (async () => {
      if (!firebaseApp) return null;
      try {
        const { initializeAnalytics, isSupported } = await import('firebase/analytics');
        if (!(await isSupported())) return null;
        // Page views are sent above, for each view, so the one sent on loading would count the first twice.
        // The Google tag sends one when it loads even with send_page_view off in Firebase's config, unless
        // it's set for the whole page first, in the queue the tag reads (as gtag() would, with arguments).
        const w = window as unknown as { dataLayer?: unknown[] };
        const queue = (w.dataLayer ??= []);
        (function (..._: unknown[]) {
          queue.push(arguments);
        })('set', 'send_page_view', false);
        return initializeAnalytics(firebaseApp, { config: { send_page_view: false } });
      } catch {
        return null;
      }
    })());
  }
}
