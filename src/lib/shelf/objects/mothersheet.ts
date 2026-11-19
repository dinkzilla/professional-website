// The game in its box on the floor under the rack, and the manual that is in the box (its pages
// are printed in manual.ts).

import {
	BackSide,
	BufferGeometry,
	CanvasTexture,
	Float32BufferAttribute,
	Group,
	MeshBasicMaterial,
	MeshStandardMaterial,
	Quaternion,
	SRGBColorSpace,
	Vector3
} from 'three';
import monoton from '@fontsource/monoton/files/monoton-latin-400-normal.woff2?url';
import mothershipLid from '#lib/assets/mothership-lid.jpg';
import { catalogue } from '../catalogue.ts';
import { loadManual, PAGE, printManual } from '../manual.ts';
import { mesh, box, smooth, printed } from '../parts.ts';
import { FLOOR } from '../rack.ts';
import type { Placement, Press, Works } from '../types.ts';

// The game's box: black, printed all over with a tangle of line art in dull gold, and lettered in
// white. Long and short are its lid's sides, and it is this deep, lying flat.
const GAME = { long: 0.72, short: 0.52, h: 0.16 };
// It is a lid over a tray, of card this thick. The tray is filled to this depth with whatever
// else the game comes with, and the manual lies on top of that.
const GAME_CARD = 0.006;
const GAME_FILL = 0.075;
// Where the box is pushed under the rack, and how it is turned: its left side to the front, and
// askew, pushed under there, not put.
const GAME_AT = { x: -0.02, back: 0.5, yaw: Math.PI / 2 - 0.16 };
// The manual: a booklet of the proportions its pages are printed at, with this much between one
// leaf and the next. It lies in the tray this far above the floor, the top of its pages to the
// box's back end.
const MANUAL = { w: 0.44, h: (0.44 * PAGE.H) / PAGE.W, gap: 0.0012, up: 0.0015 + GAME_CARD + GAME_FILL };
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

/**
 * Fetch what the box and the manual are printed with: the game's typeface, the drawing on its lid
 * and the manual's own (see manual.ts). Whatever cannot be had is done without.
 */
export async function loadGame() {
	const face = new FontFace(GAME_FACE, `url(${monoton})`);
	const lid = new Image();
	lid.src = mothershipLid;
	await Promise.allSettled([
		loadManual(),
		face.load().then((loaded) => document.fonts.add(loaded)),
		lid.decode().then(() => (gameLid = lid))
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
	// The card seen from inside the box, and a face that is not there at all: the lid has no
	// bottom and the tray no top.
	const lining = new MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.9, side: BackSide });
	const filling = new MeshStandardMaterial({ color: 0x101012, roughness: 0.95 });
	const none = new MeshBasicMaterial({ visible: false });
	const T = GAME_CARD;
	/** The edge of the card round an open side `w` by `l`, at this height. */
	const rim = (to: Group, w: number, l: number, y: number) => {
		for (const side of [-1, 1]) {
			to.add(box(w - 0.0006, 0.0006, T, under, 0, y, side * (l / 2 - T / 2)));
			to.add(box(T, 0.0006, l - 2 * T, under, side * (w / 2 - T / 2 - 0.0003), y, 0));
		}
	};
	const g = new Group();

	// The tray, which the lid comes down over: a loose fit inside it, and all but as deep.
	const tray = { w: short - 2 * T - 0.004, h: h - T - 0.003, l: long - 2 * T - 0.004, y: 0.0005 };
	// A box's faces in three.js's order: right, left, top, bottom, front, back.
	g.add(box(tray.w, tray.h, tray.l, [under, under, none, under, under, under], 0, tray.y));
	const well = box(tray.w - 2 * T, tray.h - T, tray.l - 2 * T, [lining, lining, none, lining, lining, lining], 0, tray.y + T);
	well.castShadow = false;
	g.add(well);
	rim(g, tray.w, tray.l, tray.y + tray.h - 0.0006);
	g.add(box(tray.w - 2 * T - 0.003, GAME_FILL, tray.l - 2 * T - 0.003, filling, 0, tray.y + T));

	// The lid, which is all of the box that shows while it is shut. It is taken off as a lid is:
	// lifted clear of the tray, then tipped back about its far edge (the box is held with its left
	// side nearest) to stand open behind it.
	const shell = new Group();
	shell.add(box(short, h, long, [right, left, lid, none, front, back]));
	const inside = box(short - 2 * T, h - T, long - 2 * T, [lining, lining, lining, none, lining, lining]);
	inside.castShadow = false;
	shell.add(inside);
	rim(shell, short, long, 0);
	shell.position.set(-short / 2, -h, 0);
	const hinge = new Group();
	hinge.position.set(short / 2, h, 0);
	hinge.add(shell);
	const raised = new Group();
	raised.add(hinge);
	g.add(raised);
	const open = (u: number) => {
		raised.position.y = h * 1.15 * smooth(0, 0.55, u);
		raised.position.x = 0.07 * smooth(0.3, 1, u);
		hinge.rotation.z = -1.85 * smooth(0.3, 1, u);
	};

	// The scene says how far the box has been lifted off the floor. The lid is not touched until it
	// is most of the way up, and then comes off in its own time; it is back on well before the box
	// is back on the floor.
	const OPEN_S = 0.6;
	const SHUT_S = 0.3;
	let u = 0;
	let goal = 0;
	let lifted = 0;
	const works: Works = {
		start: () => {},
		stop: () => {},
		dim: () => {},
		lifted: (share) => {
			if (share < lifted) goal = 0;
			else if (share > lifted && share > 0.7) goal = 1;
			lifted = share;
		},
		tick: (dt) => {
			if (u === goal) return false;
			u = goal > u ? Math.min(1, u + dt / OPEN_S) : Math.max(0, u - dt / SHUT_S);
			open(u);
			return u !== goal;
		},
		opened: () => u > 0.75
	};
	g.userData.works = works;
	return g;
}

/**
 * The manual that is in the game's box: a booklet, its leaves printed on the front (see
 * manual.ts) and held along their left edges. In the box it lies flat. Out of it, it stands
 * facing out of its group, its middle on the group's origin, and a press on a page turns it:
 * the leaf goes over to the left and on round behind the rest, as a magazine is folded back on
 * itself, so that there is only ever the one page to look at.
 */
function manual() {
	const { w, h, gap } = MANUAL;
	const print = printManual(catalogue.find((entry) => entry.id === 'manual')!.manual!);
	const count = print.faces.length;
	const ACROSS = 12;
	// The pages give off a little light of their own once they are out of the box, as the clipping
	// does (see `lay`).
	const paper = { roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0 };
	const other = printed(print.back);
	const backs = new MeshStandardMaterial({ ...paper, map: other, emissiveMap: other });
	const lit: MeshStandardMaterial[] = [backs];

	const g = new Group();
	const body = new Group();
	g.add(body);
	// How far round each leaf is (0 where it was bound, 1 folded right round behind), the one page
	// the booklet is open at, and how far out of the box it is.
	let at = 0;
	let lifted = 0;
	const turn: Press = (hit) => {
		if (lifted < 1) return false;
		// The left of a page goes back a page, and the rest of it on one. The cover only opens, and
		// the last page has nothing after it.
		if (at > 0 && (hit.uv?.x ?? 1) < 0.3) at--;
		else if (at < count - 1) at++;
		else return false;
		return true;
	};
	const leaves = print.faces.map((face, n) => {
		// A strip of points from the bound edge out, top and bottom, and a face of the leaf made on
		// each side of it: the same triangles, wound the other way for the back.
		const positions = new Float32BufferAttribute(new Float32Array((ACROSS + 1) * 6), 3);
		const uvs: number[][] = [[], []];
		const indices: number[][] = [[], []];
		for (let i = 0; i <= ACROSS; i++) {
			for (const v of [1, 0]) {
				uvs[0].push(i / ACROSS, v);
				uvs[1].push(1 - i / ACROSS, v);
			}
		}
		for (let i = 0; i < ACROSS; i++) {
			const p = i * 2;
			indices[0].push(p, p + 1, p + 2, p + 2, p + 1, p + 3);
			indices[1].push(p, p + 2, p + 1, p + 2, p + 3, p + 1);
		}
		const sides = [0, 1].map((side) => {
			const geometry = new BufferGeometry();
			geometry.setIndex(indices[side]);
			geometry.setAttribute('position', positions);
			geometry.setAttribute('uv', new Float32BufferAttribute(uvs[side], 2));
			return geometry;
		});
		const map = printed(face.canvas);
		const fronts = new MeshStandardMaterial({ ...paper, map, emissiveMap: map });
		lit.push(fronts);
		const front = mesh(sides[0], fronts);
		const back = mesh(sides[1], backs);
		// Only the back of the last leaf casts a shadow: the rest are all but touching what is behind
		// them, and would shadow one another in stripes.
		front.castShadow = false;
		back.castShadow = n === count - 1;
		front.userData.links = face.links;
		front.userData.press = turn;
		// A press on the back of a leaf, which shows only while it is turning, does nothing.
		back.userData.press = (() => lifted === 1) satisfies Press;
		const leaf = new Group();
		leaf.add(front, back);
		leaf.position.x = -w / 2;
		body.add(leaf);
		return { leaf, positions, sides, n, q: 0 };
	});
	/**
	 * Put a leaf where it is `q` of the way round. It bends as it goes, its free edge trailing, and
	 * it moves back as well as round, from its place in the booklet to the same place from the
	 * back of it.
	 */
	const fold = (each: (typeof leaves)[number]) => {
		const q = smooth(0, 1, each.q);
		const round = q * Math.PI * 2;
		const bend = Math.sin(Math.PI * each.q) * 0.6;
		for (let i = 0; i <= ACROSS; i++) {
			const out = i / ACROSS;
			const angle = round - bend * out ** 1.6;
			const x = w * out * Math.cos(angle);
			const z = w * out * Math.sin(angle);
			each.positions.setXYZ(i * 2, x, h / 2, z);
			each.positions.setXYZ(i * 2 + 1, x, -h / 2, z);
		}
		each.positions.needsUpdate = true;
		for (const geometry of each.sides) {
			geometry.computeVertexNormals();
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
		}
		each.leaf.position.z = -gap * (each.n + q * (2 * (count - each.n) - 1));
	};

	// Lying in the box it faces up, and is as far above its group's origin as it is thick.
	const lying = { turned: new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2), at: new Vector3(0, gap * count, 0) };
	const facing = new Quaternion();
	const RISE = 0.3;
	/**
	 * Put the booklet where it is `e` of the way from the box to being read. That is how far the
	 * scene has brought it, which starts slowly; in the time that takes, it comes straight up out
	 * of the tray, as it lay. Then it turns to face out, coming down to its group's origin, which is
	 * what the scene brings in front of the camera.
	 */
	const lay = (e: number) => {
		// How far through the time it takes, which is what the scene eases to get `e`.
		const t = e < 0.5 ? Math.cbrt(e / 4) : 1 - Math.cbrt(2 * (1 - e)) / 2;
		const up = smooth(0, 0.4, t);
		const round = smooth(0.26, 0.92, t);
		body.quaternion.slerpQuaternions(lying.turned, facing, round);
		body.position.copy(lying.at).multiplyScalar(1 - round);
		body.position.y += RISE * up * (1 - round);
		for (const material of lit) material.emissiveIntensity = 0.8 * round;
	};
	for (const each of leaves) fold(each);
	lay(0);

	const TURN_S = 0.75;
	const works: Works = {
		start: () => {},
		stop: () => {},
		dim: () => {},
		lifted: (share) => {
			// On its way back to the box, it is shut.
			if (share < lifted) at = 0;
			if (share !== lifted) lay(share);
			lifted = share;
		},
		tick: (dt) => {
			let moving = false;
			for (const each of leaves) {
				const goal = each.n < at ? 1 : 0;
				if (each.q === goal) continue;
				// Shut in a hurry, if it is on its way back.
				const step = dt / (lifted < 1 ? TURN_S * 0.4 : TURN_S);
				each.q = goal > each.q ? Math.min(1, each.q + step) : Math.max(0, each.q - step);
				fold(each);
				moving = true;
			}
			return moving;
		}
	};
	g.userData.works = works;
	return g;
}

export const mothersheetPlacements: Placement[] = [
	{
		id: 'mothersheet',
		shelf: FLOOR,
		...GAME_AT,
		// Lid to the viewer with the same side nearest, tipped and turned to show that and an end.
		held: { pitch: 0.95, yaw: Math.PI / 2 - 0.4 },
		build: gameBox
	},
	{
		// In the box, as the box lies (see MANUAL): it comes out once the lid is off.
		id: 'manual',
		shelf: FLOOR,
		...GAME_AT,
		up: MANUAL.up,
		rides: 'mothersheet',
		page: { w: MANUAL.w, h: MANUAL.h },
		takes: 1,
		build: manual
	}
];
