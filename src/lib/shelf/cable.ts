// How a cable lies: not drawn, but worked out.
//
// A cable is a chain of short links of fixed length that resists being bent, has weight, and
// cannot pass through the floor, the wall or anything solid it is told about. Each end is held,
// and held pointing a given way for its first few links, as a plug's sleeve holds a lead. The
// chain is started along a rough path (the two ends, and any points given for it to go by, which
// is how it is told which side of something to pass), given a length, and left to settle. That is
// done once, when the cable is built: nothing here runs while the scene is drawn.
//
// What settles the chain is position-based: each pass moves the links under their weight, then
// puts right, over and over, what that broke (the links' lengths, the straightness of the chain,
// what it has sunk into). It is not a measurement of any real cable, and `stiff` and `weight` are
// set by eye, but the shapes are those of a thing with a length and a stiffness, which a curve
// drawn through points is not.

import { CatmullRomCurve3, Matrix4, Vector3 } from 'three';

const LINK = 0.014; // about the length of a link
const STEPS = 700;
const PASSES = 14; // of putting right, to each step
const DAMP = 0.86; // how much of its movement a link keeps from one step to the next
const BEND = 0.1; // how hard a pass straightens it, at a stiffness of 1
const DROP = 0.0005; // how far a step's weight moves a link
const ARCS = [4, 8, 14]; // and is kept from bending too tightly over these many links
const EASE = 5000; // passes of easing the settled chain's corners
const SPANS = [1, 2, 4, 7]; // a link is kept in line with its neighbours this far off, either side

/** A box that cables cannot pass through. */
export type Solid = { matrix: Matrix4; inverse: Matrix4; half: Vector3 };

/** A solid box with its middle at (x, y, z), turned about the vertical by `yaw`. */
export function solid(x: number, y: number, z: number, w: number, h: number, d: number, yaw = 0): Solid {
	const matrix = new Matrix4().makeRotationY(yaw).setPosition(x, y, z);
	return { matrix, inverse: matrix.clone().invert(), half: new Vector3(w / 2, h / 2, d / 2) };
}

export type Cable = {
	/** Where it starts, and the way it points as it leaves there. */
	from: Vector3;
	out: Vector3;
	/** Where it ends, and the way it is going as it arrives. */
	to: Vector3;
	into: Vector3;
	/** Points for the rough path it is started along to go through, in order. */
	via?: Vector3[];
	/** How much longer it is than that rough path, as a share of it. */
	slack?: number;
	/** Its radius, which is how far its middle is kept from surfaces. */
	r: number;
	/** How far it runs dead straight from each end. */
	hold?: number;
	/** The tightest radius it can be bent to. */
	bend?: number;
	/** How much it resists bending beyond that, 0 to 1. */
	stiff?: number;
	/** How heavy it is for its stiffness. */
	weight?: number;
	/** How well the floor holds it where it lies, 0 to 1. */
	grip?: number;
	/** The height of the floor, and how far out the wall is. */
	floor?: number;
	wall?: number;
	solids?: Solid[];
};

/** The points a cable settles through, a link apart, from its start to its end. */
export function settle(c: Cable): Vector3[] {
	const out = c.out.clone().normalize();
	const into = c.into.clone().normalize();
	const HELD = Math.max(2, Math.round((c.hold ?? 0.045) / LINK)); // links at each end that are held in line
	const lead = HELD * LINK;
	const rough = new CatmullRomCurve3(
		[c.from, c.from.clone().addScaledVector(out, lead), ...(c.via ?? []), c.to.clone().addScaledVector(into, -lead), c.to],
		false,
		'centripetal'
	);
	const length = rough.getLength() * (1 + (c.slack ?? 0));
	const n = Math.max(2 * HELD + 3, Math.ceil(length / LINK) + 1);
	const link = length / (n - 1);
	const start = rough.getSpacedPoints(n - 1);

	const p = new Float64Array(3 * n);
	const was = new Float64Array(3 * n);
	const held = (i: number) => i < HELD || i >= n - HELD;
	const hold = () => {
		for (let i = 0; i < HELD; i++) {
			const a = c.from.clone().addScaledVector(out, i * link);
			const b = c.to.clone().addScaledVector(into, -i * link);
			p.set([a.x, a.y, a.z], 3 * i);
			p.set([b.x, b.y, b.z], 3 * (n - 1 - i));
		}
	};
	start.forEach((v, i) => p.set([v.x, v.y, v.z], 3 * i));
	hold();
	was.set(p);

	const stiff = c.stiff ?? 0.5;
	const least = c.bend ?? 0.085;
	const drop = (c.weight ?? 1) * DROP;
	const grip = c.grip ?? 0.85;
	const floor = (c.floor ?? 0) + c.r;
	const wall = c.wall === undefined ? -Infinity : c.wall + c.r;
	const solids = c.solids ?? [];
	const v = new Vector3();

	const collide = (i: number) => {
		const k = 3 * i;
		for (const s of solids) {
			v.set(p[k], p[k + 1], p[k + 2]).applyMatrix4(s.inverse);
			const dx = s.half.x + c.r - Math.abs(v.x);
			const dy = s.half.y + c.r - Math.abs(v.y);
			const dz = s.half.z + c.r - Math.abs(v.z);
			if (dx <= 0 || dy <= 0 || dz <= 0) continue;
			// Out by the nearest face.
			if (dx <= dy && dx <= dz) v.x += Math.sign(v.x || 1) * dx;
			else if (dy <= dz) v.y += Math.sign(v.y || 1) * dy;
			else v.z += Math.sign(v.z || 1) * dz;
			v.applyMatrix4(s.matrix);
			p[k] = v.x;
			p[k + 1] = v.y;
			p[k + 2] = v.z;
		}
		if (p[k + 1] < floor) p[k + 1] = floor;
		if (p[k + 2] < wall) p[k + 2] = wall;
	};

	for (let step = 0; step < STEPS; step++) {
		for (let i = HELD; i < n - HELD; i++) {
			const k = 3 * i;
			for (let a = 0; a < 3; a++) {
				const moved = (p[k + a] - was[k + a]) * DAMP;
				was[k + a] = p[k + a];
				p[k + a] += moved;
			}
			p[k + 1] -= drop;
		}
		for (let pass = 0; pass < PASSES; pass++) {
			const forward = pass % 2 === 0;
			// Straightness: each link and the two the same way off either side of it are moved toward
			// being in line, the middle one one way and the outer two the other, so that nothing is
			// pulled along the cable by it.
			for (const span of SPANS) {
				const pull = (BEND * stiff) / (1 + 0.15 * (span - 1));
				for (let j = span; j < n - span; j++) {
					const i = forward ? j : n - 1 - j;
					const wi = held(i) ? 0 : 1;
					const wa = held(i - span) ? 0 : 1;
					const wb = held(i + span) ? 0 : 1;
					const w = wi + (wa + wb) / 4;
					if (w === 0) continue;
					const k = 3 * i;
					const a = 3 * (i - span);
					const b = 3 * (i + span);
					for (let x = 0; x < 3; x++) {
						const d = (((p[a + x] + p[b + x]) / 2 - p[k + x]) * pull) / w;
						p[k + x] += d * wi;
						p[a + x] -= (d / 2) * wa;
						p[b + x] -= (d / 2) * wb;
					}
				}
			}
			// And it cannot be bent tighter than its least radius: two links this far apart along it
			// are never closer together than the ends of an arc of that radius that long.
			for (const span of ARCS) {
				const angle = (span * link) / least;
				if (angle >= Math.PI) continue;
				const chord = 2 * least * Math.sin(angle / 2);
				for (let j = 0; j < n - span; j++) {
					const i = forward ? j : n - 1 - span - j;
					const a = 3 * i;
					const b = 3 * (i + span);
					const wa = held(i) ? 0 : 1;
					const wb = held(i + span) ? 0 : 1;
					if (wa + wb === 0) continue;
					const dx = p[b] - p[a];
					const dy = p[b + 1] - p[a + 1];
					const dz = p[b + 2] - p[a + 2];
					const l = Math.hypot(dx, dy, dz) || 1e-9;
					if (l >= chord) continue;
					const off = (l - chord) / l / (wa + wb);
					p[a] += dx * off * wa;
					p[a + 1] += dy * off * wa;
					p[a + 2] += dz * off * wa;
					p[b] -= dx * off * wb;
					p[b + 1] -= dy * off * wb;
					p[b + 2] -= dz * off * wb;
				}
			}
			// Length: each link is put back to its own.
			for (let j = 0; j < n - 1; j++) {
				const i = forward ? j : n - 2 - j;
				const a = 3 * i;
				const b = a + 3;
				const dx = p[b] - p[a];
				const dy = p[b + 1] - p[a + 1];
				const dz = p[b + 2] - p[a + 2];
				const l = Math.hypot(dx, dy, dz) || 1e-9;
				const wa = held(i) ? 0 : 1;
				const wb = held(i + 1) ? 0 : 1;
				if (wa + wb === 0) continue;
				const off = (l - link) / l / (wa + wb);
				p[a] += dx * off * wa;
				p[a + 1] += dy * off * wa;
				p[a + 2] += dz * off * wa;
				p[b] -= dx * off * wb;
				p[b + 1] -= dy * off * wb;
				p[b + 2] -= dz * off * wb;
			}
			for (let i = HELD; i < n - HELD; i++) collide(i);
		}
		// What lies on the floor is held by it: most of any slide across it is undone.
		for (let i = HELD; i < n - HELD; i++) {
			const k = 3 * i;
			if (p[k + 1] > floor + 0.0005) continue;
			p[k] = was[k] + (p[k] - was[k]) * (1 - grip);
			p[k + 2] = was[k + 2] + (p[k + 2] - was[k + 2]) * (1 - grip);
		}
	}

	// Settled, the chain has the cable's path but not its line: where its least radius or a held
	// end stopped it, it turns a corner between two straights. A real cable spreads a bend along
	// its length and leaves a plug in line with it, as a sprung strip clamped at both ends does.
	// So the chain is eased toward that: each pass moves every link to lessen the change in bend
	// along the chain, with the held links at each end staying where they are.
	const eased = new Float64Array(3 * n);
	for (let pass = 0; pass < EASE; pass++) {
		eased.set(p);
		for (let i = HELD; i < n - HELD; i++) {
			const k = 3 * i;
			for (let x = 0; x < 3; x++) {
				const kink = p[k - 6 + x] - 4 * p[k - 3 + x] + 6 * p[k + x] - 4 * p[k + 3 + x] + p[k + 6 + x];
				eased[k + x] = p[k + x] - 0.06 * kink;
			}
		}
		p.set(eased);
		if (pass % 10 === 9) for (let i = HELD; i < n - HELD; i++) collide(i);
	}

	return Array.from({ length: n }, (_, i) => new Vector3(p[3 * i], p[3 * i + 1], p[3 * i + 2]));
}

/**
 * A cable laid along a path of straight runs, with every corner of the path rounded to an arc.
 * Each corner has the radius it is given (or `r`), or as near to it as the runs either side of it
 * leave room for. Unlike a settled cable this is exactly what it is told to be, which is what is
 * wanted where one stiff lead has to be seen to bend the same way all along: out of a plug, over
 * and down to the floor. The points are a link apart.
 */
export function bent(path: (Vector3 | [Vector3, number])[], r: number): Vector3[] {
	const corners = path.map((c) => (c instanceof Vector3 ? { at: c, r } : { at: c[0], r: c[1] }));
	const STEP = 0.012;
	const out: Vector3[] = [corners[0].at.clone()];
	const line = (to: Vector3) => {
		const from = out[out.length - 1];
		const n = Math.max(1, Math.round(from.distanceTo(to) / STEP));
		for (let i = 1; i <= n; i++) out.push(from.clone().lerp(to, i / n));
	};
	for (let i = 1; i < corners.length - 1; i++) {
		const b = corners[i].at;
		const u = corners[i - 1].at.clone().sub(b);
		const v = corners[i + 1].at.clone().sub(b);
		// Half of each run is this corner's to use, but the first and last runs are all theirs.
		const room = Math.min(u.length() * (i === 1 ? 1 : 0.5), v.length() * (i === corners.length - 2 ? 1 : 0.5));
		u.normalize();
		v.normalize();
		const between = Math.acos(Math.max(-1, Math.min(1, u.dot(v))));
		if (between > Math.PI - 0.02) {
			line(b);
			continue;
		}
		const reach = Math.min(corners[i].r / Math.tan(between / 2), room); // from the corner to where the arc starts
		const radius = reach * Math.tan(between / 2);
		const middle = b.clone().addScaledVector(u.clone().add(v).normalize(), radius / Math.sin(between / 2));
		const a0 = b.clone().addScaledVector(u, reach).sub(middle);
		const a1 = b.clone().addScaledVector(v, reach).sub(middle);
		const sweep = Math.PI - between;
		line(a0.clone().add(middle));
		const n = Math.max(2, Math.round((radius * sweep) / STEP));
		for (let k = 1; k <= n; k++) {
			const t = k / n;
			out.push(
				a0
					.clone()
					.multiplyScalar(Math.sin((1 - t) * sweep) / Math.sin(sweep))
					.addScaledVector(a1, Math.sin(t * sweep) / Math.sin(sweep))
					.add(middle)
			);
		}
	}
	line(corners[corners.length - 1].at);
	return out;
}
