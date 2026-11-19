// What an object in the room tells the scene about itself: where it is kept, and what it does.

import { Group, type Intersection, type Object3D } from 'three';
import type { Entry } from './catalogue.ts';

export interface Placement {
	id: string;
	/**
	 * Which shelf it sits on, counting from the top, and where along it (0 is the middle). Or
	 * WALL: it is pinned to the wall behind, `x` is where along the wall, `up` is how far above the
	 * floor its origin is, and `back` is ignored. Or FLOOR: it is on the floor under the rack,
	 * placed as it would be on a shelf.
	 */
	shelf: number;
	x: number;
	/** How far back from the front edge its base centre sits, as a share of the shelf depth. */
	back?: number;
	/** Turned this far (radians) about the vertical while on the shelf. */
	yaw?: number;
	/** Stands this far above the shelf, on top of something else that is on it. */
	up?: number;
	/** Tipped this far (radians) to its left while on the shelf, as a book leaning on its neighbour. */
	lean?: number;
	/**
	 * Rack-mounted, with a front panel of this height: the panel is flush with the front of the
	 * rack and its bay is exactly as tall, whatever else is attached to it. Built with the front of
	 * the panel at z = 0 and its bottom edge at y = 0, and `back` is ignored.
	 */
	flush?: number;
	/** On the wall, pinned to the board: it is moved with the board (see PINBOARD). */
	pinned?: boolean;
	/** On the wall, over something else that is on it: this much further off the wall. */
	proud?: number;
	/**
	 * Under the pointer it does not come forward, which would take it through whatever is pinned
	 * over it: it turns this far (radians) on its pin, which its group's userData.pin gives the
	 * height of above its middle.
	 */
	swing?: number;
	/** Stays on the shelf: it cannot be picked up. */
	fixed?: boolean;
	/**
	 * Stays where it is too, but a tap on it is still passed to the page, which does something
	 * else with it.
	 */
	link?: boolean;
	/** How far it comes forward under the pointer, where that is not as far as most things do. */
	out?: number;
	/**
	 * Kept in or on this other object (its id), and carried along with it wherever that goes. It is
	 * not picked up itself: a press on it is a press on what carries it. When that has been picked
	 * up, this comes out of it and is held up beside it, and goes back in before that is put back.
	 */
	rides?: string;
	/**
	 * Held, it is a flat sheet of this size, to be read: it is brought as near as fills the part of
	 * the window it is shown in.
	 */
	page?: { w: number; h: number };
	/** How many seconds it takes to come forward or go back, where that is not as long as most things do. */
	takes?: number;
	/** Its attitude once picked up: pitch (tipped toward the viewer) and yaw, in radians. */
	held?: { pitch?: number; yaw?: number };
	build: () => Group;
}

export type Item = Entry & Placement;

/**
 * A part of an object that works where it is, without the object being picked up: a knob, a
 * switch. It is kept in the part's userData.control, where the scene finds it under the pointer.
 */
export interface Control {
	/** It was pressed and let go. */
	tap: () => void;
	/**
	 * It was pressed and let go by a finger, where that does something else: a finger cannot pick
	 * out parts of it that a mouse can.
	 */
	touch?: () => void;
	/**
	 * It was pressed and dragged far enough for one click: down the window (1) or up it (-1). A
	 * press that turns it is not a tap, and a finger that starts on it does not scroll the page.
	 */
	turn?: (by: 1 | -1) => void;
}

/**
 * What an object that does something by itself asks of the scene. It is kept in the userData.works
 * of the group its builder returns.
 */
/**
 * Somewhere on a part's printed face that is a link, as the share of the way across it and up it.
 * It is kept in the part's userData.links, where the scene finds it under the pointer.
 */
export interface Link {
	href: string;
	u: [number, number];
	v: [number, number];
}

/**
 * What a part of an object does when it is pressed while the object is held, where that is
 * something other than the object being put back: true if it did it. It is kept in the part's
 * userData.press, where the scene finds it under the pointer, and is told where the press was.
 */
export type Press = (hit: Intersection) => boolean;

export interface Works {
	/**
	 * The scene has been put on a page. `redraw` has it drawn again, because the object has
	 * changed; told which part of the object shows the change, only if that part is in view.
	 */
	start: (redraw: (showing?: Object3D) => void) => void;
	/** The scene has been taken off its page. */
	stop: () => void;
	/** Move its parts on by `dt` seconds: true if they have further to go. */
	tick: (dt: number) => boolean;
	/** The room's lights are down by this share. */
	dim: (share: number) => void;
	/** It is this far from where it is kept (0) to being held (1). */
	lifted?: (share: number) => void;
	/**
	 * Whether what is kept in it can come out yet, where it has to be opened first: what rides on
	 * it waits for this, once it has been picked up.
	 */
	opened?: () => boolean;
}
