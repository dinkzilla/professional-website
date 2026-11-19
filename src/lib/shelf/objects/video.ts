// The tv on top of the rack, and the video module that is plugged into it.

import {
	BoxGeometry,
	BufferGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CircleGeometry,
	CylinderGeometry,
	ExtrudeGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	Shape,
	SRGBColorSpace,
	Vector3,
	type Object3D
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createFirmware } from '#lib/video-module/firmware.ts';
import { createMpv } from '#lib/video-module/mpv.ts';
import { createOled } from '#lib/video-module/oled.ts';
import {
	light,
	mid,
	dark,
	gloss,
	powerBlue,
	plugRed,
	white,
	unlit,
	mesh,
	box,
	round,
	fluted,
	braided,
	hang,
	PANEL_HEIGHT,
	panel
} from '../parts.ts';
import { RACK_DEPTH, BOARD } from '../rack.ts';
import type { Placement, Control, Works } from '../types.ts';

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

export const tvPlacement: Placement = { id: 'tv', shelf: 0, x: TV_X, back: TV_BACK, yaw: TV_YAW, fixed: true, build: tv };

export const videoModulePlacement: Placement = { id: 'video-module', shelf: 1, x: 0, flush: PANEL_HEIGHT, fixed: true, build: videoModule };
