// Grey-box stand-ins for the objects in the rack: each is a few primitives at roughly the
// real thing's proportions, to be replaced by a proper model later. A builder returns a group
// whose origin is the centre of its base, so it can be set straight down on a shelf.

import {
	BoxGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CircleGeometry,
	CylinderGeometry,
	ExtrudeGeometry,
	Group,
	LatheGeometry,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	RepeatWrapping,
	Shape,
	SphereGeometry,
	SRGBColorSpace,
	TorusGeometry,
	TubeGeometry,
	Vector2,
	Vector3,
	type BufferGeometry,
	type Material,
	type Object3D
} from 'three';
import { createFirmware } from '#lib/video-module/firmware.ts';
import { createMpv } from '#lib/video-module/mpv.ts';
import { createOled } from '#lib/video-module/oled.ts';
import { catalogue, type Entry } from './catalogue.ts';

interface Placement {
	id: string;
	/**
	 * Which shelf it sits on, counting from the top, and where along it (0 is the middle). Or
	 * WALL: it is pinned to the wall behind, `x` is where along the wall, `up` is how far above the
	 * floor its origin is, and `back` is ignored.
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
}

/**
 * What an object that does something by itself asks of the scene. It is kept in the userData.works
 * of the group its builder returns.
 */
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
}

// The rack the objects go in, in world units (one is about half a metre): its width inside, between
// the posts; its depth, front to back; and the thickness of its shelves. They are here because
// some of the objects are made to fit it.
/** In place of a shelf number: pinned to the wall (see Placement). */
export const WALL = -1;
// The board on the wall that the fliers are pinned to: its edges along the wall, and above the
// floor. Its right end is behind the rack, so that some of it shows where the window is only as
// wide as the rack. The heights are as it was laid out: it is hung with its top level with the top
// of the door's opening, which is as high as the rack and what stands on it, so the board and
// everything pinned to it are moved up or down together by the difference (`lift` in room.ts).
export const PINBOARD = { left: -2, right: -0.3, bottom: 1.21, top: 2.4 };

// The middle one of the three hooks by the door, which the tie hangs on (they are built in
// room.ts): where along the wall, and how far above the floor.
export const HOOK = { x: 0.99, y: 2.08 };

export const RACK_WIDTH = 1.1;
export const RACK_DEPTH = 0.7;
export const BOARD = 0.05;
// How far the back of the rack stands off the wall: clear of the pinboard, which runs behind it,
// with room for the cable that goes down behind the tv.
export const STANDOFF = 0.1;
export const LEGS = 0.14; // how far the posts carry on below the bottom shelf, down to the floor

// The amp on the floor under the pinboard (built in room.ts): where along the wall its middle is,
// its size, and how far it stands off the wall. Its input jack is on its front, given here from
// the floor at the foot of the wall, because the cable plugged into the cassette player ends there.
export const AMP = { x: -1.35, w: 1.2, h: 1, d: 0.5, gap: 0.06 };
export const AMP_JACK = { x: AMP.x + 0.42, y: 0.89, z: AMP.gap + AMP.d };

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
// Bright enough to show in the dim of the room.
const pink = new MeshStandardMaterial({ color: 0xff2e93, roughness: 0.6, emissive: 0xff2e93, emissiveIntensity: 0.25 });
const pinkShade = new MeshStandardMaterial({ color: 0xc81f70, roughness: 0.6, emissive: 0xc81f70, emissiveIntensity: 0.2 });
// The plugs on the two cables, matching the flecks in their braid.
const plugRed = new MeshStandardMaterial({ color: 0xc22424, roughness: 0.6 });
const plugGreen = new MeshStandardMaterial({ color: 0x52cf6c, roughness: 0.6 });
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

/** A cylinder lying on its side, its axis pointing out of the shelf: a knob, jack or reel. */
function round(r: number, depth: number, material: Material, x: number, y: number, z: number) {
	const m = mesh(new CylinderGeometry(r, r, depth, 32), material, x, y, z + depth / 2);
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
	const w = 1.08;
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
	const press = (shape: BufferGeometry, x: number, z: number, tap: () => void) => {
		const m = new Mesh(shape, dark);
		m.position.set(x, h / 2, z);
		m.visible = false;
		m.userData.control = { tap } satisfies Control;
		g.add(m);
	};
	const turn = (by: 1 | -1) => () => {
		clicks += by;
		inside.firmware.rotary(by > 0 ? 'down' : 'up');
	};
	const REACH = RIM + 0.025; // how far from the knob's middle a press still turns it
	press(new CircleGeometry(REACH, 24, Math.PI / 4, Math.PI), KNOB, FACE + 0.001, turn(-1));
	press(new CircleGeometry(REACH, 24, (-3 * Math.PI) / 4, Math.PI), KNOB, FACE + 0.001, turn(1));
	// The circle's own shape covers the mouth of the hollow, so that a press on anything seen
	// through it is a press on the circle. It is just in front of the other two, which makes it
	// the one such a press finds.
	press(new CircleGeometry(MIDDLE, 24), KNOB, FACE + 0.002, () => {
		pushed = 1;
		inside.firmware.button();
	});
	press(new BoxGeometry(0.07, 0.2, 0.08), TOGGLE, 0.04, inside.flip);

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
	const plug = { w: 0.065, h: 0.13, d: 0.13 };
	g.add(box(plug.w + 0.02, plug.h + 0.02, 0.004, dark, port.x, port.y - plug.h / 2 - 0.01, 0));
	g.add(box(plug.w, plug.h, plug.d, plugRed, port.x, port.y - plug.h / 2, plug.d / 2));
	g.add(box(plug.w - 0.02, plug.h - 0.03, 0.02, light, port.x, port.y - plug.h / 2 + 0.015, 0.012)); // its metal end
	g.add(round(0.024, 0.05, plugRed, port.x, port.y, plug.d)); // where the cable leaves it
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
	g.add(box(0.34 * k, 0.19, 0.008, dark, -0.3 * k, 0.07, 0));
	for (const side of [-1, 1]) g.add(round(0.036, 0.006, light, (-0.3 + side * 0.075) * k, 0.175, 0.004));
	// Two meters, with the transport keys under them.
	for (const side of [0, 1]) g.add(box(0.14 * k, 0.08, 0.006, screen, (0.02 + side * 0.17) * k, 0.16, 0));
	for (let i = 0; i < 6; i++) g.add(box(0.045 * k, 0.03, 0.024, dark, (-0.05 + i * 0.062) * k, 0.05, 0));
	g.add(round(0.042, 0.04, dark, 0.4 * k, 0.19, 0));
	g.add(round(0.024, 0.03, dark, 0.35 * k, 0.08, 0));
	g.add(round(0.024, 0.03, dark, 0.45 * k, 0.08, 0));

	// A jack socket under the door, and the cable from the amp plugged into it. The cable drops
	// from the amp's input to the floor, lies in a loose curve round the foot of the rack, and
	// comes up to the socket. The amp's place is given from the floor and the wall.
	const floor = -(BOARD + LEGS);
	const wall = -(RACK_DEPTH + 0.008 + STANDOFF);
	const socket = new Vector3(-0.4, 0.038, 0);
	const amp = new Vector3(AMP_JACK.x, floor + AMP_JACK.y, wall + AMP_JACK.z);
	const lying = floor + 0.015;
	g.add(round(0.034, 0.004, dark, socket.x, socket.y, 0));
	g.add(round(0.027, 0.1, plugGreen, socket.x, socket.y, 0));
	g.add(round(0.027, 0.1, plugGreen, amp.x, amp.y, amp.z));
	const path = new CatmullRomCurve3([
		new Vector3(socket.x, socket.y, 0.1),
		new Vector3(socket.x - 0.01, socket.y - 0.03, 0.17),
		new Vector3(socket.x - 0.04, lying + 0.03, 0.22),
		new Vector3(socket.x - 0.1, lying, 0.3),
		new Vector3(-0.6, lying, 0.42),
		new Vector3(-0.85, lying, 0.36),
		new Vector3(-0.92, lying, 0.16),
		new Vector3(-0.8, lying, 0.04),
		new Vector3(amp.x + 0.05, lying + 0.06, amp.z + 0.2),
		new Vector3(amp.x + 0.01, floor + 0.4, amp.z + 0.17),
		new Vector3(amp.x, amp.y - 0.08, amp.z + 0.17),
		new Vector3(amp.x, amp.y, amp.z + 0.1)
	]);
	g.add(braided(path, '#2c66d8', '#52cf6c', 4)); // blue, flecked with green
	return g;
}

function skull() {
	// Facing forward (+z), resting on its jaw line, with the frill standing up behind.
	const g = new Group();
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

// The skull is turned to face left, which puts its frill on the right, tipped away from its face.
// The books stand in a row to the right of it and lean left, the first with its top against the
// top of the frill and each of the others resting on the one before. Leaning at the same angle, their bottom-left edges are a thickness apart
// measured along the shelf, which is a little more than the thickness itself.
const SKULL_X = -0.15;
const SKULL_SCALE = 0.8;
const BOOK_LEAN = 0.16;
const BOOKS_FROM = SKULL_X + 0.27; // where the first book's bottom-left edge sits
const volumes: [thick: number, tall: number, deep: number, cover: MeshStandardMaterial][] = [
	[0.07, 0.46, 0.34, dark],
	[0.05, 0.4, 0.3, mid],
	[0.085, 0.44, 0.34, light],
	[0.055, 0.37, 0.28, accent],
	[0.065, 0.42, 0.32, mid]
];

let edge = BOOKS_FROM;
const books: Placement[] = volumes.map(([thick, tall, deep, cover], i) => {
	const id = `book-${i + 1}`;
	// The title on the spine is the book's name in the catalogue.
	const title = catalogue.find((entry) => entry.id === id)!.label;
	const x = edge + (thick / 2) * Math.cos(BOOK_LEAN);
	edge += thick / Math.cos(BOOK_LEAN);
	return {
		id,
		shelf: 2,
		x,
		// Spines lined up just behind the shelf's front edge, whatever the book's depth.
		back: (0.05 + deep / 2) / RACK_DEPTH,
		lean: BOOK_LEAN,
		// Front cover to the viewer, turned enough to show the spine as well.
		held: { pitch: 0.12, yaw: -Math.PI / 2 + 0.45 },
		build: book(thick, tall, deep, cover, title)
	};
});

// Placeholder art for the fliers: paper, ink, a second ink, and the name in the largest type.
const FLIERS: [string, string, string, string][] = [
	['#e9e2cf', '#151515', '#b3201c', 'BAND'],
	['#161417', '#ece6da', '#d9a400', 'NOISE'],
	['#c9462f', '#141212', '#f1e9d6', 'DOOM'],
	['#d8d24a', '#17161a', '#17161a', 'FEST'],
	['#23323a', '#e6ecef', '#e2603c', 'LIVE']
];

/** A photocopied show flier, flat against the wall and facing out, with a pin through its top. */
function flier(index: number, w: number, h: number) {
	const [paper, ink, second, name] = FLIERS[index];
	const canvas = document.createElement('canvas');
	const W = (canvas.width = 400);
	const H = (canvas.height = Math.round((400 * h) / w));
	const c = canvas.getContext('2d')!;
	c.fillStyle = paper;
	c.fillRect(0, 0, W, H);
	// A different block of second ink on each, behind the name.
	c.fillStyle = second;
	c.beginPath();
	if (index % 5 === 0) {
		for (let i = 0; i < 32; i++) {
			const a = (i / 32) * Math.PI * 2;
			const r = i % 2 ? 95 : 170 - (i % 3) * 20;
			c.lineTo(W / 2 + Math.cos(a) * r, H * 0.45 + Math.sin(a) * r);
		}
	} else if (index % 5 === 1) c.arc(W / 2, H * 0.45, 135, 0, Math.PI * 2);
	else if (index % 5 === 2) c.rect(0, H * 0.3, W, H * 0.3);
	else if (index % 5 === 3) for (let y = 0.28; y < 0.62; y += 0.07) c.rect(30, H * y, W - 60, H * 0.035);
	else {
		c.moveTo(W / 2, H * 0.2);
		c.lineTo(W - 40, H * 0.66);
		c.lineTo(40, H * 0.66);
	}
	c.fill();
	c.fillStyle = ink;
	c.textAlign = 'center';
	c.font = '700 26px sans-serif';
	c.fillText('ONE NIGHT ONLY', W / 2, 78);
	c.font = 'italic 900 96px sans-serif';
	c.fillText(name, W / 2, H * 0.45 + 34, W - 40);
	c.font = '700 30px sans-serif';
	c.fillText('WITH SUPPORT', W / 2, H * 0.78);
	c.font = '600 22px sans-serif';
	c.fillText('DATE · VENUE · DOORS', W / 2, H * 0.9);
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	map.anisotropy = 4;

	const g = new Group();
	g.add(mesh(new BoxGeometry(w, h, 0.004), page));
	const front = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map, roughness: 0.95 }));
	front.position.z = 0.0025;
	g.add(front);
	g.add(mesh(new SphereGeometry(0.016, 12, 8), accent, 0, h / 2 - 0.022, 0.012));
	return g;
}

// Pinned up none too carefully: where along the wall, how high, how crooked, and its size.
const pinned: [number, number, number, number, number][] = [
	[-1.73, 2.05, 0.05, 0.34, 0.48],
	[-1.24, 2.1, -0.04, 0.36, 0.49],
	[-0.7, 2.07, 0.03, 0.34, 0.48],
	[-1.49, 1.52, -0.06, 0.34, 0.46],
	[-0.87, 1.51, 0.07, 0.36, 0.49]
];
const fliers: Placement[] = pinned.map(([x, up, lean, w, h], i) => ({
	id: `flier-${i + 1}`,
	shelf: WALL,
	x,
	up,
	lean,
	pinned: true,
	build: () => flier(i, w, h)
}));

/**
 * A tie taken off over the head and hung up still knotted: the loop that went round the neck, the
 * knot under it, and the two blades hanging from that. Its origin is the top of the loop, where
 * the hook is, and it hangs flat against the wall facing out.
 */
function tie() {
	const g = new Group();
	const loopW = 0.1;
	const loopH = 0.17; // half the loop's height
	const loop = mesh(new TorusGeometry(loopW, 0.016, 8, 40), pink, 0, -loopH, 0);
	loop.scale.set(1, loopH / loopW, 0.5);
	g.add(loop);
	const knotY = -2 * loopH - 0.03;
	const knot = mesh(new CylinderGeometry(0.062, 0.038, 0.09, 4), pink, 0, knotY, 0.008);
	knot.rotation.y = Math.PI / 4;
	knot.scale.z = 0.45;
	g.add(knot);
	const blade = (half: number, length: number, material: Material) => {
		const outline = new Shape()
			.moveTo(-0.026, 0)
			.lineTo(0.026, 0)
			.lineTo(half, -length + half)
			.lineTo(0, -length)
			.lineTo(-half, -length + half)
			.closePath();
		return mesh(new ExtrudeGeometry(outline, { depth: 0.006, bevelEnabled: false }), material);
	};
	// The narrow blade behind, hanging a little askew, and the wide one in front.
	const narrow = blade(0.035, 0.6, pinkShade);
	narrow.position.set(0, knotY - 0.03, -0.006);
	narrow.rotation.z = 0.07;
	const wide = blade(0.085, 0.82, pink);
	wide.position.set(0, knotY - 0.03, 0.002);
	g.add(narrow, wide);
	return g;
}

const placements: Placement[] = [
	{ id: 'tv', shelf: 0, x: TV_X, back: TV_BACK, yaw: TV_YAW, fixed: true, build: tv },
	{ id: 'cat', shelf: 0, x: -0.36, back: 0.26, yaw: 0.2, fixed: true, build: catBed },
	{ id: 'video-module', shelf: 1, x: 0, flush: PANEL_HEIGHT, fixed: true, build: videoModule },
	{
		id: 'skull',
		shelf: 2,
		x: SKULL_X,
		back: 0.4,
		yaw: -1.15,
		fixed: true,
		build: skull
	},
	...books,
	...fliers,
	{ id: 'tie', shelf: WALL, x: HOOK.x, up: HOOK.y, lean: -0.03, build: tie },
	{ id: 'cassette', shelf: 3, x: 0, flush: PANEL_HEIGHT, fixed: true, build: cassettePlayer }
];

export const items: Item[] = placements.map((placement) => ({
	...catalogue.find((entry) => entry.id === placement.id)!,
	...placement
}));
