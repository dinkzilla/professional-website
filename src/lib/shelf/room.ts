// The room the rack stands in, and what shows through its openings (grey-box prototype). Left of
// the rack is a board with show fliers pinned to it; right of it a door hangs open on a yard, a dock and a lake;
// past the door the wall turns a corner and comes toward the viewer, with a window onto a wood.
//
// The group's origin is on the floor at the foot of the back wall, level with the rack's middle.
// The back wall is the plane z = 0, as in scene.ts, and the room is on its +z side.
//
// The room is lit by the scene's lights. Everything outdoors is flat colour, unaffected by them,
// since it is in daylight; `dim` darkens it along with the room.
//
// The outdoors is a diorama placed by eye for where the camera stands (about x = -1.9, z = 7): the
// wood stands just outside the window, where it cannot be seen through the door, and the dock
// lies where the door looks.

import {
	BackSide,
	BoxGeometry,
	CanvasTexture,
	CircleGeometry,
	Color,
	CatmullRomCurve3,
	CylinderGeometry,
	DoubleSide,
	ExtrudeGeometry,
	Float32BufferAttribute,
	Group,
	IcosahedronGeometry,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	PointLight,
	Quaternion,
	RepeatWrapping,
	Shape,
	ShapeGeometry,
	SphereGeometry,
	SRGBColorSpace,
	TorusGeometry,
	TubeGeometry,
	Vector3,
	Path,
	type Material
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { AMP, AMP_JACK, braided, HOOK, PINBOARD } from './items.ts';
import { powerStrip } from './wiring.ts';
import { dominic } from './objects/dominic.ts';
import { buildRod } from './rod.ts';
import { buildCoatRack } from './coatrack.ts';
import { buildRope } from './rope.ts';
import type { Works } from './types.ts';
import { buildHarness } from './harness.ts';

/**
 * Whether the lamp casts shadows (see scene.ts). With it on, everything lit in the room casts and
 * receives them, the two boxes on the wall among them; with it off, those have soft patches painted
 * on the wall under them instead. Either way the switch's lever, which is too small for the lamp's
 * shadows to show, has one painted on the cover beside it.
 */
export const SHADOWS = true;

const FAR = 30; // how far the walls and floor run on, out of sight
const CORNER = 3.5; // x of the wall that comes toward the viewer; far enough to leave some wall beside the door
const DOOR = { left: 1.3, right: 2.7 };
const DOOR_OPEN = (100 * Math.PI) / 180; // swung inward, hinged on the left
// Along z, and above the floor. It runs on toward the viewer well past the edge of any screen.
const WINDOW = { near: 5.2, far: 0.3, sill: 1.3, top: 2.6 };
const SHORE = -2.6; // z where the yard ends and the lake begins
const HORIZON = -150;

export function buildRoom(rackHeight: number) {
	const group = new Group();
	const doorHeight = rackHeight - 0.05; // low enough that its top is in view

	const blocks = cinderBlocks();
	const wall = new MeshStandardMaterial({
		color: 0xe2e0d8, // off-white paint, barely warm, since the lamp warms it further
		roughness: 0.8, // paint has a little sheen, which lets the relief catch the lamp
		map: blocks.map,
		bumpMap: blocks.bump,
		// three takes the relief's slope per screen pixel, not per unit of wall, so this is of order 1:
		// a joint's full step between neighbouring pixels then tips the surface about 40 degrees.
		bumpScale: 3
	});
	const planks = floorboards(FAR + CORNER, FAR);
	// The colour is all in the paint (see floorboards); the relief is slight, just grain, gaps and dents.
	const boards = new MeshStandardMaterial({ roughness: 0.8, map: planks.map, bumpMap: planks.bump, bumpScale: 1 });
	// All the woodwork: the door and window frames, the skirting, and the frame of the pinboard.
	const trim = new MeshStandardMaterial({ color: 0x3f2819, roughness: 0.6 }); // dark mahogany: brown first, red second
	const iron = new MeshStandardMaterial({ color: 0x47454a, roughness: 0.8 });

	const outdoors: { material: MeshBasicMaterial; colour: Color }[] = [];
	const flat = (hex: number) => {
		const material = new MeshBasicMaterial({ color: hex });
		outdoors.push({ material, colour: new Color(hex) });
		return material;
	};

	const add = (mesh: Mesh, x = 0, y = 0, z = 0) => {
		mesh.position.set(x, y, z);
		group.add(mesh);
		return mesh;
	};
	const box = (w: number, h: number, d: number, material: Material, x: number, y: number, z: number) =>
		add(new Mesh(new BoxGeometry(w, h, d), material), x, y, z);
	/** A flat rectangle lying on the ground, between two x and two z. */
	const ground = (x0: number, x1: number, z0: number, z1: number, y: number, material: Material) => {
		const mesh = new Mesh(new PlaneGeometry(x1 - x0, Math.abs(z1 - z0)), material);
		mesh.rotation.x = -Math.PI / 2;
		return add(mesh, (x0 + x1) / 2, y, (z0 + z1) / 2);
	};

	// --- The room ---------------------------------------------------------------------------

	const floor = ground(-FAR, CORNER, 0, FAR, 0, boards);
	floor.receiveShadow = true;

	// A mat just inside the door.
	const mat = doormat(DOOR.right - DOOR.left - 0.1, 0.85);
	mat.position.set((DOOR.left + DOOR.right) / 2, 0, 0.58);
	mat.rotation.y = 0.03; // nobody lays one dead square
	group.add(mat);

	// The back wall, with the doorway cut out of its bottom edge.
	const back = new Shape()
		.moveTo(-FAR, 0)
		.lineTo(DOOR.left, 0)
		.lineTo(DOOR.left, doorHeight)
		.lineTo(DOOR.right, doorHeight)
		.lineTo(DOOR.right, 0)
		.lineTo(CORNER, 0)
		.lineTo(CORNER, FAR)
		.lineTo(-FAR, FAR)
		.closePath();
	add(new Mesh(new ShapeGeometry(back), wall)).receiveShadow = true;

	// The side wall, drawn with z across, then turned to face into the room.
	const side = new Shape().moveTo(0, 0).lineTo(FAR, 0).lineTo(FAR, FAR).lineTo(0, FAR).closePath();
	side.holes.push(
		new Path()
			.moveTo(WINDOW.far, WINDOW.sill)
			.lineTo(WINDOW.near, WINDOW.sill)
			.lineTo(WINDOW.near, WINDOW.top)
			.lineTo(WINDOW.far, WINDOW.top)
			.closePath()
	);
	add(new Mesh(new ShapeGeometry(side), wall), CORNER).rotation.y = -Math.PI / 2;

	// Frames, which give the walls some thickness where they are cut.
	const FRAME = 0.07;

	// Skirting along the foot of both walls, broken by the doorway.
	const SKIRT = { h: 0.09, d: 0.025 };
	for (const [from, to] of [
		[-FAR, DOOR.left - FRAME],
		[DOOR.right + FRAME, CORNER]
	]) {
		box(to - from, SKIRT.h, SKIRT.d, trim, (from + to) / 2, SKIRT.h / 2, SKIRT.d / 2);
	}
	box(SKIRT.d, SKIRT.h, FAR, trim, CORNER - SKIRT.d / 2, SKIRT.h / 2, FAR / 2);
	const REVEAL = 0.16;
	const doorWidth = DOOR.right - DOOR.left;
	const doorX = (DOOR.left + DOOR.right) / 2;
	const frameZ = -REVEAL / 2 + 0.02;
	for (const x of [DOOR.left - FRAME / 2, DOOR.right + FRAME / 2]) {
		box(FRAME, doorHeight + FRAME, REVEAL, trim, x, (doorHeight + FRAME) / 2, frameZ);
	}
	box(doorWidth, FRAME, REVEAL, trim, doorX, doorHeight + FRAME / 2, frameZ);
	// A rebate for the door to shut into: the frame is thicker behind where the door would lie,
	// up both sides and across the head.
	const LEAF = 0.06; // the door's thickness
	const STOP = { t: 0.02, d: REVEAL - LEAF, z: frameZ - LEAF / 2 };
	for (const x of [DOOR.left + STOP.t / 2, DOOR.right - STOP.t / 2]) box(STOP.t, doorHeight, STOP.d, trim, x, doorHeight / 2, STOP.z);
	box(doorWidth - 2 * STOP.t, STOP.t, STOP.d, trim, doorX, doorHeight - STOP.t / 2, STOP.z);
	// The threshold: a low board across the foot of the doorway, as deep as the frame.
	const SILL = 0.02;
	box(doorWidth, SILL, REVEAL, trim, doorX, SILL / 2, frameZ);

	const windowWidth = WINDOW.near - WINDOW.far;
	const windowHeight = WINDOW.top - WINDOW.sill;
	const windowZ = (WINDOW.near + WINDOW.far) / 2;
	const windowY = (WINDOW.top + WINDOW.sill) / 2;
	const frameX = CORNER + REVEAL / 2 - 0.02;
	for (const z of [WINDOW.far - FRAME / 2, WINDOW.near + FRAME / 2]) {
		box(REVEAL, windowHeight + 2 * FRAME, FRAME, trim, frameX, windowY, z);
	}
	for (const y of [WINDOW.sill - FRAME / 2, WINDOW.top + FRAME / 2]) {
		box(REVEAL, FRAME, windowWidth, trim, frameX, y, windowZ);
	}
	// A sliding window: plain sashes side by side, alternately in the inner and the outer of two
	// tracks, each overlapping the next by the width of its stile. No glazing bars.
	const SASH = { w: 0.95, rail: 0.045, d: 0.03 };
	const glazing = flat(0xe6f1f5);
	glazing.transparent = true;
	glazing.opacity = 0.14;
	glazing.side = DoubleSide;
	for (let i = 0; WINDOW.far + i * (SASH.w - SASH.rail) < WINDOW.near; i++) {
		const from = WINDOW.far + i * (SASH.w - SASH.rail);
		const to = Math.min(from + SASH.w, WINDOW.near);
		const x = CORNER + 0.03 + (i % 2) * (SASH.d + 0.005);
		const middle = (from + to) / 2;
		for (const z of [from + SASH.rail / 2, to - SASH.rail / 2]) box(SASH.d, windowHeight, SASH.rail, trim, x, windowY, z);
		for (const y of [WINDOW.sill + SASH.rail / 2, WINDOW.top - SASH.rail / 2]) box(SASH.d, SASH.rail, to - from, trim, x, y, middle);
		const sheet = new Mesh(new PlaneGeometry(to - from, windowHeight), glazing);
		sheet.rotation.y = -Math.PI / 2;
		add(sheet, x, windowY, middle);
		// A pull on the stile nearer the corner.
		box(0.02, 0.14, 0.02, iron, x - SASH.d / 2 - 0.01, windowY, from + SASH.rail / 2);
	}

	// The board the fliers are pinned to (the fliers themselves are in objects/fliers.ts, since they can be
	// taken down): cork in a frame.
	const boardW = PINBOARD.right - PINBOARD.left;
	const boardH = PINBOARD.top - PINBOARD.bottom;
	const grain = corkGrain(boardW, boardH);
	// Its colour is all in the map. The relief is gentler than the wall's: granules, not joints.
	const cork = new MeshStandardMaterial({ roughness: 1, map: grain.map, bumpMap: grain.bump, bumpScale: 0.5 });
	const boardX = (PINBOARD.left + PINBOARD.right) / 2;
	// Hung with its top level with the top of the door's opening.
	const lift = doorHeight - PINBOARD.top;
	const boardY = (PINBOARD.top + PINBOARD.bottom) / 2 + lift;
	const board = box(boardW, boardH, 0.03, cork, boardX, boardY, 0.015);
	board.receiveShadow = true;
	for (const x of [PINBOARD.left, PINBOARD.right]) box(0.05, boardH + 0.05, 0.05, trim, x, boardY, 0.025);
	for (const y of [PINBOARD.bottom, PINBOARD.top]) box(boardW + 0.05, 0.05, 0.05, trim, boardX, y + lift, 0.025);

	// The hooks by the door: three pegs with lips, on a rail. The tie hangs on the middle one (the
	// tie is in tie.ts); the other two are empty.
	const SPACING = 0.13;
	box(2 * SPACING + 0.1, 0.09, 0.012, iron, HOOK.x, HOOK.y - 0.03, 0.006);
	for (const side of [-1, 0, 1]) {
		const x = HOOK.x + side * SPACING;
		const peg = new Mesh(new CylinderGeometry(0.012, 0.012, 0.08, 10), iron);
		peg.rotation.x = Math.PI / 2;
		add(peg, x, HOOK.y - 0.03, 0.04);
		box(0.024, 0.04, 0.012, iron, x, HOOK.y - 0.015, 0.08);
	}

	// A power outlet low on the wall between the rack and the door: a steel box on the surface, as
	// it has to be on block, with a duplex receptacle in its cover. Its conduit leaves its left
	// side and runs level along the wall, behind the rack and the amp (it is thin enough to pass
	// through the gap the amp stands off by) and on out of sight.
	// No further left than this: from where the camera stands, to the left, the rack hides the
	// wall to about x = 0.92.
	const OUTLET = { x: 1.03, y: 0.36, w: 0.145, h: 0.24, d: 0.11 };
	const CONDUIT = { r: 0.024, z: 0.03 }; // as thick as will still pass behind the amp
	const steel = new MeshStandardMaterial({ color: 0x8f9296, roughness: 0.5 });
	const zinc = new MeshStandardMaterial({ color: 0xa4a7aa, roughness: 0.4 }); // the fittings, a little brighter
	const white = new MeshStandardMaterial({ color: 0xf1f0ea, roughness: 0.55 }); // the faceplate and the receptacle in it
	const slot = new MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 });
	/** A cylinder lying along x, or with `out`, facing out of the wall. */
	const barrel = (r: number, length: number, material: Material, x: number, y: number, z: number, out = false, sides = 20) => {
		const m = new Mesh(new CylinderGeometry(r, r, length, sides), material);
		if (out) m.rotation.x = Math.PI / 2;
		else m.rotation.z = Math.PI / 2;
		return add(m, x, y, z);
	};
	/** Draw a rectangle with rounded corners about the origin. */
	const trace = <P extends Path>(path: P, w: number, h: number, r: number) =>
		path
			.moveTo(-w / 2 + r, -h / 2)
			.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false)
			.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false)
			.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false)
			.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false) as P;
	type Hole = { w: number; h: number; r: number };
	/**
	 * A slab with rounded corners, seen from the front, standing out from the plane z = 0, with a
	 * hole through its middle if one is given. With `roll`, its edges (and the hole's) are rolled
	 * over by that much, front and back, as a moulded plate's are; its size is then as measured
	 * across the roll, and the hole's as measured at its narrowest.
	 */
	const rounded = (w: number, h: number, r: number, depth: number, hole?: Hole, roll = 0) => {
		const outline = trace(new Shape(), w - 2 * roll, h - 2 * roll, r - roll);
		if (hole) outline.holes.push(trace(new Path(), hole.w + 2 * roll, hole.h + 2 * roll, hole.r + roll));
		const thick = Math.min(roll, depth / 2 - 0.0005); // how far back from each face the roll starts
		const slab = new ExtrudeGeometry(outline, {
			depth: roll ? depth - 2 * thick : depth,
			curveSegments: 10,
			bevelEnabled: roll > 0,
			bevelSize: roll,
			bevelThickness: thick,
			bevelSegments: 5
		});
		if (roll) slab.translate(0, 0, thick);
		return slab;
	};
	/**
	 * A soft dark patch to lie on a surface where something standing off it keeps the lamp's light
	 * from it, painted on where the lamp's own shadows do not do it.
	 */
	const blur = document.createElement('canvas');
	blur.width = blur.height = 128;
	const soft = blur.getContext('2d')!;
	soft.shadowColor = '#000';
	soft.shadowBlur = 20;
	soft.shadowOffsetX = 256; // the rectangle itself is drawn off the picture; only what it casts is on it
	soft.fillRect(32 - 256, 32, 64, 64);
	const blurred = new CanvasTexture(blur);
	const shade = (w: number, h: number, x: number, y: number, z: number, strength: number) => {
		const material = new MeshBasicMaterial({ color: 0x000000, map: blurred, transparent: true, opacity: strength, depthWrite: false });
		return add(new Mesh(new PlaneGeometry(w * 2, h * 2), material), x, y, z);
	};
	// Where the lamp is, near enough, as the room is laid out (see scene.ts), and so which way a
	// shadow falls from a point this far off the wall: away from the lamp, by its share of the way to it.
	const LAMP = new Vector3(0, 2.2 + rackHeight, 4.5);
	const cast = (x: number, y: number, off: number) => [((x - LAMP.x) * off) / (LAMP.z - off), ((y - LAMP.y) * off) / (LAMP.z - off)];
	const ROUND = 0.022; // the radius of the box's corners
	const COVER = 0.008; // how thick a cover is
	const coverZ = OUTLET.d + COVER; // the face of a box's cover
	/**
	 * A box with its cover on, its middle this high, and the screw that holds the cover on at each
	 * of `screws` from there. With a hole, the cover has it cut through, and behind it is a dark
	 * well in the box for what works in the hole.
	 */
	const wallBox = (x: number, y: number, screws: number[], hole?: Hole) => {
		const [dx, dy] = cast(x, y, coverZ);
		// On the wall, only when the lamp is not casting one there itself.
		if (!SHADOWS) shade(OUTLET.w, OUTLET.h, x + dx * 0.8, y + dy * 0.8, 0.002, 0.55);
		const cut = hole && { w: hole.w + 0.008, h: hole.h + 0.008, r: hole.r };
		add(new Mesh(rounded(OUTLET.w, OUTLET.h, ROUND, OUTLET.d, cut), steel), x, y, 0);
		add(new Mesh(rounded(OUTLET.w + 0.008, OUTLET.h + 0.008, ROUND + 0.004, COVER, hole, 0.0035), white), x, y, OUTLET.d);
		if (hole) {
			const WELL = 0.03;
			add(new Mesh(new BoxGeometry(hole.w + 0.004, hole.h + 0.004, WELL), well), x, y, OUTLET.d - WELL / 2);
		}
		for (const up of screws) {
			barrel(0.008, 0.004, zinc, x, y + up, coverZ + 0.002, true, 16);
			// The slot in its head, left wherever the screwdriver stopped.
			box(0.013, 0.0022, 0.001, slot, x, y + up, coverZ + 0.0042).rotation.z = 0.5 + up * 31;
		}
	};
	// The inside of a box, seen through a hole in its cover: only its inner faces are drawn.
	const well = new MeshStandardMaterial({ color: 0x1b1b1e, roughness: 1, side: BackSide });
	wallBox(OUTLET.x, OUTLET.y, [0]);
	for (const side of [-1, 1]) {
		const y = OUTLET.y + side * 0.052;
		barrel(0.04, 0.008, white, OUTLET.x, y, coverZ + 0.004, true, 28);
		const face = coverZ + 0.0085;
		for (const x of [-0.014, 0.014]) box(0.007, 0.026, 0.002, slot, OUTLET.x + x, y + 0.008, face);
		barrel(0.0065, 0.002, slot, OUTLET.x, y - 0.02, face, true, 12); // the earth
	}
	// The conduit, and the fitting that joins it to the box: a sleeve with a nut against the box.
	const outletLeft = OUTLET.x - OUTLET.w / 2;
	barrel(CONDUIT.r, outletLeft + FAR, steel, (outletLeft - FAR) / 2, OUTLET.y, CONDUIT.z);
	barrel(CONDUIT.r + 0.006, 0.05, zinc, outletLeft - 0.025, OUTLET.y, CONDUIT.z);
	barrel(CONDUIT.r + 0.011, 0.012, zinc, outletLeft - 0.006, OUTLET.y, CONDUIT.z, false, 6);
	// Plugged into the lower receptacle, a power strip on the floor, and what is plugged into that
	// (see wiring.ts).
	const power = powerStrip(new Vector3(OUTLET.x, OUTLET.y - 0.052, coverZ + 0.008));
	group.add(power.group);
	// On the other side of the door, a second box of the same kind with the light switch in it.
	// Its conduit drops to the height the outlet's runs at, turns toward the corner, runs along
	// the wall to it, turns again round it, and runs on toward the viewer along the side wall,
	// under the rods. Each turn is an elbow fitting.
	const SWITCH = { x: 2.95, y: 1.3 };
	// The switch: a toggle in a dark cutout in the cover, tipped up, which is on. Its sizes are
	// given in inches of the cover, which stands for the standard 2.75 by 4.5 inch plate.
	const INCH = (OUTLET.h + 0.008) / 4.5;
	const K = 1.4 * INCH; // the mechanism is drawn bigger than life, as the receptacle is, to show at this distance
	const TOGGLE = { w: 0.36 * K, root: 0.2 * K, tip: 0.15 * K, end: 0.9 * K, barrel: 0.42 * K, sunk: 0.27 * K, edge: 0.025 * K };
	// The same white as the cover, but giving back a little light of its own, so that the side of
	// it that the lamp does not reach is grey and not black.
	const plastic = new MeshStandardMaterial({ color: 0xf1f0ea, roughness: 0.45, emissive: 0xf1f0ea, emissiveIntensity: 0.07 });
	// The cutout the toggle moves in: a hole through the cover, enough bigger than the toggle's
	// base to show the dark inside of the box all round it. The screws are further apart than the
	// standard, to stand clear of it.
	wallBox(SWITCH.x, SWITCH.y, [-0.088, 0.088], { w: 0.5 * K, h: 1.08 * K, r: 0.05 * K });
	// What the lever keeps the light from, on the cover beside and below it.
	const [leverX, leverY] = cast(SWITCH.x, SWITCH.y, 0.035); // the lever stands about this far off the cover
	shade(0.3 * K, 0.36 * K, SWITCH.x + leverX, SWITCH.y + 0.012 + leverY, coverZ + 0.0006, 0.5);
	// The toggle is one moulding, so it is made as one: its outline from the side (the barrel it
	// turns on, of which the front bulges out through the cutout, and
	// the lever growing out of that, thinner toward its rounded end), cut out of a slab as thick
	// as the toggle is wide. Its two sides are flat from end to end. Drawn with the lever pointing
	// straight out of the wall, across the page, then tipped up.
	const R = TOGGLE.barrel;
	const meets = Math.asin(TOGGLE.root / R); // the angle round the barrel at which the lever's edge leaves it
	const eased = meets + 0.16; // and where the outline starts to curve out to meet that edge
	const rootAt = R * Math.cos(meets);
	const tipAt = TOGGLE.end - TOGGLE.tip; // the middle of the lever's rounded end
	// A point on the lever's edge this share of the way from the barrel to the end.
	const edgeAt = (share: number) => [rootAt + (tipAt - rootAt) * share, TOGGLE.root + (TOGGLE.tip - TOGGLE.root) * share];
	const [easeX, easeY] = edgeAt(0.22);
	const profile = new Shape()
		.moveTo(R * Math.cos(eased), R * Math.sin(eased))
		.quadraticCurveTo(rootAt, TOGGLE.root, easeX, easeY)
		.lineTo(tipAt, TOGGLE.tip)
		.absarc(tipAt, 0, TOGGLE.tip, Math.PI / 2, -Math.PI / 2, true)
		.lineTo(easeX, -easeY)
		.quadraticCurveTo(rootAt, -TOGGLE.root, R * Math.cos(eased), -R * Math.sin(eased))
		.absarc(0, 0, R, -eased, eased, true);
	const moulding = new ExtrudeGeometry(profile, {
		depth: TOGGLE.w - 2 * TOGGLE.edge,
		curveSegments: 24,
		bevelEnabled: true, // only enough to take the sharpness off the sides' edges
		bevelThickness: TOGGLE.edge,
		bevelSize: TOGGLE.edge,
		bevelSegments: 3
	});
	// From across the page to out of the wall, and centred on its width.
	moulding.translate(0, 0, -(TOGGLE.w - 2 * TOGGLE.edge) / 2).rotateY(-Math.PI / 2);
	const toggle = new Mesh(moulding, plastic);
	toggle.position.set(SWITCH.x, SWITCH.y, coverZ - TOGGLE.sunk);
	toggle.rotation.x = -0.42;
	group.add(toggle);
	const switchFoot = SWITCH.y - OUTLET.h / 2;
	const runY = OUTLET.y;
	const sideX = CORNER - CONDUIT.z; // the run along the side wall is as far off it as the others are off theirs
	/** A cylinder with its middle here, lying along this axis. */
	const pipe = (axis: 'x' | 'y' | 'z', r: number, length: number, material: Material, x: number, y: number, z: number, sides = 20) => {
		const m = new Mesh(new CylinderGeometry(r, r, length, sides), material);
		if (axis === 'x') m.rotation.z = Math.PI / 2;
		if (axis === 'z') m.rotation.x = Math.PI / 2;
		return add(m, x, y, z);
	};
	pipe('y', CONDUIT.r, switchFoot - runY, steel, SWITCH.x, (switchFoot + runY) / 2, CONDUIT.z);
	pipe('y', CONDUIT.r + 0.006, 0.05, zinc, SWITCH.x, switchFoot - 0.025, CONDUIT.z); // the fitting into the box, as the outlet's
	pipe('y', CONDUIT.r + 0.011, 0.012, zinc, SWITCH.x, switchFoot - 0.006, CONDUIT.z, 6);
	pipe('x', CONDUIT.r, sideX - SWITCH.x, steel, (SWITCH.x + sideX) / 2, runY, CONDUIT.z);
	pipe('z', CONDUIT.r, FAR - CONDUIT.z, steel, sideX, runY, (FAR + CONDUIT.z) / 2);
	/**
	 * An elbow where two lengths meet at a right angle: a round body at the corner, and toward
	 * each length (given as an axis and which way along it) a sleeve that the conduit goes into,
	 * with a nut at its mouth.
	 */
	const elbow = (x: number, y: number, z: number, legs: ['x' | 'y' | 'z', number][]) => {
		add(new Mesh(new SphereGeometry(CONDUIT.r + 0.007, 28, 20), zinc), x, y, z);
		for (const [axis, way] of legs) {
			const at = (along: number): [number, number, number] => [
				x + (axis === 'x' ? way * along : 0),
				y + (axis === 'y' ? way * along : 0),
				z + (axis === 'z' ? way * along : 0)
			];
			pipe(axis, CONDUIT.r + 0.007, 0.05, zinc, ...at(0.025), 28);
			pipe(axis, CONDUIT.r + 0.012, 0.022, zinc, ...at(0.058), 28);
			pipe(axis, CONDUIT.r + 0.005, 0.012, zinc, ...at(0.074), 28);
		}
	};
	elbow(SWITCH.x, runY, CONDUIT.z, [
		['y', 1],
		['x', 1]
	]);
	elbow(sideX, runY, CONDUIT.z, [
		['x', -1],
		['z', 1]
	]);

	// The strap holding it to the wall: a band over the conduit, with a tab below it screwed to the block.
	const strapD = CONDUIT.z + CONDUIT.r + 0.003;
	// Only the one that shows: just clear of the amp's left side, with bare conduit either side of it.
	for (const x of [AMP.x - AMP.w / 2 - 0.14]) {
		box(0.03, 2 * CONDUIT.r + 0.006, strapD, zinc, x, OUTLET.y, strapD / 2);
		box(0.03, 0.04, 0.004, zinc, x, OUTLET.y - CONDUIT.r - 0.02, 0.002);
		barrel(0.008, 0.004, steel, x, OUTLET.y - CONDUIT.r - 0.024, 0.006, true, 10);
	}
	// And one of the same on the side wall, where it shows under the rods.
	const GUIDE = 1.15; // its z
	box(strapD, 2 * CONDUIT.r + 0.006, 0.03, zinc, CORNER - strapD / 2, runY, GUIDE);
	box(0.004, 0.04, 0.03, zinc, CORNER - 0.002, runY - CONDUIT.r - 0.02, GUIDE);
	pipe('x', 0.008, 0.004, steel, CORNER - 0.006, runY - CONDUIT.r - 0.024, GUIDE, 10);
	// And one halfway up the length that comes down from the switch, its tab to the right.
	const guideY = (runY + switchFoot) / 2;
	box(2 * CONDUIT.r + 0.006, 0.03, strapD, zinc, SWITCH.x, guideY, strapD / 2);
	box(0.04, 0.03, 0.004, zinc, SWITCH.x + CONDUIT.r + 0.02, guideY, 0.002);
	barrel(0.008, 0.004, steel, SWITCH.x + CONDUIT.r + 0.024, guideY, 0.006, true, 10);

	// A backless bench for putting shoes on used to stand here, under the window, with a coiled
	// climbing rope slung over its door end and a second cat, Dominic, asleep on it. The bench is
	// gone, and the rope and the cat are put away for now: they are still made as they lay on it, so
	// its measures are kept for them. (A motorcycle helmet lay on the floor under it; that is gone too.)
	const SHOWN = { rope: false, cat: false };
	const BENCH = { from: 0.5, d: 0.6, seat: 0.8, pad: 0.12, gap: 0.02 };
	const benchFront = CORNER - BENCH.gap - BENCH.d;
	const benchX = benchFront + BENCH.d / 2;
	const benchTop = BENCH.seat + BENCH.pad;
	const ROPE = { z: BENCH.from + 0.3, r: 0.02 };

	// The rope: each turn of the coil lies across the pad and hangs down the front, no two quite alike.
	if (SHOWN.rope) {
		for (let turn = 0; turn < 5; turn++) {
			const wide = 0.1 + turn * 0.012; // half the gap between the turn's two sides
			const drop = 0.5 + ((turn * 3) % 5) * 0.035; // how far it hangs
			const lift = benchTop + ROPE.r + turn * 0.008;
			const side = (s: number) => [
				new Vector3(benchFront + 0.4, lift, ROPE.z + s * wide),
				new Vector3(benchFront + 0.06, lift + 0.01, ROPE.z + s * (wide + 0.03)),
				new Vector3(benchFront - 0.035, benchTop - 0.12, ROPE.z + s * (wide + 0.02)),
				new Vector3(benchFront - 0.04, benchTop - drop + 0.08, ROPE.z + s * wide * 0.7)
			];
			const turnPath = new CatmullRomCurve3(
				[
					new Vector3(benchFront + 0.47, lift, ROPE.z),
					...side(-1),
					new Vector3(benchFront - 0.04, benchTop - drop, ROPE.z),
					...side(1).reverse()
				],
				true
			);
			group.add(braided(turnPath, '#1fa39a', '#f2d13a', 4, ROPE.r));
		}
		// The wraps that hold the coil together, round both its sides where they lie on the pad.
		const wraps = new Mesh(new TorusGeometry(0.16, 0.022, 8, 24), new MeshStandardMaterial({ color: 0x1fa39a, roughness: 0.8 }));
		wraps.rotation.y = Math.PI / 2;
		wraps.scale.set(1, 0.3, 3.2);
		add(wraps, benchFront + 0.22, benchTop + 0.04, ROPE.z);
	}

	// Dominic (see objects/dominic.ts): turned so that his belly faces the room, and mirrored end
	// for end so that his head is toward the rope.
	if (SHOWN.cat) {
		const cat = dominic();
		// Built oversize; this brings his head to a little more than the size of the other cat's.
		cat.scale.set(-0.65, 0.65, 0.65);
		cat.position.set(benchX + 0.04, benchTop, ROPE.z + 0.58);
		cat.rotation.y = -Math.PI / 2 + 0.2;
		group.add(cat);
	}

	// Two fly rods hung level on the side wall under the window, one right below the other, their
	// reels toward the door (see rod.ts): strung, each with a fly in its keeper. Each lies in two
	// hooks, close to the wall, with its guides hanging down and the reel's handle toward the
	// wall. The handle stands further out from the reel than the rod is off the wall, so it lies
	// against the blocks and holds the reel out, which turns the whole rod about its length: the
	// reel, the guides and the line all hang a little out into the room. The lower one is just far enough under
	// the upper to clear its line, which comes off the bottom of the reel and climbs to the first
	// guide. That is still not quite as far as the upper one's reel hangs, so it is set along the
	// wall toward the viewer by enough for that reel to hang past its butt.
	// The turn is what brings the end of the handle to the wall with the rod this far off it.
	const RODS = { z: 0.45, y: 1.06, off: 0.035, turned: 0.19, apart: 0.21, along: 0.3 };
	const hung = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(1, 0, 0)));
	hung.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -RODS.turned));
	const rodX = CORNER - RODS.off;
	// Where along the rod each hook is, and how far below the rod's middle the bottom of what lies
	// in it: one behind the reel, under the threaded end of the seat, and one just past the fly and
	// the label, under the bare blank. The rod and reel balance between the two. Nothing further
	// along shows. The second is between the reel and the first guide, so the line is in it under
	// the rod, and the leader with it: both are pinched there against the blank, which lies on them.
	const HOOKS = [
		{ at: 0.028, under: 0.0147 },
		{ at: 0.72, under: 0.0135 }
	];
	const WIRE = 0.006; // the hook's thickness, as a radius
	/**
	 * A hook for a rod whose middle is at this height and this far along the wall: a plate screwed
	 * to the blocks above and below, and a round bar that leaves it behind the rod, goes down and
	 * under whatever lies in it, and comes up in front with its end turned out.
	 */
	const hook = (y: number, z: number, under: number) => {
		const round = under + WIRE; // from the rod's middle to the bar's
		const at = (out: number, up: number) => new Vector3(CORNER - out, y + up, z);
		const bar = new CatmullRomCurve3([
			at(0.003, 0.014),
			...[200, 235, 270, 305, 340, 375].map((degrees) => {
				const a = (degrees * Math.PI) / 180;
				return at(RODS.off + round * Math.cos(a), round * Math.sin(a));
			}),
			at(RODS.off + round + 0.005, 0.26 * round + 0.017)
		]);
		group.add(new Mesh(new TubeGeometry(bar, 40, WIRE, 10), zinc));
		const end = bar.getPoint(1);
		add(new Mesh(new SphereGeometry(WIRE, 12, 8), zinc), end.x, end.y, end.z);
		const PLATE = { t: 0.004, w: 0.03, top: 0.052, foot: -0.064 };
		box(PLATE.t, PLATE.top - PLATE.foot, PLATE.w, zinc, CORNER - PLATE.t / 2, y + (PLATE.top + PLATE.foot) / 2, z);
		// The screws: pan heads, slotted, no two slots turned alike.
		[PLATE.top - 0.014, PLATE.foot + 0.014].forEach((up, k) => {
			pipe('x', 0.0075, 0.004, steel, CORNER - PLATE.t - 0.002, y + up, z, 14);
			box(0.001, 0.002, 0.0135, slot, CORNER - PLATE.t - 0.004, y + up, z).rotation.x = 0.5 + k * 1.9 + z * 7;
		});
	};
	[
		{}, // the first: a dark blank and a green line, with a green drake
		{ blank: 0x1d4a2c, line: 0x1f8fff, fly: 'bugger' as const } // the second: a dark green blank and a bright blue line, with a woolly bugger
	].forEach((its, k) => {
		const rod = buildRod({ ...its, labelFaces: Math.PI - 0.6, pinch: HOOKS[1].at });
		const y = RODS.y - k * RODS.apart;
		const z = RODS.z + k * RODS.along;
		rod.position.set(rodX, y, z);
		rod.quaternion.copy(hung);
		group.add(rod);
		for (const { at, under } of HOOKS) hook(y, z + at, under);
	});

	// A coat rack standing in the corner (see coatrack.ts): black steel, with pegs at different
	// heights, turned to show from where the room is seen. The highest points toward the window and
	// the viewer, and a harness hangs from it (see harness.ts). The next down points the other way
	// across the corner, toward the back wall and the door, and is bare. Below that a climbing rope
	// hangs from one toward the door (see rope.ts), and the lowest, toward the side wall, is bare.
	// The rope and the harness are both made in the rack's own frame, hung on the peg they are given.
	const RACK = { out: 0.4 }; // how far the pole is from each wall
	const coats = buildCoatRack([
		{ way: 225, height: 1.88 },
		{ way: 60, height: 2.12 }, // turned a little toward the viewer, so that its end stands clear of the window's frame
		{ way: 172, height: 1.3 },
		{ way: 352, height: 1.12 }
	]);
	const rope = buildRope(coats.pegs[2]);
	const harness = buildHarness(coats.pegs[1]);
	coats.group.add(rope, harness);
	coats.group.position.set(CORNER - RACK.out, 0, RACK.out);
	group.add(coats.group);

	// Daylight from the window, falling on the rods and the corner. It dims with the room.
	const DAYLIGHT = 2.2;
	const daylight = new PointLight(0xe4ecf2, DAYLIGHT, 4.5, 1.6);
	daylight.position.set(CORNER - 0.7, 2.2, 1.3);
	group.add(daylight);
	// And a little from the door, spilling onto the mat and the boards just inside: brightest at the
	// threshold and fading into the room with no edge to it, as the sky's light does, so a bare point
	// of light with no cone. It hangs just outside the doorway, where the back wall, facing away from
	// it, takes none. It dims with the room too.
	const SPILL = 1;
	const spill = new PointLight(0xe4ecf2, SPILL, 5, 1.6);
	spill.position.set((DOOR.left + DOOR.right) / 2, 1.35, -0.4);
	group.add(spill);

	// The amp under the board: a combo, with its controls along the top of its front and the
	// speaker cloth below them. The cable in its input is the cassette player's (see objects/cassette.ts).
	const tolex = new MeshStandardMaterial({ color: 0x1d1c1f, roughness: 0.85 });
	const cloth = new MeshStandardMaterial({ color: 0x6b6254, roughness: 1 });
	const plate = new MeshStandardMaterial({ color: 0xa5a29a, roughness: 0.5 });
	const front = AMP.gap + AMP.d;
	const controls = 0.2; // height of the strip the knobs are on
	box(AMP.w, AMP.h, AMP.d, tolex, AMP.x, AMP.h / 2, AMP.gap + AMP.d / 2);
	const clothH = AMP.h - controls - 0.12;
	box(AMP.w - 0.12, clothH, 0.02, cloth, AMP.x, 0.06 + clothH / 2, front);
	const cone = new Mesh(new CircleGeometry(clothH * 0.42, 32), new MeshStandardMaterial({ color: 0x4d463c, roughness: 1 }));
	add(cone, AMP.x, 0.06 + clothH / 2, front + 0.011);
	const stripY = AMP.h - 0.06 - controls / 2;
	box(AMP.w - 0.12, controls - 0.04, 0.02, plate, AMP.x, stripY, front);
	for (let i = 0; i < 5; i++) {
		const knob = new Mesh(new CylinderGeometry(0.035, 0.035, 0.04, 20), tolex);
		knob.rotation.x = Math.PI / 2;
		add(knob, AMP.x - 0.4 + i * 0.15, stripY, front + 0.03);
	}
	const jack = new Mesh(new CylinderGeometry(0.036, 0.036, 0.012, 20), tolex);
	jack.rotation.x = Math.PI / 2;
	add(jack, AMP_JACK.x, AMP_JACK.y, front + 0.012);
	box(0.4, 0.03, 0.06, tolex, AMP.x, AMP.h + 0.015, AMP.gap + AMP.d / 2); // the handle

	// On top of the amp, in front of the handle, a pint glass with half a beer left in it.
	const pintZ = AMP.gap + AMP.d / 2 + 0.13;
	const PINT = { x: AMP.x + 0.13, h: 0.3, top: 0.085, foot: 0.062 };
	const beerTop = 0.5; // how full, as a share of the glass
	const waist = PINT.foot + (PINT.top - PINT.foot) * beerTop;
	const beer = new Mesh(
		new CylinderGeometry(waist - 0.006, PINT.foot - 0.006, PINT.h * beerTop - 0.01, 28),
		new MeshStandardMaterial({ color: 0xd08a1e, roughness: 0.3, emissive: 0x6a3c05, emissiveIntensity: 0.5 })
	);
	add(beer, PINT.x, AMP.h + 0.012 + (PINT.h * beerTop - 0.01) / 2, pintZ);
	const foam = new Mesh(new CylinderGeometry(waist - 0.005, waist - 0.006, 0.014, 28), new MeshStandardMaterial({ color: 0xf3ead2, roughness: 1 }));
	add(foam, PINT.x, AMP.h + PINT.h * beerTop + 0.008, pintZ);
	const pint = new Mesh(
		new CylinderGeometry(PINT.top, PINT.foot, PINT.h, 28, 1, true),
		new MeshStandardMaterial({ color: 0xdfeaf0, roughness: 0.1, transparent: true, opacity: 0.28, side: DoubleSide, depthWrite: false })
	);
	add(pint, PINT.x, AMP.h + PINT.h / 2, pintZ);

	// --- Outdoors ---------------------------------------------------------------------------

	const sky = flat(0xbcd3e2);
	const water = flat(0x6c9bb3);
	const grass = flat(0x86a560);
	const shore = flat(0x64846e);
	const hill = flat(0x7d9a8c);
	const plank = flat(0x9a7a56);
	const pile = flat(0x5f4a36);
	const bark = flat(0x6f5a44);
	const greens = [flat(0x8fb56a), flat(0x6f9d5c), flat(0xa9c47a)];
	const thicket = flat(0x5c8554);

	add(new Mesh(new PlaneGeometry(800, 300), sky), 0, 140, HORIZON);
	ground(-300, 400, SHORE, HORIZON, -0.25, water);
	ground(-FAR, 60, FAR, SHORE, -0.03, grass);

	// The far side of the lake: a low wooded shore with hills behind it.
	box(800, 2.5, 1, shore, 0, 1, HORIZON + 6);
	for (const [x, w, h] of [
		[-10, 60, 9],
		[70, 45, 6],
		[140, 70, 11]
	]) {
		const mound = add(new Mesh(new SphereGeometry(1, 24, 12), hill), x, 0, HORIZON + 3);
		mound.scale.set(w, h, 2);
	}

	// On the far shore, a geodesic dome house with a dock of its own. Its lower half is under the
	// water; its facets are told apart by shade alone, there being no light out here to do it. The
	// dock runs mostly across the view, since one pointing at the viewer would be a pixel tall.
	// The two together stand in the part of the doorway that the open door leaves clear, which
	// is its right: at this distance, from about x = 77 to x = 95.
	const DOME = { x: 90.5, z: HORIZON + 9, r: 3.5 };
	const facets = new IcosahedronGeometry(DOME.r, 1);
	const shades: number[] = [];
	for (let face = 0; face < facets.attributes.position.count / 3; face++) {
		const shade = 0.78 + 0.22 * ((face * 7919) % 11) / 10; // any fixed scatter
		for (let corner = 0; corner < 3; corner++) shades.push(shade, shade, shade);
	}
	facets.setAttribute('color', new Float32BufferAttribute(shades, 3));
	const shell = flat(0xe9e1cf);
	shell.vertexColors = true;
	add(new Mesh(facets, shell), DOME.x, -0.1, DOME.z);
	const farDock = new Group();
	farDock.position.set(DOME.x - 2.5, 0, DOME.z + DOME.r);
	farDock.rotation.y = -0.5;
	const farLength = 7.5; // just past the fourth post
	const farDeck = new Mesh(new BoxGeometry(farLength, 0.22, 1.2), plank);
	farDeck.position.set(-farLength / 2, 0.25, 0);
	farDock.add(farDeck);
	// The dome's door, standing on the deck at the end of the dock, against the shell behind it.
	const farDoor = new Mesh(new BoxGeometry(0.7, 1.2, 0.2), pile);
	farDoor.position.set(-0.35, 0.36 + 0.6, -0.7);
	farDock.add(farDoor);
	for (let along = 1; along <= farLength; along += 2) {
		const post = new Mesh(new BoxGeometry(0.2, 1.1, 0.2), pile);
		post.position.set(-along, 0.2, 0.6);
		farDock.add(post);
	}
	group.add(farDock);

	// The dock, running out from the yard, turned a little toward the line of sight through the
	// door so that it reads as going out into the lake and not along the shore.
	const DOCK = { x: 3.9, z: -2.2, length: 3.8, w: 0.7, turn: -0.26 };
	const dock = new Group();
	dock.position.set(DOCK.x, 0, DOCK.z);
	dock.rotation.y = DOCK.turn;
	const deck = new Mesh(new BoxGeometry(DOCK.w, 0.06, DOCK.length), plank);
	deck.position.set(0, 0.03, -DOCK.length / 2);
	dock.add(deck);
	for (let along = 0.5; along <= DOCK.length; along += 0.9) {
		for (const s of [-1, 1]) {
			const post = new Mesh(new CylinderGeometry(0.045, 0.045, 0.6, 8), pile);
			post.position.set((s * DOCK.w) / 2, 0, -along);
			dock.add(post);
		}
	}
	group.add(dock);

	// The door itself, swung into the room.
	const hinge = new Group();
	// It turns about the edge of its room-side face, at the face of the frame and just in front
	// of it, so that shut it would lie in the rebate, and open it clears the frame.
	hinge.position.set(DOOR.left, 0, 0.025);
	hinge.rotation.y = -DOOR_OPEN;
	const leafHeight = doorHeight - SILL; // its foot clears the threshold
	const door = new Group();
	door.position.set(0, SILL, -LEAF / 2);
	hinge.add(door);
	// A glass door: one sheet in a border of the same wood as the rest of the woodwork, and lit
	// by the room as that is. The pieces are laid out from the hinge, which is at x = 0.
	const STILE = 0.2;
	const piece = (w: number, h: number, x: number, y: number) => {
		const m = new Mesh(new BoxGeometry(w, h, LEAF), trim);
		m.position.set(x, y, 0);
		door.add(m);
	};
	piece(STILE, leafHeight, STILE / 2, leafHeight / 2);
	piece(STILE, leafHeight, doorWidth - STILE / 2, leafHeight / 2);
	piece(doorWidth - 2 * STILE, STILE, doorWidth / 2, STILE / 2);
	piece(doorWidth - 2 * STILE, STILE, doorWidth / 2, leafHeight - STILE / 2);
	const glass = new MeshStandardMaterial({ color: 0xe6f1f5, roughness: 0.2, transparent: true, opacity: 0.18, side: DoubleSide });
	const pane = new Mesh(new PlaneGeometry(doorWidth - 2 * STILE, leafHeight - 2 * STILE), glass);
	pane.position.set(doorWidth / 2, leafHeight / 2, 0);
	door.add(pane);
	// A black lever handle on each face: a plate on the stile, a stub out from it, and the lever
	// pointing back toward the hinge.
	const black = new MeshStandardMaterial({ color: 0x141416, roughness: 0.5 });
	const handleX = doorWidth - STILE / 2;
	const handleY = leafHeight * 0.44;
	for (const face of [-1, 1]) {
		const part = (w: number, h: number, d: number, x: number, y: number, z: number) => {
			const m = new Mesh(new BoxGeometry(w, h, d), black);
			m.position.set(x, y, face * z);
			door.add(m);
		};
		part(0.07, 0.26, 0.012, handleX, handleY, 0.036);
		part(0.03, 0.03, 0.06, handleX, handleY + 0.05, 0.066);
		part(0.2, 0.03, 0.025, handleX - 0.085, handleY + 0.05, 0.09);
	}
	// Three plain black hinges in the gap between the door and the frame: just the knuckles, on
	// the line the door turns about.
	for (const y of [0.25, doorHeight / 2, doorHeight - 0.25]) {
		const knuckle = new Mesh(new CylinderGeometry(0.013, 0.013, 0.12, 10), black);
		knuckle.position.set(0, y, 0.006);
		hinge.add(knuckle);
	}
	group.add(hinge);
	// The latch plate, on the jamb the door shuts against, at the height of the lever: a black plate
	// with rounded corners let into the rebate, an opening in its middle for the latch, a screw above
	// and below that, and a lip out past the edge of the frame.
	const latchY = SILL + handleY + 0.05;
	const frameFront = frameZ + REVEAL / 2;
	const rebateZ = (STOP.z + STOP.d / 2 + frameFront) / 2; // midway across the rebate
	// Half its width and height, its thickness, the radius of its corners, and half the lip's height.
	const PLATE = { a: 0.023, b: 0.1, t: 0.004, r: 0.008, lip: 0.055 };
	const { a, b, r } = PLATE;
	const edge = frameFront - rebateZ; // from the plate's middle to the edge of the frame
	// Drawn with the rebate's depth across (the room to the right) and height up.
	const strike = new Shape()
		.moveTo(-a + r, -b)
		.lineTo(a - r, -b)
		.quadraticCurveTo(a, -b, a, -b + r)
		.lineTo(a, -PLATE.lip)
		.lineTo(edge, -PLATE.lip)
		.lineTo(edge, PLATE.lip)
		.lineTo(a, PLATE.lip)
		.lineTo(a, b - r)
		.quadraticCurveTo(a, b, a - r, b)
		.lineTo(-a + r, b)
		.quadraticCurveTo(-a, b, -a, b - r)
		.lineTo(-a, -b + r)
		.quadraticCurveTo(-a, -b, -a + r, -b);
	const MOUTH = { w: 0.011, h: 0.03 }; // half the opening's width and height
	strike.holes.push(
		new Path().moveTo(-MOUTH.w, -MOUTH.h).lineTo(MOUTH.w, -MOUTH.h).lineTo(MOUTH.w, MOUTH.h).lineTo(-MOUTH.w, MOUTH.h).closePath()
	);
	const strikePlate = new Mesh(new ExtrudeGeometry(strike, { depth: PLATE.t, bevelEnabled: false }), black);
	strikePlate.rotation.y = -Math.PI / 2; // its face toward the doorway
	add(strikePlate, DOOR.right, latchY, rebateZ);
	// The mortise behind the opening, which is dark.
	box(0.001, 2 * MOUTH.h, 2 * MOUTH.w, new MeshBasicMaterial({ color: 0x050403 }), DOOR.right - 0.0005, latchY, rebateZ);
	// The lip, which is what the latch strikes as the door comes shut: it carries on past the edge of
	// the frame into the room, standing proud of the woodwork, and curls away from the doorway as it
	// goes, so that the latch rides up it. Drawn from above, with the wall to the right and the room
	// up, as a slice of a ring, then given the lip's height.
	const LIP = { radius: 0.03, sweep: (65 * Math.PI) / 180 };
	const curl = new Shape()
		.moveTo(-PLATE.t, 0)
		.absarc(LIP.radius, 0, LIP.radius + PLATE.t, Math.PI, Math.PI - LIP.sweep, true)
		.absarc(LIP.radius, 0, LIP.radius, Math.PI - LIP.sweep, Math.PI, false)
		.closePath();
	const lip = new Mesh(new ExtrudeGeometry(curl, { depth: 2 * PLATE.lip, bevelEnabled: false, curveSegments: 16 }), black);
	lip.rotation.x = Math.PI / 2; // the drawing's up into the room, its height downward
	add(lip, DOOR.right, latchY + PLATE.lip, frameFront);
	for (const side of [-1, 1]) {
		const screw = new Mesh(new CylinderGeometry(0.007, 0.007, 0.002, 12), black);
		screw.rotation.z = Math.PI / 2;
		add(screw, DOOR.right - PLATE.t - 0.001, latchY + side * 0.068, rebateZ);
	}

	// The wood outside the window: a few trees close by, with thicker growth behind them.
	const thick = new Mesh(new PlaneGeometry(10, 8), thicket);
	thick.rotation.y = -Math.PI / 2;
	add(thick, CORNER + 2.3, 4, 1.4);
	for (const [out, z, h, r] of [
		[0.75, 0.35, 2.3, 0.5],
		[1.15, -0.55, 2.7, 0.6],
		[1.55, 0.05, 2.1, 0.45],
		[1.70, -1.2, 2.9, 0.65],
		[1.25, -1.65, 2.4, 0.5],
		[1.95, -2.1, 2.6, 0.6],
		[1.00, 1.3, 2.5, 0.55],
		[1.60, 2.1, 2.8, 0.6],
		[0.95, 3.0, 2.3, 0.5],
		[1.70, 3.9, 2.7, 0.6],
		[1.10, 4.8, 2.5, 0.55]
	]) {
		const x = CORNER + out; // each is given by how far outside the wall it stands
		add(new Mesh(new CylinderGeometry(0.05, 0.07, h, 8), bark), x, h / 2, z);
		const n = Math.round(x * 7 + z * 3); // any fixed number, to vary the trees
		add(new Mesh(new IcosahedronGeometry(r, 1), greens[Math.abs(n) % 3]), x, h, z);
		add(new Mesh(new IcosahedronGeometry(r * 0.7, 1), greens[Math.abs(n + 1) % 3]), x - 0.15, h + r * 0.6, z + 0.2);
	}

	if (SHADOWS) {
		group.traverse((o) => {
			if (!(o instanceof Mesh) || !(o.material instanceof MeshStandardMaterial)) return;
			o.receiveShadow = true;
			// Not the walls or the floor, which there is nothing behind, nor anything seen through.
			o.castShadow = o.material !== wall && o.material !== boards && !o.material.transparent && o.material.side !== BackSide;
		});
	}

	return {
		group,
		/** What in the room moves by itself, for the scene to run with the rest: what the air stirs of the rope and of the harness. */
		works: [rope.userData.works, harness.userData.works].filter(Boolean) as Works[],
		/** The board the fliers are on: a press on it takes one of them down. */
		board,
		/** Where the tv's lead leaves its plug in the power strip, from the floor (see wiring.ts). */
		tvPlug: power.tv,
		/** How far the board was moved up from where PINBOARD has it, and so what is pinned to it. */
		lift,
		/** Darken the daylight outside by this share, as the room's lights are when something is held. */
		dim(share: number) {
			for (const { material, colour } of outdoors) material.color.copy(colour).multiplyScalar(1 - share);
			daylight.intensity = DAYLIGHT * (1 - share);
			spill.intensity = SPILL * (1 - share);
		}
	};
}

/**
 * The walls' surface: painted cinder blocks, 0.8 by 0.4 (40 cm by 20), each row half a block along
 * from the one below. One tile is four blocks by four rows, each block its own shade, and it
 * repeats by the walls' own coordinates, which are their texture coordinates. The second texture
 * is the relief, drawn separately: the joints sunk between the blocks, and the faces pitted.
 */
function cinderBlocks() {
	const ACROSS = 4;
	const ROWS = 4;
	const W = 256; // px per block
	const H = 128;
	const JOINT = 3;
	const BEVEL = 3; // px over which a block's edge rolls down into the joint
	const MORTAR = 140; // the joint's height, where a block's face is FACE
	const FACE = 220;
	const sheet = (fill: string) => {
		const canvas = document.createElement('canvas');
		canvas.width = ACROSS * W;
		canvas.height = ROWS * H;
		const c = canvas.getContext('2d')!;
		c.fillStyle = fill;
		c.fillRect(0, 0, canvas.width, canvas.height);
		return { canvas, c };
	};
	// The paint is one colour over blocks and mortar alike; it is the relief that tells them apart.
	const { canvas, c } = sheet('#e6e6e6');
	const { canvas: relief, c: r } = sheet(`rgb(${MORTAR},${MORTAR},${MORTAR})`);
	// A fixed scatter, so that the wall is the same on every visit.
	let seed = 7;
	const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	for (let row = 0; row < ROWS; row++) {
		// One more block than fits, so that the offset rows wrap round the tile's edge.
		for (let i = -1; i < ACROSS; i++) {
			const x = (i + (row % 2) / 2) * W + JOINT / 2;
			const y = row * H + JOINT / 2;
			const shade = 232 + Math.round(random() * 6);
			c.fillStyle = `rgb(${shade},${shade},${shade})`;
			for (const at of [x, x + canvas.width]) {
				c.fillRect(at, y, W - JOINT, H - JOINT);
				// The same block in relief, stepped up from the joint to its face.
				for (let k = 0; k <= BEVEL; k++) {
					const height = Math.round(MORTAR + ((FACE - MORTAR) * (k + 1)) / (BEVEL + 1));
					r.fillStyle = `rgb(${height},${height},${height})`;
					r.fillRect(at + k, y + k, W - JOINT - 2 * k, H - JOINT - 2 * k);
				}
			}
		}
	}
	// The blocks' pitted faces: many small holes in the relief, and only a breath of them in the paint.
	for (let i = 0; i < 14000; i++) {
		const x = random() * canvas.width;
		const y = random() * canvas.height;
		const size = 1 + random() * 2.5;
		const depth = 0.04 + random() * 0.1;
		r.fillStyle = `rgba(0,0,0,${depth})`;
		r.fillRect(x, y, size, size);
		c.fillStyle = `rgba(0,0,0,${depth * 0.2})`;
		c.fillRect(x, y, size, size);
	}
	const texture = (from: HTMLCanvasElement, colour: boolean) => {
		const t = new CanvasTexture(from);
		t.wrapS = t.wrapT = RepeatWrapping;
		t.repeat.set(1 / (ACROSS * 0.8), 1 / (ROWS * 0.4));
		t.anisotropy = 8;
		if (colour) t.colorSpace = SRGBColorSpace;
		return t;
	};
	return { map: texture(canvas, true), bump: texture(relief, false) };
}

/**
 * The mat inside the door, lying about its own origin on the floor: a thin rubber backing whose
 * lip shows all round, and on it a slab of tufted pile with its top edge rolled over. Under it
 * all, a soft dark patch on the floor, since the mat is too low for the lamp's shadows to show.
 */
function doormat(width: number, depth: number) {
	const LIP = 0.02; // how far the backing shows beyond the pile
	const BACKING = 0.005; // how thick the backing is
	const TOP = 0.018; // the top of the pile, above the floor
	const ROLL = 0.005; // how far the pile's edge is rolled over
	const SUNK = 0.002; // how far into the backing the pile's slab starts
	const group = new Group();
	/** A rectangle with rounded corners about the origin. */
	const outline = (w: number, h: number, r: number) =>
		new Shape()
			.moveTo(-w / 2 + r, -h / 2)
			.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false)
			.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false)
			.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false)
			.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
	/** Lay something drawn in x and y down on the floor, its bottom at `y`. */
	const lay = (mesh: Mesh, y: number) => {
		mesh.rotation.x = -Math.PI / 2;
		mesh.position.y = y;
		group.add(mesh);
		return mesh;
	};

	const rubber = new MeshStandardMaterial({ color: 0x1c1524, roughness: 0.85 });
	lay(new Mesh(new ExtrudeGeometry(outline(width, depth, 0.03), { depth: BACKING, bevelEnabled: false, curveSegments: 8 }), rubber), 0);

	// The pile. An extruded shape's faces take its own x and y as their texture coordinates, so the
	// textures are placed by those: one copy over the slab, centred. The rolled edge and the sides
	// fall outside it and take the colour of the textures' edges.
	const w = width - 2 * LIP;
	const d = depth - 2 * LIP;
	const pile = matPile(w, d);
	for (const t of [pile.map, pile.bump]) {
		t.repeat.set(1 / w, 1 / d);
		t.offset.set(0.5, 0.5);
	}
	const tufted = new MeshStandardMaterial({ roughness: 1, map: pile.map, bumpMap: pile.bump, bumpScale: 2 });
	const slab = new ExtrudeGeometry(outline(w - 2 * ROLL, d - 2 * ROLL, 0.015 - ROLL), {
		depth: TOP - SUNK - 2 * ROLL,
		curveSegments: 8,
		bevelEnabled: true,
		bevelSize: ROLL,
		bevelThickness: ROLL,
		bevelSegments: 4
	});
	lay(new Mesh(slab, tufted), SUNK + ROLL);

	// The patch on the floor: the mat's outline, blurred, showing as a dark fringe round the backing.
	const FRINGE = 0.05;
	const PX = 200;
	const canvas = document.createElement('canvas');
	canvas.width = Math.round((width + 2 * FRINGE) * PX);
	canvas.height = Math.round((depth + 2 * FRINGE) * PX);
	const c = canvas.getContext('2d')!;
	c.shadowColor = '#000';
	c.shadowBlur = FRINGE * PX * 0.8;
	c.shadowOffsetX = canvas.width * 2; // the rectangle itself is drawn off the picture; only what it casts is on it
	c.fillRect(FRINGE * PX - canvas.width * 2, FRINGE * PX, width * PX, depth * PX);
	const shadow = new MeshBasicMaterial({
		color: 0x000000,
		map: new CanvasTexture(canvas),
		transparent: true,
		opacity: 0.55,
		depthWrite: false,
		polygonOffset: true, // it lies all but on the floor
		polygonOffsetFactor: -1,
		polygonOffsetUnits: -1
	});
	lay(new Mesh(new PlaneGeometry(width + 2 * FRINGE, depth + 2 * FRINGE), shadow), 0.001);

	return group;
}

/**
 * The mat's surface: tufted pile in purple, which is a crowd of short fibres lying every way, each
 * a little lighter or darker than the next, over the shadow between them. Over that, at the mat's
 * own size, what use has done to it: uneven tone, a paler and flatter patch in the middle where
 * feet land, dirt gathered toward the edges, and a little lint. The second texture is the relief:
 * the fibres at their different heights, pressed flatter where the mat is worn. `width` and
 * `depth` are the pile's, and one copy covers it.
 */
function matPile(width: number, depth: number) {
	const PX = 800; // px per unit of mat, so a fibre 3 to 8 px long is 4 to 10 mm
	const W = Math.round(width * PX);
	const H = Math.round(depth * PX);
	// A fixed scatter, so that the mat is the same on every visit.
	let seed = 31;
	const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const sheet = (fill: string) => {
		const canvas = document.createElement('canvas');
		canvas.width = W;
		canvas.height = H;
		const c = canvas.getContext('2d')!;
		c.fillStyle = fill;
		c.fillRect(0, 0, W, H);
		c.lineCap = 'round';
		return { canvas, c };
	};
	const { canvas, c } = sheet('#3a2060'); // down between the fibres
	const { canvas: relief, c: r } = sheet('rgb(80,80,80)');
	/** One fibre, in the paint and (if `height` is given) in the relief. */
	const fibre = (colour: string, thick: number, height?: number) => {
		const x = random() * W;
		const y = random() * H;
		const length = 3 + random() * 5;
		const turn = random() * Math.PI * 2;
		const dx = (Math.cos(turn) * length) / 2;
		const dy = (Math.sin(turn) * length) / 2;
		for (const { ctx, stroke } of [
			{ ctx: c, stroke: colour },
			...(height === undefined ? [] : [{ ctx: r, stroke: `rgb(${height},${height},${height})` }])
		]) {
			ctx.strokeStyle = stroke;
			ctx.lineWidth = thick;
			ctx.beginPath();
			ctx.moveTo(x - dx, y - dy);
			ctx.lineTo(x + dx, y + dy);
			ctx.stroke();
		}
	};
	// The pile: about the mat's colour, 0x4b2b7d, and varied in lightness more than in hue.
	for (let i = 0; i < 36000; i++) {
		const light = 0.78 + random() * 0.5;
		const red = random(); // a few lean toward plum, a few toward blue
		const rgb = [70 + 12 * red, 43, 128 - 10 * red].map((v) => Math.round(v * light));
		fibre(`rgb(${rgb})`, 1.2 + random() * 1.2, Math.round(90 + random() * 150));
	}
	// A few pale fibres, faded or catching the light.
	for (let i = 0; i < 900; i++) fibre(`rgba(150,122,196,${0.25 + random() * 0.3})`, 1, Math.round(190 + random() * 50));

	// Uneven tone: wide, faint patches, some darker and some paler.
	for (let i = 0; i < 14; i++) {
		const x = random() * W;
		const y = random() * H;
		const radius = 80 + random() * 180;
		const strength = 0.05 + random() * 0.07;
		const patch = c.createRadialGradient(x, y, 0, x, y, radius);
		const tone = random() < 0.6 ? '22,10,44' : '168,148,204';
		patch.addColorStop(0, `rgba(${tone},${strength})`);
		patch.addColorStop(1, `rgba(${tone},0)`);
		c.fillStyle = patch;
		c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
	}
	// Where feet land: an oval in the middle, greyed and paler in the paint and pressed flat in the relief.
	for (const [ctx, tone, strength] of [
		[c, '150,134,170', 0.2],
		[r, '125,125,125', 0.55]
	] as const) {
		ctx.save();
		ctx.translate(W / 2, H / 2);
		ctx.scale(W * 0.4, H * 0.38);
		const worn = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
		worn.addColorStop(0, `rgba(${tone},${strength})`);
		worn.addColorStop(0.5, `rgba(${tone},${strength * 0.7})`);
		worn.addColorStop(1, `rgba(${tone},0)`);
		ctx.fillStyle = worn;
		ctx.fillRect(-1, -1, 2, 2);
		ctx.restore();
	}
	// Darker toward the edges, where the dirt is swept to and nothing treads it pale.
	const EDGE = 70;
	for (const [x0, y0, x1, y1] of [
		[0, 0, EDGE, 0],
		[W, 0, W - EDGE, 0],
		[0, 0, 0, EDGE],
		[0, H, 0, H - EDGE]
	]) {
		const shade = c.createLinearGradient(x0, y0, x1, y1);
		shade.addColorStop(0, 'rgba(14,7,28,0.4)');
		shade.addColorStop(1, 'rgba(14,7,28,0)');
		c.fillStyle = shade;
		c.fillRect(0, 0, W, H);
	}
	// Lint and grit, in the paint alone.
	for (let i = 0; i < 260; i++) {
		const size = 1 + random() * 2;
		c.fillStyle = `rgba(${random() < 0.5 ? '205,196,178' : '30,24,20'},${0.2 + random() * 0.3})`;
		c.fillRect(random() * W, random() * H, size, size);
	}

	const texture = (from: HTMLCanvasElement, colour: boolean) => {
		const t = new CanvasTexture(from);
		t.anisotropy = 8;
		if (colour) t.colorSpace = SRGBColorSpace;
		return t;
	};
	return { map: texture(canvas, true), bump: texture(relief, false) };
}

/**
 * The pinboard's surface: cork, which is granules of bark pressed together, so a crowd of small
 * rounded bits in tans and browns over the darker binder between them, with a few dark flecks and
 * pits. That grain is drawn once on a small tile and spread over the board; over it, at the
 * board's own size, go what does not repeat: faint blotches, a darkening toward the frame, and the
 * holes of old pins. The second texture is the relief: the granules at their different heights,
 * the pits and the pin holes sunk. `width` and `height` are the board's, and one copy covers it.
 */
function corkGrain(width: number, height: number) {
	const PX = 600; // px per unit of board, so a granule 2 to 6 px across is 2 to 5 mm
	const TILE = 512;
	// A fixed scatter, so that the board is the same on every visit.
	let seed = 23;
	const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const sheet = (w: number, h: number, fill: string) => {
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const c = canvas.getContext('2d')!;
		c.fillStyle = fill;
		c.fillRect(0, 0, w, h);
		return { canvas, c };
	};

	// --- The grain, on a tile that repeats ---
	const tile = sheet(TILE, TILE, '#ac875c'); // the binder, a shade darker than the granules
	const tileRelief = sheet(TILE, TILE, 'rgb(126,126,126)');
	// Where along one axis to draw a bit so that it carries on across the tile's edge.
	const wrapped = (v: number, r: number) => (v - r < 0 ? [v, v + TILE] : v + r > TILE ? [v, v - TILE] : [v]);
	/** One bit of cork, an ellipse at any angle, in the paint and (if `height` is given) in the relief. */
	const bit = (rx: number, ry: number, colour: string, height?: number) => {
		const x = random() * TILE;
		const y = random() * TILE;
		const turn = random() * Math.PI;
		for (const { c, fill } of [
			{ c: tile.c, fill: colour },
			...(height === undefined ? [] : [{ c: tileRelief.c, fill: `rgb(${height},${height},${height})` }])
		]) {
			c.fillStyle = fill;
			for (const ax of wrapped(x, rx))
				for (const ay of wrapped(y, rx)) {
					c.beginPath();
					c.ellipse(ax, ay, rx, ry, turn, 0, Math.PI * 2);
					c.fill();
				}
		}
	};
	// The granules: fine, and close to one another in shade, since from across a room cork is nearly
	// one colour. Enough to cover about half the tile, so the binder shows between them.
	for (let i = 0; i < 14000; i++) {
		const rx = 1.2 + random() * 1.8;
		const light = 0.92 + random() * 0.16;
		const warm = random();
		const rgb = [185, 138 + 8 * warm, 90 + 10 * warm].map((v) => Math.round(v * light));
		bit(rx, rx * (0.5 + random() * 0.5), `rgba(${rgb},0.8)`, Math.round(118 + random() * 32));
	}
	// Dark flecks of bark, each a small pit.
	for (let i = 0; i < 220; i++) {
		const rx = 1 + random() * 1.5;
		bit(rx, rx * (0.5 + random() * 0.5), `rgba(58,40,24,${0.2 + random() * 0.25})`, Math.round(88 + random() * 24));
	}
	// And a few pale ones, in the paint alone.
	for (let i = 0; i < 120; i++) {
		const rx = 1 + random() * 1.2;
		bit(rx, rx * (0.5 + random() * 0.5), `rgba(198,164,118,${0.15 + random() * 0.2})`);
	}

	// --- The board, at its own size ---
	const W = Math.round(width * PX);
	const H = Math.round(height * PX);
	const { canvas, c } = sheet(W, H, '#000');
	const { canvas: relief, c: r } = sheet(W, H, '#000');
	c.fillStyle = c.createPattern(tile.canvas, 'repeat')!;
	c.fillRect(0, 0, W, H);
	r.fillStyle = r.createPattern(tileRelief.canvas, 'repeat')!;
	r.fillRect(0, 0, W, H);
	// Uneven tone: a few wide, faint patches, some darker and some paler.
	for (let i = 0; i < 16; i++) {
		const x = random() * W;
		const y = random() * H;
		const radius = 120 + random() * 220;
		const strength = 0.02 + random() * 0.03;
		const patch = c.createRadialGradient(x, y, 0, x, y, radius);
		const tone = random() < 0.6 ? '45,28,12' : '225,190,140';
		patch.addColorStop(0, `rgba(${tone},${strength})`);
		patch.addColorStop(1, `rgba(${tone},0)`);
		c.fillStyle = patch;
		c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
	}
	// Darker toward the frame, where the dust settles and the light has not faded it.
	const EDGE = 80;
	for (const [x0, y0, x1, y1] of [
		[0, 0, EDGE, 0],
		[W, 0, W - EDGE, 0],
		[0, 0, 0, EDGE],
		[0, H, 0, H - EDGE]
	]) {
		const shade = c.createLinearGradient(x0, y0, x1, y1);
		shade.addColorStop(0, 'rgba(40,24,10,0.12)');
		shade.addColorStop(1, 'rgba(40,24,10,0)');
		c.fillStyle = shade;
		c.fillRect(0, 0, W, H);
	}
	// The holes of old pins: mostly in clusters, where things have hung before, and a few strays.
	// A pin is under a millimetre thick, so each hole is barely more than a pixel: a soft spot of
	// shadowed cork, not of black, and a dent in the relief for the lamp to find.
	const hole = (x: number, y: number) => {
		const radius = 1.2 + random() * 0.6; // of the whole soft spot; its dark heart is half that
		for (const [ctx, tone, strength] of [
			[c, '74,52,32', 0.5 + random() * 0.2],
			[r, '60,60,60', 0.9]
		] as const) {
			const spot = ctx.createRadialGradient(x, y, 0, x, y, radius);
			spot.addColorStop(0, `rgba(${tone},${strength})`);
			spot.addColorStop(0.4, `rgba(${tone},${strength * 0.6})`);
			spot.addColorStop(1, `rgba(${tone},0)`);
			ctx.fillStyle = spot;
			ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
		}
	};
	for (let i = 0; i < 8; i++) {
		const x = W * (0.08 + random() * 0.84);
		const y = H * (0.08 + random() * 0.6); // pins go in the tops of things
		const count = 3 + Math.floor(random() * 6);
		for (let k = 0; k < count; k++) hole(x + (random() + random() - 1) * 45, y + (random() + random() - 1) * 30);
	}
	for (let i = 0; i < 14; i++) hole(W * (0.04 + random() * 0.92), H * (0.04 + random() * 0.92));

	const texture = (from: HTMLCanvasElement, colour: boolean) => {
		const t = new CanvasTexture(from);
		t.anisotropy = 8;
		if (colour) t.colorSpace = SRGBColorSpace;
		return t;
	};
	return { map: texture(canvas, true), bump: texture(relief, false) };
}

/**
 * The floor's surface: old hardwood boards 0.25 wide running toward the viewer, their ends
 * staggered, in a mid-brown walnut that has seen years of use. Each board has its own shade and its own
 * grain: fine lines along its length, on some the nested arches of a plain-sawn face, and now and
 * then a knot. Over the boards goes the wear, which takes no notice of where one ends: pale
 * patches where the finish has rubbed through, a few stains, scratches, the parallel scuffs of
 * things dragged, and dents. The second texture is the relief: the gaps between boards, the
 * deeper grain, the scratches and the dents sunk. One tile is twelve boards across and six units
 * long; `width` and `depth` are the size of the floor it is spread over.
 */
function floorboards(width: number, depth: number) {
	const BOARDS = 12;
	const LENGTH = 6; // units of floor under one tile
	const PX = 384; // px per unit
	const W = 0.25 * PX; // px per board, across
	const TW = BOARDS * W;
	const L = LENGTH * PX;
	// A fixed scatter, so that the floor is the same on every visit.
	let seed = 11;
	const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const sheet = (fill: string) => {
		const canvas = document.createElement('canvas');
		canvas.width = TW;
		canvas.height = L;
		const c = canvas.getContext('2d')!;
		c.fillStyle = fill;
		c.fillRect(0, 0, TW, L);
		return { canvas, c };
	};
	const { canvas, c } = sheet('#000');
	const { canvas: relief, c: r } = sheet('rgb(128,128,128)');
	const GRAIN = '44,27,15'; // the dark of the grain, and of dirt
	const PALE = '152,126,96'; // bare wood, where the finish is gone

	/** One board, its near end at `y`. */
	const plank = (x: number, y: number, length: number) => {
		for (const ctx of [c, r]) {
			ctx.save();
			ctx.beginPath();
			ctx.rect(x, y, W, length);
			ctx.clip();
		}
		const light = 0.9 + random() * 0.2;
		const warm = random();
		c.fillStyle = `rgb(${[100, 71 + 5 * warm, 47 + 7 * warm].map((v) => Math.round(v * light))})`;
		c.fillRect(x, y, W, length);
		// The grain: lines along the board that wander a little, most darker than the wood, some paler.
		const lines = 26 + Math.floor(random() * 14);
		for (let k = 0; k < lines; k++) {
			const gx = x + random() * W;
			const sway = random() * 3;
			const period = 300 + random() * 500;
			const phase = random() * Math.PI * 2;
			const dark = random() < 0.75;
			const line = new Path2D();
			for (let t = 0; t <= length + 24; t += 24)
				line.lineTo(gx + sway * Math.sin((t / period) * Math.PI * 2 + phase), y + t);
			c.lineWidth = 0.6 + random() * 1.6;
			c.strokeStyle = dark ? `rgba(${GRAIN},${0.06 + random() * 0.14})` : `rgba(${PALE},${0.05 + random() * 0.1})`;
			c.stroke(line);
			// The open pores of the darker lines are low, which is the grain the lamp finds.
			if (dark && random() < 0.4) {
				r.lineWidth = 1;
				r.strokeStyle = 'rgba(96,96,96,0.3)';
				r.stroke(line);
			}
		}
		// On one board in three, the arches of a plain-sawn face.
		if (random() < 0.35) {
			const cx = x + W * (0.3 + random() * 0.4);
			const cy = y + random() * length;
			const step = 5 + random() * 3;
			const stretch = 9 + random() * 8;
			c.lineWidth = 1.2;
			for (let k = 1; k <= 12; k++) {
				c.strokeStyle = `rgba(${GRAIN},${0.08 + random() * 0.1})`;
				c.beginPath();
				c.ellipse(cx, cy, k * step, k * step * stretch, 0, 0, Math.PI * 2);
				c.stroke();
			}
		}
		// Now and then a knot.
		if (random() < 0.15) {
			const kx = x + W * (0.2 + random() * 0.6);
			const ky = y + random() * length;
			const radius = 4 + random() * 4;
			for (const [ctx, tone, strength] of [
				[c, '30,18,10', 0.75],
				[r, '96,96,96', 0.5]
			] as const) {
				const knot = ctx.createRadialGradient(kx, ky, 0, kx, ky, radius * 1.6);
				knot.addColorStop(0, `rgba(${tone},${strength})`);
				knot.addColorStop(0.5, `rgba(${tone},${strength * 0.6})`);
				knot.addColorStop(1, `rgba(${tone},0)`);
				ctx.fillStyle = knot;
				ctx.fillRect(kx - radius * 2, ky - radius * 2, radius * 4, radius * 4);
			}
		}
		// Dirt worked into the edges, darkest at the gap.
		const edges = c.createLinearGradient(x, 0, x + W, 0);
		edges.addColorStop(0, 'rgba(25,15,7,0.14)');
		edges.addColorStop(0.07, 'rgba(25,15,7,0)');
		edges.addColorStop(0.93, 'rgba(25,15,7,0)');
		edges.addColorStop(1, 'rgba(25,15,7,0.1)');
		c.fillStyle = edges;
		c.fillRect(x, y, W, length);
		// The gaps: along one side, and across the end.
		c.fillStyle = 'rgba(18,11,5,0.35)';
		c.fillRect(x, y, 1, length);
		c.fillRect(x, y, W, 1.5);
		r.fillStyle = 'rgb(100,100,100)';
		r.fillRect(x, y, 1, length);
		r.fillRect(x, y, W, 1.5);
		c.restore();
		r.restore();
	};
	for (let i = 0; i < BOARDS; i++) {
		// Three or four boards end to end, the joints falling anywhere.
		let y = -random() * L * 0.3;
		while (y < L) {
			const length = L * (0.2 + random() * 0.25);
			plank(i * W, y, length);
			y += length;
		}
	}

	// --- The wear, which carries on across the tile's edges ---
	/** A soft patch, longer along the boards than across them. */
	const patch = (tone: string, strength: number, radius: number, stretch: number) => {
		const x = random() * TW;
		const y = random() * L;
		for (const dx of [-TW, 0, TW])
			for (const dy of [-L, 0, L]) {
				c.save();
				c.translate(x + dx, y + dy);
				c.scale(1, stretch);
				const fade = c.createRadialGradient(0, 0, 0, 0, 0, radius);
				fade.addColorStop(0, `rgba(${tone},${strength})`);
				fade.addColorStop(0.5, `rgba(${tone},${strength * 0.6})`);
				fade.addColorStop(1, `rgba(${tone},0)`);
				c.fillStyle = fade;
				c.fillRect(-radius, -radius, radius * 2, radius * 2);
				c.restore();
			}
	};
	// Where feet have rubbed the finish through to paler, greyer wood.
	for (let i = 0; i < 44; i++) patch('136,114,90', 0.1 + random() * 0.16, 50 + random() * 130, 1.5 + random() * 3);
	// And where something was spilt, or stood for years.
	for (let i = 0; i < 12; i++) patch('33,21,12', 0.06 + random() * 0.08, 40 + random() * 90, 1 + random() * 1.5);

	/** One straight scratch from a point, in the paint and (if `deep`) in the relief. */
	const scratch = (x: number, y: number, angle: number, length: number, pale: boolean, deep: boolean) => {
		const x1 = x + Math.cos(angle) * length;
		const y1 = y + Math.sin(angle) * length;
		const thick = 0.5 + random() * 0.6;
		const colour = pale ? `rgba(${PALE},${0.09 + random() * 0.16})` : `rgba(${GRAIN},${0.1 + random() * 0.15})`;
		for (const dx of [-TW, 0, TW])
			for (const dy of [-L, 0, L])
				for (const [ctx, style] of [[c, colour], ...(deep ? ([[r, 'rgba(100,100,100,0.3)']] as const) : [])] as const) {
					ctx.lineWidth = thick;
					ctx.strokeStyle = style;
					ctx.beginPath();
					ctx.moveTo(x + dx, y + dy);
					ctx.lineTo(x1 + dx, y1 + dy);
					ctx.stroke();
				}
	};
	// Scratches at every angle, most of them short and pale.
	for (let i = 0; i < 320; i++)
		scratch(random() * TW, random() * L, random() * Math.PI, 12 + random() * random() * 260, random() < 0.7, random() < 0.35);
	// Scuffs: a handful of scratches side by side, where a chair or a case was dragged.
	for (let i = 0; i < 16; i++) {
		const x = random() * TW;
		const y = random() * L;
		const angle = random() * Math.PI;
		const length = 40 + random() * 160;
		const count = 3 + Math.floor(random() * 6);
		for (let k = 0; k < count; k++) {
			const aside = (k - count / 2) * (2 + random() * 3);
			scratch(
				x - Math.sin(angle) * aside + (random() - 0.5) * 20,
				y + Math.cos(angle) * aside + (random() - 0.5) * 20,
				angle + (random() - 0.5) * 0.04,
				length * (0.6 + random() * 0.4),
				true,
				random() < 0.3
			);
		}
	}
	// Dents, from whatever has been dropped: each a small dark spot, and a hollow in the relief.
	for (let i = 0; i < 150; i++) {
		const x = random() * TW;
		const y = random() * L;
		const radius = 1.5 + random() * 3;
		for (const [ctx, tone, strength] of [
			[c, '30,20,12', 0.25 + random() * 0.3],
			[r, '64,64,64', 0.8]
		] as const) {
			const spot = ctx.createRadialGradient(x, y, 0, x, y, radius);
			spot.addColorStop(0, `rgba(${tone},${strength})`);
			spot.addColorStop(0.5, `rgba(${tone},${strength * 0.6})`);
			spot.addColorStop(1, `rgba(${tone},0)`);
			ctx.fillStyle = spot;
			ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
		}
	}

	const texture = (from: HTMLCanvasElement, colour: boolean) => {
		const t = new CanvasTexture(from);
		t.wrapS = t.wrapT = RepeatWrapping;
		t.repeat.set(width / (BOARDS * 0.25), depth / LENGTH);
		t.anisotropy = 8;
		if (colour) t.colorSpace = SRGBColorSpace;
		return t;
	};
	return { map: texture(canvas, true), bump: texture(relief, false) };
}
