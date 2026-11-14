// Getting the shelf ready ahead of time. The scene is a large download (it brings three.js) and
// takes a moment to build, so pages that link to the personal side start it in the background, and
// a transition that lands there waits for it, instead of arriving at a black page. This module is
// small and loads none of that itself, so any page can import it.

import type { Shelf } from './scene.ts';

let preparing: Promise<Shelf> | undefined;

/**
 * The shelf, built and drawn once, ready to be put on a page. The work is started by the first
 * call and shared by every later one. Rejects if the scene cannot be loaded or built (no WebGL,
 * say); a later call then tries again.
 */
export function prepareShelf(): Promise<Shelf> {
	preparing ??= import('./scene.ts')
		.then((scene) => scene.prepare())
		.catch((error) => {
			preparing = undefined;
			throw error;
		});
	return preparing;
}
