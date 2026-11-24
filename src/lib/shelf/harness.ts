// The climbing harness that hangs from the coat rack (see coatrack.ts, and room.ts, which hangs it):
// a sport climber's sit harness, with blue padding, grey webbing and an orange belay loop. It is
// hung the way they are when they are put away, by the belay loop: that is over the peg, and the
// waist belt and the two leg loops, which the belay loop holds together at the front, all hang
// from the bottom of it by their fronts. So the belt is a long loop with its stiff padded back at
// the bottom, the leg loops are two shorter loops lying against it one on the other, and the
// elastic straps that hold the leg loops up behind when it is worn are slack, and droop below.
// A screwgate carabiner with a belay device on it is clipped to one of the gear loops.
//
// Built in the rack's own frame, from the peg it is given. The belay loop hangs straight down from
// the peg's root. What hangs from it is in a plane of its own, which faces round from the peg
// toward the room and leans out, since the belt's padded back lies against the tube. Within that plane things are placed by how far they are to the right as the room
// sees it, how far up (so nearly always down, and negative) from the bottom of the belay loop, and
// how far out toward the room.
//
// Sizes are a real harness's at 1.4 units to the metre, a medium, except that the thinnest things
// (the elastic, the device's cable) are a little heavier than life. It is all made here, and it is
// two meshes: one of everything sewn, and one of everything hard.

import {
	BufferGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	Color,
	CylinderGeometry,
	DoubleSide,
	ExtrudeGeometry,
	Float32BufferAttribute,
	Group,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	Path,
	Quaternion,
	RepeatWrapping,
	Shape,
	ShapeGeometry,
	SphereGeometry,
	SRGBColorSpace,
	TubeGeometry,
	Vector2,
	Vector3
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Peg } from './coatrack.ts';
import { air, blown } from './tie.ts';

const UP = new Vector3(0, 1, 0);
const ACROSS = new Vector3(0, 0, 1); // the line the room is seen along: a turn about it shows as one from side to side
const TURN = Math.PI * 2;

// How it hangs.
const FACES = (30 * Math.PI) / 180; // how far round from the peg, toward the room, its plane faces
const OFF = 0.008; // how far out along the peg the bottom of the belay loop is pushed, by the webbing behind it
const YAWS = (10 * Math.PI) / 180; // how far the carabiner turns on its gear loop before its spine is against the belt
const LEAN = 0.08; // how much further out it is for each unit down: the padded back lies against the tube
const DROP = 0.1; // how far below the top of the peg the bottom of the belay loop is

// Webbing, and the padding it is sewn to. Thicknesses are a little over life.
const WEB = { wide: 0.031, thick: 0.004 }; // the waist belt's: a little under an inch
const PAD = { thick: 0.012, ends: 0.064, back: 0.1 }; // the belt's padding: how wide at its ends and at the back
const LEG = { wide: 0.028, thick: 0.0035, pad: 0.05, back: 0.07 }; // a leg loop's webbing, and its padding
const BELAY = { wide: 0.03, thick: 0.007 }; // the belay loop: under an inch, and doubled
// The two tie-in points, which are what the belay loop holds: each is a strap that bridges the two
// sides of the belt, or the two leg loops, and goes straight through the loop on its way. They lie
// side by side on the loop's bottom: how far along it each is, and how wide. Each is sheathed
// against wear where it bears on the loop, and for so far down either side, and lies so close to it.
const TIED = { belt: -0.0105, wide: 0.019, legs: 0.0105, narrow: 0.018 };
const BRIDGE = { sheathed: 0.036, sheath: 0.0016, off: 0.0008 };
const WEAVE = 0.03; // the length of webbing the picture of its weave covers

// Its colours.
const BLUE = new Color(0x1b62b4); // the padding's outside
const LINING = new Color(0x7d9cc4); // and its inside, which is a paler mesh
const GREY = new Color(0x767d87); // the webbing
const ORANGE = new Color(0xe9601a); // the belay loop and the haul loop
const SHEATH = new Color(0x22324c); // the tie-in points, which are sheathed against wear
const ELASTIC = new Color(0x34373c);
const ALLOY = new Color(0xd6d9dd); // the buckles
const GOLD = new Color(0xc4932e); // the carabiner: anodised gold
const LOCK = new Color(0x464a50); // and its screw sleeve: anodised grey
const DEVICE = new Color(0x1f8a4c); // the belay device: anodised green
const SHADOWED = new Color(0x0b2f1b); // and the inside of its slots, where little light gets
const CABLE = new Color(0x474b52); // its cable, in black plastic
const TUBE = new Color(0xe2dfd4); // the gear loops: webbing in a clear plastic tube

/** The same numbers every time, so that the padding is the same padding. */
function dice(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * What everything sewn is printed with, nearly white, to be coloured by what it is on. The lower
 * half is webbing: ribs across it, and a darker thread along each edge and down the middle. The
 * upper half is the padding's cover, which is a fine mesh.
 */
function cloth() {
	const W = 64;
	const H = 128;
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const c = canvas.getContext('2d')!;
	c.fillStyle = '#f4f4f4';
	c.fillRect(0, 0, W, H);
	const random = dice(5);
	for (let k = 0; k < 500; k++) {
		c.fillStyle = `rgba(0,0,0,${0.08 + random() * 0.14})`;
		c.fillRect(Math.floor(random() * W), Math.floor((random() * H) / 2), 1, 1);
	}
	c.fillStyle = 'rgba(0,0,0,0.16)';
	for (let x = 0; x < W; x += 4) c.fillRect(x, H / 2, 1, H / 2);
	c.fillStyle = 'rgba(0,0,0,0.22)';
	for (const y of [0.54, 0.75, 0.96]) c.fillRect(0, Math.round(y * H) - 1, W, 2);
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	map.wrapS = map.wrapT = RepeatWrapping;
	map.anisotropy = 4;
	return map;
}

/** A point on a strap's middle line, with which way it runs there, which way its width lies, and which way its outer face looks. */
type Ring = { p: Vector3; t: Vector3; a: Vector3; o: Vector3 };

/**
 * Lay rings along a line of points, the strap's width as near this way as it can be. Round a
 * closed line that runs clockwise, seen from the side its width points to, the outer face is the
 * outside of the loop.
 */
function along(path: Vector3[], across: Vector3 | ((p: Vector3, f: number) => Vector3), closed = false): Ring[] {
	const n = path.length;
	return path.map((p, i) => {
		const before = path[closed ? (i + n - 1) % n : Math.max(i - 1, 0)];
		const after = path[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
		const t = after.clone().sub(before).normalize();
		const want = typeof across === 'function' ? across(p, i / n) : across;
		const a = want.clone().addScaledVector(t, -want.dot(t)).normalize();
		return { p, t, a, o: a.clone().cross(t) };
	});
}

/** The same rings, moved this far the way their outer faces look. */
const lifted = (rings: Ring[], by: number | ((f: number) => number)) =>
	rings.map((ring, i) => ({ ...ring, p: ring.p.clone().addScaledVector(ring.o, typeof by === 'number' ? by : by(i / (rings.length - 1))) }));

/** Points evenly spaced along a smooth line through these. A closed one does not repeat its first. */
function spline(through: Vector3[], count: number, closed = false) {
	const points = new CatmullRomCurve3(through, closed).getSpacedPoints(count);
	if (closed) points.pop();
	return points;
}

// A strap's section, as faces round it: each is two corners, given as parts of its thickness
// (outward) and of its width, with the way the surface looks at each.
type Corner = { o: number; a: number; no: number; na: number };
/** Webbing: flat, with square edges. */
const FLAT: Corner[][] = [
	[0.5, -0.5, 0.5, 0.5, 1, 0],
	[0.5, 0.5, -0.5, 0.5, 0, 1],
	[-0.5, 0.5, -0.5, -0.5, -1, 0],
	[-0.5, -0.5, 0.5, -0.5, 0, -1]
].map(([o0, a0, o1, a1, no, na]) => [
	{ o: o0, a: a0, no, na },
	{ o: o1, a: a1, no, na }
]);
/** Padding: foam in a cover, so its edges are rolled. */
const SOFT: Corner[][] = (() => {
	const SIDES = 12;
	const round = (k: number) => {
		const turn = (k * TURN) / SIDES;
		const power = (x: number, e: number) => Math.sign(x) * Math.abs(x) ** e;
		return { o: 0.5 * power(Math.cos(turn), 0.8), a: 0.5 * power(Math.sin(turn), 0.5) };
	};
	const corner = (k: number): Corner => {
		const [before, here, after] = [round(k - 1), round(k), round(k + 1)];
		return { ...here, no: after.a - before.a, na: before.o - after.o };
	};
	return Array.from({ length: SIDES }, (_, k) => [corner(k), corner(k + 1)]);
})();

type Cut = {
	section?: Corner[][];
	/** Its width and its thickness, which may change along it: from 0 at one end to 1 at the other. */
	wide: number | ((f: number) => number);
	thick: number | ((f: number) => number);
	closed?: boolean;
	colour: Color;
	/** Its inner face's colour, if that is not the same. */
	lining?: Color;
};

/** A strap along these rings. */
function strap(rings: Ring[], { section = FLAT, wide, thick, closed = false, colour, lining = colour }: Cut) {
	const all = closed ? [...rings, rings[0]] : rings;
	const row = section === SOFT ? 1 : 0; // which half of the cloth's picture it is printed with
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const colours: number[] = [];
	const indices: number[] = [];
	const each = section.length * 2;
	const v = new Vector3();
	let run = 0;
	all.forEach((ring, i) => {
		if (i) run += ring.p.distanceTo(all[i - 1].p);
		const f = i / (all.length - 1);
		const w = Math.max(typeof wide === 'number' ? wide : wide(f), 1e-4);
		const th = Math.max(typeof thick === 'number' ? thick : thick(f), 1e-4);
		for (const face of section) {
			for (const c of face) {
				v.copy(ring.p).addScaledVector(ring.o, c.o * th).addScaledVector(ring.a, c.a * w);
				positions.push(v.x, v.y, v.z);
				v.set(0, 0, 0).addScaledVector(ring.o, c.no / th).addScaledVector(ring.a, c.na / w).normalize();
				normals.push(v.x, v.y, v.z);
				uvs.push(run / WEAVE, (row + 0.04 + 0.92 * (c.a + 0.5)) / 2);
				const tint = c.o < 0 ? lining : colour;
				colours.push(tint.r, tint.g, tint.b);
			}
		}
		if (i === all.length - 1) return;
		for (let k = 0; k < section.length; k++) {
			const here = i * each + 2 * k;
			const next = here + each;
			indices.push(here, here + 1, next, here + 1, next + 1, next);
		}
	});
	const g = new BufferGeometry();
	g.setAttribute('position', new Float32BufferAttribute(positions, 3));
	g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
	g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
	g.setAttribute('color', new Float32BufferAttribute(colours, 3));
	g.setIndex(indices);
	return g;
}

/** A flat plate with rounded corners, this wide and this long, about its middle. */
function plate(w: number, l: number, r: number) {
	return new Shape()
		.moveTo(-w / 2 + r, -l / 2)
		.absarc(w / 2 - r, -l / 2 + r, r, -TURN / 4, 0, false)
		.absarc(w / 2 - r, l / 2 - r, r, 0, TURN / 4, false)
		.absarc(-w / 2 + r, l / 2 - r, r, TURN / 4, TURN / 2, false)
		.absarc(-w / 2 + r, -l / 2 + r, r, TURN / 2, (3 * TURN) / 4, false);
}

/** A slot through one, between these corners. */
const slot = (x0: number, y0: number, x1: number, y1: number) => new Path().moveTo(x0, y0).lineTo(x0, y1).lineTo(x1, y1).lineTo(x1, y0).closePath();

/** Goes from 0 to 1 as x goes from 0 to 1, starting and ending gently. */
const ease = (x: number) => {
	const c = Math.min(Math.max(x, 0), 1);
	return c * c * (3 - 2 * c);
};

/**
 * Build the harness hung on this peg of the rack, in the rack's own frame: the origin on the floor
 * under the tube's middle, y up.
 */
export function buildHarness(peg: Peg) {
	const sewn: BufferGeometry[] = [];
	const hard: BufferGeometry[] = [];
	// What the air moves: which of the hard things, from this one on, and the point and the line they rock about.
	const swung = { from: 0, about: new Vector3(), axis: new Vector3() };
	/** Something hard, all of one colour. */
	const cast = (geometry: BufferGeometry, colour: Color) => {
		const g = geometry.index ? geometry.toNonIndexed() : geometry;
		g.deleteAttribute('uv');
		const count = g.getAttribute('position').count;
		const colours = new Float32Array(count * 3);
		for (let k = 0; k < count; k++) colour.toArray(colours, k * 3);
		g.setAttribute('color', new Float32BufferAttribute(colours, 3));
		hard.push(g);
		return g;
	};

	// --- Where it hangs. Its plane's face looks along `face`, and `right` is to the right in it as the
	// room sees it; `tie` is the bottom of the belay loop, where the belt and the leg loops are held.
	const way = Math.atan2(peg.out.z, peg.out.x);
	const level = (angle: number) => new Vector3(Math.cos(angle), 0, Math.sin(angle));
	const face = level(way + FACES);
	const right = level(way + FACES - TURN / 4);
	const tie = peg.rest
		.clone()
		.addScaledVector(peg.out, OFF)
		.addScaledVector(face, OFF / 2)
		.setY(peg.rest.y - DROP);
	/** A place in its plane: this far right, up and out from `tie`. */
	const at = (r: number, up: number, out = 0) =>
		tie
			.clone()
			.addScaledVector(right, r)
			.addScaledVector(face, out - LEAN * up)
			.setY(tie.y + up);

	// --- The belay loop: a short ring of doubled webbing, sewn through, which is the strongest thing
	// on the harness. It is over the peg at its root, where the peg says a loop comes to rest, its
	// inner edge close to the tube and its width along the peg; the harness's weight draws it into a
	// narrow loop, its two sides straight and side by side, round the peg at the top and round the
	// two tie-in points at the bottom. Those go straight through it, as the peg does, and they run
	// from one side of the harness to the other, in the plane the harness hangs in; so the loop is
	// twisted on its way down, from lying along the peg to lying along that plane.
	const through = peg.out; // the way its width lies at the peg, which is the way the peg goes through it
	const UNDER = 0.0145; // how far below `tie` the middle line of its bottom is
	const SPREAD = 0.024; // half its spread at the bottom, where two straps lie side by side in it
	const middle = peg.rest.clone().addScaledVector(UP, -peg.r / Math.cos(peg.rise)); // the peg's middle line, under the loop
	const axis = tie.clone().sub(middle); // the way the loop hangs: not quite plumb
	const long = axis.length();
	axis.normalize();
	const flatways = right.clone().addScaledVector(axis, -right.dot(axis)).normalize(); // the way its width lies at the bottom, which is the way the straps go through it
	const beside = axis.clone().cross(flatways); // and the way its bottom runs, across that: toward the room
	/**
	 * The line of a strap that goes through the belay loop and hangs on its bottom, as the bridge
	 * between the belt's two sides does, and the one between the leg loops: from where it has come up
	 * from on the left to where it goes down to on the right. It lies flat across the top of the
	 * loop's bottom, this far along that from its middle, is bent over each edge of it, and from
	 * there is straight, since it is taut: all the weight of what it holds is on it. Gives back its
	 * points, which of them is the middle of the top, and between which of them it is sheathed.
	 */
	const over = (aside: number, thick: number, left: Vector3, rightward: Vector3, keeps = 0) => {
		const CORNER = 0.002; // how much the loop's bottom's corners are eased
		const wrap = CORNER + thick / 2 + BRIDGE.off;
		const top = -UNDER + BELAY.thick / 2; // the upper face of the loop's bottom, as a height above `tie` along the loop
		const half = BELAY.wide / 2;
		const local = (p: Vector3) => {
			const d = p.clone().sub(tie);
			return { o: d.dot(flatways), h: d.dot(beside), y: -d.dot(axis) };
		};
		const world = (o: number, h: number, y: number) => tie.clone().addScaledVector(flatways, o).addScaledVector(beside, h).addScaledVector(axis, -y);
		/**
		 * One half of it, from the top of the loop's bottom to where it is going (the half to the right
		 * is +1). It bends over the upper corner of that edge until it is pointing at where it is
		 * going, and is straight from there. Gives back its points, and how many of them are sheathed.
		 */
		const leg = (to: { o: number; h: number; y: number }, side: 1 | -1) => {
			const made: Vector3[] = [];
			const [co, cy] = [side * (half - CORNER), top - CORNER];
			// Angles are how far it has turned from lying level on top. It leaves the corner where a
			// straight line to where it is going just touches the bend.
			const [dx, dy] = [side * to.o - (half - CORNER), to.y - cy]; // outward, and up, from the corner's middle
			const until = ((Math.atan2(dx, dy) + TURN) % TURN) - Math.acos(wrap / Math.hypot(dx, dy));
			const bent = Math.max(3, Math.ceil(until / 0.25));
			for (let k = 0; k <= bent; k++) made.push(world(co + side * wrap * Math.sin((until * k) / bent), aside, cy + wrap * Math.cos((until * k) / bent)));
			// From there it is straight, but for this: it keeps to its own place along the loop's bottom
			// until it is clear of the strap beside it there.
			const from = made[bent];
			const end = world(to.o, aside, to.y);
			const reach = from.distanceTo(end);
			const steps = Math.ceil(reach / 0.006);
			for (let k = 1; k <= steps; k++) {
				const gone = Math.max(0, ((k / steps) * reach - keeps) / (reach - keeps));
				made.push(from.clone().lerp(end, k / steps).addScaledVector(beside, (to.h - aside) * gone));
			}
			return { made, sheathed: Math.min(made.length - 1, bent + Math.round((BRIDGE.sheathed / reach) * steps)) };
		};
		const [back, fore] = [leg(local(left), -1), leg(local(rightward), 1)];
		const points = back.made.reverse();
		const sheathed = [points.length - 1 - back.sheathed, 0];
		const middle = points.length;
		points.push(world(0, aside, top + thick / 2 + BRIDGE.off));
		sheathed[1] = points.length + fore.sheathed;
		points.push(...fore.made);
		return { points, middle, sheathed };
	};
	/** A tie-in point: the sheath on a strap this wide and this thick, where it goes through the loop. */
	const tieIn = (tied: ReturnType<typeof over>, wide: number, thick: number) =>
		sewn.push(strap(along(tied.points.slice(tied.sheathed[0], tied.sheathed[1] + 1), beside), { wide: wide + 0.002, thick: thick + 2 * BRIDGE.sheath, colour: SHEATH }));

	{
		// Over the peg its width is tilted as the peg is; below that it is level, and turns to lie the way the straps go through it.
		const tilted = through.clone().multiplyScalar(Math.cos(peg.rise)).setY(Math.sin(peg.rise));
		const down = (p: Vector3) => p.clone().sub(middle).dot(axis) / long;
		const across = (p: Vector3) =>
			tilted
				.clone()
				.lerp(through, ease(down(p) / 0.3))
				.lerp(flatways, ease((down(p) - 0.15) / 0.8))
				.normalize();
		const R = peg.r + BELAY.thick / 2 + 0.0012; // round the peg, and half its spread most of the way down
		const outline: [number, number][] = [
			[0, R],
			[0.71 * R, 0.71 * R],
			[R, 0],
			[R, -long * 0.33],
			[R + (SPREAD - R) * 0.5, -long * 0.67],
			[SPREAD, -long + 0.002],
			[SPREAD, -long - UNDER + 0.008],
			[SPREAD * 0.96, -long - UNDER + 0.0025],
			[SPREAD * 0.82, -long - UNDER],
			[0, -long - UNDER]
		];
		for (let k = outline.length - 2; k > 0; k--) outline.push([-outline[k][0], outline[k][1]]);
		const points = outline.map(([w, v]) => {
			const on = middle.clone().addScaledVector(axis, -v);
			return on.addScaledVector(across(on).cross(axis).normalize(), w);
		});
		sewn.push(strap(along(spline(points, 56, true), across, true), { wide: BELAY.wide, thick: BELAY.thick, closed: true, colour: ORANGE }));
	}

	// --- The waist belt. Hung by its front it is a V on a U: the bare webbing either side of the
	// tie-in point is drawn straight by the weight below it, there is a slight kink where the padding
	// begins, and the padded back, which is stiff, hangs in a round. It is not even, and not flat:
	// one side hangs lower and further out than the other, and the back is slumped. At the top it
	// goes straight through the belay loop, and hangs on the bottom of it. Its line goes clockwise as the room sees it, from the
	// tie-in point at the top, so its right side comes first.
	const COUNT = 320;
	const { belt, beltTied } = (() => {
		// The padded round, from where the right side's webbing ends to where the left side's does.
		const hung = [
			[0.064, -0.168, 0.006],
			[0.094, -0.225, 0.014],
			[0.12, -0.3, 0.018],
			[0.124, -0.37, 0.012],
			[0.095, -0.445, 0.004],
			[0.02, -0.48, 0.008],
			[-0.05, -0.455, 0.014],
			[-0.09, -0.385, 0.006],
			[-0.097, -0.3, -0.012],
			[-0.082, -0.225, -0.008],
			[-0.058, -0.168, 0.003]
		].map(([r, up, out]) => at(r, up, out));
		// And the webbing over the belay loop, on the side of it away from the room, from the left side to the right.
		const tied = over(TIED.belt, WEB.thick, hung[hung.length - 1], hung[0], 0.02);
		const line = [...tied.points.slice(tied.middle), ...new CatmullRomCurve3(hung).getSpacedPoints(240).slice(1, -1), ...tied.points.slice(0, tied.middle)];
		// The same line, in even steps from the middle of the top.
		const run = [0];
		line.forEach((p, k) => run.push(run[k] + p.distanceTo(line[(k + 1) % line.length])));
		const even: Vector3[] = [];
		for (let k = 0, on = 0; k < COUNT; k++) {
			const want = (k * run[line.length]) / COUNT;
			while (run[on + 1] < want) on++;
			even.push(line[on].clone().lerp(line[(on + 1) % line.length], (want - run[on]) / (run[on + 1] - run[on])));
		}
		// Its width lies along the loop's bottom where it is over that, and turns from there, over the
		// length of the bare webbing, to lie across the belt's plane. Nothing holds the round flat, so
		// that is a little twisted too: one side's edge turned out, the other's in.
		const rings = along(
			even,
			(p, f) => {
				const turned = ease((p.distanceTo(tie) - 0.03) / 0.12);
				return beside
					.clone()
					.lerp(face.clone().addScaledVector(right, 0.16 * Math.sin(TURN * f + 0.6)), turned)
					.normalize();
			},
			true
		);
		return { belt: rings, beltTied: tied };
	})();
	/** The ring this far round the belt, from 0 at the tie-in point to 1 back at it. */
	const round = (f: number) => Math.round(f * COUNT) % COUNT;
	/** The belt's rings from here to there. */
	const stretch = (from: number, to: number) => {
		const rings: Ring[] = [];
		for (let k = round(from); k !== round(to); k = (k + 1) % COUNT) rings.push(belt[k]);
		rings.push(belt[round(to)]);
		return rings;
	};
	// The webbing, which goes all the way round. It is narrower at the tie-in point, to lie in the belay loop beside the leg loops' strap.
	const gathered = (f: number) => ease((Math.min(f, 1 - f) - 0.06) / 0.06);
	sewn.push(strap(belt, { wide: (f) => TIED.wide + (WEB.wide - TIED.wide) * gathered(f), thick: WEB.thick, closed: true, colour: GREY }));
	// The tie-in point: the webbing is sheathed where the rope and the belay loop wear it.
	tieIn(beltTied, TIED.wide, WEB.thick);
	// The padding, inside the webbing, round the back and the sides. Its ends are rounded off.
	const PADDED = { from: 0.16, to: 0.84 };
	/** How wide the padding is, this far round the belt. */
	const padWide = (f: number) => PAD.ends + (PAD.back - PAD.ends) * Math.sin((Math.PI * (f - PADDED.from)) / (PADDED.to - PADDED.from)) ** 1.5;
	const ended = (f: number) => Math.sqrt(Math.min(1, Math.min(f, 1 - f) / 0.035));
	sewn.push(
		strap(lifted(stretch(PADDED.from, PADDED.to), -(WEB.thick + PAD.thick) / 2), {
			section: SOFT,
			wide: (f) => padWide(PADDED.from + f * (PADDED.to - PADDED.from)) * ended(f),
			thick: (f) => PAD.thick * ended(f),
			colour: BLUE,
			lining: LINING
		})
	);

	/**
	 * A buckle on a strap at this ring: a plate with two slots and a bar between them, which the
	 * strap goes up through and back down through. The tail that is left over lies along the strap
	 * from there, through a keeper, and its end stands off a little.
	 */
	const buckle = (rings: Ring[], wide: number, long: number) => {
		const [ring] = rings;
		const THICK = 0.0045;
		const RIM = wide * 0.13;
		const shape = plate(wide, long, RIM);
		shape.holes.push(slot(-wide / 2 + RIM, -long / 2 + RIM, wide / 2 - RIM, -RIM / 2), slot(-wide / 2 + RIM, RIM / 2, wide / 2 - RIM, long / 2 - RIM));
		const g = new ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: false, curveSegments: 4 });
		const seat = ring.p.clone().addScaledVector(ring.o, 0.004);
		cast(g.applyMatrix4(new Matrix4().makeBasis(ring.a, ring.t, ring.o).setPosition(seat)), ALLOY);
		// The tail, over the bar and then flat on the strap.
		const lies = lifted(rings, (f) => 0.0055 + 0.006 * Math.exp(-f * 14) + 0.012 * ease((f - 0.75) / 0.25));
		sewn.push(strap(lies, { wide: wide * 0.62, thick: 0.0035, colour: GREY }));
		const keeper = rings[Math.round(rings.length * 0.55)];
		sewn.push(strap(lifted([keeper, rings[Math.round(rings.length * 0.55) + (rings.length > 20 ? 2 : 1)]], 0.004), { wide: wide * 0.74, thick: 0.011, colour: ELASTIC }));
	};
	// The belt's is on its front, to one side of the tie-in point, and its tail runs back over the padding.
	buckle(stretch(0.1, 0.22), 0.05, 0.046);

	// The haul loop: a small loop of webbing at the middle of the back, which is the bottom here.
	{
		const [from, mid, to] = [belt[round(0.485)], belt[round(0.515)], belt[round(0.545)]];
		const hangs = [from.p.clone().addScaledVector(from.o, 0.002), from.p.clone().addScaledVector(from.o, 0.02), mid.p.clone().addScaledVector(mid.o, 0.036), to.p.clone().addScaledVector(to.o, 0.02), to.p.clone().addScaledVector(to.o, 0.002)];
		sewn.push(strap(along(spline(hangs, 14), face), { wide: 0.016, thick: 0.004, colour: ORANGE }));
	}

	// --- The gear loops, two on each side: a stiff arc in a plastic tube, standing off the edge of
	// the padding that is the lower one when the harness is worn, which here is the one toward the
	// room. The pair nearer the front are the bigger. Each sags a little toward its lower end.
	const gearLoop = (from: number, to: number, deep: number, laden = false) => {
		const [a, b] = [belt[round(from)], belt[round(to)]];
		const mid = belt[round((from + to) / 2)];
		const edge = (ring: Ring, f: number) => ring.p.clone().addScaledVector(ring.a, padWide(f) / 2 - 0.008);
		const [start, end] = [edge(a, from), edge(b, to)];
		const [high, low] = start.y > end.y ? [start, end] : [end, start];
		const span = low.clone().sub(high);
		const off = mid.a.clone().multiplyScalar(0.62).addScaledVector(mid.o, 0.5).addScaledVector(UP, -0.3).normalize().multiplyScalar(deep);
		// Something hung on it draws its low end down into a short level run, which is where that sits.
		const sat = low.clone().addScaledVector(off, 1.02).addScaledVector(UP, -0.006);
		const line = new CatmullRomCurve3(
			laden
				? [high, high.clone().addScaledVector(off, 0.62).addScaledVector(span, 0.12), high.clone().addScaledVector(off, 1).addScaledVector(span, 0.5), sat, low.clone().addScaledVector(off, 0.24).setY(sat.y), low]
				: [high, high.clone().addScaledVector(off, 0.62).addScaledVector(span, 0.12), high.clone().addScaledVector(off, 1).addScaledVector(span, 0.55), low.clone().addScaledVector(off, 0.86).addScaledVector(span, -0.04), low]
		);
		cast(new TubeGeometry(line, 22, 0.0044, 6), TUBE);
		return line;
	};
	gearLoop(0.2, 0.3, 0.05);
	gearLoop(0.335, 0.42, 0.04);
	gearLoop(0.535, 0.605, 0.026);
	const racked = gearLoop(0.7, 0.8, 0.044, true);

	// --- The leg loops. Each hangs by its front too, a shorter loop than the belt, webbing all round
	// and padded round the back, with a small buckle on its outer side. They hang on the room's side of
	// the belt, and not alike: the left one is on the longer side of what joins them, so it is lower,
	// and it has swung round until the room sees it nearly edge on.
	const LEGS = 96;
	// Its line, like the belt's: across, down, and out of its plane. A V of webbing on a padded U, slumped.
	const SHAPE: [number, number, number][] = [
		[0, 0, 0],
		[0.012, -0.025, 0],
		[0.035, -0.11, 0.004],
		[0.052, -0.175, 0.012],
		[0.06, -0.235, 0.016],
		[0.05, -0.295, 0.006],
		[0.008, -0.33, -0.012],
		[-0.04, -0.305, -0.014],
		[-0.058, -0.24, -0.004],
		[-0.05, -0.175, 0.006],
		[-0.033, -0.11, 0.004],
		[-0.011, -0.025, 0]
	];
	/**
	 * One of them: where its front is, how far it is turned (its right side toward the room) and
	 * tipped (its bottom toward the room), and which leg's it is. Gives back its rings, the front first.
	 */
	const legLoop = (front: Vector3, turned: number, tipped: number, side: 1 | -1) => {
		const sideways = right.clone().multiplyScalar(Math.cos(turned)).addScaledVector(face, Math.sin(turned));
		const faces = face.clone().multiplyScalar(Math.cos(turned)).addScaledVector(right, -Math.sin(turned));
		// The left one is the right one's reflection, taken the other way round so that it is still clockwise.
		const [first, ...rest] = SHAPE;
		const shape = side === 1 ? SHAPE : [first, ...rest.reverse().map(([x, y, z]): [number, number, number] => [-x, y, -0.8 * z])];
		const points = shape.map(([x, y, z]) =>
			front
				.clone()
				.addScaledVector(sideways, x)
				.addScaledVector(faces, z - tipped * y)
				.setY(front.y + y)
		);
		const rings = along(spline(points, LEGS, true), (_, f) => faces.clone().addScaledVector(sideways, side * 0.22 * Math.sin(TURN * f + 1.2 * side)), true);
		const part = (from: number, to: number) => rings.slice(Math.round(from * LEGS), Math.round(to * LEGS) + 1);
		sewn.push(strap(rings, { wide: (f) => 0.02 + (LEG.wide - 0.02) * ease(Math.min(f, 1 - f) / 0.05), thick: LEG.thick, closed: true, colour: GREY }));
		sewn.push(
			strap(lifted(part(0.2, 0.8), -(LEG.thick + 0.01) / 2), {
				section: SOFT,
				wide: (f) => (LEG.pad + (LEG.back - LEG.pad) * Math.sin(Math.PI * f)) * ended(f),
				thick: (f) => 0.01 * ended(f),
				colour: BLUE,
				lining: LINING
			})
		);
		// Its buckle, on the side away from the other leg, with its tail toward the back.
		buckle(side === 1 ? part(0.09, 0.2) : part(0.8, 0.91).reverse().map((ring) => ({ ...ring, t: ring.t.clone().negate(), a: ring.a.clone().negate() })), 0.038, 0.034);
		return rings;
	};
	const legs = [legLoop(at(-0.07, -0.092, 0.066), -0.82, LEAN + 0.09, -1), legLoop(at(0.03, -0.08, 0.05), -0.15, 0.355, 1)];

	// What joins them at the front: one strap from the front of one to the front of the other, which
	// goes through the belay loop beside the belt's webbing, on the room's side of it, and is sheathed
	// there like that. Each side of it is taut, and turns on its way down to lie as its leg
	// loop's webbing does.
	{
		const tied = over(TIED.legs, LEG.thick, legs[0][0].p, legs[1][0].p);
		const lies = (k: number) => (legs[k][0].a.dot(beside) < 0 ? legs[k][0].a.clone().negate() : legs[k][0].a);
		const rings = along(tied.points, (p) => {
			const o = p.clone().sub(tie).dot(flatways);
			return beside
				.clone()
				.lerp(lies(o < 0 ? 0 : 1), ease((p.distanceTo(tie) - 0.04) / 0.045))
				.normalize();
		});
		sewn.push(strap(rings, { wide: TIED.narrow, thick: LEG.thick, colour: GREY }));
		tieIn(tied, TIED.narrow, LEG.thick);
	}

	// And at the back: a thin elastic strap from the back of each leg loop to the back of the belt.
	// Worn, they hold the leg loops up. Here both ends are close together, so each hangs slack in a bight.
	legs.forEach((rings, k) => {
		const back = rings.reduce((low, ring) => (ring.p.y < low.p.y ? ring : low));
		const sewnTo = belt[round(k ? 0.465 : 0.52)];
		const from = back.p.clone().addScaledVector(back.a, -LEG.back / 2 + 0.006);
		const to = sewnTo.p.clone().addScaledVector(sewnTo.a, PAD.back / 2 - 0.006);
		// The bight hangs to one side of both ends, and only a little below the belt.
		const swung = k ? 0.034 : 0.012;
		const bight = from
			.clone()
			.lerp(to, 0.5)
			.addScaledVector(right, swung)
			.addScaledVector(face, 0.014)
			.setY(Math.min(from.y, to.y) - 0.012 - k * 0.006);
		const line = spline([from, from.clone().lerp(bight, 0.55).addScaledVector(right, swung * 0.35), bight, bight.clone().lerp(to, 0.6).setY(bight.y + 0.005), to], 28);
		const chord = bight.clone().sub(from).setY(0).normalize();
		sewn.push(strap(along(line, chord.cross(UP)), { wide: 0.008, thick: 0.003, colour: ELASTIC }));
	});

	// --- A screwgate carabiner clipped to the front gear loop on the left: a pear-shaped one, of the
	// kind used to belay, forged, so its bar is not the same all round: deep and flat-sided down the
	// spine, broad round the wide end. Nothing places it but the loop and its weight. It is at the
	// lowest point of the loop, which goes through its narrow end; it hangs plumb from there, wide
	// end down; and it lies square to the way the loop runs through it, its spine toward the harness.
	// The other side of it is its gate, a separate straight bar hinged at the narrow end, with a sleeve
	// that screws down over its nose, at the wide end, to lock it. It is drawn in its own plane, across (away from the
	// harness) and up, from where the loop bears on it.
	{
		const ROD = 0.0095; // the radius of the bar it is made of, a little over life
		let lowest = 0.5;
		for (let t = 0.3; t < 0.92; t += 0.01) if (racked.getPoint(t).y < racked.getPoint(lowest).y) lowest = t;
		const hook = racked.getPoint(lowest);
		// The loop is slim, and the hole it goes through is not, so it does not hold the carabiner square to
		// itself: it has turned toward lying in the plane the harness hangs in, as far as the belt's
		// padding lets it, which its spine rests against.
		const along0 = racked.getTangent(lowest).setY(0).normalize();
		if (along0.dot(face) < 0) along0.negate();
		const turn = Math.min(along0.angleTo(face), YAWS) * Math.sign(along0.clone().cross(face).y);
		const flat = along0.applyAxisAngle(UP, turn); // the way its face looks
		const sideways = UP.clone().cross(flat);
		if (sideways.dot(hook.clone().sub(tie)) < 0) sideways.negate(); // away from the middle of the harness
		const top = hook.clone().addScaledVector(UP, 0.0044 + 0.001); // the loop is under the top of its narrow end
		const on = (x: number, y: number, z = 0) => top.clone().addScaledVector(sideways, x).addScaledVector(UP, y).addScaledVector(flat, z);
		const bar = (from: Vector3, to: Vector3, r: number, sides = 10) => {
			const run = to.clone().sub(from);
			const g = new CylinderGeometry(r, r, run.length(), sides);
			g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, run.normalize()));
			const mid = from.clone().add(to).multiplyScalar(0.5);
			return g.translate(mid.x, mid.y, mid.z);
		};
		const ball = (at: Vector3, r: number) => new SphereGeometry(r, 10, 8).translate(at.x, at.y, at.z);
		// The body: from the hinge, over the narrow end, down the spine and round the wide end to the nose.
		const HINGE: [number, number] = [0.021, -0.014];
		const NOSE: [number, number] = [0.047, -0.088];
		const body: [number, number][] = [
			HINGE,
			[0.016, 0.0005],
			[0, ROD],
			[-0.016, 0.0005],
			[-0.021, -0.014],
			[-0.0215, -0.04],
			[-0.022, -0.07],
			[-0.0225, -0.094],
			[-0.016, -0.111],
			[0.002, -0.119],
			[0.022, -0.119],
			[0.039, -0.111],
			[0.047, -0.1],
			NOSE
		];
		const rings = along(spline(body.map(([x, y]) => on(x, y)), 84), flat);
		const SIDES = 10;
		const positions: number[] = [];
		const normals: number[] = [];
		const indices: number[] = [];
		const v = new Vector3();
		rings.forEach((ring, i) => {
			const f = i / (rings.length - 1);
			const spine = ease((f - 0.2) / 0.08) * (1 - ease((f - 0.56) / 0.08));
			const basket = ease((f - 0.62) / 0.08) * (1 - ease((f - 0.92) / 0.06));
			const deep = ROD * (1 + 0.22 * spine - 0.08 * basket); // in its plane
			const thick = ROD * (1 - 0.2 * spine + 0.2 * basket); // through it
			for (let k = 0; k < SIDES; k++) {
				const [c, sn] = [Math.cos((k * TURN) / SIDES), Math.sin((k * TURN) / SIDES)];
				v.copy(ring.p).addScaledVector(ring.o, c * deep).addScaledVector(ring.a, sn * thick);
				positions.push(v.x, v.y, v.z);
				v.set(0, 0, 0).addScaledVector(ring.o, c / deep).addScaledVector(ring.a, sn / thick).normalize();
				normals.push(v.x, v.y, v.z);
				if (i === rings.length - 1) continue;
				const [here, next] = [i * SIDES + k, i * SIDES + ((k + 1) % SIDES)];
				indices.push(here, next, here + SIDES, next, next + SIDES, here + SIDES);
			}
		});
		const forged = new BufferGeometry();
		forged.setAttribute('position', new Float32BufferAttribute(positions, 3));
		forged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
		forged.setIndex(indices);
		cast(forged, GOLD);
		cast(ball(on(...NOSE), ROD * 1.08), GOLD);
		cast(ball(on(...HINGE), ROD * 1.08), GOLD);
		// The gate, a little slimmer than the body, with a gap at each end of it, and the pin it turns on.
		const [hinge, nose] = [on(...HINGE), on(...NOSE)];
		const gate = nose.clone().sub(hinge);
		cast(bar(hinge.clone().addScaledVector(gate, 0.06), hinge.clone().addScaledVector(gate, 0.92), ROD * 0.8), GOLD);
		cast(bar(on(HINGE[0], HINGE[1], -ROD * 1.2), on(HINGE[0], HINGE[1], ROD * 1.2), 0.003, 6), ALLOY);
		// The sleeve, screwed down against the nose: the lower two fifths of the gate, and knurled, so it is so
		// many flats, each lit on its own.
		const sleeve = bar(hinge.clone().addScaledVector(gate, 0.53), hinge.clone().addScaledVector(gate, 0.93), ROD * 1.14, 12).toNonIndexed();
		sleeve.computeVertexNormals();
		cast(sleeve, LOCK);

		// The belay device hanging from its wide end, well below it: a tube-style one after DMM's Bug,
		// which is a squat forged tube, nearly as deep as it is wide and about as tall, open at both
		// ends, with two slots through it side by side for the rope: each is bent like a bean, and
		// there is a wall between them. Its corners are heavily rounded, its lips at the top and the
		// bottom are rolled where the rope runs over them, and between them its outside is waisted.
		// It is kept on the carabiner by a tall loop of stiff cable in black plastic, which rises from
		// the two ends of the wall between the slots. The loop is threaded through the carabiner: one
		// leg goes down in front of the carabiner's bar and the other behind, and its top is bent
		// closely over the bar, on the inside of the wide end. So the tube hangs square to the
		// carabiner, and plumb. It is made with its top at the origin, across, front to back and down.
		const BAR = -0.119 + ROD; // the top of the carabiner's bottom bar
		const HUNG = { x: 0.012, cable: 0.048, wide: 0.078, deep: 0.073, tall: 0.07, waist: 0.0045, lip: 0.005 };
		const lip = BAR - HUNG.cable; // the top of the tube
		swung.from = hard.length;
		swung.about.copy(on(HUNG.x, -0.119));
		swung.axis.copy(sideways);
		const depthways = UP.clone().negate().cross(sideways); // through the carabiner, one way or the other
		const seat = new Matrix4().makeBasis(sideways, depthways, UP.clone().negate()).setPosition(on(HUNG.x, lip));
		// The heights it is drawn at: close together at the lips, which are round.
		const rolled = [0, 0.0005, 0.0014, 0.0028, HUNG.lip];
		const levels = [...rolled, ...Array.from({ length: 9 }, (_, k) => HUNG.lip + ((k + 1) * (HUNG.tall - 2 * HUNG.lip)) / 10), ...rolled.map((z) => HUNG.tall - z).reverse()];
		/** How far a lip is rolled back, this far down the tube. */
		const roll = (z: number) => {
			const from = HUNG.lip - Math.min(z, HUNG.tall - z);
			return from > 0 ? HUNG.lip - Math.sqrt(HUNG.lip ** 2 - from ** 2) : 0;
		};
		/** The outside, this far down: drawn in at the waist, and at the lips. */
		const outside = (p: Vector2, z: number) => {
			const less = HUNG.waist * (1 - Math.abs((2 * z) / HUNG.tall - 1) ** 2.2) + roll(z);
			return new Vector2(p.x * (1 - (2 * less) / HUNG.wide), p.y * (1 - (2 * less) / HUNG.deep));
		};
		// A slot: longer front to back than it is across, and bent, its middle further from the wall.
		const SLOT = { at: 0.0175, across: 0.0115, long: 0.0265, bent: 0.003 };
		const bean = (side: number) =>
			Array.from({ length: 28 }, (_, k) => {
				const turn = (k * TURN) / 28;
				const power = (x: number) => Math.sign(x) * Math.abs(x) ** 0.75;
				const [x, y] = [SLOT.across * power(Math.cos(turn)), SLOT.long * power(Math.sin(turn))];
				return new Vector2(side * (SLOT.at + side * x + SLOT.bent * (1 - (y / SLOT.long) ** 2) - SLOT.bent * 0.6), y);
			});
		/** A slot's wall, this far down: its mouth is eased at each lip. */
		const inside = (side: number) => (p: Vector2, z: number) =>
			new Vector2(side * SLOT.at + (p.x - side * SLOT.at) * (1 + (0.5 * roll(z)) / SLOT.across), p.y * (1 + (0.5 * roll(z)) / SLOT.long));
		/** A wall drawn up through all the levels from an outline, which goes round anticlockwise seen from above. */
		const wall = (outline: Vector2[], at: (p: Vector2, z: number) => Vector2, outward: boolean, colour: Color) => {
			const n = outline.length;
			const positions: number[] = [];
			const indices: number[] = [];
			levels.forEach((z, i) => {
				outline.forEach((p, k) => {
					const q = at(p, z);
					positions.push(q.x, q.y, z);
					if (i === levels.length - 1) return;
					const [a, b] = [i * n + k, i * n + ((k + 1) % n)];
					if (outward) indices.push(a, b, a + n, b, b + n, a + n);
					else indices.push(a, a + n, b, b, a + n, b + n);
				});
			});
			const g = new BufferGeometry();
			g.setAttribute('position', new Float32BufferAttribute(positions, 3));
			g.setIndex(indices);
			g.computeVertexNormals();
			cast(g.applyMatrix4(seat), colour);
		};
		const round = plate(HUNG.wide, HUNG.deep, 0.022).getPoints(7);
		round.pop(); // it ends where it began
		// The slot on the far side is the near one's reflection, so it is taken the other way round.
		const slots = [bean(1), bean(-1).reverse()];
		wall(round, outside, true, DEVICE);
		slots.forEach((slot, k) => wall(slot, inside(k ? -1 : 1), false, SHADOWED));
		// Its two ends: what is left of the top and of the bottom between the lips.
		for (const z of [0, HUNG.tall]) {
			const end = new Shape(round.map((p) => outside(p, z)));
			slots.forEach((slot, k) => end.holes.push(new Path(slot.map((p) => inside(k ? -1 : 1)(p, z)))));
			const g = new ShapeGeometry(end);
			if (z === 0) {
				// The top looks up, which is the other way from the way it is made.
				const index = g.getIndex()!;
				for (let k = 0; k < index.count; k += 3) {
					const [b, c] = [index.getX(k + 1), index.getX(k + 2)];
					index.setX(k + 1, c);
					index.setX(k + 2, b);
				}
				const normal = g.getAttribute('normal');
				for (let k = 0; k < normal.count; k++) normal.setZ(k, -1);
			}
			cast(g.translate(0, 0, z).applyMatrix4(seat), DEVICE);
		}
		const WIRE = 0.0055;
		const over = { y: -0.119, deep: ROD * 0.92 + WIRE + 0.0012, thick: ROD * 1.2 + WIRE + 0.0012 }; // round the bar's middle line
		const anchor = HUNG.deep / 2 - 0.007;
		/** One leg of it: up out of the tube's top, on this side of the carabiner's bar, and over the bar. */
		const leg = (side: number) => [
			...[
				[side * anchor, 0.004],
				[side * (anchor + 0.001), -0.2 * HUNG.cable],
				[side * (anchor - 0.006), -0.42 * HUNG.cable]
			].map(([y, z]) => new Vector3(0, y, z).applyMatrix4(seat)),
			on(HUNG.x, over.y - 0.016).addScaledVector(depthways, side * (over.thick + 0.005)),
			on(HUNG.x, over.y - 0.002).addScaledVector(depthways, side * over.thick),
			on(HUNG.x, over.y + over.deep * 0.72).addScaledVector(depthways, side * over.thick * 0.74)
		];
		const cable = [...leg(-1), on(HUNG.x, over.y + over.deep), ...leg(1).reverse()];
		cast(new TubeGeometry(new CatmullRomCurve3(cable), 44, WIRE, 8), CABLE);
	}

	const harness = new Group();
	const webbing = new MeshStandardMaterial({ map: cloth(), vertexColors: true, roughness: 0.9, side: DoubleSide });
	const metal = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.2 });
	harness.add(new Mesh(mergeGeometries(sewn.map((g) => g.toNonIndexed())), webbing));
	const cast0 = new Mesh(mergeGeometries(hard), metal);
	harness.add(cast0);

	// --- The air from the door stirs the belay device, a little: it is a block of metal on a stiff
	// wire, so it only rocks, all of a piece with its cable, about the carabiner's bar where the
	// cable bears on it: mostly from side to side as the room sees it, away from the door, a little
	// about the bar's own line and a very little about the upright. The corner is a long way from
	// the door, so a gust is late reaching it.
	{
		const first = hard.slice(0, swung.from).reduce((sum, g) => sum + g.getAttribute('position').count, 0);
		const points = cast0.geometry.getAttribute('position');
		const normals = cast0.geometry.getAttribute('normal');
		const still = { points: Float32Array.from(points.array as ArrayLike<number>), normals: Float32Array.from(normals.array as ArrayLike<number>) };
		const LAG = 0.7;
		const turned = new Matrix4();
		const twisted = new Matrix4();
		const v = new Vector3();
		const pose = (t: number, strength: number) => {
			const blowing = air(t - LAG) * strength;
			// The same beat as the tie's and the rope's, so they go together.
			const beat = 0.65 + 0.25 * Math.sin(3.4 * (t - LAG)) + 0.12 * Math.sin(5.3 * (t - LAG) + 1);
			// Away from the door, across the room as it is seen, which is the way that shows: the room
			// looks at the corner nearly square on, and what only comes toward it hardly seems to move.
			const across = 0.17 * blowing * beat;
			// And a little toward the room, and back.
			const rocked = -0.06 * blowing * beat;
			turned
				.makeRotationAxis(ACROSS, across)
				.multiply(twisted.makeRotationAxis(swung.axis, rocked))
				.multiply(twisted.makeRotationY(0.012 * blowing * Math.sin(2.1 * (t - LAG))));
			for (let i = first; i < points.count; i++) {
				if (blowing === 0) {
					points.setXYZ(i, still.points[i * 3], still.points[i * 3 + 1], still.points[i * 3 + 2]);
					normals.setXYZ(i, still.normals[i * 3], still.normals[i * 3 + 1], still.normals[i * 3 + 2]);
					continue;
				}
				v.fromArray(still.points, i * 3).sub(swung.about).applyMatrix4(turned).add(swung.about);
				points.setXYZ(i, v.x, v.y, v.z);
				v.fromArray(still.normals, i * 3).applyMatrix4(turned);
				normals.setXYZ(i, v.x, v.y, v.z);
			}
			points.needsUpdate = true;
			normals.needsUpdate = true;
		};
		harness.userData.works = blown(cast0, pose);
	}
	return harness;
}
