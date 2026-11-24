// The coat rack that stands in the corner of the room (placed in room.ts): a modern one, all of
// black powder-coated steel, and heavy enough for what hangs on it. A stout tube stands on three splayed legs, capped flat on top, and
// straight round pegs are welded to it at different heights, each pointing its own way and tilted
// up, so that what is hung on one slides down it and settles against the tube. A climbing rope
// hangs from one and a harness from another (see rope.ts and harness.ts).
//
// Built upright about the tube, with the origin on the floor under its middle. Like the rod it is
// all made here, and all of one mesh.

import { BufferGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Its sizes. The room is about 1.4 units to the metre here, by its door, so it stands a little under six feet. */
export const COAT_RACK = {
	height: 2.46,
	foot: 0.36, // how far out from the tube's middle each leg's foot stands
	legs: 0.6, // the height at which the legs leave the tube
	leg: 0.023, // a leg's radius
	pole: 0.03, // the tube's radius
	peg: 0.015, // a peg's radius
	long: 0.18, // a peg's length, from the tube's middle to its end
	rise: (24 * Math.PI) / 180 // how far a peg is tilted up from level
};

/** One peg of the rack, as something to hang a thing on. All in the rack's own frame. */
export type Peg = {
	/**
	 * Where a loop hung on the peg comes to rest: on the peg's upper side, down at its root, a
	 * little way out from the tube, which the loop lies against.
	 */
	rest: Vector3;
	/** The way the peg points, taken level, out from the tube: a unit vector. */
	out: Vector3;
	/** How far the peg is tilted up from level, in radians: it runs along `out` turned up by this much. */
	rise: number;
	/** The peg's radius. It is round. */
	r: number;
	/** How far `rest` is out from the tube's surface, measured level. The peg's end is about 0.12 further out and 0.055 higher. */
	fromPole: number;
};

/**
 * Build the rack with a peg for each of these: the way it points, round from +x toward +z in
 * degrees, and the height at which it leaves the tube. Gives back the pegs in the same order.
 */
export function buildCoatRack(wanted: { way: number; height: number }[]) {
	const { height, foot, legs, leg, pole, peg, long, rise } = COAT_RACK;
	// Powder coat is paint, not bare metal: satin, and it takes the window's light down one side of the tube.
	const steel = new MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.58 });
	const parts: BufferGeometry[] = [];
	// The tube, which stops a little below where the legs are welded to it, well clear of the floor.
	const hangs = legs - 0.1;
	parts.push(new CylinderGeometry(pole, pole, height - hangs, 24).translate(0, (height + hangs) / 2, 0));
	// A sleeve round it where the legs are welded on, which is what takes the load.
	parts.push(new CylinderGeometry(pole + 0.009, pole + 0.009, 0.11, 24).translate(0, legs - 0.02, 0));
	// Three legs, evenly round, each a straight bar from the tube down and out to the floor, with
	// its end rounded over to stand on. They are turned so that all three show from where the room
	// is seen, none behind another.
	for (const way of [82, 202, 322]) {
		const a = (way * Math.PI) / 180;
		const top = new Vector3(0, legs, 0);
		const stands = new Vector3(foot * Math.cos(a), leg, foot * Math.sin(a));
		const run = stands.clone().sub(top);
		const bar = new CylinderGeometry(leg, leg, run.length(), 12);
		bar.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), run.clone().normalize()));
		const mid = top.clone().add(stands).multiplyScalar(0.5);
		parts.push(bar.translate(mid.x, mid.y, mid.z));
		parts.push(new SphereGeometry(leg, 12, 8).translate(stands.x, stands.y, stands.z));
	}

	const RESTS = pole + 0.018; // how far out from the tube's middle, measured level, a loop comes to rest
	const pegs: Peg[] = wanted.map(({ way, height: leaves }) => {
		const a = (way * Math.PI) / 180;
		const out = new Vector3(Math.cos(a), 0, Math.sin(a));
		const along = out.clone().multiplyScalar(Math.cos(rise)).setY(Math.sin(rise)); // the way the peg runs
		const root = new Vector3(0, leaves, 0);
		const bar = new CylinderGeometry(peg, peg, long, 12).translate(0, long / 2, 0);
		bar.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), along));
		parts.push(bar.translate(root.x, root.y, root.z));
		// Its end is rounded over.
		const end = root.clone().addScaledVector(along, long);
		parts.push(new SphereGeometry(peg, 12, 8).translate(end.x, end.y, end.z));
		// The peg's upper side, this far out: its middle line there, and up by its radius square to its run.
		const rest = root
			.clone()
			.addScaledVector(along, RESTS / Math.cos(rise))
			.add(new Vector3(0, peg / Math.cos(rise), 0));
		return { rest, out, rise, r: peg, fromPole: RESTS - pole };
	});

	const group = new Group();
	group.add(new Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), steel));
	return { group, pegs };
}
