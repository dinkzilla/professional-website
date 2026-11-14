// Grey-box stand-ins for the objects on the shelf: each is a few primitives at roughly the
// real thing's proportions, to be replaced by a proper model later. A builder returns a group
// whose origin is the centre of its base, so it can be set straight down on a shelf.

import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	TorusGeometry,
	type BufferGeometry,
	type Material
} from 'three';
import { catalogue, type Entry } from './catalogue.ts';

interface Placement {
	id: string;
	/** Which shelf it sits on, counting from the top, and where along it (0 is the middle). */
	shelf: number;
	x: number;
	/** How far back from the front edge its base centre sits, as a share of the shelf depth. */
	back?: number;
	/** Turned this far (radians) about the vertical while on the shelf. */
	yaw?: number;
	/** Its attitude once picked up: pitch (tipped toward the viewer) and yaw, in radians. */
	held?: { pitch?: number; yaw?: number };
	build: () => Group;
}

export type Item = Entry & Placement;

const light = new MeshStandardMaterial({ color: 0xbdbcb6, roughness: 0.85 });
const mid = new MeshStandardMaterial({ color: 0x77767a, roughness: 0.8 });
const dark = new MeshStandardMaterial({ color: 0x232326, roughness: 0.6 });
const hat = new MeshStandardMaterial({ color: 0xd9a400, roughness: 0.55 });
const screen = new MeshStandardMaterial({
	color: 0x101418,
	roughness: 0.3,
	emissive: 0x2a3d4a,
	emissiveIntensity: 0.6
});

function mesh(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0) {
	const m = new Mesh(geometry, material);
	m.position.set(x, y, z);
	m.castShadow = true;
	m.receiveShadow = true;
	return m;
}

function box(w: number, h: number, d: number, material: Material, x = 0, y = 0, z = 0) {
	return mesh(new BoxGeometry(w, h, d), material, x, y + h / 2, z);
}

function disc(r: number, h: number, material: Material, x = 0, y = 0, z = 0) {
	return mesh(new CylinderGeometry(r, r, h, 48), material, x, y + h / 2, z);
}

function turntable() {
	const g = new Group();
	g.add(box(0.86, 0.09, 0.64, mid));
	g.add(disc(0.28, 0.025, light, -0.1, 0.09));
	g.add(disc(0.27, 0.008, dark, -0.1, 0.115)); // the record
	g.add(disc(0.09, 0.004, hat, -0.1, 0.123)); // its label
	g.add(disc(0.035, 0.07, light, 0.32, 0.09, -0.2)); // tonearm pivot
	const arm = box(0.018, 0.018, 0.42, light, 0.3, 0.14, 0.0);
	arm.rotation.y = 0.32;
	g.add(arm);
	return g;
}

function sleeve() {
	const g = new Group();
	const s = box(0.62, 0.62, 0.012, light);
	// Leaning back against the wall.
	s.rotation.x = -0.2;
	s.position.z += 0.06;
	g.add(s);
	return g;
}

function headphones() {
	const g = new Group();
	const band = mesh(new TorusGeometry(0.17, 0.016, 12, 40, Math.PI), dark, 0, 0.2, 0);
	g.add(band);
	for (const side of [-1, 1]) {
		const cup = mesh(new CylinderGeometry(0.085, 0.085, 0.06, 32), mid, side * 0.17, 0.12, 0);
		cup.rotation.z = Math.PI / 2;
		g.add(cup);
	}
	return g;
}

function gameBox() {
	const g = new Group();
	g.add(box(0.62, 0.11, 0.44, mid));
	// The lid, a touch bigger and sitting slightly askew.
	const lid = box(0.64, 0.07, 0.46, light, 0, 0.09);
	lid.rotation.y = 0.06;
	g.add(lid);
	return g;
}

function hardhat() {
	const g = new Group();
	const dome = mesh(
		new SphereGeometry(0.27, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
		hat,
		0,
		0.03,
		0
	);
	dome.scale.set(1, 0.85, 1.15);
	g.add(dome);
	const brim = disc(0.3, 0.03, hat);
	brim.scale.set(1, 1, 1.25);
	brim.position.z = 0.04;
	g.add(brim);
	g.add(box(0.05, 0.035, 0.56, hat, 0, 0.235, 0)); // the ridge over the top
	return g;
}

function flipPhone() {
	const g = new Group();
	g.add(box(0.2, 0.04, 0.34, mid, 0, 0, 0.08));
	for (let row = 0; row < 4; row++) {
		for (let col = -1; col <= 1; col++) {
			g.add(box(0.04, 0.008, 0.04, light, col * 0.055, 0.04, 0.0 + row * 0.055));
		}
	}
	// The lid stands up from the hinge at the back, leaning a little further open.
	const lid = new Group();
	lid.position.set(0, 0.03, -0.09);
	lid.rotation.x = -0.25;
	lid.add(box(0.2, 0.34, 0.03, mid));
	lid.add(box(0.15, 0.2, 0.004, screen, 0, 0.09, 0.016));
	g.add(lid);
	return g;
}

function videoModule() {
	const g = new Group();
	// The front panel, standing on its bottom edge, with the circuit board behind it.
	g.add(box(0.34, 0.78, 0.018, light));
	g.add(box(0.012, 0.66, 0.36, dark, 0.06, 0.06, -0.19));
	for (const [x, y] of [
		[-0.08, 0.62],
		[0.08, 0.62],
		[-0.08, 0.44],
		[0.08, 0.44]
	]) {
		const knob = mesh(new CylinderGeometry(0.045, 0.05, 0.05, 24), dark, x, y, 0.034);
		knob.rotation.x = Math.PI / 2;
		g.add(knob);
	}
	for (let i = 0; i < 6; i++) {
		const jack = mesh(
			new CylinderGeometry(0.022, 0.022, 0.02, 16),
			mid,
			-0.09 + (i % 3) * 0.09,
			0.12 + Math.floor(i / 3) * 0.12,
			0.019
		);
		jack.rotation.x = Math.PI / 2;
		g.add(jack);
	}
	// A few lumps on the board so it reads as populated.
	g.add(box(0.03, 0.12, 0.12, mid, 0.08, 0.4, -0.2));
	g.add(box(0.03, 0.08, 0.08, mid, 0.08, 0.18, -0.28));
	return g;
}

function monitor() {
	const g = new Group();
	g.add(box(0.66, 0.54, 0.56, mid));
	g.add(box(0.5, 0.38, 0.01, screen, 0, 0.1, 0.281));
	g.add(disc(0.02, 0.012, dark, 0.27, 0.04, 0.29));
	return g;
}

function book() {
	const g = new Group();
	g.add(box(0.44, 0.07, 0.6, light));
	g.add(box(0.03, 0.074, 0.18, hat, 0.12, -0.002, 0.26)); // a bookmark poking out
	return g;
}

const placements: Placement[] = [
	{
		id: 'turntable',
		shelf: 2,
		x: -0.5,
		held: { pitch: 0.95, yaw: 0 },
		build: turntable
	},
	{
		id: 'album',
		shelf: 2,
		x: 0.6,
		back: 0.86,
		held: { pitch: 0.2, yaw: -0.25 },
		build: sleeve
	},
	{
		id: 'headphones',
		shelf: 1,
		x: 0.55,
		yaw: -0.5,
		held: { pitch: 0.1, yaw: 0.5 },
		build: headphones
	},
	{
		id: 'mothersheet',
		shelf: 1,
		x: -0.45,
		yaw: 0.2,
		held: { pitch: 0.8, yaw: 0.15 },
		build: gameBox
	},
	{
		id: 'work',
		shelf: 3,
		x: 0.5,
		yaw: -0.35,
		held: { pitch: 0.25, yaw: -0.5 },
		build: hardhat
	},
	{
		id: 'kickball',
		shelf: 3,
		x: -0.42,
		yaw: -0.3,
		held: { pitch: 0.45, yaw: 0.25 },
		build: flipPhone
	},
	{
		id: 'video-module',
		shelf: 0,
		x: -0.5,
		yaw: 0.55,
		held: { pitch: 0.1, yaw: 0.45 },
		build: videoModule
	},
	{
		id: 'monitor',
		shelf: 0,
		x: 0.38,
		yaw: -0.15,
		held: { pitch: 0.1, yaw: -0.35 },
		build: monitor
	},
	{
		id: 'book',
		shelf: 4,
		x: -0.2,
		yaw: 0.3,
		held: { pitch: 0.9, yaw: 0.2 },
		build: book
	}
];

export const items: Item[] = placements.map((placement) => ({
	...catalogue.find((entry) => entry.id === placement.id)!,
	...placement
}));
