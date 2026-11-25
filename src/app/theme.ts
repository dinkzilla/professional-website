import { Injectable, computed, signal } from '@angular/core';

type Theme = 'light' | 'dark';

// Also read by the script in index.html.
const THEME_KEY = 'yule-swoon-theme';

function rememberedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

/**
 * Light or dark. The site follows the device until it is switched away from
 * that, through the data-theme attribute that styles.css reads. index.html sets
 * the attribute from the remembered choice too, before anything is drawn.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** The device's own setting. */
  private readonly device = signal<Theme>('light');
  /** The theme switched to, or null while following the device. */
  private readonly chosen = signal<Theme | null>(null);
  readonly dark = computed(() => (this.chosen() ?? this.device()) === 'dark');

  constructor() {
    const query = matchMedia('(prefers-color-scheme: dark)');
    this.device.set(query.matches ? 'dark' : 'light');
    query.addEventListener('change', (e) => this.device.set(e.matches ? 'dark' : 'light'));
    this.choose(rememberedTheme());
  }

  /** Switches to the other theme. Remembered by this browser; switching back to the device's own follows it again. */
  toggle() {
    const next: Theme = this.dark() ? 'light' : 'dark';
    this.choose(next === this.device() ? null : next);
  }

  private choose(theme: Theme | null) {
    this.chosen.set(theme);
    if (theme) document.documentElement.dataset['theme'] = theme;
    else delete document.documentElement.dataset['theme'];
    try {
      if (theme) localStorage.setItem(THEME_KEY, theme);
      else localStorage.removeItem(THEME_KEY);
    } catch {}
  }
}
