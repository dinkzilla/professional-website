// Grey-box stand-ins for the objects in the rack: each is a few primitives at roughly the
// real thing's proportions, to be replaced by a proper model later. A builder returns a group
// whose origin is the centre of its base, so it can be set straight down on a shelf.

import {
	BoxGeometry,
	BufferGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CircleGeometry,
	CylinderGeometry,
	ExtrudeGeometry,
	Float32BufferAttribute,
	Group,
	LatheGeometry,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	Quaternion,
	RepeatWrapping,
	Shape,
	SphereGeometry,
	SRGBColorSpace,
	Texture,
	TextureLoader,
	TorusGeometry,
	TubeGeometry,
	Vector2,
	Vector3,
	type Material,
	type Object3D
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import frauncesItalic from '@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2?url';
import fraunces from '@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url';
import monoton from '@fontsource/monoton/files/monoton-latin-400-normal.woff2?url';
import skullShade from '#lib/assets/models/skull-ao.webp';
import skullNormal from '#lib/assets/models/skull-normal.webp';
import skullMesh from '#lib/assets/models/skull.glb?url';
import mothershipLid from '#lib/assets/mothership-lid.jpg';
import { createFirmware } from '#lib/video-module/firmware.ts';
import { createMpv } from '#lib/video-module/mpv.ts';
import { createOled } from '#lib/video-module/oled.ts';
import { catalogue, type Article, type Entry } from './catalogue.ts';
import { air, blown, tie } from './tie.ts';

interface Placement {
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
}

// The rack the objects go in, in world units (one is about half a metre): its width inside, between
// the posts; its depth, front to back; and the thickness of its shelves. They are here because
// some of the objects are made to fit it.
/** In place of a shelf number: pinned to the wall (see Placement). */
export const WALL = -1;
/** In place of a shelf number: on the floor under the rack, between its legs. */
export const FLOOR = -2;
// The board on the wall that the fliers are pinned to: its edges along the wall, and above the
// floor. Its right end is behind the rack, so that some of it shows where the window is only as
// wide as the rack. The heights are as it was laid out: it is hung with its top level with the top
// of the door's opening, which is as high as the rack and what stands on it, so the board and
// everything pinned to it are moved up or down together by the difference (`lift` in room.ts).
export const PINBOARD = { left: -1.7, right: 0, bottom: 1.21, top: 2.4 };

// The middle one of the three hooks by the door, which the tie hangs on (they are built in
// room.ts): where along the wall, and how far above the floor.
export const HOOK = { x: 0.99, y: 2.08 };

export const RACK_WIDTH = 1.1;
export const RACK_DEPTH = 0.7;
export const BOARD = 0.05;
// How far the back of the rack stands off the wall: clear of the pinboard, which runs behind it,
// with room for the cable that goes down behind the tv, and for a flier behind it to come forward
// under the pointer, pin and all.
export const STANDOFF = 0.14;
/** How far off the wall something pinned to it or hung on it is. */
export const WALL_OFF = 0.034;
/** The backs of the rack's posts, from the wall: they stand a touch proud of its shelves. */
export const RACK_BACK = STANDOFF - 0.005;
export const LEGS = 0.24; // how far the posts carry on below the bottom shelf, down to the floor

// The amp on the floor under the pinboard (built in room.ts): where along the wall its middle is,
// its size, and how far it stands off the wall. Its input jack is on its front, given here from
// the floor at the foot of the wall, because the cable plugged into the cassette player ends there.
export const AMP = { x: -1.22, w: 1.2, h: 1, d: 0.5, gap: 0.06 };
// It is level with the knobs: the middle of the strip they are on (see room.ts).
export const AMP_JACK = { x: AMP.x + 0.42, y: AMP.h - 0.16, z: AMP.gap + AMP.d };

const light = new MeshStandardMaterial({ color: 0xbdbcb6, roughness: 0.85 });
const mid = new MeshStandardMaterial({ color: 0x77767a, roughness: 0.8 });
const dark = new MeshStandardMaterial({ color: 0x232326, roughness: 0.6 });
// A monitor's case and stand: a deeper black than the rack's, and polished, so that it catches
// the room's lights where the rack's powder coat does not. It is not given the room to reflect:
// seen edge on, as the sides of the panel are, a polished thing reflects nearly everything, and
// the wall showed in them as a pale border all the way round it.
const gloss = new MeshStandardMaterial({ color: 0x050506, roughness: 0.22 });
// A monitor's power light: lit, so that it shows against the black round it.
const powerBlue = new MeshStandardMaterial({ color: 0x2f7dff, roughness: 0.5, emissive: 0x2f7dff, emissiveIntensity: 0.9 });
const accent = new MeshStandardMaterial({ color: 0xd9a400, roughness: 0.55 });
const page = new MeshStandardMaterial({ color: 0xe6e1d4, roughness: 0.95 });
// The plugs on the two cables: the HDMI one matches the flecks in its braid, the audio one its
// rubber sleeve.
const plugRed = new MeshStandardMaterial({ color: 0xc22424, roughness: 0.6 });
const plugGreen = new MeshStandardMaterial({ color: 0x52cf6c, roughness: 0.6 });
const rubberGreen = new MeshStandardMaterial({ color: 0x41ad5b, roughness: 0.9 }); // the audio cable's sleeve
const ginger = new MeshStandardMaterial({ color: 0xd9782d, roughness: 0.9 });
const white = new MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.9 });
const screen = new MeshStandardMaterial({
	color: 0x101418,
	roughness: 0.3,
	emissive: 0x2a3d4a,
	emissiveIntensity: 0.6
});
// The glass of a display where it has no pixels: as black as pixels that are off, whatever light
// the room is in.
const unlit = new MeshBasicMaterial({ color: 0x000000 });

function mesh(geometry: BufferGeometry, material: Material | Material[], x = 0, y = 0, z = 0) {
	const m = new Mesh(geometry, material);
	m.position.set(x, y, z);
	m.castShadow = true;
	m.receiveShadow = true;
	return m;
}

function box(w: number, h: number, d: number, material: Material | Material[], x = 0, y = 0, z = 0) {
	return mesh(new BoxGeometry(w, h, d), material, x, y + h / 2, z);
}

/** A cylinder lying on its side, its axis pointing out of the shelf: a knob, jack or reel. */
function round(r: number, depth: number, material: Material, x: number, y: number, z: number) {
	const m = mesh(new CylinderGeometry(r, r, depth, 32), material, x, y, z + depth / 2);
	m.rotation.x = Math.PI / 2;
	return m;
}

/**
 * A plug on the end of a cable: a cylinder like `round`, its foot at `z`, but with the rim of its
 * far end, where the cable leaves it, rounded off: it narrows by `inward` over the last `along`
 * of its length.
 */
function plugged(r: number, depth: number, inward: number, along: number, material: Material, x: number, y: number, z: number) {
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
function fluted(r: number, depth: number, flutes: number, cut: number, hollow: number, sunk: number) {
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
function horn(length: number, r: number, material: Material) {
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

const silver = new MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.35 });
const SCREW = 0.019; // the radius of a screw's head, which has to cover a hole in a post

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
function hang(from: Vector3, to: Vector3, length: number, n = 24) {
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
const PANEL = RACK_WIDTH + 2 * BOARD + 0.01;
const EAR = 0.08; // the strip at each end of a panel that is bolted to the posts
const PANEL_HEIGHT = 0.3; // both rack-mounted pieces are the same height
// Where the tv stands on top of the rack: how far back (see Placement), and its size. The cat's
// bed is on the rack's top at the front left, in front of the near end of the panel.
const TV_BACK = 0.63; // toward the back, leaving the front left of the rack's top for the cat
const TV_X = 0.27; // and to the right
const TV_DEPTH = 0.36; // of its foot
const TV_FOOT = 0.045; // and the foot's thickness
const TV_WIDE = 0.58; // and how far across it is
// Its arm: across, front to back, where on the foot (from the foot's middle), the width of each
// upright and the height of the bar across the bottom of the slot between them.
const TV_ARM = { w: 0.21, d: 0.05, z: -TV_DEPTH / 2 + 0.07, upright: 0.06, bar: 0.04 };
const TV_YAW = -0.3; // turned to its right, away from the door and toward where it is seen from
const TV_RAISED = 0.14; // how far the bottom of the panel is above what it stands on

/** A rack-mounted panel of this height with its front at z = 0, and the case behind it. */
function panel(h: number, depth: number, material: Material) {
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

/**
 * The video module's workings (see #lib/video-module): its program, the player the program
 * drives, and its display. They make two pictures, and each is a texture here: the display's,
 * which is on the module's own panel, and the player's, which is on the tv the module is plugged
 * into. Nothing is fetched or played until the scene is first put on a page.
 */
function videoWorkings() {
	// While the scene is on a page: has it drawn again.
	let redraw: ((showing?: Object3D) => void) | undefined;
	let tvPicture: Object3D | undefined;
	let switchedOn = false;
	// The toggle switch. Up is high, which the program takes to mean at random.
	let high = true;

	const oled = createOled(() => {
		readout.needsUpdate = true;
		redraw?.();
	});
	const mpv = createMpv(() => {
		picture.needsUpdate = true;
		redraw?.(tvPicture);
	});
	const firmware = createFirmware(mpv, oled, () => high);
	const readout = new CanvasTexture(oled.canvas);
	const picture = new CanvasTexture(mpv.picture);
	for (const map of [readout, picture]) {
		map.colorSpace = SRGBColorSpace;
		map.anisotropy = 8;
	}
	// Both give out light of their own, so neither is lit by the room.
	const glow = new MeshBasicMaterial({ map: readout, toneMapped: false });
	const lcd = new MeshBasicMaterial({ map: picture, toneMapped: false });

	return {
		firmware,
		/** What the module's display is made of, and the tv's picture. */
		glow,
		lcd,
		/** The part of the tv the picture is on: a new frame is only worth drawing if it is in view. */
		shownOn(part: Object3D) {
			tvPicture = part;
		},
		get high() {
			return high;
		},
		flip() {
			high = !high;
		},
		start(ask: (showing?: Object3D) => void) {
			redraw = ask;
			mpv.run(true);
			if (switchedOn) return;
			switchedOn = true;
			firmware.main();
		},
		stop() {
			redraw = undefined;
			mpv.run(false);
		},
		dim(share: number) {
			glow.color.setScalar(1 - share);
			lcd.color.setScalar(1 - share);
		}
	};
}

// Made when the first of the tv and the module is built, and shared by the two.
let workings: ReturnType<typeof videoWorkings> | undefined;
const video = () => (workings ??= videoWorkings());

function tv() {
	// A flat monitor on a stand, everything about the stand made bigger than life so that it shows:
	// one thick slab of a foot; toward the back of it the arm, which is two uprights with a slot
	// right through between them for cables, joined across the bottom by a bar (and across the
	// top too, but that is behind the panel); and on the arm's front the panel itself, thin, with
	// a shallow hump on its back and an even border round the picture.
	const g = new Group();
	const foot = { w: TV_WIDE, h: TV_FOOT, d: TV_DEPTH };
	const arm = TV_ARM;
	const w = 1.09;
	const edge = 0.036; // the border round the picture, the same on all four sides
	const pictureH = ((w - 2 * edge) * 9) / 16;
	const h = pictureH + 2 * edge;
	const thin = 0.03;
	// The middle of the panel's thickness. Its back is flat against the arm's front, with no gap
	// between them for the wall to show through.
	const z = arm.z + arm.d / 2 + thin / 2;
	const top = TV_RAISED + h;

	g.add(box(foot.w, foot.h, foot.d, gloss));
	for (const side of [-1, 1]) {
		g.add(box(arm.upright, top - 0.12 - foot.h, arm.d, gloss, (side * (arm.w - arm.upright)) / 2, foot.h, arm.z));
	}
	g.add(box(arm.w, arm.bar, arm.d, gloss, 0, foot.h, arm.z));
	// The slot is closed off above, out of sight, where the panel is fixed to the arm.
	g.add(box(arm.w, top - 0.12 - (TV_RAISED + 0.06), arm.d, gloss, 0, TV_RAISED + 0.06, arm.z));
	// The hump on the panel's back, which the arm is let into.
	g.add(box(w * 0.55, h * 0.55, 0.02, gloss, 0, TV_RAISED + h * 0.2, z - thin / 2 - 0.01));

	// The panel, its corners rounded a little.
	const corner = 0.022;
	const face = new Shape()
		.moveTo(-w / 2 + corner, 0)
		.lineTo(w / 2 - corner, 0)
		.absarc(w / 2 - corner, corner, corner, -Math.PI / 2, 0, false)
		.lineTo(w / 2, h - corner)
		.absarc(w / 2 - corner, h - corner, corner, 0, Math.PI / 2, false)
		.lineTo(-w / 2 + corner, h)
		.absarc(-w / 2 + corner, h - corner, corner, Math.PI / 2, Math.PI, false)
		.lineTo(-w / 2, corner)
		.absarc(-w / 2 + corner, corner, corner, Math.PI, (3 * Math.PI) / 2, false);
	g.add(
		mesh(
			new ExtrudeGeometry(face, { depth: thin, bevelEnabled: false, curveSegments: 8 }),
			gloss,
			0,
			TV_RAISED,
			z - thin / 2
		)
	);
	// The picture is whatever the video module is sending it.
	const picture = mesh(
		new PlaneGeometry(w - 2 * edge, pictureH),
		video().lcd,
		0,
		TV_RAISED + edge + pictureH / 2,
		z + thin / 2 + 0.001
	);
	video().shownOn(picture);
	g.add(picture);
	// The power light, at the right of the border along the bottom.
	g.add(box(0.012, 0.006, 0.003, powerBlue, w / 2 - 0.062, TV_RAISED + edge / 2 - 0.003, z + thin / 2));
	return g;
}

function catBed() {
	// A round bed with a padded rim, and a ginger and white cat curled up asleep in it, nose to
	// tail.
	const g = new Group();
	const R = 0.19; // to the middle of the rim
	const tube = 0.04;
	g.add(mesh(new CylinderGeometry(R, R, 0.03, 40), mid, 0, 0.015, 0));
	const rim = mesh(new TorusGeometry(R, tube, 16, 48), mid, 0, tube, 0);
	rim.rotation.x = Math.PI / 2;
	g.add(rim);

	const blob = (r: number, material: Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
		const m = mesh(new SphereGeometry(r, 24, 16), material, x, y, z);
		m.scale.set(sx, sy, sz);
		return m;
	};
	// Big enough to spill over the rim a little.
	const cat = new Group();
	cat.scale.setScalar(1.25);
	cat.position.y = 0.012;
	// The body, lying round the back of the bed, with a white patch over its flank and haunch.
	cat.add(blob(0.13, ginger, 0, 0.085, -0.03, 1.2, 0.62, 0.95));
	cat.add(blob(0.085, white, -0.05, 0.1, 0.0, 1.15, 0.72, 1.1));
	cat.add(blob(0.075, ginger, -0.1, 0.085, 0.03, 1, 0.75, 1)); // haunch
	// The head, tucked down at the front on its white chest and paws.
	cat.add(blob(0.06, white, 0.07, 0.065, 0.06, 1.2, 0.7, 1));
	cat.add(blob(0.062, ginger, 0.09, 0.105, 0.075, 1, 0.85, 1));
	cat.add(blob(0.03, white, 0.1, 0.09, 0.125, 1, 0.8, 0.8)); // muzzle
	for (const side of [-1, 1]) {
		const ear = horn(0.045, 0.022, ginger);
		ear.position.set(0.09 + side * 0.035, 0.14, 0.065);
		ear.rotation.z = -side * 0.25;
		cat.add(ear);
		cat.add(blob(0.02, white, 0.03 + side * 0.03, 0.05, 0.12, 1.3, 0.7, 1)); // paws
	}
	// The tail, wrapped round the front to the nose, with a white tip.
	const tail = mesh(new TorusGeometry(0.115, 0.02, 10, 32, 2.2), ginger, -0.02, 0.06, 0.02);
	tail.rotation.set(Math.PI / 2, 0, -2.75);
	cat.add(tail);
	cat.add(blob(0.022, white, -0.02 + 0.115 * Math.cos(-0.55), 0.06, 0.02 + 0.115 * Math.sin(0.55)));
	g.add(cat);
	return g;
}

function videoModule() {
	const h = PANEL_HEIGHT;
	const g = panel(h, 0.3, mid);
	const inside = video();
	// A display, one knob and a toggle switch, all of which work (see #lib/video-module). Along
	// the panel from the left: the plug, the display, the knob and the toggle, the first and last
	// as far from the panel's ends as each other, and the display filling what is left between
	// the plug and the knob. The gaps allow for the plug and the knob standing out from the panel,
	// which from where they are seen puts their faces to the right of their feet.
	//
	// The display is 128 pixels by 32, so four times as wide as it is tall. The pixels do not go
	// to the edge of its glass: there is a margin of glass that never lights, and round that a
	// dark surround.
	const lit = { w: 0.486, h: 0.1215, x: -0.0575 };
	const margin = 0.024;
	const surround = 0.02;
	const glass = { w: lit.w + 2 * margin, h: lit.h + 2 * margin };
	g.add(box(glass.w + 2 * surround, glass.h + 2 * surround, 0.006, dark, lit.x, (h - glass.h) / 2 - surround, 0));
	g.add(mesh(new PlaneGeometry(glass.w, glass.h), unlit, lit.x, h / 2, 0.0035));
	g.add(mesh(new PlaneGeometry(lit.w, lit.h), inside.glow, lit.x, h / 2, 0.004));

	// The knob turns without end, a click at a time, and is pushed in to press it. The flutes
	// round its edge are what show it turning, and the white circle in the middle of its face,
	// sunk a little way into it, is where it is pushed.
	const KNOB = 0.336; // where along the panel it is
	const CLICKS = 24; // to a full turn
	const FACE = 0.045; // how far its face stands off the panel
	// Its radius, and that of the white circle: the rim between them is wide enough that a press
	// meant for one does not land on the other.
	const RIM = 0.065;
	const MIDDLE = 0.032;
	const SUNK = 0.01; // how far below the knob's face the circle is
	const knob = new Group();
	const grip = mesh(fluted(RIM, FACE, 18, 0.09, MIDDLE, SUNK), dark);
	grip.rotation.x = Math.PI / 2;
	// The circle is the floor of the hollow in the knob's face, and a little wider than it.
	knob.add(grip, round(MIDDLE + 0.002, 0.003, white, 0, 0, FACE - SUNK - 0.003));
	knob.position.set(KNOB, h / 2, 0);
	g.add(knob);

	const TOGGLE = 0.475;
	g.add(round(0.024, 0.01, dark, TOGGLE, h / 2, 0));
	const lever = new Group();
	lever.add(mesh(new CylinderGeometry(0.008, 0.008, 0.06, 12), light, 0, 0.03, 0));
	lever.position.set(TOGGLE, h / 2, 0.008);
	g.add(lever);

	let clicks = 0; // how many the knob has been turned through, clockwise, and
	let turned = 0; // how many of them it has got round so far
	let pushed = 0; // 1 when it is pushed right in, and falling back to 0
	let thrown = 1; // the lever: 1 is up, 0 down
	const pose = () => {
		knob.rotation.z = (-turned * 2 * Math.PI) / CLICKS;
		knob.position.z = -0.012 * pushed;
		knob.scale.setScalar(1 - 0.06 * pushed);
		lever.rotation.x = Math.PI / 2 + 0.5 - thrown; // sticking out, thrown upward or downward
	};
	pose();

	// Both are worked by pressing them, through unseen shapes that are easier to hit than the
	// things themselves. The knob has three, flat against its face. The white circle pushes it
	// in. The rest of it, and a little way out beyond its edge, is divided in two by a line at 45
	// degrees through its middle, which is not marked: a press above and to the left of the line
	// turns the knob one click anticlockwise, which is up the list, and a press below and to the
	// right of it turns it one click clockwise, which is down.
	//
	// Those three are too small to tell apart under a finger. So a press anywhere on the knob
	// that is dragged turns it, a click at a time, down the window being down the list. And a tap
	// by a finger pushes it in wherever on it the tap lands.
	const press = (shape: BufferGeometry, x: number, z: number, control: Control) => {
		const m = new Mesh(shape, dark);
		m.position.set(x, h / 2, z);
		m.visible = false;
		m.userData.control = control;
		g.add(m);
	};
	const turn = (by: 1 | -1) => {
		clicks += by;
		inside.firmware.rotary(by > 0 ? 'down' : 'up');
	};
	// Dragged, it is seen to turn a click at a time as well, but it takes two of those the same
	// way to move the list: one for one runs through the list faster than a finger can stop it.
	let slack = 0;
	const drag = (by: 1 | -1) => {
		clicks += by;
		slack += by;
		if (Math.abs(slack) < 2) return;
		slack = 0;
		inside.firmware.rotary(by > 0 ? 'down' : 'up');
	};
	const push = () => {
		pushed = 1;
		inside.firmware.button();
	};
	const REACH = RIM + 0.025; // how far from the knob's middle a press still turns it
	const half = (from: number, by: 1 | -1) =>
		press(new CircleGeometry(REACH, 24, from, Math.PI), KNOB, FACE + 0.001, {
			tap: () => turn(by),
			touch: push,
			turn: drag
		});
	half(Math.PI / 4, -1);
	half((-3 * Math.PI) / 4, 1);
	// The circle's own shape covers the mouth of the hollow, so that a press on anything seen
	// through it is a press on the circle. It is just in front of the other two, which makes it
	// the one such a press finds.
	press(new CircleGeometry(MIDDLE, 24), KNOB, FACE + 0.002, { tap: push, turn: drag });
	press(new BoxGeometry(0.07, 0.2, 0.08), TOGGLE, 0.04, { tap: inside.flip });

	/** A step from `now` toward `goal`, most of the way there in `time` seconds. */
	const toward = (now: number, goal: number, dt: number, time: number) =>
		Math.abs(goal - now) < 0.004 ? goal : now + (goal - now) * (1 - Math.exp(-dt / time));
	g.userData.works = {
		start: inside.start,
		stop: inside.stop,
		dim: inside.dim,
		tick(dt) {
			const up = inside.high ? 1 : 0;
			turned = toward(turned, clicks, dt, 0.04);
			pushed = toward(pushed, 0, dt, 0.06);
			thrown = toward(thrown, up, dt, 0.03);
			pose();
			return turned !== clicks || pushed !== 0 || thrown !== up;
		}
	} satisfies Works;

	// The HDMI socket at the left, upright, and the cable plugged into it, its plug far bigger
	// than life. The cable leaves the plug, hangs freely across the front of the panel, and goes
	// up over the lip of the rack's top between the display and the knob, in front of the
	// display's right-hand end and clear of the knob and the toggle and of where they are
	// pressed. On the top it swings out to the right, comes back onto the tv's foot from that
	// side, goes under the tv and round the right-hand side of its arm, and up behind it to the
	// socket on its back.
	const port = new Vector3(-0.46, 0.15, 0);
	const plug = { w: 0.056, h: 0.112, d: 0.112 };
	g.add(box(plug.w + 0.02, plug.h + 0.02, 0.004, dark, port.x, port.y - plug.h / 2 - 0.01, 0));
	// Its body, the edges and corners rounded off. It goes into the panel by as much as they are
	// rounded, so that it still meets the socket square.
	const corner = 0.014;
	g.add(
		mesh(
			new RoundedBoxGeometry(plug.w, plug.h, plug.d + corner, 4, corner),
			plugRed,
			port.x,
			port.y,
			(plug.d - corner) / 2
		)
	);
	g.add(box(plug.w - 0.02, plug.h - 0.03, 0.02, light, port.x, port.y - plug.h / 2 + 0.015, 0.012)); // its metal end
	g.add(round(0.021, 0.05 + corner, plugRed, port.x, port.y, plug.d - corner)); // where the cable leaves it
	const R = 0.014; // the cable's radius
	// Where along the rack it goes over the lip. That is above the knob's left-hand edge, but by
	// the height of the knob the cable has fallen away to the left of where the knob is pressed.
	const up = KNOB - REACH + 0.015;
	const top = h + BOARD; // the rack's top
	// A point on the tv, given as the tv is built (across, up from the rack's top, toward its front).
	const tvBack = -(RACK_DEPTH + 0.008) + RACK_DEPTH * (1 - TV_BACK); // of its foot's middle, from the panel
	const onTv = (x: number, y: number, z: number) =>
		new Vector3(
			TV_X + x * Math.cos(TV_YAW) + z * Math.sin(TV_YAW),
			top + y,
			tvBack - x * Math.sin(TV_YAW) + z * Math.cos(TV_YAW)
		);
	const beside = TV_ARM.w / 2 + R + 0.03; // just clear of the arm's right-hand side
	// It leaves the plug pointing out of it and comes round in an easy bend, down and toward the
	// lip, as a stiff cable does. From the end of the bend to the lip nothing holds it, so that
	// length is worked out as a hanging cable (see hang).
	const free = new Vector3(port.x + 0.09, port.y - 0.1, plug.d + 0.165);
	const lip = new Vector3(up, top + R - 0.01, 0.02);
	const path = new CatmullRomCurve3([
		new Vector3(port.x, port.y, plug.d + 0.05),
		new Vector3(port.x + 0.012, port.y - 0.015, plug.d + 0.115),
		new Vector3(port.x + 0.045, port.y - 0.055, plug.d + 0.155),
		...hang(free, lip, free.distanceTo(lip) * 1.2),
		new Vector3(up, top + R + 0.003, -0.035),
		// Across the top it swings out to the right first, away from the tv, round the front
		// corner of the tv's foot, and comes back in over the foot's right-hand edge.
		new Vector3(up + 0.06, top + R, -0.09),
		new Vector3(0.4, top + R, -0.14),
		new Vector3(0.5, top + R, -0.2),
		new Vector3(0.555, top + R, -0.3),
		onTv(TV_WIDE / 2 + 0.005, R + 0.03, -0.02), // riding up over the edge
		onTv(TV_WIDE / 2 - 0.04, TV_FOOT + R, -0.07),
		onTv(beside + 0.05, TV_FOOT + R, TV_ARM.z + 0.01),
		onTv(beside, TV_FOOT + R + 0.015, TV_ARM.z - 0.045),
		onTv(beside - 0.015, 0.25, TV_ARM.z - 0.06),
		onTv(beside - 0.03, 0.4, TV_ARM.z - 0.02)
	]);
	g.add(braided(path, '#131313', '#c22424', 4)); // black, flecked with red
	return g;
}

function cassettePlayer() {
	const h = PANEL_HEIGHT;
	const g = panel(h, 0.5, light);
	// Laid out for a panel 1.2 wide, and scaled across to this one.
	const k = PANEL / 1.2;
	// The cassette door, with the tape's two reels showing through it.
	g.add(box(0.34 * k, 0.19, 0.008, dark, -0.3 * k, 0.055, 0));
	for (const side of [-1, 1]) g.add(round(0.036, 0.006, light, (-0.3 + side * 0.075) * k, 0.16, 0.004));
	// To the right of the door, two rows of the same height, which together are as tall as the
	// door and level with it. Below, the four transport keys (back, play, pause and next) and
	// then the output socket. Above, the eject key over the back key, and beside it one display,
	// which runs on to the right until it is over the socket. Everything is the same distance
	// from its neighbours, across and up, and the socket's far edge is as far from its end of the
	// panel as the door is from the other. Each key has its sign standing out of its face.
	const GAP = 0.03;
	const ROW = { h: 0.08, low: 0.055, high: 0.055 + 0.08 + GAP };
	const SOCKET = { r: 0.034, x: 0.47 * k - 0.034 };
	const from = -0.13 * k + 0.05; // the left edge of the keys: a little clear of the door
	const KEY = { w: (SOCKET.x - SOCKET.r - from - 4 * GAP) / 4, h: ROW.h, d: 0.024 };
	const s = 0.016; // half the height of a sign
	const bar = (x: number) => [
		[x - 0.2 * s, -s],
		[x + 0.2 * s, -s],
		[x + 0.2 * s, s],
		[x - 0.2 * s, s]
	];
	const arrow = (x: number) => [
		[x - 0.75 * s, -s],
		[x + 0.75 * s, 0],
		[x - 0.75 * s, s]
	];
	const next = [arrow(-0.3 * s), bar(0.8 * s)];
	const signs = [
		next.map((part) => part.map(([x, y]) => [-x, y])), // back: next, the other way round
		[arrow(0)],
		[bar(-0.5 * s), bar(0.5 * s)],
		next
	];
	const eject = [
		[
			[-s, -s],
			[s, -s],
			[s, -0.55 * s],
			[-s, -0.55 * s]
		],
		[
			[-s, -0.2 * s],
			[s, -0.2 * s],
			[0, s]
		]
	];
	const key = (sign: number[][][], x: number, y: number) => {
		g.add(box(KEY.w, KEY.h, KEY.d, dark, x, y, 0));
		for (const part of sign) {
			const outline = new Shape(part.map(([px, py]) => new Vector2(px, py)));
			const raised = mesh(new ExtrudeGeometry(outline, { depth: 0.002, bevelEnabled: false }), light, x, y + KEY.h / 2, KEY.d);
			raised.castShadow = false;
			g.add(raised);
		}
	};
	const column = (i: number) => from + KEY.w / 2 + i * (KEY.w + GAP);
	signs.forEach((sign, i) => key(sign, column(i), ROW.low));
	key(eject, column(0), ROW.high);
	const left = column(1) - KEY.w / 2; // the display's edges
	const right = SOCKET.x + SOCKET.r;
	const rim = 0.015; // of dark round its glass
	g.add(box(right - left, ROW.h, 0.006, dark, (left + right) / 2, ROW.high, 0));
	g.add(box(right - left - 2 * rim, ROW.h - 2 * rim, 0.002, screen, (left + right) / 2, ROW.high + rim, 0.006));

	// The output socket at the far end of the panel from the door, level with the keys, and the
	// cable from the amp plugged into it. The cable drops from the amp's input to the floor, lies
	// in a loose curve along the front of the rack and round its foot, and comes up to the socket.
	// The amp's place is given from the floor and the wall.
	const floor = -(BOARD + LEGS);
	const wall = -(RACK_DEPTH + 0.008 + STANDOFF);
	const socket = new Vector3(SOCKET.x, ROW.low + ROW.h / 2, 0);
	// The amp's jack stands 0.018 proud of its front (see room.ts), and the plug starts at its face.
	const amp = new Vector3(AMP_JACK.x, floor + AMP_JACK.y, wall + AMP_JACK.z + 0.018);
	const lying = floor + 0.015;
	g.add(round(SOCKET.r, 0.004, dark, socket.x, socket.y, 0));
	const PLUG = 0.085; // how far a plug stands out of its socket
	g.add(plugged(0.027, PLUG, 0.012, 0.035, plugGreen, socket.x, socket.y, 0));
	g.add(plugged(0.027, PLUG, 0.012, 0.035, plugGreen, amp.x, amp.y, amp.z));
	const path = new CatmullRomCurve3([
		new Vector3(socket.x, socket.y, PLUG),
		new Vector3(socket.x, socket.y - 0.035, 0.175),
		new Vector3(socket.x - 0.01, socket.y - 0.12, 0.225),
		new Vector3(socket.x - 0.03, lying + 0.04, 0.25),
		new Vector3(socket.x - 0.1, lying, 0.31),
		new Vector3(0.1, lying, 0.4),
		new Vector3(-0.3, lying, 0.34),
		new Vector3(-0.6, lying, 0.42),
		new Vector3(amp.x + 0.08, lying, 0.36),
		new Vector3(amp.x + 0.01, lying, 0.16),
		new Vector3(amp.x + 0.13, lying, 0.04),
		new Vector3(amp.x + 0.05, lying + 0.06, amp.z + 0.2),
		new Vector3(amp.x + 0.01, floor + 0.4, amp.z + 0.17),
		new Vector3(amp.x, amp.y - 0.08, amp.z + 0.17),
		new Vector3(amp.x, amp.y, amp.z + PLUG)
	]);
	// The cable is plain rubber, a deeper green than its plugs, and as thick as the braided ones.
	g.add(mesh(new TubeGeometry(path, 160, 0.014, 12), rubberGreen));
	return g;
}

// The skull as scanned, once fetched: a Triceratops skull without its lower jaw, a unit long from
// beak to frill, facing forward (+z) and rocked back onto its frill, with its base centred on the
// origin. Made from the model in model-originals/triceratops (Creative Commons 4.0).
let skullModel: { geometry: BufferGeometry; bone: MeshStandardMaterial } | undefined;

/**
 * Fetch the objects that are scanned models and not built here from primitives, which is to be
 * done before any object is built. One that cannot be had is left as its grey-box stand-in.
 */
export async function loadModels() {
	const textures = new TextureLoader();
	// Laid out for the model's own texture coordinates, which run the other way up from three's.
	const texture = async (url: string) => {
		const t = await textures.loadAsync(url);
		t.flipY = false;
		t.anisotropy = 8;
		return t;
	};
	try {
		const [gltf, normalMap, shade] = await Promise.all([
			new GLTFLoader().loadAsync(skullMesh),
			texture(skullNormal),
			texture(skullShade)
		]);
		const found = gltf.scene.getObjectByProperty('isMesh', true) as Mesh | undefined;
		if (!found) return;
		// The shading baked into the hollows is its only colouring, over the colour of old bone. The
		// fine surface the scan had, and this many triangles cannot hold, is in the normal map.
		shade.colorSpace = SRGBColorSpace;
		// The model rests on its teeth, which is how it stands on the shelf. Centred over its base.
		const geometry = found.geometry;
		geometry.computeBoundingBox();
		const { min, max } = geometry.boundingBox!;
		geometry.translate(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2);
		skullModel = {
			geometry,
			bone: new MeshStandardMaterial({ color: 0xd6ccb4, roughness: 0.85, map: shade, normalMap })
		};
	} catch {
		// The stand-in will do.
	}
}

// The newspaper clipping rolled up in the skull's left eye socket, which is the one that faces out
// of the shelf. When the skull is picked up, it slides out of the socket and unrolls to be read.
//
// Where the roll goes is given in the scanned skull's own units: its axis passes through `at`, in
// the middle of the socket, and points out, a little up and nearly as far forward, toward the
// beak, as it does out. It goes `inside` into the skull from there and stands `outside` out of it.
// `r` is all the socket has room for, so the roll is squeezed where it goes in and has sprung
// open outside it: wider by `flare` at its outer end. `spin` turns it about its axis, which
// decides where round it the loose edge of the sheet lies.
const ROLL = {
	at: new Vector3(0.1, 0.274, 0.046),
	toward: new Vector3(1, 0.4, 0.9).normalize(),
	inside: 0.08,
	outside: 0.22,
	r: 0.024,
	core: 0.007,
	turns: 5,
	flare: 0.45,
	spin: 2.4
};

const smooth = (from: number, to: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
	return t * t * (3 - 2 * t);
};

/**
 * Where a point of the clipping is when the sheet is `k` of the way unrolled (0 rolled up, 1
 * flat), in the sheet's own frame: flat, it faces +z with its middle on the origin, as wide as
 * the roll is long. The point is `s` down the sheet from its top edge and `w` in from its left.
 *
 * It unrolls as a scroll does. The top of the sheet lies flat, as far down as has been let out,
 * and the rest is still rolled, print inward, in a roll that sits on the face of the sheet at
 * that line and gets thinner as it gives up paper. The sheet's foot is at the roll's core. What
 * makes the roll less than perfect is all measured out from the paper's own surface, so that it
 * carries over from the rolled part to the flat with no step, and fades as the sheet unrolls.
 */
function clippingPoint(s: number, w: number, k: number, to: Vector3) {
	const { W, L, core, gap, inside, outside } = SHEET;
	const out = k * L; // how far down the sheet is flat
	const fade = 1 - k;
	const a = L - s; // how far this is from the core, along the paper
	// The winding is not even: the paper stands off its true line by a little, more so the further
	// out it is. And the loose edge has lifted off the roll, most at its outer corner.
	const uneven = (0.0003 + (0.0005 * a) / L) * (0.6 * Math.sin(a / 0.021 + 1) + 0.4 * Math.sin(a / 0.013 + 4));
	const flap = 0.005 * Math.max(0, 1 - s / 0.035) ** 2 * (0.35 + (0.65 * w) / W);
	const off = fade * (uneven + flap);
	// Sprung open past the socket, by the same share at every turn.
	const open = 1 + (ROLL.flare * fade * Math.max(0, w - inside)) / outside;
	const x = w - W / 2;
	if (s <= out) return to.set(x, L / 2 - s, -open * off);
	// A spiral that takes up `gap` with every turn: how far out the paper is this far from the
	// core, and how far round.
	const radius = (arc: number) => Math.sqrt(core * core + (arc * gap) / Math.PI);
	const round = (arc: number) => ((radius(arc) - core) * 2 * Math.PI) / gap;
	const rolled = L - out; // how much paper is still in the roll
	const turn = round(rolled) - round(a);
	const r = radius(a) + off;
	// The inner turns stand a little further out of the roll's end than the outer ones.
	const proud = (0.012 * fade * (rolled - a)) / L;
	return to.set(x + proud, L / 2 - out - open * r * Math.sin(turn), open * (radius(rolled) - r * Math.cos(turn)));
}

/**
 * A blank sheet of newsprint to print the clipping on, one side of it: cut out of the paper with
 * scissors, not quite square. The other side is the same shape seen from behind (`mirrored`).
 * Nothing drawn after this goes outside the cut.
 */
function newsprint(mirrored: boolean) {
	const canvas = document.createElement('canvas');
	const W = (canvas.width = SHEET.PX);
	const H = (canvas.height = Math.round((SHEET.PX * SHEET.L) / SHEET.W));
	const c = canvas.getContext('2d')!;
	const cut = [
		[0.012, 0.004],
		[0.996, 0],
		[0.986, 0.52],
		[0.997, 0.994],
		[0.002, 1],
		[0.009, 0.44]
	];
	c.beginPath();
	for (const [x, y] of cut) c.lineTo((mirrored ? 1 - x : x) * W, y * H);
	c.closePath();
	c.clip();
	c.fillStyle = '#dddcd6';
	c.fillRect(0, 0, W, H);
	return { canvas, c, W, H };
}

/**
 * What being rolled up has left in the paper, drawn over the print: faint lines across it where
 * it was pressed flat, closer together toward its foot, which was wound the tightest.
 */
function creased(c: CanvasRenderingContext2D, W: number, H: number) {
	let seed = 11;
	const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
	for (let y = H * 0.06; y < H; y += H * (0.02 + 0.07 * random()) * (1.25 - y / H)) {
		const tilt = (random() - 0.5) * H * 0.006;
		for (const [shade, dy] of [
			['rgb(0 0 0 / 0.045)', 0],
			['rgb(255 255 255 / 0.12)', 2.5]
		] as const) {
			c.strokeStyle = shade;
			c.lineWidth = 2;
			c.beginPath();
			c.moveTo(0, y + dy - tilt);
			c.lineTo(W, y + dy + tilt);
			c.stroke();
		}
	}
}

function printed(canvas: HTMLCanvasElement) {
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	map.anisotropy = 8;
	return map;
}

const INK = '#22211f';
// The face the clipping is set in, once fetched (see loadPrinting), and what stands in for it.
const NEWS_FACE = 'Clipping Fraunces';
const SERIF = `'${NEWS_FACE}', Georgia, 'Times New Roman', serif`;

/** `text` broken into lines of words no wider than `width`, in the font that is set. */
function lines(c: CanvasRenderingContext2D, text: string, width: number, indent = 0) {
	const out: string[][] = [[]];
	let room = width - indent;
	let used = 0;
	const space = c.measureText(' ').width;
	for (const word of text.split(' ')) {
		const wide = c.measureText(word).width;
		const line = out[out.length - 1];
		if (line.length && used + space + wide > room) {
			out.push([word]);
			room = width;
			used = wide;
		} else {
			used += (line.length ? space : 0) + wide;
			line.push(word);
		}
	}
	return out;
}

/**
 * `text` broken into as few lines as `lines` makes of it, but of about the same length, so that
 * no word is left on a line by itself.
 */
function evenLines(c: CanvasRenderingContext2D, text: string, width: number) {
	let out = lines(c, text, width);
	for (let w = width; w > width / 2; w -= width / 64) {
		const narrower = lines(c, text, w);
		if (narrower.length > out.length) break;
		out = narrower;
	}
	return out;
}

/**
 * `text` broken into lines that are to be spread to `width`, all but the last. The breaks are the
 * ones that leave the spaces nearest their own size over the whole paragraph, which filling each
 * line as it comes does not: that sets a tight line and then a gappy one.
 */
function spreadLines(c: CanvasRenderingContext2D, text: string, width: number, indent = 0) {
	const words = text.split(' ');
	const wide = words.map((word) => c.measureText(word).width);
	const space = c.measureText(' ').width;
	// From each word, the least that setting the rest costs, and where its line ends to do so.
	const cost = words.map(() => Infinity).concat(0);
	const end = words.map(() => words.length);
	for (let from = words.length - 1; from >= 0; from--) {
		const room = width - (from ? 0 : indent);
		let taken = 0;
		for (let to = from + 1; to <= words.length; to++) {
			taken += wide[to - 1];
			const gaps = to - from - 1;
			// How many times its own size each space would be.
			const each = gaps ? (room - taken) / gaps / space : Infinity;
			if (gaps && each < 0.82) break;
			const last = to === words.length;
			if (last && each < 1) break;
			// A space squeezed shows sooner than one let out, and the last line is not spread at all.
			// A word by itself on a line is the last resort.
			const bad = last ? (gaps ? 0 : 2) : each < 1 ? (4 * (1 - each)) ** 2 : Math.min(1000, (each - 1) ** 2);
			if (bad + cost[to] < cost[from]) [cost[from], end[from]] = [bad + cost[to], to];
		}
	}
	const out: string[][] = [];
	for (let from = 0; from < words.length; from = end[from]) out.push(words.slice(from, end[from]));
	return out;
}

/**
 * The side of the clipping that was cut out to be kept: the article's headline over what it is
 * about and whose it is, its photograph, and as much of its opening as there is paper for, in two
 * columns, down to the foot.
 */
function clippingFront(article: Article) {
	const { canvas, c, W, H } = newsprint(false);
	const edge = W * 0.06;
	const wide = W - 2 * edge;
	const hair = Math.max(1.5, W * 0.0018);
	c.fillStyle = INK;
	c.textBaseline = 'alphabetic';
	const rule = (at: number, thick = hair) => c.fillRect(edge, at, wide, thick);

	// The headline, under the rule that parted it from the story above: as large as goes on two
	// lines, and on more only if that would make it small. Its lines are the same length.
	let y = edge * 0.62;
	rule(y, W * 0.007);
	y += W * 0.007 + W * 0.012;
	let head = W * 0.125;
	const heading = () => {
		c.font = `900 ${head}px ${SERIF}`;
		return lines(c, article.headline, wide);
	};
	while (head > W * 0.05 && (heading().length > 2 || c.measureText(article.headline).width > wide * 1.96)) head -= 1;
	heading();
	for (const line of evenLines(c, article.headline, wide)) {
		y += head * 1.08;
		c.fillText(line.join(' '), edge, y);
	}

	// Under it, what the article is about.
	const stand = W * 0.0325;
	c.font = `italic 400 ${stand}px ${SERIF}`;
	y += stand * 0.5;
	for (const line of evenLines(c, article.standfirst, wide)) {
		y += stand * 1.27;
		c.fillText(line.join(' '), edge, y);
	}

	// Between two fine rules, who wrote it and whose it is, and at the far end the day it came
	// out: whichever of them there are, in capitals small enough to go on the one line.
	const credits = [article.byline, article.source.name].flatMap((each) => (each ? [each.toUpperCase()] : []));
	const dated = article.date ?? '';
	const apart = 1.6; // between one credit and the next, in ems
	let credit = W * 0.0175;
	const credited = () => {
		c.letterSpacing = `${credit * 0.14}px`;
		return credits.concat(dated).reduce((sum, each, n) => {
			c.font = `${n ? 500 : 800} ${credit}px ${SERIF}`;
			return sum + c.measureText(each).width + (each && n ? credit * apart : 0);
		}, 0);
	};
	while (credited() > wide && credit > W * 0.012) credit -= 0.25;
	y += stand * 0.75;
	rule(y);
	y += credit * 2;
	let x = edge;
	credits.forEach((each, n) => {
		c.font = `${n ? 500 : 800} ${credit}px ${SERIF}`;
		c.fillText(each, x, y);
		x += c.measureText(each).width + credit * apart;
		// A stroke between one and the next.
		if (n < credits.length - 1) c.fillRect(x - credit * (apart / 2 + 0.07), y - credit * 0.8, hair, credit * 0.95);
	});
	// The last letter's spacing is not left hanging over the margin.
	c.fillText(dated, edge + wide - c.measureText(dated).width + credit * 0.14, y);
	c.letterSpacing = '0px';
	y += credit * 1.1;
	rule(y);
	y += W * 0.02;

	// The article is set first, though it is printed last, since the photograph gets whatever
	// depth the type leaves. Two columns on the one set of baselines, the same length or the first
	// a line longer. The last line is the way to the rest of it.
	const gutter = W * 0.046;
	const column = (wide - gutter) / 2;
	const foot = H - edge * 0.72;
	const small = W * 0.0205;
	const onward = 'Continue reading on DMNS’s website…';
	// Its paragraphs in order, each with the heading it comes under, if it is the first to.
	const blocks = article.sections.flatMap((section, at) =>
		section.paragraphs.map((text, i) => ({
			text,
			heading: i ? undefined : section.heading,
			// Every paragraph but the first of all and the first under a heading is indented.
			indented: i > 0 || (at > 0 && !section.heading)
		}))
	);
	type Line =
		| { words: string[]; indent: number; full: boolean; opens: boolean }
		| { heading: string }
		| { onward: true };
	// The first `count` paragraphs in type of this size.
	const set = (size: number, count: number) => {
		c.font = `${size}px ${SERIF}`;
		const all: Line[] = [];
		const space = c.measureText(' ').width;
		// How gappy it comes out: over all the lines that are spread, how far past half as wide
		// again their spaces are.
		let gappy = 0;
		for (const block of blocks.slice(0, count)) {
			if (block.heading) all.push({ heading: block.heading });
			const indent = block.indented ? size * 1.1 : 0;
			const broken = spreadLines(c, block.text, column, indent);
			broken.forEach((words, n) => {
				const full = n < broken.length - 1;
				all.push({ words, indent: n ? 0 : indent, full, opens: n === 0 });
				const spare = column - (n ? 0 : indent) - c.measureText(words.join('')).width;
				if (full) gappy += Math.max(0, spare / Math.max(1, words.length - 1) / space - 1.5) ** 2;
			});
		}
		all.push({ onward: true });
		// How many lines of the column each takes: a heading has a line of room over it, unless it is
		// the first thing in its column, and the last line has half a line over it.
		const tall = (line: Line, first: boolean) => ('heading' in line ? (first ? 1 : 2) : 'onward' in line ? 1.5 : 1);
		const run = (from: number, to: number) =>
			all.slice(from, to).reduce((sum, line, n) => sum + tall(line, n === 0), 0);
		// The second column starts wherever leaves the two nearest the same length. Not straight
		// after a heading, which is not left at the foot of a column with nothing under it, and not,
		// if it can be helped, one line into a paragraph or one line short of its end.
		let turn = 1;
		let off = Infinity;
		for (let n = 1; n < all.length; n++) {
			const [before, after] = [all[n - 1], all[n]];
			if ('heading' in before) continue;
			const orphan = 'words' in before && before.opens && before.full;
			const widow = 'words' in after && !after.opens && !after.full;
			const by = Math.abs(run(0, n) - run(n, all.length) - 0.25) + (orphan || widow ? 1.5 : 0);
			if (by < off) [turn, off] = [n, by];
		}
		return { size, count, all, tall, turn, gappy, deep: Math.max(run(0, turn), run(turn, all.length)) };
	};
	// The photograph is all of the picture, or cropped a little in height. As many whole paragraphs
	// are printed as leave it that much room in the smallest type that reads well. Then the type is
	// as much larger as still lets those on, short of too large for so narrow a column, or a shade
	// smaller if the words happen to fall better so, and the lines are let out to take up what is
	// over.
	const photo = { w: wide, h: 0 };
	const under = small * 2.8; // what the caption takes, under the photograph
	const most = (wide * 2) / 3;
	const least = wide / 1.8;
	const fits = (type: ReturnType<typeof set>) => y + least + under + type.size * 1.3 * type.deep <= foot;
	const text = { least: W * 0.0225, most: W * 0.026 };
	let type = set(text.least, blocks.length);
	while (!fits(type) && type.count > 1) type = set(text.least, type.count - 1);
	for (let larger = set(type.size + 0.25, type.count); fits(larger) && larger.size <= text.most; ) {
		type = larger;
		larger = set(type.size + 0.25, type.count);
	}
	const largest = type.size;
	for (let n = 1; n <= 4 && largest - 0.25 * n >= text.least; n++) {
		const smaller = set(largest - 0.25 * n, type.count);
		if (smaller.gappy < type.gappy - 0.5) type = smaller;
	}
	const { size, all, tall, turn, deep } = type;
	photo.h = Math.max(least, Math.min(most, foot - y - under - size * 1.36 * deep));
	const first = y + photo.h + under + size * 0.95;
	const leading = Math.max(size * 1.2, Math.min(size * 1.42, (foot - first) / (deep - 1)));

	if (clippingPhoto) {
		const from = clippingPhoto;
		const scale = Math.max(photo.w / from.naturalWidth, photo.h / from.naturalHeight);
		c.save();
		c.beginPath();
		c.rect(edge, y, photo.w, photo.h);
		c.clip();
		// Cropped, it keeps a little more of its foot than of its top, where the people are.
		c.drawImage(
			from,
			edge + (photo.w - from.naturalWidth * scale) / 2,
			y + (photo.h - from.naturalHeight * scale) * 0.4,
			from.naturalWidth * scale,
			from.naturalHeight * scale
		);
		c.restore();
		// Newsprint has no white and no black.
		c.fillStyle = 'rgb(221 220 214 / 0.18)';
		c.fillRect(edge, y, photo.w, photo.h);
	} else {
		// Without it: a hillside, as near as a few shapes go.
		c.fillStyle = '#8d8a82';
		c.fillRect(edge, y, photo.w, photo.h);
		c.fillStyle = '#5f5c56';
		c.beginPath();
		c.ellipse(edge + photo.w * 0.3, y + photo.h, photo.w * 0.45, photo.h * 0.7, 0, Math.PI, 0);
		c.fill();
	}
	c.strokeStyle = 'rgb(34 33 31 / 0.55)';
	c.lineWidth = 1;
	c.strokeRect(edge + 0.5, y + 0.5, photo.w - 1, photo.h - 1);
	y += photo.h;
	c.fillStyle = INK;
	c.font = `italic ${small}px ${SERIF}`;
	c.fillText(article.caption, edge, y + small * 1.3);

	// A fine rule down the gutter, as deep as the columns.
	c.fillRect(edge + column + gutter / 2 - hair / 2, first - size * 0.72, hair, (deep - 1) * leading + size * 0.94);

	let link: Link | undefined;
	let top = first;
	all.forEach((line, n) => {
		const at = n < turn ? 0 : 1;
		const opens = n === 0 || n === turn;
		if (n === turn) top = first;
		const x = edge + at * (column + gutter);
		const rows = tall(line, opens);
		// Each sits on the last of the lines it takes.
		const base = top + (rows - 1) * leading;
		if ('heading' in line) {
			c.font = `800 ${size * 0.78}px ${SERIF}`;
			c.letterSpacing = `${size * 0.09}px`;
			c.fillText(line.heading.toUpperCase(), x, base);
			c.letterSpacing = '0px';
		} else if ('onward' in line) {
			// Underlined, in the blue of a link, and no wider than the column.
			c.font = `italic 500 ${size}px ${SERIF}`;
			const fitted = Math.min(size, (size * column) / c.measureText(onward).width);
			c.font = `italic 500 ${fitted}px ${SERIF}`;
			const across = c.measureText(onward).width;
			c.fillStyle = '#1d3f7a';
			c.fillText(onward, x, base);
			c.fillRect(x, base + fitted * 0.16, across, Math.max(1.5, fitted * 0.065));
			c.fillStyle = INK;
			// Where it is on the sheet, with some room round it for a finger.
			const room = fitted * 0.7;
			link = {
				href: article.source.href,
				u: [(x - room) / W, (x + across + room) / W],
				v: [1 - (base + room) / H, 1 - (base - fitted - room) / H]
			};
		} else {
			// Justified: the spare room in a line is shared out between its words.
			c.font = `${size}px ${SERIF}`;
			const words = line.words;
			const taken = words.reduce((sum, word) => sum + c.measureText(word).width, 0);
			const space = c.measureText(' ').width;
			const between = line.full && words.length > 1 ? (column - line.indent - taken) / (words.length - 1) : space;
			// A line that would be too gappy has some of it put between its letters instead.
			const letters = words.join('').length;
			const track = Math.min(size * 0.035, (Math.max(0, between - space * 2) * (words.length - 1)) / letters);
			c.letterSpacing = `${track}px`;
			let wx = x + line.indent;
			for (const word of words) {
				c.fillText(word, wx, base);
				wx += c.measureText(word).width + between - (track * letters) / (words.length - 1 || 1);
			}
			c.letterSpacing = '0px';
		}
		top += rows * leading;
	});
	creased(c, W, H);
	return { map: printed(canvas), link };
}

/**
 * The other side of the clipping, which is whatever was printed on the back of the article: the
 * columns of some other page, cut through wherever the scissors went. It is the side that shows
 * while the clipping is rolled up.
 */
function clippingBack() {
	const { canvas, c, W, H } = newsprint(true);
	let seed = 7;
	const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
	// Set a little off the cut, since nobody cut along these columns.
	const COLUMNS = 3;
	const gutter = W * 0.035;
	const column = W * 0.36;
	const line = H * 0.003;
	c.fillStyle = INK;
	for (let i = -1; i < COLUMNS; i++) {
		const x = W * 0.07 + i * (column + gutter);
		let y = -line * 3 * random();
		while (y < H) {
			// Now and then a headline, or a block that was a picture.
			const kind = random();
			if (kind < 0.005) {
				c.globalAlpha = 0.3;
				c.fillRect(x, y + line * 2, column, column * 0.6);
				y += column * 0.6 + line * 5;
			} else if (kind < 0.03) {
				c.globalAlpha = 0.8;
				for (let n = 0; n < 2; n++) c.fillRect(x, y + line * 2 + n * line * 5.5, column * (0.6 + 0.4 * random()), line * 3.2);
				y += line * 14;
			} else {
				// A paragraph ends on a short line.
				const ends = random() < 0.12;
				c.globalAlpha = 0.4;
				c.fillRect(x, y, column * (ends ? 0.3 + random() * 0.5 : 1), line);
				y += line * (ends ? 4.6 : 2.9);
			}
		}
	}
	c.globalAlpha = 1;
	creased(c, W, H);
	const map = printed(canvas);
	// Seen from behind, the sheet runs the other way across.
	map.wrapS = RepeatWrapping;
	map.repeat.x = -1;
	map.offset.x = 1;
	return map;
}

/**
 * The clipping: rolled up where it is kept, which is in the skull's eye socket (see ROLL), and
 * unrolled flat to be read when it is picked up. It is a sheet with no thickness and a side
 * printed on each face.
 */
function clipping() {
	const { W, L, ALONG, ACROSS } = SHEET;
	const count = (ALONG + 1) * (ACROSS + 1);
	const positions = new Float32BufferAttribute(new Float32Array(count * 3), 3);
	const uvs: number[] = [];
	const indices: number[] = [];
	for (let j = 0; j <= ALONG; j++) {
		for (let i = 0; i <= ACROSS; i++) uvs.push(i / ACROSS, 1 - j / ALONG);
	}
	for (let j = 0; j < ALONG; j++) {
		for (let i = 0; i < ACROSS; i++) {
			const p = j * (ACROSS + 1) + i;
			const q = p + ACROSS + 1;
			indices.push(p, q, p + 1, p + 1, q, q + 1);
		}
	}
	// One grid of points, and a face of the sheet made on each side of it: the same triangles,
	// wound the other way for the back, which gives each face normals of its own, pointing out of it.
	const faces = [indices, indices.map((_, n) => indices[n - (n % 3) + [0, 2, 1][n % 3]])].map((wound) => {
		const geometry = new BufferGeometry();
		geometry.setIndex(wound);
		geometry.setAttribute('position', positions);
		geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
		return geometry;
	});

	const article = catalogue.find((entry) => entry.id === 'clipping')!.article!;
	const paper = { roughness: 1, alphaTest: 0.5 };
	const g = new Group();
	// The paper gives off a little light of its own once it is out of the skull (see `lay`): it is
	// held up nearer the camera than the light on what is held reaches, and it has to be legible.
	const { map: read, link } = clippingFront(article);
	const front = new MeshStandardMaterial({ ...paper, map: read, emissive: 0xffffff, emissiveMap: read, emissiveIntensity: 0 });
	const inner = mesh(faces[0], front);
	// Only the back casts a shadow. A shadow is cast by the faces turned away from the light, and
	// rolled up those are the far side of the roll, as they would be of anything solid. The front's
	// would be the near side, which is the very surface the light falls on.
	inner.castShadow = false;
	g.add(inner);
	const other = clippingBack();
	const back = new MeshStandardMaterial({ ...paper, map: other, emissive: 0xffffff, emissiveMap: other, emissiveIntensity: 0 });
	g.add(mesh(faces[1], back));

	// Held, it is flat and faces out of its group, its middle where the middle of the roll was,
	// which is the point the scene brings in front of the camera.
	const flat = { turned: new Quaternion(), at: new Vector3(0, REST.height / 2, 0) };
	const turned = new Quaternion();
	const at = new Vector3();
	const point = new Vector3();
	/**
	 * Put the sheet where it is `u` of the way from kept to held. It comes straight out of the
	 * socket first, the way it went in. Then it turns to face out, and while it does it starts to
	 * unroll, which is the last thing to finish.
	 */
	const lay = (u: number) => {
		const facing = smooth(0.1, 0.55, u);
		turned.slerpQuaternions(REST.turned, flat.turned, facing);
		at.lerpVectors(REST.at, flat.at, facing).addScaledVector(REST.out, REST.pull * smooth(0, 0.15, u) * (1 - facing));
		const k = smooth(0.3, 1, u);
		front.emissiveIntensity = back.emissiveIntensity = 0.4 * facing;
		for (let j = 0; j <= ALONG; j++) {
			for (let i = 0; i <= ACROSS; i++) {
				clippingPoint((L * j) / ALONG, (W * i) / ACROSS, k, point).applyQuaternion(turned).add(at);
				positions.setXYZ(j * (ACROSS + 1) + i, point.x, point.y, point.z);
			}
		}
		positions.needsUpdate = true;
		for (const geometry of faces) {
			geometry.computeVertexNormals();
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
		}
	};
	lay(0);

	// The scene says how far it has been lifted out of the skull, and takes about half a second
	// over it, which is too quick to watch a sheet unroll in. So that is only taken as which way it is going: up, and
	// it unrolls in its own time, or back, and it is rolled up again well before it gets there.
	const UNROLL_S = 1.3;
	const ROLL_UP_S = 0.35;
	let u = 0;
	let goal = 0;
	let lifted = 0;
	const works: Works = {
		start: () => {},
		stop: () => {},
		dim: () => {},
		lifted: (share) => {
			if (share !== lifted) goal = share > lifted ? 1 : 0;
			lifted = share;
		},
		tick: (dt) => {
			if (u === goal) return false;
			u = goal > u ? Math.min(1, u + dt / UNROLL_S) : Math.max(0, u - dt / ROLL_UP_S);
			lay(u);
			// What is printed as a link is one only once the sheet is flat and can be read.
			inner.userData.links = u === 1 && link ? [link] : undefined;
			return u !== goal;
		}
	};
	g.userData.works = works;
	return g;
}

function skull() {
	// Facing forward (+z), with the frill standing up behind.
	const g = new Group();
	if (skullModel) {
		g.scale.setScalar(SKULL_LENGTH);
		g.add(mesh(skullModel.geometry, skullModel.bone));
		return g;
	}
	// The stand-in, resting on its jaw line.
	g.scale.setScalar(SKULL_SCALE);
	g.add(box(0.22, 0.2, 0.3, light, 0, 0, 0.02)); // the cranium
	g.add(box(0.14, 0.13, 0.2, light, 0, 0, 0.25)); // the snout
	const beak = horn(0.15, 0.06, light);
	beak.position.set(0, 0.07, 0.33);
	beak.rotation.x = Math.PI / 2 + 0.35; // hooked forward and down
	g.add(beak);
	// The frill: a broad disc on edge, tipped back.
	const frill = mesh(new CylinderGeometry(0.25, 0.25, 0.035, 40), light, 0, 0.28, -0.14);
	frill.scale.x = 1.12;
	frill.rotation.x = Math.PI / 2 - 0.45;
	g.add(frill);
	// The two long brow horns, and the short one on the nose.
	for (const side of [-1, 1]) {
		const brow = horn(0.36, 0.034, light);
		brow.position.set(side * 0.08, 0.18, 0.1);
		brow.rotation.set(0.95, 0, -side * 0.16);
		g.add(brow);
	}
	const nose = horn(0.1, 0.03, light);
	nose.position.set(0, 0.12, 0.3);
	nose.rotation.x = 0.35;
	g.add(nose);
	return g;
}

/**
 * Lettering to go down a book's spine: a strip `length` by `width` (world units) with `text` set
 * along it, on a clear ground. Turned so that it reads from the top of the book to the bottom.
 */
function spineTitle(text: string, length: number, width: number, ink: string) {
	const PX = 1600; // per world unit
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(length * PX);
	canvas.height = Math.round(width * PX);
	const c = canvas.getContext('2d')!;
	const size = canvas.height * 0.5;
	const font = (px: number) => `600 ${px}px system-ui, sans-serif`;
	c.font = font(size);
	// Shrunk, if need be, to fit the spine's length.
	const room = canvas.width * 0.88;
	c.font = font(size * Math.min(1, room / c.measureText(text).width));
	c.fillStyle = ink;
	c.textAlign = 'center';
	c.textBaseline = 'middle';
	c.fillText(text, canvas.width / 2, canvas.height / 2);
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	map.anisotropy = 8;
	const m = new Mesh(
		new PlaneGeometry(length, width),
		new MeshStandardMaterial({ map, transparent: true, roughness: 0.9 })
	);
	m.rotation.z = -Math.PI / 2;
	return m;
}

/**
 * A book standing up with its spine to the front and its title down the spine. The front cover
 * is its right-hand face.
 */
function book(thick: number, tall: number, deep: number, cover: MeshStandardMaterial, title: string) {
	return () => {
		const g = new Group();
		g.add(box(thick, tall, deep, cover));
		// The pages, set in a little from the covers on three sides.
		g.add(box(thick * 0.72, tall - 0.014, deep - 0.012, page, 0, 0.007, -0.008));
		// Light lettering on a dark cover, dark on a light one.
		const hsl = cover.color.getHSL({ h: 0, s: 0, l: 0 });
		const lettering = spineTitle(title, tall, thick, hsl.l > 0.35 ? '#1b1b1d' : '#e6e1d4');
		lettering.position.set(0, tall / 2, deep / 2 + 0.001);
		g.add(lettering);
		return g;
	};
}

// The skull stands on its teeth at the left end, side on, its beak just short of the wall and its
// frill standing up at the other end like a shield. The books stand in a row to the right of it
// and lean left into the back of the frill. The first is the shortest, which lets it tuck in under
// the frill's rim, and each of the others rests on the one before. Leaning at the same angle,
// their bottom-left edges are a thickness apart measured along the shelf, which is a little more
// than the thickness itself.
const SKULL_X = -0.18;
const SKULL_BACK = 0.5; // how far back its middle is, as a share of the shelf's depth
const SKULL_YAW = -Math.PI / 2;
const SKULL_LENGTH = 0.7; // the scanned skull, from beak to frill
const SKULL_SCALE = 0.8; // its stand-in
const BOOK_LEAN = 0.1;
const BOOKS_FROM = SKULL_X + 0.3377; // where the first book's bottom-left edge sits
const volumes: [thick: number, tall: number, deep: number, cover: MeshStandardMaterial][] = [
	[0.07, 0.46, 0.34, dark],
	[0.05, 0.4, 0.3, mid],
	[0.085, 0.44, 0.34, light],
	[0.055, 0.37, 0.28, accent],
	[0.065, 0.42, 0.32, mid]
];
// The order they stand in, from the skull outward.
const SHELVED = [3, 1, 4, 2, 0];
const TUCKED = SHELVED[0];

let edge = BOOKS_FROM;
const books: Placement[] = SHELVED.map((i) => {
	const [thick, tall, deep, cover] = volumes[i];
	const id = `book-${i + 1}`;
	// The title on the spine is the book's name in the catalogue.
	const title = catalogue.find((entry) => entry.id === id)!.label;
	const x = edge + (thick / 2) * Math.cos(BOOK_LEAN);
	edge += thick / Math.cos(BOOK_LEAN);
	return {
		id,
		shelf: 2,
		x,
		// Centred on the frill from front to back, whatever the book's depth.
		back: 0.5,
		lean: BOOK_LEAN,
		// The one tucked in under the frill stays there: it could not come out past the skull.
		fixed: i === TUCKED,
		// Front cover to the viewer, turned enough to show the spine as well.
		held: { pitch: 0.12, yaw: -Math.PI / 2 + 0.45 },
		build: book(thick, tall, deep, cover, title)
	};
});

// The clipping's sheet, in the room's units: as wide as the roll is long, and as long as it takes
// to wind that many turns from the core out to the roll's radius, which leaves `gap` between one
// turn and the next. It is this many px across when it is printed, and is drawn as a grid, ALONG
// by ACROSS, fine enough along it to go round the core smoothly.
const SHEET = {
	W: (ROLL.inside + ROLL.outside) * SKULL_LENGTH,
	L: Math.PI * (ROLL.r + ROLL.core) * ROLL.turns * SKULL_LENGTH,
	core: ROLL.core * SKULL_LENGTH,
	gap: ((ROLL.r - ROLL.core) / ROLL.turns) * SKULL_LENGTH,
	inside: ROLL.inside * SKULL_LENGTH,
	outside: ROLL.outside * SKULL_LENGTH,
	PX: 1024,
	ALONG: 260,
	ACROSS: 10
};

// How the rolled-up clipping lies in the socket, worked out once: it is needed to place it on the
// shelf as well as to build it. The sheet's own frame (see clippingPoint) is `turned` and put
// `at` this, in a frame that stands as the room does with its origin under the middle of the
// roll, at its lowest point, which is what the scene wants of an object (`base` is where that is
// from the skull's own origin on the shelf). `out` is the way the roll points, which is the way
// it is pulled out of the socket, by `pull`. `height` is how tall the roll stands.
const REST = (() => {
	const { W, L, ALONG, ACROSS, core, gap, inside } = SHEET;
	const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), SKULL_YAW);
	const turned = yaw
		.clone()
		.multiply(new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), ROLL.toward))
		.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), ROLL.spin));
	// The point on the roll's axis that is level with the socket goes in the middle of the socket.
	const axis = new Vector3(inside - W / 2, L / 2, Math.sqrt(core * core + (L * gap) / Math.PI));
	const at = ROLL.at.clone().multiplyScalar(SKULL_LENGTH).applyQuaternion(yaw).sub(axis.applyQuaternion(turned));
	const low = new Vector3(Infinity, Infinity, Infinity);
	const high = low.clone().negate();
	const point = new Vector3();
	for (let j = 0; j <= ALONG; j++) {
		for (let i = 0; i <= ACROSS; i++) {
			clippingPoint((L * j) / ALONG, (W * i) / ACROSS, 0, point).applyQuaternion(turned).add(at);
			low.min(point);
			high.max(point);
		}
	}
	const base = new Vector3((low.x + high.x) / 2, low.y, (low.z + high.z) / 2);
	return {
		turned,
		at: at.sub(base),
		base,
		out: ROLL.toward.clone().applyQuaternion(yaw),
		pull: inside + 0.03,
		height: high.y - low.y
	};
})();

// The game's box: black, printed all over with a tangle of line art in dull gold, and lettered in
// white. Long and short are its lid's sides, and it is this deep, lying flat.
const GAME = { long: 0.72, short: 0.52, h: 0.16 };
const GAME_PX = 1400; // of a printed face, per world unit
const GAME_BLACK = '#070708';
const GAME_GOLD = '#b8a273';
const GAME_WHITE = '#f1efe9';

/**
 * One printed face of the game's box, `w` by `h` (world units), as a material: the line art (what
 * `ground` lays down, if that is given, or something made up in the real box's manner), with
 * whatever `print` draws over it. `print` is given the canvas's size and how many of its px
 * make a printed line's width. The same `seed` gives the same art.
 */
function gameFace(
	w: number,
	h: number,
	seed: number,
	print: (c: CanvasRenderingContext2D, W: number, H: number, line: number) => void,
	ground?: (c: CanvasRenderingContext2D) => void
) {
	const PX = GAME_PX;
	const canvas = document.createElement('canvas');
	const W = (canvas.width = Math.round(w * PX));
	const H = (canvas.height = Math.round(h * PX));
	const c = canvas.getContext('2d')!;
	const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
	const between = (low: number, high: number) => low + (high - low) * random();
	const line = PX * 0.0016;
	c.fillStyle = GAME_BLACK;
	c.fillRect(0, 0, W, H);
	c.strokeStyle = GAME_GOLD;
	c.lineWidth = line;
	c.lineCap = c.lineJoin = 'round';

	if (ground) ground(c);
	else {
		// The art is in the manner of the real box's, not a copy of it: solid gold shapes with black
		// drawing inside them, one over another, with black left showing between. Each kind of shape
		// is drawn with a black edge round it, so that it parts from whatever is under it.
		type Point = [x: number, y: number];
		type Spine = [x: number, y: number, heading: number][];
		const TURN = Math.PI * 2;
		const anywhere = (): Point => [random() * W, random() * H];
		/** A path that wanders from a point: `steps` of `stride`, turning by no more than `turn` at each. */
		const wander = ([x, y]: Point, steps: number, stride: number, turn: number) => {
			const spine: Spine = [];
			let heading = random() * TURN;
			let curl = 0;
			for (let n = 0; n <= steps; n++) {
				spine.push([x, y, heading]);
				curl = Math.max(-turn, Math.min(turn, curl + between(-turn, turn) * 0.35));
				heading += curl;
				x += Math.cos(heading) * stride;
				y += Math.sin(heading) * stride;
			}
			return spine;
		};
		/** The line this far to one side of a path, all the way along it. */
		const beside = (spine: Spine, offset: (n: number) => number): Point[] =>
			spine.map(([x, y, a], n) => [x - Math.sin(a) * offset(n), y + Math.cos(a) * offset(n)]);
		const trace = (points: Point[], closed = false) => {
			c.beginPath();
			points.forEach(([x, y], n) => (n ? c.lineTo(x, y) : c.moveTo(x, y)));
			if (closed) c.closePath();
		};
		const ink = (style: string, width: number) => {
			c.strokeStyle = style;
			c.lineWidth = width;
			c.stroke();
		};
		const flood = (style: string) => {
			c.fillStyle = style;
			c.fill();
		};
		const STRIDE = 0.006 * PX;

		/** A tapering arm: solid, with a seam down it and creases across, or in outline with suckers. */
		const arm = () => {
			const r = between(0.008, 0.034) * PX;
			const steps = Math.round(between(35, 85));
			// Never curled tighter than it is thick.
			const spine = wander(anywhere(), steps, STRIDE, STRIDE / (1.6 * r));
			const girth = (n: number) => r * (1 - n / (steps + 1)) ** 0.8 + line;
			const outline = [...beside(spine, girth), ...beside(spine, (n) => -girth(n)).reverse()];
			const solid = random() < 0.62;
			trace(outline, true);
			ink(GAME_BLACK, line * 5);
			flood(solid ? GAME_GOLD : GAME_BLACK);
			if (!solid) ink(GAME_GOLD, line * 1.6);
			const detail = solid ? GAME_BLACK : GAME_GOLD;
			trace(beside(spine, (n) => girth(n) * 0.42));
			ink(detail, line * 1.2);
			c.beginPath();
			for (let n = 2; n < steps - 4; n += solid ? 3 : 4) {
				const [x, y, a] = spine[n];
				const g = girth(n);
				if (solid) {
					// A crease from one edge to the seam.
					c.moveTo(x + Math.sin(a) * g, y - Math.cos(a) * g);
					c.lineTo(x - Math.sin(a) * g * 0.42, y + Math.cos(a) * g * 0.42);
				} else {
					const sx = x + Math.sin(a) * g * 0.35;
					const sy = y - Math.cos(a) * g * 0.35;
					c.moveTo(sx + g * 0.3, sy);
					c.arc(sx, sy, g * 0.3, 0, TURN);
				}
			}
			ink(detail, line * 1.1);
		};

		/** A lock of hair: strands that start together and spread, each with a wave of its own. */
		const lock = () => {
			const steps = Math.round(between(50, 115));
			const spine = wander(anywhere(), steps, STRIDE, 0.09);
			const spread = between(0.004, 0.009) * PX;
			const count = Math.round(between(7, 15));
			const strands = Array.from({ length: count }, (_, k) => {
				const lane = k - (count - 1) / 2;
				const fan = between(0.6, 1.5);
				const phase = random() * TURN;
				return {
					points: beside(
						spine,
						(n) => lane * spread * (0.35 + (fan * n) / steps) + Math.sin(n * 0.15 + phase) * spread * 0.5
					),
					width: line * between(0.9, 2.4)
				};
			});
			for (const strand of strands) {
				trace(strand.points);
				ink(GAME_BLACK, strand.width + line * 3);
			}
			for (const strand of strands) {
				trace(strand.points);
				ink(GAME_GOLD, strand.width);
			}
		};

		/** A row of hooked teeth along a curve. */
		const teeth = () => {
			const size = between(0.014, 0.034) * PX;
			const spine = wander(anywhere(), Math.round(between(4, 9)), size * 0.75, 0.25);
			const side = random() < 0.5 ? -1 : 1;
			for (let n = 0; n + 1 < spine.length; n++) {
				const [ax, ay, a] = spine[n];
				const [bx, by] = spine[n + 1];
				const reach = size * between(1.1, 1.9) * side;
				const tx = (ax + bx) / 2 - Math.sin(a) * reach + Math.cos(a) * size * 0.4;
				const ty = (ay + by) / 2 + Math.cos(a) * reach + Math.sin(a) * size * 0.4;
				c.beginPath();
				c.moveTo(ax, ay);
				c.quadraticCurveTo(ax - Math.sin(a) * reach * 0.5, ay + Math.cos(a) * reach * 0.5, tx, ty);
				c.quadraticCurveTo((bx + tx) / 2, (by + ty) / 2, bx, by);
				c.closePath();
				ink(GAME_BLACK, line * 4);
				flood(GAME_GOLD);
			}
		};

		/** A lump of something, cracked. */
		const lump = () => {
			const [x, y] = anywhere();
			const r = between(0.01, 0.036) * PX;
			const turn = random() * TURN;
			const rim: Point[] = Array.from({ length: 9 }, (_, n) => {
				const reach = r * between(0.55, 1.25);
				return [x + Math.cos(turn + (n / 9) * TURN) * reach, y + Math.sin(turn + (n / 9) * TURN) * reach];
			});
			// Rounded off: through the middle of each side, bending at each corner.
			const mid = (n: number): Point => {
				const [ax, ay] = rim[n % 9];
				const [bx, by] = rim[(n + 1) % 9];
				return [(ax + bx) / 2, (ay + by) / 2];
			};
			c.beginPath();
			c.moveTo(...mid(0));
			for (let n = 1; n <= 9; n++) c.quadraticCurveTo(...rim[n % 9], ...mid(n));
			c.closePath();
			ink(GAME_BLACK, line * 4);
			flood(GAME_GOLD);
			for (let n = Math.round(between(2, 4)); n > 0; n--) {
				trace(beside(wander([x + between(-0.4, 0.4) * r, y + between(-0.4, 0.4) * r], 5, r * 0.2, 0.7), () => 0));
				ink(GAME_BLACK, line * 1.1);
			}
		};

		/** An eye, with its lid's crease over it. */
		const eye = () => {
			const [x, y] = anywhere();
			const w = between(0.034, 0.06) * PX;
			c.save();
			c.translate(x, y);
			c.rotate(between(-0.5, 0.5));
			c.beginPath();
			c.ellipse(0, -w * 0.15, w * 1.25, w * 0.9, 0, 0, TURN);
			flood(GAME_BLACK);
			c.beginPath();
			c.moveTo(-w, 0);
			c.quadraticCurveTo(0, -w * 0.9, w, 0);
			c.quadraticCurveTo(0, w * 0.6, -w, 0);
			c.closePath();
			ink(GAME_GOLD, line * 2.4);
			c.beginPath();
			c.moveTo(-w * 1.05, -w * 0.3);
			c.quadraticCurveTo(0, -w * 1.3, w * 1.1, -w * 0.25);
			ink(GAME_GOLD, line * 1.3);
			c.beginPath();
			c.arc(0, -w * 0.06, w * 0.36, 0, TURN);
			flood(GAME_GOLD);
			c.beginPath();
			c.arc(0, -w * 0.06, w * 0.26, 0, TURN);
			ink(GAME_BLACK, line);
			c.beginPath();
			c.arc(0, -w * 0.06, w * 0.15, 0, TURN);
			flood(GAME_BLACK);
			c.restore();
		};

		// A little loose hatching under everything.
		c.beginPath();
		for (let i = Math.round(w * h * 250); i > 0; i--) {
			const [x, y] = anywhere();
			const a = random() * Math.PI;
			const l = between(0.004, 0.014) * PX;
			c.moveTo(x, y);
			c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
		}
		ink(GAME_GOLD, line);

		// So many of each to the square unit, in no order.
		const kinds: [draw: () => void, density: number][] = [
			[arm, 62],
			[lump, 55],
			[teeth, 20],
			[lock, 20],
			[eye, 6]
		];
		const jobs = kinds.flatMap(([draw, density]) => Array(Math.round(w * h * density)).fill(draw));
		for (let n = jobs.length - 1; n > 0; n--) {
			const k = Math.floor(random() * (n + 1));
			[jobs[n], jobs[k]] = [jobs[k], jobs[n]];
		}
		for (const draw of jobs as (() => void)[]) draw();
	}

	print(c, W, H, line);
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	map.anisotropy = 8;
	return new MeshStandardMaterial({ map, roughness: 0.55 });
}

// The face that mothersheet.com sets its name and its M in.
const GAME_FACE = 'Monoton';
// The drawing on the real box's lid, once fetched: flattened out of a photograph of the box, with
// its long sides to the left and right, as the box is built.
let gameLid: HTMLImageElement | undefined;

// The photograph that is printed on the clipping, if it has been saved in the assets as
// dig-site: without it, a grey block stands in for it.
const digSite = Object.values(
	import.meta.glob<string>('../assets/dig-site.{jpg,jpeg,png,webp}', {
		eager: true,
		query: '?url',
		import: 'default'
	})
)[0];
let clippingPhoto: HTMLImageElement | undefined;

// The fliers on the board: the pictures saved in the assets' fliers folder, in the order of their
// names, which `npm run fliers` puts there (see scripts/set-fliers.js). A flier is its picture
// and nothing else, so there are only as many fliers as pictures.
const flierArt = Object.entries(
	import.meta.glob<string>('../assets/fliers/*.{jpg,jpeg,png,webp}', {
		eager: true,
		query: '?url',
		import: 'default'
	})
)
	.sort(([a], [b]) => a.localeCompare(b))
	.map(([, url]) => url);
/** Those pictures, once fetched: each where its flier looks for it. */
const flierPrints: (HTMLImageElement | undefined)[] = [];

/**
 * Fetch what the objects are printed with: a typeface and a picture. They are drawn on canvases,
 * which use whatever is to hand when they are drawn, so this is to be done before any object is
 * built. Whatever cannot be had is done without.
 */
export async function loadPrinting() {
	const face = new FontFace(GAME_FACE, `url(${monoton})`);
	// Every weight of the clipping's face is in the one file, and its italic in another.
	const news = [
		new FontFace(NEWS_FACE, `url(${fraunces})`, { weight: '100 900' }),
		new FontFace(NEWS_FACE, `url(${frauncesItalic})`, { weight: '100 900', style: 'italic' })
	];
	const lid = new Image();
	lid.src = mothershipLid;
	const photo = new Image();
	if (digSite) photo.src = digSite;
	const prints = flierArt.map((url) => Object.assign(new Image(), { src: url }));
	await Promise.allSettled([
		face.load().then((loaded) => document.fonts.add(loaded)),
		...news.map((each) => each.load().then((loaded) => document.fonts.add(loaded))),
		lid.decode().then(() => (gameLid = lid)),
		digSite ? photo.decode().then(() => (clippingPhoto = photo)) : undefined,
		...prints.map((print, i) => print.decode().then(() => (flierPrints[i] = print)))
	]);
}

/**
 * `text` in the game's own face, in white: centred here, and as large as fits in `w` by `h`. The
 * face is all fine stripes, so the art is blacked out behind it and a little way round.
 */
function gameLettering(c: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number) {
	const font = (px: number) => `${px}px ${GAME_FACE}, system-ui, sans-serif`;
	c.textAlign = 'center';
	c.textBaseline = 'alphabetic';
	c.font = font(100);
	// Fitted and centred by the ink itself, not the space the face allows round it.
	const m = c.measureText(text);
	const wide = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
	const tall = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
	const scale = Math.min(w / wide, h / tall);
	c.font = font(100 * scale);
	const left = x + ((m.actualBoundingBoxLeft - m.actualBoundingBoxRight) * scale) / 2;
	const base = y + ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) * scale) / 2;
	c.lineJoin = 'round';
	c.strokeStyle = GAME_BLACK;
	c.lineWidth = Math.min(tall * scale * 0.16, 22);
	c.strokeText(text, left, base);
	c.fillStyle = GAME_WHITE;
	c.fillText(text, left, base);
}

// How far the frame on the lid is set in from its edges. The frames on the sides are set in as
// far from the box's corners, so that their uprights meet the lid's lines at its edge.
const GAME_INSET = 0.075 * GAME.short;

/**
 * The fine white frame that each face of the game's box has, set in GAME_INSET from its left and
 * right edges, given as a share of its width, and `drop` px from its top and bottom.
 */
function gameFrame(c: CanvasRenderingContext2D, W: number, H: number, inset: number, drop: number, line: number) {
	c.strokeStyle = GAME_WHITE;
	c.lineWidth = line * 3; // heavier than it is printed, to show from across the room
	c.lineJoin = 'miter';
	c.strokeRect(W * inset, drop, W * (1 - 2 * inset), H - 2 * drop);
}

/**
 * A board game in its box, lying flat with its long sides to the left and right: the game's name
 * along each of those, the mark and the edition on each end, and the mark on the lid, which is
 * the right way up seen from the left.
 */
function gameBox() {
	const { long, short, h } = GAME;

	// The real lid's drawing, as it is printed here: at the faces' own scale, and enlarged from its
	// middle by enough to lose what is printed round its edge (a frame finer than the one drawn
	// here, and the publisher's mark in one corner). Its own mark, a little off the middle, is
	// blacked out, with the trade mark sign beside it, leaving a plate for this game's to go on.
	const ZOOM = 1.19;
	let drawing: HTMLCanvasElement | undefined;
	if (gameLid) {
		drawing = document.createElement('canvas');
		const W = (drawing.width = Math.round(short * GAME_PX));
		const H = (drawing.height = Math.round(long * GAME_PX));
		const c = drawing.getContext('2d')!;
		c.translate(W / 2, H / 2);
		c.scale(ZOOM, ZOOM);
		c.translate(-W / 2, -H / 2);
		c.drawImage(gameLid, 0, 0, W, H);
		c.fillStyle = GAME_BLACK;
		c.fillRect(W * 0.236, H * 0.3, W * 0.53, H * 0.414);
	}
	/**
	 * What lays a cutting of the drawing on a face: the drawing moved and turned by this
	 * transform, but never scaled, so that every face is printed at the lid's size. With `fold`,
	 * the cutting stops that many px down the face and is carried on by its own reflection: a
	 * strip that is narrower than the face, doubled back to cover it.
	 */
	const cutting = ([a, b, c2, d, e, f]: [number, number, number, number, number, number], fold?: number) => {
		const from = drawing;
		if (!from) return undefined;
		return (c: CanvasRenderingContext2D) => {
			c.setTransform(a, b, c2, d, e, f);
			c.drawImage(from, 0, 0);
			c.resetTransform();
			if (fold === undefined) return;
			c.save();
			c.beginPath();
			c.rect(0, fold, c.canvas.width, c.canvas.height - fold);
			c.clip();
			c.setTransform(a, -b, c2, -d, e, 2 * fold - f);
			c.drawImage(from, 0, 0);
			c.restore();
		};
	};
	const W = short * GAME_PX;
	const H = long * GAME_PX;

	const lid = gameFace(
		short,
		long,
		11,
		(c, W, H, line) => {
			// The frame, and the mark in the middle of it, the right way up seen from the long side
			// that is on the box's left: drawn as that view has it, `long` across, and turned to suit.
			c.translate(W / 2, H / 2);
			c.rotate(Math.PI / 2);
			c.translate(-H / 2, -W / 2);
			gameFrame(c, H, W, GAME_INSET / long, (W * GAME_INSET) / short, line);
			// On the plate where the real box's mark was, if that is what it covers.
			if (drawing) gameLettering(c, 'M', H * 0.508, W * 0.4986, W * 0.83, W * 0.55);
			else gameLettering(c, 'M', H / 2, W / 2, W * 0.7, W * 0.46);
		},
		cutting([1, 0, 0, 1, 0, 0])
	);

	// Each long side is a strip from along that side of the lid, turned to lie along it with what
	// was the lid's edge uppermost. The strip is as wide as there is drawing clear of the plate,
	// which is less than the side is tall, so it is folded back to make up the rest.
	const named = (c: CanvasRenderingContext2D, W: number, H: number, line: number) => {
		gameFrame(c, W, H, GAME_INSET / long, H * 0.14, line);
		gameLettering(c, 'MOTHERSHEET', W / 2, H / 2, W * 0.78, H * 0.4);
	};
	const left = gameFace(long, h, 7, named, cutting([0, 1, -1, 0, H, 0], W * 0.18));
	const right = gameFace(long, h, 8, named, cutting([0, -1, 1, 0, 0, W], W * 0.18));

	// Each end is a strip from across that end of the lid, clear of the mark.
	const marked = (c: CanvasRenderingContext2D, W: number, H: number, line: number) => {
		gameFrame(c, W, H, GAME_INSET / short, H * 0.14, line);
		gameLettering(c, 'M', W * 0.22, H / 2, W * 0.3, H * 0.44);
		c.font = `italic 800 ${H * 0.25}px system-ui, sans-serif`;
		c.textAlign = 'center';
		c.textBaseline = 'middle';
		c.fillStyle = GAME_WHITE;
		c.fillText('DELUXE SET', W * 0.62, H * 0.52);
	};
	const back = gameFace(short, h, 5, marked, cutting([1, 0, 0, 1, 0, -H * 0.02]));
	const front = gameFace(short, h, 6, marked, cutting([1, 0, 0, 1, 0, -H * 0.765]));

	const under = new MeshStandardMaterial({ color: GAME_BLACK, roughness: 0.8 });
	const g = new Group();
	// A box's faces in three.js's order: right, left, top, bottom, front, back.
	g.add(box(short, h, long, [right, left, lid, under, front, back]));
	return g;
}

// The widest a flier is hung: one that is wider than it is tall is made smaller to keep to this,
// so that it does not lie over the one beside it.
const FLIER_WIDEST = 0.46;

/**
 * A show flier, flat against the wall and facing out, with a pin through its top: one of the
 * pictures in the assets (see flierArt), on a sheet of that picture's proportions and about as
 * much paper as `w` by `h`. `x` is where along the wall it is, and `lean` how crooked: the air
 * from the door reaches it later the further off it is, and what part of it is behind the rack
 * cannot lift far.
 */
function flier(index: number, w: number, h: number, x: number, lean: number) {
	const far = HOOK.x - x;
	const art = flierPrints[index];
	let map: Texture | undefined;
	if (art) {
		const shape = art.naturalWidth / art.naturalHeight;
		const area = w * h;
		h = Math.sqrt(area / shape);
		w = h * shape;
		const fit = Math.min(1, FLIER_WIDEST / w);
		w *= fit;
		h *= fit;
		map = new Texture(art);
		map.colorSpace = SRGBColorSpace;
		map.anisotropy = 8;
		map.needsUpdate = true;
	}

	const g = new Group();
	// Taken down, it is something to read: held as near as fills the window (see Placement.page,
	// which cannot say this for it, since its size is not known until its picture is).
	g.userData.page = { w, h };
	// In strips down it, for the paper to bend by. The printing is a sheet of its own, laid on the
	// paper, so the paper is made without its front: of two faces that close together, bending as
	// one, a phone cannot always tell which is in front, and the paper showed through in triangles.
	const stock = new BoxGeometry(w, h, 0.004, 4, 12, 1);
	const facing = stock.groups[4]; // a box's faces come right, left, top, bottom, front, back
	const faces = Array.from(stock.index!.array);
	faces.splice(facing.start, facing.count);
	stock.setIndex(faces);
	stock.clearGroups();
	const sheet = mesh(stock, page);
	// A picture that could not be had leaves the paper blank.
	const front = new Mesh(new PlaneGeometry(w, h, 4, 12), map ? new MeshStandardMaterial({ map, roughness: 0.95 }) : page);
	front.position.z = 0.0025;
	const PIN = h / 2 - 0.022;
	g.add(sheet, front);
	g.add(mesh(new SphereGeometry(0.016, 12, 8), accent, 0, PIN, 0.012));

	// The air from the door (see tie.ts) gets under the paper. It turns a little on its pin, away
	// from the door, and its foot comes off the board, one corner more than the other, with a
	// shiver across it. No two go quite alike.
	const lag = 0.5 * far + 0.3 * index;
	const give = 0.8 + 0.1 * ((index * 3) % 5);
	const sheets = [sheet.geometry, front.geometry].map((geometry) => ({
		geometry,
		still: Float32Array.from(geometry.attributes.position.array)
	}));
	// The rack's left side, along the wall: its posts stand a touch proud of that too.
	const RACK_LEFT = -(RACK_WIDTH / 2 + BOARD) - 0.005;
	const cos = Math.cos(lean);
	const sin = Math.sin(lean);
	const pose = (t: number, strength: number) => {
		const blowing = air(t - lag) * strength * give;
		const turn = blowing * 0.032 * (0.7 + 0.3 * Math.sin(2.9 * t + index));
		const out = blowing * 0.2 * (0.75 + 0.25 * Math.sin(4.3 * t + 2 * index));
		// How far the paper's face is from the back of the rack, where it is now: it may have been
		// brought forward under the pointer.
		const gap = Math.max(0, RACK_BACK - 0.004 - g.position.z - 0.0045);
		for (const { geometry, still } of sheets) {
			const at = geometry.attributes.position;
			for (let i = 0; i < at.count; i++) {
				const x = still[i * 3];
				const y = still[i * 3 + 1];
				const down = Math.max(0, (PIN - y) / (PIN + h / 2)); // from the pin (0) to the foot (1)
				const across = x / (w / 2);
				const curl = down ** 1.7;
				const shiver = blowing * 0.004 * Math.sin(7 * (t - lag) - 4 * down + 1.5 * across);
				const px = x - turn * (PIN - y);
				const py = y + turn * x;
				let lifted = curl * (out * (1 - 0.35 * across) + shiver);
				if (lifted > 0) {
					// Behind the rack it comes up against the back of it and lies along that, never
					// through it. A sheet that is only partly behind is held over that part alone.
					const k = Math.min(1, Math.max(0, (g.position.x + px * cos - py * sin - (RACK_LEFT - 0.06)) / 0.05));
					const behind = k * k * (3 - 2 * k);
					const held = gap ? gap * (1 - Math.exp(-lifted / gap)) : 0;
					lifted += behind * (held - lifted);
				}
				at.setXYZ(i, px, py, still[i * 3 + 2] + lifted);
			}
			at.needsUpdate = true;
			geometry.computeVertexNormals();
			// What a pointer is over is found by these.
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
		}
	};
	g.userData.works = blown(front, pose);
	return g;
}

// Pinned up none too carefully: where along the wall, how high, how crooked, and its size. There
// is a flier at each of these for as many pictures as there are, in the order of their names.
const pinned: [number, number, number, number, number][] = [
	[-1.43, 2.05, 0.05, 0.34, 0.48],
	[-0.94, 2.1, -0.04, 0.36, 0.49],
	[-0.4, 2.07, 0.03, 0.34, 0.48],
	[-1.19, 1.52, -0.06, 0.34, 0.46],
	[-0.57, 1.51, 0.07, 0.36, 0.49]
];
const fliers: Placement[] = pinned.slice(0, flierArt.length).map(([x, up, lean, w, h], i) => ({
	id: `flier-${i + 1}`,
	shelf: WALL,
	x,
	up,
	lean,
	pinned: true,
	build: () => flier(i, w, h, x, lean)
}));

const placements: Placement[] = [
	{ id: 'tv', shelf: 0, x: TV_X, back: TV_BACK, yaw: TV_YAW, fixed: true, build: tv },
	{ id: 'cat', shelf: 0, x: -0.36, back: 0.26, yaw: 0.2, fixed: true, build: catBed },
	{ id: 'video-module', shelf: 1, x: 0, flush: PANEL_HEIGHT, fixed: true, build: videoModule },
	{
		id: 'skull',
		shelf: 2,
		x: SKULL_X,
		back: SKULL_BACK,
		yaw: SKULL_YAW,
		// Face to the viewer and turned half left, to show a horn, an eye and the frill behind them.
		held: { pitch: 0.1, yaw: -0.6 },
		build: skull
	},
	{
		// In the skull's eye socket, wherever on the shelf that puts it (see REST).
		id: 'clipping',
		shelf: 2,
		x: SKULL_X + REST.base.x,
		back: SKULL_BACK - REST.base.z / RACK_DEPTH,
		up: REST.base.y,
		rides: 'skull',
		page: { w: SHEET.W, h: SHEET.L },
		build: clipping
	},
	...books,
	{
		id: 'mothersheet',
		shelf: FLOOR,
		x: -0.02,
		back: 0.5,
		// Its left side to the front, and askew: pushed under there, not put.
		yaw: Math.PI / 2 - 0.16,
		// Lid to the viewer with the same side nearest, tipped and turned to show that and an end.
		held: { pitch: 0.95, yaw: Math.PI / 2 - 0.4 },
		build: gameBox
	},
	...fliers,
	{ id: 'tie', shelf: WALL, x: HOOK.x, up: HOOK.y, lean: -0.03, link: true, out: 0.03, build: tie },
	{ id: 'cassette', shelf: 3, x: 0, flush: PANEL_HEIGHT, fixed: true, build: cassettePlayer }
];

export const items: Item[] = placements.map((placement) => ({
	...catalogue.find((entry) => entry.id === placement.id)!,
	...placement
}));
