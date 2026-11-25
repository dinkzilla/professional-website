import { MovieData } from './criteria';

/**
 * A rating form's unsaved changes, kept for as long as the tab is open so that leaving the form or reloading
 * doesn't lose them. Each is kept with the movie as it was when the form opened, and only comes back while
 * the movie is still like that, so it can't undo changes made since.
 */
export interface Kept {
  base: string;
  draft: MovieData;
}

/** The unsaved changes kept under a key, if they still apply to the movie as it is now. */
export function readDraft(key: string, base: string): { draft: MovieData; text: string } | null {
  try {
    const text = sessionStorage.getItem(key);
    const kept: Kept | null = text ? JSON.parse(text) : null;
    return text && kept?.base === base && kept.draft ? { draft: kept.draft, text } : null;
  } catch {
    return null;
  }
}

/** Keeps unsaved changes, and returns the text they are kept as, which clearDraft takes. */
export function keepDraft(key: string, kept: Kept): string {
  const text = JSON.stringify(kept);
  try {
    sessionStorage.setItem(key, text);
  } catch {}
  return text;
}

/** Drops unsaved changes, unless different ones have been kept under the key since. */
export function clearDraft(key: string, text: string) {
  try {
    if (sessionStorage.getItem(key) === text) sessionStorage.removeItem(key);
  } catch {}
}
