// Grey-box stand-ins for the objects in the rack: each is a few primitives at roughly the
// real thing's proportions, to be replaced by a proper model later. A builder returns a group
// whose origin is the centre of its base, so it can be set straight down on a shelf.
//
// Here is what the builders share: the materials and the primitives. Each object is built in its
// own file in objects/.

import {
	BoxGeometry,
	BufferGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CylinderGeometry,
	Group,
	LatheGeometry,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	RepeatWrapping,
	SRGBColorSpace,
	TubeGeometry,
	Vector2,
	Vector3,
	type Material
} from 'three';
import { RACK_WIDTH, BOARD } from './rack.ts';

export const light = new MeshStandardMaterial({ color: 0xbdbcb6, roughness: 0.85 });
export const mid = new MeshStandardMaterial({ color: 0x77767a, roughness: 0.8 });
export const dark = new MeshStandardMaterial({ color: 0x232326, roughness: 0.6 });
// A monitor's case and stand: a deeper black than the rack's, and polished, so that it catches
// the room's lights where the rack's powder coat does not. It is not given the room to reflect:
// seen edge on, as the sides of the panel are, a polished thing reflects nearly everything, and
// the wall showed in them as a pale border all the way round it.
export const gloss = new MeshStandardMaterial({ color: 0x050506, roughness: 0.22 });
// A monitor's power light: lit, so that it shows against the black round it.
export const powerBlue = new MeshStandardMaterial({ color: 0x2f7dff, roughness: 0.5, emissive: 0x2f7dff, emissiveIntensity: 0.9 });
export const accent = new MeshStandardMaterial({ color: 0xd9a400, roughness: 0.55 });
export const page = new MeshStandardMaterial({ color: 0xe6e1d4, roughness: 0.95 });
// The plugs on the two cables: the HDMI one matches the flecks in its braid, the audio one its
// rubber sleeve.
export const plugRed = new MeshStandardMaterial({ color: 0xc22424, roughness: 0.6 });
export const plugGreen = new MeshStandardMaterial({ color: 0x52cf6c, roughness: 0.6 });
export const rubberGreen = new MeshStandardMaterial({ color: 0x41ad5b, roughness: 0.9 }); // the audio cable's sleeve
export const ginger = new MeshStandardMaterial({ color: 0xd9782d, roughness: 0.9 });
export const white = new MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.9 });
export const screen = new MeshStandardMaterial({
	color: 0x101418,
	roughness: 0.3,
	emissive: 0x2a3d4a,
	emissiveIntensity: 0.6
});
// The glass of a display where it has no pixels: as black as pixels that are off, whatever light
// the room is in.
export const unlit = new MeshBasicMaterial({ color: 0x000000 });

export function mesh(geometry: BufferGeometry, material: Material | Material[], x = 0, y = 0, z = 0) {
	const m = new Mesh(geometry, material);
	m.position.set(x, y, z);
	m.castShadow = true;
	m.receiveShadow = true;
	return m;
}

export function box(w: number, h: number, d: number, material: Material | Material[], x = 0, y = 0, z = 0) {
	return mesh(new BoxGeometry(w, h, d), material, x, y + h / 2, z);
}

/** A cylinder lying on its side, its axis pointing out of the shelf: a knob, jack or reel. */
export function round(r: number, depth: number, material: Material, x: number, y: number, z: number) {
	const m = mesh(new CylinderGeometry(r, r, depth, 32), material, x, y, z + depth / 2);
	m.rotation.x = Math.PI / 2;
	return m;
}

/**
 * A plug on the end of a cable: a cylinder like `round`, its foot at `z`, but with the rim of its
 * far end, where the cable leaves it, rounded off: it narrows by `inward` over the last `along`
 * of its length.
 */
export function plugged(r: number, depth: number, inward: number, along: number, material: Material, x: number, y: number, z: number) {
	// Turned on a lathe from its outline: up the side, round the rim, and in across the end.
	const STEPS = 10;
	const outline = [new Vector2(r, 0)];
	for (let i = 0; i <= STEPS; i++) {
		const a = (i / STEPS) * (Math.PI / 2);
		outline.push(new Vector2(r - inward + inward * Math.cos(a), depth - along + along * Math.sin(a)));
	}
	outline.push(new Vector2(0, depth));
	const m = mesh(new LatheGeometry(outline, 32), material, x, y, z);
	m.rotation.x = Math.PI / 2;
	return m;
}

/**
 * A knob made to be gripped: a cylinder with shallow flutes all the way round it, each taking
 * `cut` of the radius where it is deepest, and in the middle of its top a round hollow, `hollow`
 * in radius and `sunk` deep. The hollow has no floor: the caller puts something in it. The knob
 * stands on its foot, its top `depth` above that, until the caller turns it.
 */
export function fluted(r: number, depth: number, flutes: number, cut: number, hollow: number, sunk: number) {
	// Turned on a lathe from its outline: up the outside, in across the top, and down into the
	// hollow. Each corner is given twice, which keeps it sharp.
	const outline = [
		[r, 0],
		[r, depth],
		[r, depth],
		[hollow, depth],
		[hollow, depth],
		[hollow, depth - sunk]
	].map(([x, y]) => new Vector2(x, y));
	const geometry = new LatheGeometry(outline, flutes * 8);
	const at = geometry.attributes.position;
	for (let i = 0; i < at.count; i++) {
		const x = at.getX(i);
		const z = at.getZ(i);
		if (Math.hypot(x, z) < (r + hollow) / 2) continue; // the hollow is plain
		const k = 1 - cut * (0.5 - 0.5 * Math.cos(Math.atan2(z, x) * flutes));
		at.setX(i, x * k);
		at.setZ(i, z * k);
	}
	geometry.computeVertexNormals();
	return geometry;
}

/** A cone from the origin of its own group, which the caller places and turns. */
export function horn(length: number, r: number, material: Material) {
	const g = new Group();
	g.add(mesh(new CylinderGeometry(r * 0.12, r, length, 20), material, 0, length / 2, 0));
	return g;
}

/**
 * A braided cable along this path: a sleeve of one colour with flecks of a second running round
 * it in both directions, every `every`th strand (2 is half and half). `R` is its radius.
 */
export function braided(path: CatmullRomCurve3, base: string, fleck: string, every: number, R = 0.014) {
	const CELLS = 8;
	const PX = 8;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = CELLS * PX;
	const c = canvas.getContext('2d')!;
	c.fillStyle = base;
	c.fillRect(0, 0, canvas.width, canvas.height);
	c.fillStyle = fleck;
	for (let i = 0; i < CELLS; i++) {
		for (let j = 0; j < CELLS; j++) {
			if ((i + j) % every === 0 && (i - j + CELLS) % 2 === 0) c.fillRect(i * PX, j * PX, PX, PX);
		}
	}
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	map.wrapS = map.wrapT = RepeatWrapping;
	// The tile goes twice round the cable, and as often along it as keeps it square.
	map.repeat.set(path.getLength() / (Math.PI * R), 2);
	return mesh(new TubeGeometry(path, 160, R, 10), new MeshStandardMaterial({ map, roughness: 0.8 }));
}

export const silver = new MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.35 });
export const SCREW = 0.019; // the radius of a screw's head, which has to cover a hole in a post

/**
 * The head of a rack screw, standing on the surface z = 0 and facing out of it: silver, with a
 * cross cut in it, turned whichever way it happened to stop.
 */
export function screw() {
	const g = new Group();
	g.add(round(SCREW, 0.008, silver, 0, 0, 0));
	for (const turn of [0, Math.PI / 2]) {
		const slot = mesh(new BoxGeometry(SCREW * 1.2, SCREW * 0.24, 0.002), dark, 0, 0, 0.008);
		slot.rotation.z = turn;
		slot.castShadow = false;
		g.add(slot);
	}
	g.rotation.z = Math.random() * Math.PI;
	return g;
}

/**
 * The line of a cable of this length hanging freely between two points: a catenary, in the
 * upright plane through them. `n` points, both ends included.
 */
export function hang(from: Vector3, to: Vector3, length: number, n = 24) {
	const across = Math.hypot(to.x - from.x, to.z - from.z);
	const rise = to.y - from.y;
	// The catenary's scale `c` is whatever makes a curve of this length span this far.
	const span = Math.sqrt(length * length - rise * rise);
	let low = 1e-3;
	let high = 1e3;
	for (let i = 0; i < 80; i++) {
		const c = Math.sqrt(low * high);
		if (2 * c * Math.sinh(across / (2 * c)) > span) low = c;
		else high = c;
	}
	const c = Math.sqrt(low * high);
	const lowest = across / 2 - c * Math.atanh(rise / length); // how far across its lowest point is
	return Array.from({ length: n }, (_, i) => {
		const t = i / (n - 1);
		const y = from.y + c * (Math.cosh((t * across - lowest) / c) - Math.cosh(lowest / c));
		return new Vector3(from.x + (to.x - from.x) * t, y, from.z + (to.z - from.z) * t);
	});
}

// The width of a rack-mounted panel: right across the rack, over the fronts of its posts.
export const PANEL = RACK_WIDTH + 2 * BOARD + 0.01;
export const EAR = 0.08; // the strip at each end of a panel that is bolted to the posts
export const PANEL_HEIGHT = 0.3; // both rack-mounted pieces are the same height

/** A rack-mounted panel of this height with its front at z = 0, and the case behind it. */
export function panel(h: number, depth: number, material: Material) {
	const g = new Group();
	g.add(box(PANEL, h, 0.012, material, 0, 0, -0.006));
	g.add(box(RACK_WIDTH - 0.04, h - 0.02, depth, dark, 0, 0.01, -0.012 - depth / 2));
	// A bolt at each corner.
	const inset = Math.min(0.04, h / 4);
	for (const side of [-1, 1]) {
		for (const y of [inset, h - inset]) {
			const head = screw();
			head.position.set(side * (PANEL / 2 - EAR / 2), y, 0);
			g.add(head);
		}
	}
	return g;
}

export const smooth = (from: number, to: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
	return t * t * (3 - 2 * t);
};

export function printed(canvas: HTMLCanvasElement) {
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	map.anisotropy = 8;
	return map;
}
