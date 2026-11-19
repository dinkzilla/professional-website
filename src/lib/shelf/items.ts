// The objects in the room, in the order the scene builds them. Each is built in its own file in
// objects/ (or tie.ts), which also says where it is kept; what the builders share is in parts.ts,
// rack.ts and types.ts. Everything the rest of the scene wants of them is to be had from here.

import { catalogue } from './catalogue.ts';
import { cassettePlacement } from './objects/cassette.ts';
import { flierPlacements, loadFliers } from './objects/fliers.ts';
import { khemmisPlacement } from './objects/khemmis.ts';
import { loadGame, mothersheetPlacements } from './objects/mothersheet.ts';
import { loadClipping, skullPlacements } from './objects/skull.ts';
import { tvPlacement, videoModulePlacement } from './objects/video.ts';
import { tiePlacement } from './tie.ts';
import type { Item, Placement } from './types.ts';

export * from './rack.ts';
export type * from './types.ts';
export { braided, screw } from './parts.ts';
export { loadModels } from './objects/skull.ts';

/**
 * Fetch what the objects are printed with: a typeface and a picture. They are drawn on canvases,
 * which use whatever is to hand when they are drawn, so this is to be done before any object is
 * built. Whatever cannot be had is done without.
 */
export async function loadPrinting() {
	await Promise.allSettled([loadGame(), loadClipping(), loadFliers()]);
}

const placements: Placement[] = [
	tvPlacement,
	khemmisPlacement,
	videoModulePlacement,
	...skullPlacements,
	...mothersheetPlacements,
	...flierPlacements,
	tiePlacement,
	cassettePlacement
];

export const items: Item[] = placements.map((placement) => ({
	...catalogue.find((entry) => entry.id === placement.id)!,
	...placement
}));
