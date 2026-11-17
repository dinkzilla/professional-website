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
	BoxGeometry,
	CapsuleGeometry,
	CanvasTexture,
	CircleGeometry,
	Color,
	ConeGeometry,
	CatmullRomCurve3,
	CylinderGeometry,
	DoubleSide,
	Float32BufferAttribute,
	Group,
	IcosahedronGeometry,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	PointLight,
	RepeatWrapping,
	Shape,
	ShapeGeometry,
	SphereGeometry,
	SRGBColorSpace,
	TorusGeometry,
	Vector3,
	Path,
	type Material
} from 'three';
import { AMP, AMP_JACK, braided, HOOK, PINBOARD } from './items.ts';

const FAR = 30; // how far the walls and floor run on, out of sight
const CORNER = 3.5; // x of the wall that comes toward the viewer; far enough for the bench to clear the door
const DOOR = { left: 1.3, right: 2.7 };
const DOOR_OPEN = (110 * Math.PI) / 180; // swung outward, hinged on the right
// Along z, and above the floor. It runs on toward the viewer well past the edge of any screen.
const WINDOW = { near: 5.2, far: 0.3, sill: 1.3, top: 2.6 };
const SHORE = -2.6; // z where the yard ends and the lake begins
const HORIZON = -150;

export function buildRoom(rackHeight: number) {
	const group = new Group();
	const doorHeight = rackHeight - 0.05; // low enough that its top is in view

	const blocks = cinderBlocks();
	const wall = new MeshStandardMaterial({
		color: 0xa9acaf, // a touch cool, to come out off-white under the warm lamp
		roughness: 1,
		map: blocks.map,
		bumpMap: blocks.bump,
		bumpScale: 0.04
	});
	const boards = new MeshStandardMaterial({ color: 0x5a3f2b, roughness: 0.8, map: floorboards(FAR + CORNER, FAR) });
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
	const mat = new MeshStandardMaterial({ color: 0x4b2b7d, roughness: 1 });
	box(DOOR.right - DOOR.left - 0.1, 0.03, 0.85, mat, (DOOR.left + DOOR.right) / 2, 0.015, 0.58);

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
	for (const x of [DOOR.left - FRAME / 2, DOOR.right + FRAME / 2]) {
		box(FRAME, doorHeight + FRAME, REVEAL, trim, x, (doorHeight + FRAME) / 2, -REVEAL / 2 + 0.02);
	}
	box(doorWidth, FRAME, REVEAL, trim, (DOOR.left + DOOR.right) / 2, doorHeight + FRAME / 2, -REVEAL / 2 + 0.02);

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

	// The board the fliers are pinned to (the fliers themselves are in items.ts, since they can be
	// taken down): cork in a frame.
	const cork = new MeshStandardMaterial({ color: 0x8f6f4b, roughness: 1 });
	const boardW = PINBOARD.right - PINBOARD.left;
	const boardH = PINBOARD.top - PINBOARD.bottom;
	const boardX = (PINBOARD.left + PINBOARD.right) / 2;
	// Hung with its top level with the top of the door's opening.
	const lift = doorHeight - PINBOARD.top;
	const boardY = (PINBOARD.top + PINBOARD.bottom) / 2 + lift;
	const board = box(boardW, boardH, 0.03, cork, boardX, boardY, 0.015);
	board.receiveShadow = true;
	for (const x of [PINBOARD.left, PINBOARD.right]) box(0.05, boardH + 0.05, 0.05, trim, x, boardY, 0.025);
	for (const y of [PINBOARD.bottom, PINBOARD.top]) box(boardW + 0.05, 0.05, 0.05, trim, boardX, y + lift, 0.025);

	// The hooks by the door: three pegs with lips, on a rail. The tie hangs on the middle one (the
	// tie is in items.ts); the other two are empty.
	const SPACING = 0.13;
	box(2 * SPACING + 0.1, 0.09, 0.012, iron, HOOK.x, HOOK.y - 0.03, 0.006);
	for (const side of [-1, 0, 1]) {
		const x = HOOK.x + side * SPACING;
		const peg = new Mesh(new CylinderGeometry(0.012, 0.012, 0.08, 10), iron);
		peg.rotation.x = Math.PI / 2;
		add(peg, x, HOOK.y - 0.03, 0.04);
		box(0.024, 0.04, 0.012, iron, x, HOOK.y - 0.015, 0.08);
	}

	// Under the window, a backless bench for putting shoes on: a wooden frame with a padded top.
	// Its end nearer the door is toward the back wall.
	// It starts a little way out from the corner, which the fishing rod stands in.
	const BENCH = { from: 0.5, to: 2.9, d: 0.6, seat: 0.8, pad: 0.12, gap: 0.02 };
	const benchFront = CORNER - BENCH.gap - BENCH.d;
	const benchX = benchFront + BENCH.d / 2;
	const benchZ = (BENCH.from + BENCH.to) / 2;
	const benchTop = BENCH.seat + BENCH.pad;
	const padding = new MeshStandardMaterial({ color: 0xb3a589, roughness: 1 });
	for (const x of [benchFront + 0.04, benchFront + BENCH.d - 0.04]) {
		for (const z of [BENCH.from + 0.04, BENCH.to - 0.04]) box(0.07, BENCH.seat - 0.1, 0.07, trim, x, (BENCH.seat - 0.1) / 2, z);
	}
	box(BENCH.d, 0.1, BENCH.to - BENCH.from, trim, benchX, BENCH.seat - 0.05, benchZ);
	box(BENCH.d - 0.03, BENCH.pad, BENCH.to - BENCH.from - 0.03, padding, benchX, BENCH.seat + BENCH.pad / 2, benchZ);

	// A climbing rope, coiled and slung over the bench at the door end, above the helmet: each turn of the coil lies
	// across the pad and hangs down the front, no two quite alike.
	const ROPE = { z: BENCH.from + 0.3, r: 0.02 };
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

	// A full-face motorcycle helmet on the floor under the bench, below the rope, facing into the room and a little toward the
	// viewer: a shell, cut off flat underneath, with a dark visor across the front.
	const helmet = new Group();
	const HELMET = 0.27;
	const lid = new Mesh(
		new SphereGeometry(HELMET, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.8),
		new MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.35 })
	);
	lid.scale.set(1.1, 1, 0.94);
	const visor = new Mesh(
		new SphereGeometry(HELMET * 1.02, 24, 8, -Math.PI / 3, (Math.PI * 2) / 3, Math.PI * 0.36, Math.PI * 0.2),
		new MeshStandardMaterial({ color: 0x0e1216, roughness: 0.15 })
	);
	visor.scale.copy(lid.scale);
	helmet.add(lid, visor);
	helmet.position.set(benchFront + 0.35, -HELMET * Math.cos(Math.PI * 0.8), ROPE.z);
	helmet.rotation.y = 0.55;
	group.add(helmet);

	// A second cat, asleep on the bench next to the rope: grey and white and a little fat, flat out on his side with
	// his belly toward the room and his legs anywhere. Built lying along x with his head at +x and
	// his belly toward +z, then turned so that the belly faces the room, and mirrored end for end
	// so that his head is toward the rope.
	const fur = new MeshStandardMaterial({ color: 0x8b8e94, roughness: 0.95 });
	const snow = new MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.95 });
	const cat = new Group();
	const blob = (r: number, material: Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
		const m = new Mesh(new SphereGeometry(r, 24, 16), material);
		m.position.set(x, y, z);
		m.scale.set(sx, sy, sz);
		cat.add(m);
	};
	/** A leg or tail from this point, this long, pointing this way. */
	const limb = (r: number, length: number, material: Material, from: Vector3, toward: Vector3) => {
		const m = new Mesh(new CapsuleGeometry(r, length, 4, 10), material);
		const way = toward.clone().normalize();
		m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), way);
		m.position.copy(from).addScaledVector(way, length / 2);
		cat.add(m);
	};
	blob(0.2, fur, 0, 0.2, -0.03, 1.9, 1, 1.15); // his back and sides
	blob(0.19, snow, -0.02, 0.19, 0.06, 1.65, 0.92, 1.1); // the belly, which is most of him
	blob(0.13, fur, 0.43, 0.14, 0.03); // head, on the floor
	blob(0.075, snow, 0.47, 0.12, 0.11, 1, 0.8, 1); // muzzle and chin
	for (const [x, y] of [
		[0.5, 0.25],
		[0.4, 0.27]
	]) {
		const ear = new Mesh(new ConeGeometry(0.045, 0.09, 4), fur);
		ear.position.set(x, y, 0);
		cat.add(ear);
	}
	limb(0.035, 0.2, snow, new Vector3(0.24, 0.24, 0.16), new Vector3(0.5, 0.7, 0.6)); // front legs
	limb(0.035, 0.22, snow, new Vector3(0.26, 0.07, 0.16), new Vector3(0.6, 0, 0.8));
	limb(0.04, 0.22, snow, new Vector3(-0.24, 0.26, 0.16), new Vector3(-0.4, 0.75, 0.55)); // hind legs
	limb(0.04, 0.24, fur, new Vector3(-0.28, 0.07, 0.14), new Vector3(-0.7, 0, 0.7));
	limb(0.03, 0.34, fur, new Vector3(-0.36, 0.05, -0.06), new Vector3(-0.9, 0, 0.35)); // tail
	// Built oversize; this brings his head to a little more than the size of the other cat's.
	cat.scale.set(-0.65, 0.65, 0.65);
	cat.position.set(benchX + 0.04, benchTop, ROPE.z + 0.58);
	cat.rotation.y = -Math.PI / 2 + 0.2;
	group.add(cat);

	// A fly rod stood in the corner, leaning into it, its tip far above the top of the view: a
	// cork grip with the reel under it, and a long thin blank with line guides along it. Built
	// upright from its butt, then leant.
	const rod = new Group();
	const ROD = 5.4;
	const along = (m: Mesh, y: number, x = 0) => {
		m.position.set(x, y, 0);
		rod.add(m);
		return m;
	};
	const blank = new MeshStandardMaterial({ color: 0x2c4a3a, roughness: 0.4 });
	const grip = new MeshStandardMaterial({ color: 0xc8a273, roughness: 1 }); // cork
	const alloy = new MeshStandardMaterial({ color: 0x9b9ea3, roughness: 0.35 });
	const flyLine = new MeshStandardMaterial({ color: 0xc6de38, roughness: 0.8 });
	along(new Mesh(new CylinderGeometry(0.022, 0.022, 0.2, 12), iron), 0.1); // the reel seat
	along(new Mesh(new CylinderGeometry(0.026, 0.032, 0.36, 14), grip), 0.38);
	along(new Mesh(new CylinderGeometry(0.004, 0.013, ROD - 0.56, 8), blank), 0.56 + (ROD - 0.56) / 2);
	// The reel, hanging under the seat, with the line wound on it.
	along(new Mesh(new CylinderGeometry(0.09, 0.09, 0.05, 28), alloy), 0.11, -0.1).rotation.x = Math.PI / 2;
	along(new Mesh(new CylinderGeometry(0.07, 0.07, 0.056, 28), flyLine), 0.11, -0.1).rotation.x = Math.PI / 2;
	for (let y = 1.1; y < ROD; y += 0.75) {
		along(new Mesh(new TorusGeometry(0.018, 0.004, 6, 14), alloy), y, -0.026).rotation.x = Math.PI / 2;
	}
	const butt = new Vector3(CORNER - 0.46, 0, 0.14); // out from the corner, clear of the bench's leg
	const tip = new Vector3(CORNER - 0.05, ROD * 0.998, 0.05);
	rod.position.copy(butt);
	rod.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), tip.sub(butt).normalize());
	group.add(rod);

	// Daylight from the window, falling on the bench and the corner. It dims with the room.
	const DAYLIGHT = 2.2;
	const daylight = new PointLight(0xe4ecf2, DAYLIGHT, 4.5, 1.6);
	daylight.position.set(CORNER - 0.7, 2.2, 1.3);
	group.add(daylight);

	// The amp under the board: a combo, with its controls along the top of its front and the
	// speaker cloth below them. The cable in its input is the cassette player's (see items.ts).
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
	const leaf = flat(0x4f3220);
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
	const DOME = { x: 78, z: HORIZON + 9, r: 3.5 };
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
	const farDeck = new Mesh(new BoxGeometry(9, 0.22, 1.2), plank);
	farDeck.position.set(-4.5, 0.25, 0);
	farDock.add(farDeck);
	// The dome's door, standing on the deck at the end of the dock, against the shell behind it.
	const farDoor = new Mesh(new BoxGeometry(0.7, 1.2, 0.2), pile);
	farDoor.position.set(-0.35, 0.36 + 0.6, -0.7);
	farDock.add(farDoor);
	for (let along = 1; along <= 9; along += 2) {
		const post = new Mesh(new BoxGeometry(0.2, 1.1, 0.2), pile);
		post.position.set(-along, 0.2, 0.6);
		farDock.add(post);
	}
	group.add(farDock);

	// The dock, running out from the yard, turned a little toward the line of sight through the
	// door so that it reads as going out into the lake and not along the shore.
	const DOCK = { x: 3.2, z: -2.2, length: 3.8, w: 0.7, turn: -0.26 };
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

	// The door itself, swung out into the yard.
	const hinge = new Group();
	// Hinged on the outside of the frame, clear of it, so that the open door does not pass
	// through the jamb.
	hinge.position.set(DOOR.right + 0.01, 0, -(REVEAL - 0.02) - 0.045);
	hinge.rotation.y = -DOOR_OPEN;
	// A glass door: one sheet in a border of the same wood as the rest of the woodwork, but out
	// in the daylight. The pieces are laid out from the hinge, which is at x = 0.
	const STILE = 0.2;
	const piece = (w: number, h: number, x: number, y: number) => {
		const m = new Mesh(new BoxGeometry(w, h, 0.06), leaf);
		m.position.set(x, y, 0);
		hinge.add(m);
	};
	piece(STILE, doorHeight, -STILE / 2, doorHeight / 2);
	piece(STILE, doorHeight, -doorWidth + STILE / 2, doorHeight / 2);
	piece(doorWidth - 2 * STILE, STILE, -doorWidth / 2, STILE / 2);
	piece(doorWidth - 2 * STILE, STILE, -doorWidth / 2, doorHeight - STILE / 2);
	const glass = flat(0xe6f1f5);
	glass.transparent = true;
	glass.opacity = 0.18;
	glass.side = DoubleSide;
	const pane = new Mesh(new PlaneGeometry(doorWidth - 2 * STILE, doorHeight - 2 * STILE), glass);
	pane.position.set(-doorWidth / 2, doorHeight / 2, 0);
	hinge.add(pane);
	// A black lever handle on each face: a plate on the stile, a stub out from it, and the lever
	// pointing back toward the hinge.
	const black = flat(0x141416);
	const handleX = -doorWidth + STILE / 2;
	const handleY = doorHeight * 0.44;
	for (const face of [-1, 1]) {
		const part = (w: number, h: number, d: number, x: number, y: number, z: number) => {
			const m = new Mesh(new BoxGeometry(w, h, d), black);
			m.position.set(x, y, face * z);
			hinge.add(m);
		};
		part(0.07, 0.26, 0.012, handleX, handleY, 0.036);
		part(0.03, 0.03, 0.06, handleX, handleY + 0.05, 0.066);
		part(0.2, 0.03, 0.025, handleX + 0.085, handleY + 0.05, 0.09);
	}
	group.add(hinge);

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

	return {
		group,
		/** The board the fliers are on: a press on it takes one of them down. */
		board,
		/** How far the board was moved up from where PINBOARD has it, and so what is pinned to it. */
		lift,
		/** Darken the daylight outside by this share, as the room's lights are when something is held. */
		dim(share: number) {
			for (const { material, colour } of outdoors) material.color.copy(colour).multiplyScalar(1 - share);
			daylight.intensity = DAYLIGHT * (1 - share);
		}
	};
}

/**
 * The walls' surface: painted cinder blocks, 0.8 by 0.4 (40 cm by 20), each row half a block along
 * from the one below. One tile is four blocks by four rows, each block its own shade, and it
 * repeats by the walls' own coordinates, which are their texture coordinates. The second texture
 * is the same picture read as relief, which sinks the mortar.
 */
function cinderBlocks() {
	const ACROSS = 4;
	const ROWS = 4;
	const W = 256; // px per block
	const H = 128;
	const JOINT = 3;
	const canvas = document.createElement('canvas');
	canvas.width = ACROSS * W;
	canvas.height = ROWS * H;
	const c = canvas.getContext('2d')!;
	c.fillStyle = '#e2e2e2'; // the mortar, barely darker than the blocks
	c.fillRect(0, 0, canvas.width, canvas.height);
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
			for (const at of [x, x + canvas.width]) c.fillRect(at, y, W - JOINT, H - JOINT);
		}
	}
	// The blocks' pitted faces.
	for (let i = 0; i < 5000; i++) {
		c.fillStyle = `rgba(0,0,0,${0.02 + random() * 0.04})`;
		c.fillRect(random() * canvas.width, random() * canvas.height, 2 + random() * 3, 2 + random() * 3);
	}
	const texture = (colour: boolean) => {
		const t = new CanvasTexture(canvas);
		t.wrapS = t.wrapT = RepeatWrapping;
		t.repeat.set(1 / (ACROSS * 0.8), 1 / (ROWS * 0.4));
		t.anisotropy = 8;
		if (colour) t.colorSpace = SRGBColorSpace;
		return t;
	};
	return { map: texture(true), bump: texture(false) };
}

/**
 * The floor's surface: hardwood boards 0.25 wide running toward the viewer, their ends staggered,
 * each a slightly different shade. One tile is eight boards across and four units long; `width`
 * and `depth` are the size of the floor it is spread over.
 */
function floorboards(width: number, depth: number) {
	const BOARDS = 8;
	const W = 64; // px per board, across
	const L = 1024; // px for the tile's length
	const canvas = document.createElement('canvas');
	canvas.width = BOARDS * W;
	canvas.height = L;
	const c = canvas.getContext('2d')!;
	let seed = 11;
	const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	for (let i = 0; i < BOARDS; i++) {
		// Two or three boards end to end, the joints falling anywhere.
		let y = -random() * L * 0.5;
		while (y < L) {
			const length = L * (0.3 + random() * 0.35);
			const shade = 205 + Math.round(random() * 40);
			c.fillStyle = `rgb(${shade},${shade - 6},${shade - 14})`;
			c.fillRect(i * W, y, W, length);
			c.fillStyle = 'rgba(0,0,0,0.3)';
			c.fillRect(i * W, y, W, 2);
			y += length;
		}
		c.fillStyle = 'rgba(0,0,0,0.3)';
		c.fillRect(i * W, 0, 2, L);
	}
	const texture = new CanvasTexture(canvas);
	texture.wrapS = texture.wrapT = RepeatWrapping;
	texture.repeat.set(width / (BOARDS * 0.25), depth / 4);
	texture.anisotropy = 8;
	texture.colorSpace = SRGBColorSpace;
	return texture;
}
