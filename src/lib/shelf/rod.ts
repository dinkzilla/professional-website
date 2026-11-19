// The fly rod that stands in the corner of the room (placed in room.ts): a nine-foot five-weight
// after Orvis's Helios, which is a matte dark blank with a white label above the cork, a dark
// anodised reel seat and a large-arbor reel. It is strung: the fly line runs from the reel up
// through every guide to the tip, and the leader comes back down outside them to a green drake
// hooked in the keeper above the grip.
//
// Built upright from its butt, which is the origin, with the reel and the guides on its -x side
// and the reel's handle toward +z. Sizes are a real rod's, at about 1.85 units to the metre, except
// that the lines and the fly are a little heavier than life, since at life size they would be
// finer than a pixel.
//
// It is all made here, with no model or picture to download, and everything of one material is
// merged into one mesh, so the whole rod is a dozen draw calls.

import {
	BoxGeometry,
	BufferGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CylinderGeometry,
	DoubleSide,
	ExtrudeGeometry,
	Float32BufferAttribute,
	Group,
	LatheGeometry,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	Path,
	Quaternion,
	RepeatWrapping,
	Shape,
	ShapeGeometry,
	SphereGeometry,
	SplineCurve,
	SRGBColorSpace,
	TorusGeometry,
	TubeGeometry,
	Vector2,
	Vector3,
	type Material
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MM = 0.00185; // units to a millimetre
const INCH = 25.4 * MM;
/** The rod's length: nine feet. */
export const ROD = 108 * INCH;

const UP = new Vector3(0, 1, 0);
const TURN = Math.PI * 2;

// Along the rod, from the butt.
const SEAT_TOP = 0.19; // where the cork starts
const GRIP_TOP = 0.52; // and where it ends, and the bare blank begins
const KEEPER = 0.545;
const LABEL = { from: 0.565, to: 0.685 };
const BLANK = { butt: 0.0085, tip: 0.0022 }; // radii
/** The blank's radius this far up it. */
const blankR = (y: number) => BLANK.butt + ((BLANK.tip - BLANK.butt) * (y - GRIP_TOP)) / (ROD - GRIP_TOP);

// The reel. Its spool, and what stands between that and the seat: the frame's bar over the spool's
// rim, a pillar, and the foot, which is let a little way into the seat. Its axle is that far out.
const INSERT_R = 0.0135; // the part of the seat the reel's foot lies on
const SPOOL = { r: 0.083, half: 0.0215, arbor: 0.04, line: 0.071 };
const CAGE = SPOOL.r + 0.0065; // the outside of the frame, round the spool
const FOOT = { long: 0.115, thick: 0.004, pillar: 0.016, sunk: 0.0015 };
const REEL = { x: -(INSERT_R - FOOT.sunk + FOOT.thick + FOOT.pillar + CAGE), y: 0.1385 };

// The guides, as a rod builder's chart gives them: inches down from the tip.
const SNAKES = [4, 9, 14.5, 20.5, 27.5, 35, 42.5, 51];
const STRIPPERS = [61, 73];

/** The same numbers every time, so that the cork is the same cork. */
function dice(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function paint(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return { canvas, c: canvas.getContext('2d')! };
}

function texture(canvas: HTMLCanvasElement) {
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	map.wrapS = RepeatWrapping;
	map.anisotropy = 4;
	return map;
}

/** The grip's cork: rings glued end to end, each its own shade, pitted, the pits lying round it. */
function corkRings(rings: number) {
	const W = 64;
	const H = 256;
	const { canvas, c } = paint(W, H);
	const random = dice(7);
	c.fillStyle = '#c9a877';
	c.fillRect(0, 0, W, H);
	const ring = H / rings;
	for (let k = 0; k < rings; k++) {
		c.fillStyle = random() < 0.5 ? `rgba(92,60,28,${random() * 0.12})` : `rgba(240,214,170,${random() * 0.14})`;
		c.fillRect(0, k * ring, W, ring);
	}
	for (let k = 0; k < 420; k++) {
		const dark = random() < 0.6;
		c.fillStyle = dark ? `rgba(84,54,28,${0.25 + random() * 0.45})` : `rgba(232,204,160,${0.2 + random() * 0.3})`;
		c.beginPath();
		c.ellipse(random() * W, random() * H, 0.6 + random() * (dark ? 2.6 : 1.6), 0.4 + random() * 0.9, 0, 0, TURN);
		c.fill();
	}
	c.fillStyle = 'rgba(88,60,34,0.5)';
	for (let k = 1; k < rings; k++) c.fillRect(0, Math.round(k * ring), W, 1);
	return texture(canvas);
}

/** Woven carbon fibre, for the seat's insert: a check of two dark greys. */
function weave() {
	const { canvas, c } = paint(8, 8);
	c.fillStyle = '#17181c';
	c.fillRect(0, 0, 8, 8);
	c.fillStyle = '#33363d';
	c.fillRect(0, 0, 4, 4);
	c.fillRect(4, 4, 4, 4);
	const map = texture(canvas);
	map.wrapT = RepeatWrapping;
	map.repeat.set(12, 12);
	return map;
}

/** The label above the grip: white, with the maker's and the rod's names along it, reading toward the tip. */
function label() {
	const W = 128;
	const H = 512;
	const { canvas, c } = paint(W, H);
	c.fillStyle = '#eceae4';
	c.fillRect(0, 0, W, H);
	c.fillStyle = '#16181c';
	c.fillRect(0, 0, W, 10);
	c.fillRect(0, H - 10, W, 10);
	c.translate(W / 2, H / 2);
	c.rotate(-Math.PI / 2);
	c.textBaseline = 'middle';
	c.textAlign = 'left';
	c.font = '700 38px Helvetica, Arial, sans-serif';
	c.fillText('HELIOS', -H / 2 + 34, -5);
	c.textAlign = 'right';
	c.font = '700 20px Helvetica, Arial, sans-serif';
	c.fillText('ORVIS', H / 2 - 34, -14);
	c.font = '500 15px Helvetica, Arial, sans-serif';
	c.fillText("9' 5wt 4pc", H / 2 - 34, 8);
	return texture(canvas);
}

export function buildRod() {
	const paintOn = (hex: number, roughness: number) => new MeshStandardMaterial({ color: hex, roughness });
	const graphite = paintOn(0x1b1f26, 0.55); // the blank: matte, nearly black, a little blue
	const gloss = paintOn(0x0c0d10, 0.22); // thread wraps under epoxy, the seat's carbon insert, the reel's handle
	const anodised = paintOn(0x676b73, 0.3); // the seat's hardware, and the reel's drag knob
	const carbon = new MeshStandardMaterial({ map: weave(), roughness: 0.3 }); // the seat's insert
	const pewter = paintOn(0x17181b, 0.38); // the reel: black anodised
	const cherry = paintOn(0x7a1f1c, 0.35); // its handle: cherry wood, a dark red, to show against the black
	const wire = paintOn(0xb9bcc1, 0.3); // the guides
	const cork = new MeshStandardMaterial({ map: corkRings(13), roughness: 1 });
	const flyLine = paintOn(0xc3d44a, 0.75);
	const mono = paintOn(0xe4e8e2, 0.3); // the leader
	// The fly.
	const bronze = paintOn(0x4d3b28, 0.3); // its hook
	const olive = paintOn(0x768a32, 1); // its body
	const rib = paintOn(0xd3c35c, 0.9);
	const moose = paintOn(0x1d1913, 1); // its tails and the thread at its head
	const dun = new MeshStandardMaterial({ color: 0xa9ad92, roughness: 1, side: DoubleSide }); // its wings

	// Everything is gathered by material and made into one mesh for each at the end.
	const parts = new Map<Material, BufferGeometry[]>();
	const put = (material: Material, geometry: BufferGeometry, x = 0, y = 0, z = 0) => {
		geometry.translate(x, y, z);
		if (!parts.has(material)) parts.set(material, []);
		parts.get(material)!.push(geometry);
		return geometry;
	};
	/** A round bar from one point to another. */
	const stick = (from: Vector3, to: Vector3, r: number, sides = 5, rTo = r) => {
		const way = to.clone().sub(from);
		const g = new CylinderGeometry(rTo, r, way.length(), sides, 1, true);
		g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, way.normalize()));
		const mid = from.clone().add(to).multiplyScalar(0.5);
		return g.translate(mid.x, mid.y, mid.z);
	};
	/** A length of the rod's axis: a cylinder from this height to that. */
	const sleeve = (material: Material, from: number, to: number, r: number, rTo = r, sides = 12) =>
		put(material, new CylinderGeometry(rTo, r, to - from, sides), 0, (from + to) / 2, 0);
	/** A thread wrap over the blank. */
	const wrap = (from: number, to: number) => sleeve(gloss, from, to, blankR(from) + 0.0008, blankR(to) + 0.0008, 10);
	/** A ring round the rod's axis direction, standing off it. */
	const ring = (material: Material, R: number, r: number, x: number, y: number, sides = 16) =>
		put(material, new TorusGeometry(R, r, 5, sides).rotateX(Math.PI / 2), x, y, 0);

	// --- The seat: uplocking, so from the butt it is a cap, a length of thread, a lock ring and a nut,
	// the hood they push up over one end of the reel's foot, the insert the foot lies on, and a second
	// hood, let into the cork, over its other end.
	const HOOD = 0.0185;
	const footEnd = REEL.y - FOOT.long / 2;
	const slide = { from: footEnd - 0.007, to: footEnd + 0.013 }; // the hood that moves
	const threaded = slide.from - 0.027; // where the thread stops showing
	const seat: number[][] = [
		[0, 0],
		[0.0125, 0],
		[0.0168, 0.003],
		[0.0178, 0.007],
		[0.0178, 0.012],
		[0.0146, 0.0125]
	];
	for (let y = 0.014; y < threaded; y += 0.0026) seat.push([0.0137, y], [0.0147, y + 0.0013]);
	seat.push([0.0137, threaded], [0.0137, slide.from], [0.0172, slide.from], [HOOD, slide.from + 0.003], [HOOD, slide.to], [INSERT_R, slide.to]);
	put(anodised, new LatheGeometry(seat.map(([r, y]) => new Vector2(r, y)), 20));
	/** A ring cut with grooves to be gripped: so many flats, each lit on its own. */
	const knurled = (geometry: CylinderGeometry) => {
		const flats = geometry.toNonIndexed();
		flats.computeVertexNormals();
		return flats;
	};
	put(anodised, knurled(new CylinderGeometry(0.0186, 0.0186, 0.008, 22)), 0, threaded + 0.005, 0); // the lock ring
	put(anodised, knurled(new CylinderGeometry(0.019, 0.019, 0.015, 22)), 0, slide.from - 0.0085, 0); // the nut
	put(carbon, new CylinderGeometry(INSERT_R, INSERT_R, SEAT_TOP - 0.01 - slide.to, 16, 1, true), 0, (SEAT_TOP - 0.01 + slide.to) / 2, 0);
	put(
		anodised,
		new LatheGeometry(
			[
				[INSERT_R, SEAT_TOP - 0.01],
				[HOOD, SEAT_TOP - 0.01],
				[HOOD, SEAT_TOP + 0.002],
				[0.0175, SEAT_TOP + 0.004]
			].map(([r, y]) => new Vector2(r, y)),
			20
		)
	);

	// --- The grip: a reverse half wells, as trout rods have, which flares at the reel end, swells under
	// the palm and tapers away to the front.
	const profile = new SplineCurve(
		[
			[0.0185, SEAT_TOP],
			[0.0212, SEAT_TOP + 0.004],
			[0.0206, 0.225],
			[0.0222, 0.27],
			[0.0235, 0.315],
			[0.0222, 0.37],
			[0.0198, 0.425],
			[0.0178, 0.475],
			[0.0164, 0.505],
			[0.0148, GRIP_TOP - 0.003],
			[0.0118, GRIP_TOP]
		].map(([r, y]) => new Vector2(r, y))
	);
	put(cork, new LatheGeometry(profile.getSpacedPoints(26), 18));
	sleeve(anodised, GRIP_TOP, GRIP_TOP + 0.006, 0.0115, 0.0105, 14); // the winding check

	// --- The blank, in four pieces: each joint is the upper piece's end slipped over the lower's,
	// so a short length a little thicker, with a wrap at its mouth.
	sleeve(graphite, GRIP_TOP, ROD, BLANK.butt, BLANK.tip, 10);
	for (const joint of [1, 2, 3]) {
		const y = (ROD * joint) / 4 + 0.03;
		sleeve(graphite, y, y + 0.06, blankR(y) + 0.0011, blankR(y + 0.06) + 0.0004, 10);
		wrap(y - 0.004, y + 0.016);
	}

	// The label, which is its own mesh since it has its own picture, turned to face the room.
	const badge = new Mesh(
		new CylinderGeometry(blankR(LABEL.to) + 0.0005, blankR(LABEL.from) + 0.0005, LABEL.to - LABEL.from, 16, 1, true),
		new MeshStandardMaterial({ map: label(), roughness: 0.4 })
	);
	badge.geometry.rotateY(Math.PI - 0.75).translate(0, (LABEL.from + LABEL.to) / 2, 0);
	wrap(GRIP_TOP + 0.006, LABEL.from);
	wrap(LABEL.to, LABEL.to + 0.012);

	// The keeper: a small wire ring standing off the blank, for the fly's hook.
	const KEEPER_R = 0.0055;
	const keeperX = -(BLANK.butt + KEEPER_R + 0.001);
	ring(wire, KEEPER_R, 0.0011, keeperX, KEEPER, 12);
	put(wire, stick(new Vector3(-BLANK.butt, KEEPER - 0.012, 0), new Vector3(keeperX + KEEPER_R, KEEPER, 0), 0.0011, 4));

	// --- The guides. Where the line goes through each is kept, to string it afterwards.
	const through: Vector3[] = [];
	// Two stripping guides: a ring held well off the blank on a frame of three legs.
	STRIPPERS.forEach((inches, k) => {
		const y = ROD - inches * INCH;
		const s = k === 0 ? 0.82 : 1; // the upper one is the smaller
		const r = blankR(y);
		const R = 0.0085 * s;
		const x = -(r + 0.0165 * s);
		ring(gloss, R, 0.002 * s, x, y); // the frame's hoop
		ring(wire, R - 0.0016 * s, 0.0011 * s, x, y); // and the hard ring set in it
		for (const side of [-1, 1]) {
			put(gloss, stick(new Vector3(-r, y - 0.03 * s, 0), new Vector3(x + R * 0.3, y, side * R * 0.95), 0.001, 4));
		}
		put(gloss, stick(new Vector3(-r, y + 0.024 * s, 0), new Vector3(x + R, y, 0), 0.001, 4));
		wrap(y - 0.05 * s, y - 0.022 * s);
		wrap(y + 0.016 * s, y + 0.04 * s);
		through.push(new Vector3(x, y, 0));
	});
	through.reverse(); // the lower first
	// Then snake guides, each one wire: up from a foot, out round the line and back to a second foot.
	[...SNAKES].reverse().forEach((inches, k) => {
		const y = ROD - inches * INCH;
		const s = 0.0072 - k * 0.00035; // smaller toward the tip
		const r = blankR(y);
		const path = new CatmullRomCurve3(
			[
				[-0.05, -1.8, 0],
				[-0.3, -0.9, 0.45],
				[-0.9, -0.25, 0.42],
				[-1.15, 0, 0],
				[-0.9, 0.25, -0.42],
				[-0.3, 0.9, -0.45],
				[-0.05, 1.8, 0]
			].map(([px, py, pz]) => new Vector3(-r + px * s, y + py * s, pz * s))
		);
		put(wire, new TubeGeometry(path, 14, 0.0009, 4));
		wrap(y - 2.9 * s, y - 1.1 * s);
		wrap(y + 1.1 * s, y + 2.9 * s);
		through.push(new Vector3(-r - 0.6 * s, y, 0));
	});
	// And the tip-top: a tube over the end of the blank with a ring on it.
	sleeve(wire, ROD - 0.028, ROD + 0.002, BLANK.tip + 0.0009, BLANK.tip + 0.0009, 8);
	const top = new Vector3(-0.0052, ROD + 0.003, 0);
	ring(wire, 0.0038, 0.0009, top.x, top.y, 10);
	put(wire, stick(new Vector3(-BLANK.tip, ROD - 0.014, 0), new Vector3(top.x + 0.0038, top.y, 0), 0.0008, 4));
	through.push(top);

	// --- The reel: a large-arbor one. Its spool is two ported plates on a wide drum with the line
	// wound between them; its frame is a plate behind the spool, a band round the spool's back edge,
	// and a bar over its rim on the rod's side, from which a pillar goes up to the foot. Made about
	// its axle, facing +z, with the rod toward +x.
	const reel = (material: Material, geometry: BufferGeometry, z = 0) => put(material, geometry, REEL.x, REEL.y, z);
	/** A disc or drum about the axle, between two z. */
	const drum = (material: Material, r: number, from: number, to: number, sides = 24, open = false) =>
		reel(material, new CylinderGeometry(r, r, to - from, sides, 1, open).rotateX(Math.PI / 2), (from + to) / 2);
	const disc = (r: number) => {
		const shape = new Shape();
		for (let q = 0; q < 4; q++) shape.absarc(0, 0, r, (q * TURN) / 4, ((q + 1) * TURN) / 4, false);
		return shape;
	};
	/** Cut windows in a plate between two radii, leaving this many spokes, each this wide all the way along. */
	const windows = (plate: Shape, count: number, inner: number, outer: number, spoke: number) => {
		const wide = Math.asin(spoke / 2 / outer);
		const narrow = Math.asin(spoke / 2 / inner);
		for (let k = 0; k < count; k++) {
			const a0 = (k * TURN) / count;
			const a1 = a0 + TURN / count;
			const cut = new Path().absarc(0, 0, outer, a0 + wide, a1 - wide, false).absarc(0, 0, inner, a1 - narrow, a0 + narrow, true);
			cut.closePath();
			plate.holes.push(cut);
		}
	};
	const drilled = (plate: Shape, count: number, at: number, r: number, turned = 0) => {
		for (let k = 0; k < count; k++) {
			const a = turned + (k * TURN) / count;
			plate.holes.push(new Path().absarc(at * Math.cos(a), at * Math.sin(a), r, 0, TURN, true));
		}
	};
	const flat = (shape: Shape, depth: number) => new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });

	// The spool.
	const SPOKES = 6;
	const PLATE = 0.0025;
	const plate = disc(SPOOL.r);
	windows(plate, SPOKES, 0.043, 0.064, 0.018);
	drilled(plate, SPOKES, 0.03, 0.0055, TURN / SPOKES / 2);
	drilled(plate, 18, 0.0735, 0.003);
	const front = flat(plate, PLATE);
	reel(pewter, front.clone(), -SPOOL.half);
	reel(pewter, front, SPOOL.half - PLATE);
	// Each plate's edge is turned in toward the other, which is the rim the line is wound up to.
	drum(pewter, SPOOL.r + 0.0004, SPOOL.half - 0.007, SPOOL.half + 0.0004, 36, true);
	drum(pewter, SPOOL.r + 0.0004, -SPOOL.half - 0.0004, -SPOOL.half + 0.007, 36, true);
	drum(pewter, SPOOL.arbor, -SPOOL.half + PLATE, SPOOL.half - PLATE, 24, true);
	// The line on it: turn on turn, each one a ridge, across the top and down both sides.
	const COIL = 0.0052;
	const BUMP = 0.0008;
	const packed = SPOOL.half - PLATE - BUMP - 0.0004;
	const wound: Vector2[] = [];
	for (let r = SPOOL.arbor; r < SPOOL.line - COIL / 2; r += COIL) wound.push(new Vector2(r, -packed), new Vector2(r + COIL / 2, -packed - BUMP));
	for (let z = -packed; z < packed - COIL / 4; z += COIL) wound.push(new Vector2(SPOOL.line, z), new Vector2(SPOOL.line + BUMP, z + COIL / 2));
	for (let r = SPOOL.line; r > SPOOL.arbor + COIL / 2; r -= COIL) wound.push(new Vector2(r, packed), new Vector2(r - COIL / 2, packed + BUMP));
	wound.push(new Vector2(SPOOL.arbor, packed));
	reel(flyLine, new LatheGeometry(wound, 32).rotateX(Math.PI / 2));
	// The cap over the axle, the handle on one spoke and its counterweight on the spoke opposite.
	drum(pewter, 0.0115, SPOOL.half, SPOOL.half + 0.004, 18);
	drum(gloss, 0.0048, SPOOL.half + 0.004, SPOOL.half + 0.0052, 10);
	const crank = (4 * TURN) / SPOKES;
	const CRANK = 0.072; // out on the rim
	const [crankX, crankY] = [CRANK * Math.cos(crank), CRANK * Math.sin(crank)];
	reel(pewter, new CylinderGeometry(0.0095, 0.0095, 0.0025, 14).rotateX(Math.PI / 2).translate(crankX, crankY, 0), SPOOL.half + 0.00125);
	reel(
		cherry,
		new LatheGeometry(
			[
				[0.005, 0],
				[0.0075, 0.004],
				[0.0102, 0.016],
				[0.0106, 0.028],
				[0.0085, 0.039],
				[0, 0.04]
			].map(([r, y]) => new Vector2(r, y)),
			14
		)
			.rotateX(Math.PI / 2)
			.translate(crankX, crankY, 0),
		SPOOL.half + 0.0025
	);
	reel(pewter, new CylinderGeometry(0.0078, 0.0078, 0.0045, 14).rotateX(Math.PI / 2).translate(-crankX, -crankY, 0), SPOOL.half + 0.00225);

	// The frame. Its back plate has three arms, one of them toward the rod, and the drag's housing
	// and knob at its middle.
	const BACK = -SPOOL.half - 0.0055; // the frame's back face
	const back = disc(SPOOL.r);
	windows(back, 3, 0.03, 0.074, 0.011);
	reel(pewter, flat(back, 0.0035), BACK);
	// No wider than the spool, or the far side of the reel looks the bigger.
	drum(pewter, SPOOL.r + 0.0004, BACK, -SPOOL.half, 36, true);
	drum(pewter, 0.024, BACK - 0.0075, BACK, 20);
	reel(anodised, knurled(new CylinderGeometry(0.029, 0.029, 0.012, 20)).rotateX(Math.PI / 2), BACK - 0.0135);
	// The bar over the rim, as wide as the spool.
	const SPAN = 0.42; // radians either side of the pillar
	const bar = new Shape().absarc(0, 0, CAGE, -SPAN, SPAN, false).absarc(0, 0, SPOOL.r + 0.002, SPAN, -SPAN, true);
	bar.closePath();
	reel(pewter, flat(bar, SPOOL.half + 0.001 - BACK), BACK);
	// The pillar, and the foot: a bar along the seat, thinned at its ends to go under the hoods.
	const pillarTop = CAGE + FOOT.pillar;
	const pillar = new Shape()
		.moveTo(CAGE - 0.002, -0.021)
		.lineTo(pillarTop + 0.0005, -0.014)
		.lineTo(pillarTop + 0.0005, 0.014)
		.lineTo(CAGE - 0.002, 0.021)
		.closePath();
	reel(pewter, flat(pillar, 0.022), -0.011);
	const lies = pillarTop + FOOT.thick; // the face of the foot that is against the seat
	const foot = new Shape()
		.moveTo(lies, -FOOT.long / 2)
		.lineTo(lies, FOOT.long / 2)
		.lineTo(lies - 0.0018, FOOT.long / 2)
		.lineTo(pillarTop, 0.03)
		.lineTo(pillarTop, -0.03)
		.lineTo(lies - 0.0018, -FOOT.long / 2)
		.closePath();
	reel(pewter, flat(foot, 0.017), -0.0085);

	// --- The line. It comes off the far side of the spool and runs straight up to the first guide,
	// then from guide to guide to the tip.
	const first = through[0];
	const reach = Math.hypot(first.x - REEL.x, first.y - REEL.y);
	const leaves = Math.atan2(first.y - REEL.y, first.x - REEL.x) + Math.acos(SPOOL.line / reach);
	const run = [new Vector3(REEL.x + SPOOL.line * Math.cos(leaves), REEL.y + SPOOL.line * Math.sin(leaves), 0), ...through];
	for (let k = 1; k < run.length; k++) put(flyLine, stick(run[k - 1], run[k], 0.0026, 5));

	// --- The fly: a green drake, a big olive mayfly, tied dry. Made in its own frame, the hook's
	// shank along +x from the bend to the eye and the wings up, then hung by its bend from the
	// keeper with its eye toward the tip, which is the way the leader pulls it.
	const SHANK = 0.035;
	const GAPE = 0.012;
	// Where the shank's rear end goes: the keeper's outer wire sits in the bend.
	const hung = new Matrix4()
		.makeTranslation(keeperX - KEEPER_R - GAPE / 2, KEEPER + 0.4 * GAPE, 0)
		.multiply(new Matrix4().makeRotationZ(Math.PI / 2));
	const fly = (material: Material, geometry: BufferGeometry) => put(material, geometry.applyMatrix4(hung));
	const hook = new CatmullRomCurve3(
		[
			[SHANK, 0],
			[SHANK / 2, 0],
			[0, 0],
			[-0.35 * GAPE, -0.15 * GAPE],
			[-0.5 * GAPE, -0.5 * GAPE],
			[-0.35 * GAPE, -0.85 * GAPE],
			[0, -GAPE],
			[0.55 * GAPE, -0.96 * GAPE]
		].map(([x, y]) => new Vector3(x, y, 0))
	);
	fly(bronze, new TubeGeometry(hook, 22, 0.00065, 5));
	fly(bronze, new TorusGeometry(0.0013, 0.0005, 4, 8).rotateY(Math.PI / 2).translate(SHANK + 0.001, 0, 0)); // the eye
	// The abdomen, tapering to the tail, ribbed in yellow.
	const bodyR = (x: number) => 0.0015 + (0.0017 * (x - 0.04 * SHANK)) / (0.58 * SHANK);
	fly(olive, new CylinderGeometry(bodyR(0.62 * SHANK), bodyR(0.04 * SHANK), 0.58 * SHANK, 8).rotateZ(-Math.PI / 2).translate(0.33 * SHANK, 0, 0));
	for (let k = 0; k < 5; k++) {
		const x = (0.1 + k * 0.105) * SHANK;
		fly(rib, new TorusGeometry(bodyR(x) + 0.0001, 0.00042, 4, 8).rotateY(Math.PI / 2).translate(x, 0, 0));
	}
	fly(olive, new SphereGeometry(0.0034, 10, 8).scale(1.5, 1, 1).translate(0.74 * SHANK, 0, 0)); // the thorax
	fly(moose, new SphereGeometry(0.0017, 8, 6).translate(0.95 * SHANK, 0, 0)); // the head
	// Three tails, as long as the body, splayed.
	for (const [up, out] of [
		[0.006, 0],
		[0.0025, 0.0075],
		[0.0025, -0.0075]
	]) {
		fly(moose, stick(new Vector3(0.05 * SHANK, 0.0005, 0), new Vector3(-0.85 * SHANK, up, out), 0.0005, 3, 0.0002));
	}
	// A pair of upright wings, leaning back a little and apart.
	const WING = 0.031;
	const wing = new Shape()
		.moveTo(0, 0)
		.bezierCurveTo(0.008, 0.2 * WING, 0.007, 0.8 * WING, -0.003, WING)
		.bezierCurveTo(-0.01, 0.75 * WING, -0.008, 0.25 * WING, 0, 0);
	for (const side of [-1, 1]) {
		fly(dun, new ShapeGeometry(wing, 5).rotateX(side * 0.3).translate(0.72 * SHANK, 0.002, side * 0.0008));
	}
	// The hackle: stiff fibres standing out all round the hook in front of and behind the wings,
	// barred light and dark, as a grizzly feather dyed olive is. Each is one sliver of a triangle.
	const FIBRES = 44;
	const FIBRE = 0.014;
	const random = dice(3);
	const points: number[] = [];
	const normals: number[] = [];
	const shades: number[] = [];
	for (let k = 0; k < FIBRES; k++) {
		const x = (0.6 + (0.3 * k) / FIBRES) * SHANK;
		const turn = k * 2.4 + random() * 0.4;
		const lean = (random() - 0.5) * 0.004;
		const long = FIBRE * (0.8 + random() * 0.35);
		const [cy, cz] = [Math.cos(turn), Math.sin(turn)];
		points.push(x - 0.0007, 0, 0, x + 0.0007, 0, 0, x + lean, cy * long, cz * long);
		for (let v = 0; v < 3; v++) normals.push(0, -cz, cy);
		const shade = k % 3 === 0 ? [0.05, 0.05, 0.03] : [0.4, 0.42, 0.13];
		for (let v = 0; v < 3; v++) shades.push(...shade);
	}
	const fibres = new BufferGeometry();
	fibres.setAttribute('position', new Float32BufferAttribute(points, 3));
	fibres.setAttribute('normal', new Float32BufferAttribute(normals, 3));
	fibres.setAttribute('color', new Float32BufferAttribute(shades, 3));
	const hackle = new Mesh(fibres.applyMatrix4(hung), new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide }));

	// --- The leader, from the tip back down to the fly's eye. It is outside the guides, so it lies
	// against the sides of the two big ones on its way.
	const eye = new Vector3(SHANK + 0.002, 0, 0).applyMatrix4(hung);
	const [lower, upper] = through;
	const leader = [top, new Vector3(upper.x, upper.y, 0.011), new Vector3(lower.x, lower.y, 0.0125), eye];
	for (let k = 1; k < leader.length; k++) put(mono, stick(leader[k - 1], leader[k], 0.0011, 4));

	const rod = new Group();
	for (const [material, geometries] of parts) {
		rod.add(new Mesh(mergeGeometries(geometries.map((g) => (g.index ? g.toNonIndexed() : g))), material));
	}
	rod.add(badge, hackle);
	return rod;
}
