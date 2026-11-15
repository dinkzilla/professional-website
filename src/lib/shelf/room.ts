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
	CircleGeometry,
	Color,
	CylinderGeometry,
	Float32BufferAttribute,
	Group,
	IcosahedronGeometry,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	Shape,
	ShapeGeometry,
	SphereGeometry,
	Path,
	type Material
} from 'three';
import { AMP, AMP_JACK, HOOK, PINBOARD } from './items.ts';

const FAR = 30; // how far the walls and floor run on, out of sight
const CORNER = 3.2; // x of the wall that comes toward the viewer
const DOOR = { left: 1.3, right: 2.7 };
const DOOR_OPEN = (110 * Math.PI) / 180; // swung outward, hinged on the right
const WINDOW = { near: 1.65, far: 0.4, sill: 1.3, top: 2.6 }; // along z, and above the floor
const SHORE = -2.6; // z where the yard ends and the lake begins
const HORIZON = -150;

export function buildRoom(rackHeight: number) {
	const group = new Group();
	const doorHeight = rackHeight - 0.05; // low enough that its top is in view

	const wall = new MeshStandardMaterial({ color: 0x2b2a2d, roughness: 1 });
	const trim = new MeshStandardMaterial({ color: 0x47454a, roughness: 0.8 });

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

	const floor = ground(-FAR, CORNER, 0, FAR, 0, wall);
	floor.receiveShadow = true;

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
	// Glazing bars: one upright, one across.
	box(0.03, windowHeight, 0.03, trim, CORNER + 0.05, windowY, windowZ);
	box(0.03, 0.03, windowWidth, trim, CORNER + 0.05, windowY, windowZ);

	// The board the fliers are pinned to (the fliers themselves are in items.ts, since they can be
	// taken down): cork in a frame.
	const cork = new MeshStandardMaterial({ color: 0x8f6f4b, roughness: 1 });
	const boardW = PINBOARD.right - PINBOARD.left;
	const boardH = PINBOARD.top - PINBOARD.bottom;
	const boardX = (PINBOARD.left + PINBOARD.right) / 2;
	const boardY = (PINBOARD.top + PINBOARD.bottom) / 2;
	const board = box(boardW, boardH, 0.03, cork, boardX, boardY, 0.015);
	board.receiveShadow = true;
	for (const x of [PINBOARD.left, PINBOARD.right]) box(0.05, boardH + 0.05, 0.05, trim, x, boardY, 0.025);
	for (const y of [PINBOARD.bottom, PINBOARD.top]) box(boardW + 0.05, 0.05, 0.05, trim, boardX, y, 0.025);

	// The hooks by the door: three pegs with lips, on a rail. The tie hangs on the middle one (the
	// tie is in items.ts); the other two are empty.
	const SPACING = 0.13;
	box(2 * SPACING + 0.1, 0.09, 0.012, trim, HOOK.x, HOOK.y - 0.03, 0.006);
	for (const side of [-1, 0, 1]) {
		const x = HOOK.x + side * SPACING;
		const peg = new Mesh(new CylinderGeometry(0.012, 0.012, 0.08, 10), trim);
		peg.rotation.x = Math.PI / 2;
		add(peg, x, HOOK.y - 0.03, 0.04);
		box(0.024, 0.04, 0.012, trim, x, HOOK.y - 0.015, 0.08);
	}

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
	const jack = new Mesh(new CylinderGeometry(0.022, 0.022, 0.012, 16), tolex);
	jack.rotation.x = Math.PI / 2;
	add(jack, AMP_JACK.x, AMP_JACK.y, front + 0.012);
	box(0.4, 0.03, 0.06, tolex, AMP.x, AMP.h + 0.015, AMP.gap + AMP.d / 2); // the handle

	// --- Outdoors ---------------------------------------------------------------------------

	const sky = flat(0xbcd3e2);
	const water = flat(0x6c9bb3);
	const grass = flat(0x86a560);
	const shore = flat(0x64846e);
	const hill = flat(0x7d9a8c);
	const plank = flat(0x9a7a56);
	const pile = flat(0x5f4a36);
	const leaf = flat(0xb7b0a2);
	const bark = flat(0x6f5a44);
	const greens = [flat(0x8fb56a), flat(0x6f9d5c), flat(0xa9c47a)];
	const thicket = flat(0x5c8554);

	add(new Mesh(new PlaneGeometry(800, 300), sky), 0, 140, HORIZON);
	ground(-300, 400, SHORE, HORIZON, -0.25, water);
	ground(-FAR, 60, 0.5, SHORE, -0.03, grass);

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
	box(0.9, 1.5, 0.2, pile, DOME.x - 0.6, 0.5, DOME.z + DOME.r - 0.25); // its door
	const farDock = new Group();
	farDock.position.set(DOME.x - 2.5, 0, DOME.z + DOME.r);
	farDock.rotation.y = -0.5;
	const farDeck = new Mesh(new BoxGeometry(9, 0.22, 1.2), plank);
	farDeck.position.set(-4.5, 0.25, 0);
	farDock.add(farDeck);
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
	hinge.position.set(DOOR.right, 0, -0.04);
	hinge.rotation.y = -DOOR_OPEN;
	const panel = new Mesh(new BoxGeometry(doorWidth, doorHeight, 0.06), leaf);
	panel.position.set(-doorWidth / 2, doorHeight / 2, 0);
	const knob = new Mesh(new SphereGeometry(0.045, 12, 8), pile);
	knob.position.set(-doorWidth + 0.12, doorHeight * 0.45, 0.06);
	hinge.add(panel, knob);
	group.add(hinge);

	// The wood outside the window: a few trees close by, with thicker growth behind them.
	const thick = new Mesh(new PlaneGeometry(4.2, 8), thicket);
	thick.rotation.y = -Math.PI / 2;
	add(thick, CORNER + 2.3, 4, -1.5);
	for (const [x, z, h, r] of [
		[3.95, 0.35, 2.3, 0.5],
		[4.35, -0.55, 2.7, 0.6],
		[4.75, 0.05, 2.1, 0.45],
		[4.9, -1.2, 2.9, 0.65],
		[4.45, -1.65, 2.4, 0.5],
		[5.15, -2.1, 2.6, 0.6]
	]) {
		add(new Mesh(new CylinderGeometry(0.05, 0.07, h, 8), bark), x, h / 2, z);
		const n = Math.round(x * 7 + z * 3); // any fixed number, to vary the trees
		add(new Mesh(new IcosahedronGeometry(r, 1), greens[Math.abs(n) % 3]), x, h, z);
		add(new Mesh(new IcosahedronGeometry(r * 0.7, 1), greens[Math.abs(n + 1) % 3]), x - 0.15, h + r * 0.6, z + 0.2);
	}

	return {
		group,
		/** The board the fliers are on: a press on it takes one of them down. */
		board,
		/** Darken the daylight outside by this share, as the room's lights are when something is held. */
		dim(share: number) {
			for (const { material, colour } of outdoors) material.color.copy(colour).multiplyScalar(1 - share);
		}
	};
}
