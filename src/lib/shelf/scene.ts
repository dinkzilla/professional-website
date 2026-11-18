// The rack (grey-box prototype): a tall, narrow equipment rack on legs against a dark wall, with
// block-out objects (see items.ts). Some are mounted in it, their
// panels flush with its front; the others stand on its shelves, and some of those come forward
// when picked.
//
// Nothing scrolls: the canvas is fixed over the window and the unit is fitted into it. The camera looks at the wall square-on
// from its left at about eye level. One world unit is `ppu` pixels where the middle of the unit's
// front edge is drawn.
//
// Nothing is drawn unless something changed: resize, hover, an object in flight, or one
// that works by itself showing something new (the tv does, with every frame of video).
//
// Most objects are picked up to be looked at. Some have parts that work where they are (the video
// module's knob and switch): those are pressed in place, with nothing picked up.
//
// The scene outlives the page that shows it. It owns its canvas, so it can be built and drawn
// once before the personal page is ever visited (see ready.ts), then put on that page the moment
// it mounts, and taken off again, intact, when the visitor leaves.

import {
	ACESFilmicToneMapping,
	Box3,
	BoxGeometry,
	CanvasTexture,
	Color,
	CubeCamera,
	ExtrudeGeometry,
	Frustum,
	Group,
	HalfFloatType,
	HemisphereLight,
	Matrix4,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	Path,
	PCFSoftShadowMap,
	PerspectiveCamera,
	Quaternion,
	Raycaster,
	RepeatWrapping,
	Scene,
	Shape,
	SpotLight,
	SRGBColorSpace,
	Vector2,
	Vector3,
	WebGLCubeRenderTarget,
	WebGLRenderer,
	type Intersection
} from 'three';
import { buildRoom, SHADOWS } from './room.ts';
import {
	BOARD,
	FLOOR,
	screw,
	items,
	LEGS,
	loadModels,
	loadPrinting,
	RACK_DEPTH,
	RACK_WIDTH,
	STANDOFF,
	WALL_OFF,
	WALL,
	type Control,
	type Item,
	type Works
} from './items.ts';

// The unit, in world units (one is about half a metre). The wall is the plane z = 0, the unit
// stands a little off it (STANDOFF), and y = 0 is
// a little above the tallest thing on the top shelf, with the shelves going down from there.
const WIDTH = RACK_WIDTH; // inside, between the posts
const DEPTH = RACK_DEPTH;
const HEADROOM = 0.2; // clear space left above the tallest object on the unit's top
const POST = 0.06; // the posts are square, and stand a touch proud of the shelves
const FULL_WIDTH = WIDTH + 2 * BOARD;
const UNIT = 0.1; // one rack unit: the posts' mounting holes come three to every two
const CLEARANCE = UNIT; // clear space left above the tallest object on a tray inside the rack
const SHEET = 0.012; // the thickness of a tray bolted into the rack, which is folded sheet metal
// Where the three holes are in each two units of a post, as a share of the way down it.
const HOLES = [1 / 7, 1 / 2, 6 / 7];
const HOLE = 0.36 * POST; // they are square, and this wide
// The slots cut in a tray: their length between the centres of their round ends, the radius of
// those, and how far apart they are across the tray and along it.
const SLOT = { length: 0.11, r: 0.02, across: 0.15, along: 0.15 };
const BLACK = '#17171a'; // the rack's powder coat

const rad = (degrees: number) => (degrees * Math.PI) / 180;

// The view: from the unit's left, about level with its upper shelves, so that shelves above eye
// level slope one way on screen and those below it the other. The camera turns to face the unit
// but does not tilt: the little height it has over the window's centre comes from shifting the
// frustum (a "shift lens"), which keeps the posts vertical.
const FOV = rad(26); // vertical field of view across the window
const TURN = rad(-16); // how far round the unit is seen from; negative is from its left
const RISE = rad(3); // how far above the window's centre the camera looks from
// The unit's width as it appears: its front, turned, plus the end that shows.
const SEEN_WIDTH = FULL_WIDTH * Math.cos(TURN) + DEPTH * Math.abs(Math.sin(TURN));
const MARGIN = 44; // px kept clear above and below the unit
// The unit sits this many px above centre: there is clear air over the things on its top shelf,
// and its near bottom corner hangs low in perspective, so true centre looks too low.
const RAISE = 32;
const GUTTER = 28; // px kept clear either side
const FIT_SHELVES = 4; // the unit is sized so this many shelves fit the window's height...
const MIN_PPU = 150; // ...unless that would make it narrower than this many px per unit
const OFF_CENTRE = 0.12; // in wide windows the unit sits this share of the width left of centre
const PANEL_MIN = 280; // px of wall needed right of the unit for the panel to go there
const PICK_S = 0.55; // seconds for an object to come forward or go back
const DIM = 0.65; // how much of the room's lighting is lost while an object is held

export type LayoutMode = 'tall' | 'side';

export interface Layout {
	/**
	 * Tall: the unit is centred, and a picked object shows above its panel. Side: the unit sits
	 * left of centre, a picked object comes up in front of it, and the panel is on its right.
	 */
	mode: LayoutMode;
	/** Where the unit's right edge is on screen. */
	unitRight: number;
}

/** What the scene needs from the page it is shown on. */
export interface Host {
	/** The height to lay out for: the viewport with the browser's bars showing. */
	fitHeight: () => number;
	onLayout: (layout: Layout) => void;
	/**
	 * An object was tapped (its id), or the space around a held object was (null). The page has
	 * the object picked up, unless it is one that does something else (`link` in items.ts).
	 */
	onTap: (id: string | null) => void;
}

export type Shelf = ReturnType<typeof createShelf>;

interface Placed {
	item: Item;
	group: Group;
	centre: Vector3; // of its bounding box, in its own coordinates
	height: number; // how far its top is above the shelf it stands on
	sunk: number; // how far its origin is above the shelf, its lowest point resting on it
	size: number; // roughly its largest dimension
	shelfPosition: Vector3;
	shelfRotation: Quaternion;
	heldPosition: Vector3;
	heldRotation: Quaternion;
	t: number; // 0 on the shelf, 1 held
	nudge: number; // 0 to 1: leaning out under the cursor
	works?: Works; // what it does by itself, if anything
}

const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Build the scene and draw it once, off the page, so that it can be shown without delay. */
export async function prepare(): Promise<Shelf> {
	await Promise.all([loadPrinting(), loadModels()]);
	const shelf = createShelf();
	await shelf.warm();
	return shelf;
}

/**
 * The face of a rack post, two units of it: black, with three square holes cut right through it,
 * spaced as they are on a real one (closer across the joins between tiles than within them).
 * The posts are drawn as boxes, but with the holes cut in both drilled faces and nothing drawn
 * of the insides, what is behind a post shows through them.
 */
function mountingHoles() {
	const W = 96;
	const H = Math.round((W * 2 * UNIT) / POST);
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const c = canvas.getContext('2d')!;
	c.fillStyle = BLACK;
	c.fillRect(0, 0, W, H);
	const size = (W * HOLE) / POST;
	for (const at of HOLES) {
		const x = (W - size) / 2;
		const y = at * H - size / 2;
		c.clearRect(x, y, size, size);
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.wrapT = RepeatWrapping;
	texture.anisotropy = 8;
	return texture;
}

function createShelf() {
	const canvas = document.createElement('canvas');
	// The page showing the scene, if one is.
	let host: Host | undefined;

	const renderer = new WebGLRenderer({ canvas, antialias: true });
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	renderer.toneMapping = ACESFilmicToneMapping;

	const scene = new Scene();
	scene.background = new Color(0x000000);
	const camera = new PerspectiveCamera();

	const steel = new MeshStandardMaterial({ color: BLACK, roughness: 0.55 });
	// The faces of the posts that things are bolted to, front and back, with their square holes.
	const holes = mountingHoles();
	const rail = new MeshStandardMaterial({ map: holes, roughness: 0.55, alphaTest: 0.5 });
	// The tray: red anodised sheet. Metal is only what it reflects, so it is given a picture of
	// the room as it is, taken from inside the rack (see reflect). Nothing is lit that is not
	// lit in the room.
	const surroundings = new WebGLCubeRenderTarget(128, { type: HalfFloatType });
	const probe = new CubeCamera(0.05, 60, surroundings);
	const red = new MeshStandardMaterial({
		color: 0xd81a22,
		roughness: 0.65,
		metalness: 0.1,
		envMap: surroundings.texture,
		// Only a quarter of the reflection: at full strength it washes out the shadows cast on it.
		envMapIntensity: 0.25
	});
	const drilled = [steel, steel, steel, steel, rail, rail];
	scene.add(new HemisphereLight(0xcfd8ff, 0x1a1410, 0.22));

	// Lights the wall around the unit, brightest at the top and falling off to the sides.
	const wash = new SpotLight(0xffe7c8, 60, 0, 0.75, 1, 1.6);
	scene.add(wash, wash.target);
	if (SHADOWS) {
		wash.castShadow = true;
		wash.shadow.mapSize.set(4096, 4096);
		wash.shadow.camera.near = 1;
		wash.shadow.camera.far = 20;
		wash.shadow.bias = -0.0004;
		wash.shadow.normalBias = 0.01;
		// Soft: each edge is blurred over this many texels of the map, and the shadows are not
		// quite full strength.
		wash.shadow.radius = 6;
		wash.shadow.intensity = 0.75;
	}

	// Lights whichever object is being held, from above it.
	const heldLight = new SpotLight(0xfff1dc, 0, 0, 0.6, 0.9, 1.2);
	scene.add(heldLight, heldLight.target);

	// The unit is rebuilt whenever the number of shelves changes.
	let unit = new Group();
	let shelves = FIT_SHELVES;

	const placed: Placed[] = items.map((item) => {
		const group = item.build();
		group.traverse((o) => (o.userData.item = item.id));
		const bounds = new Box3().setFromObject(group);
		// Measured again as it stands on the shelf: turned, and tipped over if it leans, which lifts
		// one edge of its base and drops the other.
		const shelfRotation = new Quaternion()
			.setFromAxisAngle(Y_AXIS, item.yaw ?? 0)
			.multiply(new Quaternion().setFromAxisAngle(Z_AXIS, item.lean ?? 0));
		group.quaternion.copy(shelfRotation);
		const standing = new Box3().setFromObject(group);
		scene.add(group);
		return {
			item,
			group,
			centre: bounds.getCenter(new Vector3()),
			height: standing.max.y - standing.min.y + (item.up ?? 0),
			sunk: item.flush ? 0 : (item.up ?? 0) - standing.min.y,
			size: bounds.getSize(new Vector3()).length() * 0.8,
			shelfPosition: new Vector3(),
			shelfRotation,
			heldPosition: new Vector3(),
			heldRotation: new Quaternion(),
			t: 0,
			nudge: 0,
			works: group.userData.works
		};
	});
	const working = placed.flatMap((p) => p.works ?? []);

	// Each shelf is only as tall as its tallest object needs. `pitch` is the distance from the
	// surface above (the underside of the unit's top, for the first) to the shelf's own surface.
	// What is under each bay. The unit's top and bottom are thick boards. Between them, a bay of
	// mounted gear has nothing under it, since the gear hangs from the posts by its panel, and a
	// bay of loose things has a sheet-metal tray, bolted to the posts like anything else.
	const mounted = new Set<number>();
	for (const item of items) if (item.flush) mounted.add(item.shelf);
	const thickness = (index: number, count = shelves) =>
		index === 0 || index === count - 1 ? BOARD : mounted.has(index) ? 0 : SHEET;
	// What is over a bay is never the unit's bottom.
	const above = (index: number) => thickness(index - 1, Infinity);

	const pitch: number[] = [];
	for (const p of placed) {
		if (p.item.shelf === WALL || p.item.shelf === FLOOR) continue;
		// Something mounted in the rack fills its bay.
		const clear = p.item.shelf === 0 ? HEADROOM : CLEARANCE;
		const needed = (p.item.flush ?? p.height + clear) + above(p.item.shelf);
		pitch[p.item.shelf] = Math.max(pitch[p.item.shelf] ?? 0, needed);
	}
	const drop = (count: number) => pitch.slice(0, count).reduce((sum, h) => sum + h, 0);
	// From y = 0 down to the floor.
	const unitHeight = (count = shelves) => drop(count) + BOARD + LEGS;
	const shelfY = (index: number) => -drop(index + 1);

	// The walls, the floor the legs stand on, and what is outside (see room.ts).
	const room = buildRoom(unitHeight(FIT_SHELVES));
	scene.add(room.group);

	function buildUnit() {
		scene.remove(unit);
		unit.traverse((o) => o instanceof Mesh && o.geometry.dispose());
		unit = new Group();

		const height = unitHeight();
		const add = (
			w: number,
			h: number,
			d: number,
			x: number,
			y: number,
			z: number,
			material: MeshStandardMaterial | MeshStandardMaterial[] = steel
		) => {
			const m = new Mesh(new BoxGeometry(w, h, d), material);
			m.position.set(x, y, z);
			m.castShadow = true;
			m.receiveShadow = true;
			unit.add(m);
		};
		// Open shelving: no back or sides, just a post at each corner. The posts stop at the top
		// shelf, which has nothing over it, and carry on below the bottom one as legs. The wall
		// shows through behind.
		const posts = height + shelfY(0);
		const postX = FULL_WIDTH / 2 - POST / 2 + 0.005;
		/** The height of the nth hole down a post. */
		const holeY = (n: number) => shelfY(0) - (Math.floor(n / 3) + HOLES[n % 3]) * 2 * UNIT;
		// The holes are counted down from the top of the posts.
		// They stop at the underside of the unit's bottom: the legs below it are plain.
		const drilledLength = posts - LEGS;
		holes.repeat.set(1, drilledLength / (2 * UNIT));
		holes.offset.y = Math.ceil(holes.repeat.y) - holes.repeat.y;
		for (const side of [-1, 1]) {
			for (const z of [POST / 2 - 0.005, DEPTH - POST / 2 + 0.005]) {
				add(POST, drilledLength, POST, side * postX, shelfY(0) - drilledLength / 2, z, drilled);
				add(POST, LEGS, POST, side * postX, shelfY(0) - drilledLength - LEGS / 2, z);
			}
		}
		for (let i = 0; i < shelves; i++) {
			const thick = thickness(i);
			if (thick === BOARD) add(FULL_WIDTH, BOARD, DEPTH, 0, shelfY(i) - BOARD / 2, DEPTH / 2);
			else if (thick) {
				// A tray, as a rack shelf is made: a sheet between the posts with a wall up each side,
				// tall at the front, where it ends in an ear lying on the post's face, and sloping
				// down to almost nothing at the back. The ear covers four of the post's holes and
				// is bolted through the top and bottom ones.
				const inside = 2 * postX - POST;
				const base = shelfY(i) - SHEET;
				// The sheet is drawn from above (width across, depth up from the front edge) with
				// rows of slanted, round-ended slots cut through it for air, then laid flat.
				const sheet = new Shape()
					.moveTo(-inside / 2, 0)
					.lineTo(inside / 2, 0)
					.lineTo(inside / 2, DEPTH)
					.lineTo(-inside / 2, DEPTH)
					.closePath();
				const EDGE = 0.1; // left solid round the slots
				const columns = Math.floor((inside - 2 * EDGE) / SLOT.across);
				const rows = Math.floor((DEPTH - 2 * EDGE) / SLOT.along);
				for (let column = 0; column <= columns; column++) {
					for (let row = 0; row <= rows; row++) {
						const x = (column - columns / 2) * SLOT.across;
						const y = DEPTH / 2 + (row - rows / 2) * SLOT.along;
						const dx = (SLOT.length / 2) * Math.SQRT1_2;
						const slot = new Path();
						slot.absarc(x + dx, y + dx, SLOT.r, -Math.PI / 4, (3 * Math.PI) / 4, false);
						slot.absarc(x - dx, y - dx, SLOT.r, (3 * Math.PI) / 4, (7 * Math.PI) / 4, false);
						slot.closePath();
						sheet.holes.push(slot);
					}
				}
				const plate = new Mesh(
					new ExtrudeGeometry(sheet, { depth: SHEET, bevelEnabled: false, curveSegments: 6 }),
					red
				);
				plate.rotation.x = -Math.PI / 2;
				plate.position.set(0, base, DEPTH);
				plate.castShadow = true;
				plate.receiveShadow = true;
				unit.add(plate);
				// A low lip along the back, to stop things being pushed off it. It runs between the
				// side walls, which come down to its height where they meet it.
				const LIP = 0.06; // above the underside of the tray
				add(inside - 2 * SHEET, LIP, SHEET, 0, base + LIP / 2, SHEET / 2, red);
				// The lowest hole clear of the tray, and the third above it.
				let low = 0;
				while (holeY(low + 1) >= base + 0.025) low++;
				const bolts = [holeY(low), holeY(low - 3)];
				const earTop = bolts[1] + 0.03;
				// The ear lies on the front of the post, and the wall comes forward past the post to
				// the ear's face, so that the two meet in a corner with no gap between them.
				const EAR = 0.008; // its thickness
				const front = DEPTH + 0.005 + EAR;
				const wall = new Shape()
					.moveTo(0, base)
					.lineTo(front, base)
					.lineTo(front, earTop)
					.lineTo(DEPTH - 0.04, earTop)
					.lineTo(0, base + LIP)
					.closePath();
				for (const side of [-1, 1]) {
					// Drawn in the plane of the rack's side (depth across, height up), then turned into it.
					const m = new Mesh(new ExtrudeGeometry(wall, { depth: SHEET, bevelEnabled: false }), red);
					m.rotation.y = -Math.PI / 2;
					m.position.x = side * (inside / 2 - SHEET / 2) + SHEET / 2;
					m.castShadow = true;
					m.receiveShadow = true;
					unit.add(m);
					const earWidth = POST + 0.006; // from the wall's outer face to just past the post
					const earX = side * (inside / 2 + earWidth / 2);
					add(earWidth, earTop - base, EAR, earX, (earTop + base) / 2, front - EAR / 2, red);
					for (const y of bolts) {
						const head = screw();
						head.position.set(side * postX, y, front);
						unit.add(head);
					}
				}
			}
		}
		unit.position.z = STANDOFF;
		scene.add(unit);

		room.group.position.y = -height;

		wash.position.set(0, 2.2, 4.5);
		wash.target.position.set(0, -height * 0.35, 0);

		for (const p of placed) {
			p.group.visible = p.item.shelf < shelves;
			if (p.item.shelf === WALL) {
				// Just off the wall: against the board, or hanging from a hook.
				p.shelfPosition.set(p.item.x, (p.item.up ?? 0) + (p.item.pinned ? room.lift : 0) - height, WALL_OFF);
				continue;
			}
			p.shelfPosition.set(
				p.item.x,
				(p.item.shelf === FLOOR ? -height : shelfY(p.item.shelf)) + p.sunk,
				// A mounted panel lies against the fronts of the posts.
				STANDOFF + (p.item.flush ? DEPTH + 0.008 : DEPTH * (1 - (p.item.back ?? 0.5)))
			);
		}
	}

	/** Take the picture of the room that the tray reflects: from the middle of the rack, without it. */
	function reflect() {
		const hidden = [unit, ...placed.filter((p) => p.item.shelf >= 0).map((p) => p.group)];
		const shown = hidden.map((o) => o.visible);
		for (const o of hidden) o.visible = false;
		probe.position.set(0, -unitHeight() / 2, STANDOFF + DEPTH / 2);
		probe.update(renderer, scene);
		hidden.forEach((o, i) => (o.visible = shown[i]));
	}

	// --- Layout: window size to camera ---------------------------------------------------------

	let width = 0; // of the canvas, in CSS px
	let height = 0;
	let fit = 0; // the height the unit is fitted to (see Host.fitHeight)
	let ppu = 1; // px per world unit at the shelves' front edge
	let focal = 1; // px: the camera's distance from that plane, in screen pixels
	let shift = 0; // px: how far below the camera's axis the window's centre is
	let aside = 0; // px: how far to the right of the camera's axis it is
	let offset = 0; // px: how far right of the window's centre the unit is (negative: left)
	let top = 0; // px from the top of the window to the top of the unit
	let mode: LayoutMode = 'tall';
	let held: Placed | undefined;
	const view = new Frustum(); // what the window takes in, from where the camera is
	const through = new Matrix4();

	function layout() {
		// Off the page, lay out for the window as a whole, which is what the canvas will cover.
		width = host ? canvas.clientWidth : window.innerWidth;
		height = host ? canvas.clientHeight : window.innerHeight;
		fit = Math.min(host?.fitHeight() ?? height, height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(width, height, false);

		const widthFit = (width - 2 * GUTTER) / SEEN_WIDTH;
		const heightFit = (fit - 2 * MARGIN) / unitHeight(FIT_SHELVES);
		ppu = Math.min(widthFit, Math.max(heightFit, MIN_PPU));

		const unitPx = SEEN_WIDTH * ppu;
		const contentPx = unitHeight() * ppu + 2 * MARGIN;
		top = (contentPx <= fit ? (fit - unitHeight() * ppu) / 2 : MARGIN) - RAISE;

		// In a wide window the unit moves left of centre, leaving the wall on its right for the
		// panel. If that would not leave enough, it stays centred and the panel goes underneath.
		const spare = (width - unitPx) / 2;
		const move = Math.max(0, Math.min(width * OFF_CENTRE, spare - GUTTER));
		mode = width >= fit && spare + move >= PANEL_MIN ? 'side' : 'tall';
		offset = mode === 'side' ? -move : 0;

		focal = height / 2 / Math.tan(FOV / 2);
		shift = focal * Math.tan(RISE);
		camera.fov = (2 * Math.atan((height / 2 + shift) / focal) * 180) / Math.PI;
		camera.near = 0.1;
		camera.far = 200;
		// The window is an off-centre part of a larger frustum, which puts the camera's axis above
		// or beside the window's centre without turning it. This also sets the aspect ratio.
		// Moving the unit off-centre is done the same way, so it looks the same wherever it sits.
		aside = -offset;
		camera.setViewOffset(
			width + 2 * Math.abs(aside),
			height + 2 * shift,
			Math.abs(aside) + aside,
			2 * shift,
			width,
			height
		);

		host?.onLayout({
			mode,
			unitRight: spare + unitPx + offset
		});
		follow();
	}

	/** Put the camera where the layout says, and anything held in front of it. */
	function follow() {
		const distance = focal / ppu;
		const centre = (top - height / 2) / ppu; // world y at the window's centre
		// The window is centred on the unit's front and its visible side together.
		const middle = (DEPTH * Math.sin(TURN)) / 2;
		// The camera is placed so that this point lands in the middle of the window.
		camera.rotation.set(0, TURN, 0);
		camera.position
			.set((aside + offset) / ppu, -shift / ppu, -distance)
			.applyQuaternion(camera.quaternion)
			.negate()
			.add(new Vector3(middle, centre, DEPTH + STANDOFF));
		camera.updateMatrixWorld();
		view.setFromProjectionMatrix(through.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
		for (const p of placed) hold(p);
		request();
	}

	/** Where on screen (CSS px) a picked object is shown. */
	function stage() {
		if (mode === 'tall') return { x: width / 2, y: fit * 0.27, w: width, h: fit * 0.5 };
		// In front of the unit.
		return { x: width / 2 + offset, y: fit / 2, w: SEEN_WIDTH * ppu, h: fit };
	}

	/** Work out an object's held position and attitude: centred on the stage, facing the camera. */
	function hold(p: Placed) {
		const s = stage();
		const distance = focal / ppu;
		const room = Math.min(s.w, s.h) * 0.72;
		const dz = Math.min(Math.max((p.size * focal) / room, 1.2), distance * 0.8);
		const down = s.y - height / 2 + shift; // px below the camera's axis
		const right = s.x - width / 2 + aside; // px to the right of the camera's axis
		// Placed in the camera's own frame, since the camera may be turned relative to the wall.
		const target = new Vector3((right / focal) * dz, -(down / focal) * dz, -dz)
			.applyQuaternion(camera.quaternion)
			.add(camera.position);
		// Turn and tip it to face the camera, which looks at it off its axis, then apply its own
		// attitude.
		const tip = -Math.atan(down / focal) + (p.item.held?.pitch ?? 0);
		p.heldRotation
			.copy(camera.quaternion)
			.multiply(new Quaternion().setFromAxisAngle(Y_AXIS, -Math.atan(right / focal)))
			.multiply(new Quaternion().setFromAxisAngle(X_AXIS, tip))
			.multiply(new Quaternion().setFromAxisAngle(Y_AXIS, p.item.held?.yaw ?? 0));
		// The group's origin is its base, so offset it to put its middle on the target.
		p.heldPosition.copy(target).sub(p.centre.clone().applyQuaternion(p.heldRotation));
		if (p === held) {
			heldLight.position
				.set(0, 0, 1.4)
				.applyQuaternion(camera.quaternion)
				.add(target)
				.setY(target.y + 2.4);
			heldLight.target.position.copy(target);
		}
	}

	// --- Drawing ------------------------------------------------------------------------------

	let frame = 0;
	let last = 0;
	let hovered: Placed | undefined;

	function request() {
		if (host && !frame) frame = requestAnimationFrame(draw);
	}

	/**
	 * Draw again because an object that works by itself has changed. Told which part of it shows
	 * the change, only if some of that part is in the window: a frame of video is not worth
	 * drawing for a tv that has been scrolled out of sight.
	 */
	function redraw(showing?: Object3D) {
		if (!showing || view.intersectsObject(showing)) request();
	}

	function draw(now: number) {
		frame = 0;
		// Real elapsed time, so that a slow device drops frames instead of slowing the motion down.
		const dt = Math.min((now - (last || now)) / 1000, 0.25);
		last = now;
		let moving = false;
		let lift = 0;

		for (const p of placed) {
			const goal = p === held ? 1 : 0;
			if (p.t !== goal) {
				const step = dt / PICK_S;
				p.t = goal > p.t ? Math.min(goal, p.t + step) : Math.max(goal, p.t - step);
				moving = true;
			}
			const lean = p === hovered && !held ? 1 : 0;
			if (p.nudge !== lean) {
				const step = dt / 0.15;
				p.nudge = lean > p.nudge ? Math.min(lean, p.nudge + step) : Math.max(lean, p.nudge - step);
				moving = true;
			}
			const e = ease(p.t);
			p.group.position.lerpVectors(p.shelfPosition, p.heldPosition, e);
			p.group.position.z += (p.item.out ?? 0.06) * p.nudge * (1 - e);
			p.group.quaternion.slerpQuaternions(p.shelfRotation, p.heldRotation, e);
			lift = Math.max(lift, e);
			p.works?.lifted?.(e);
		}
		for (const works of working) if (works.tick(dt)) moving = true;

		wash.intensity = 8 * (1 - DIM * lift);
		heldLight.intensity = 9 * lift;
		room.dim(DIM * lift);
		for (const works of working) works.dim(DIM * lift);

		renderer.render(scene, camera);

		if (moving) request();
		else last = 0;
	}

	// --- Input --------------------------------------------------------------------------------

	const raycaster = new Raycaster();
	const pointer = new Vector2();
	let down: { x: number; y: number } | undefined;

	/** The first thing under the pointer, whatever it is. */
	function under(event: { clientX: number; clientY: number }): Intersection | undefined {
		const rect = canvas.getBoundingClientRect();
		pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);
		raycaster.setFromCamera(pointer, camera);
		// The rack and the board are not objects, but they hide what is behind them.
		const targets: Object3D[] = placed.filter((p) => p.group.visible).map((p) => p.group);
		return raycaster.intersectObjects([...targets, unit, room.board], true)[0];
	}

	/** The object that a press on this would pick up. */
	function itemAt(hit: Intersection | undefined): Placed | undefined {
		if (!hit) return;
		// A press on the board itself is for the flier nearest to it.
		if (hit.object === room.board) {
			const from = (p: Placed) => Math.hypot(p.shelfPosition.x - hit.point.x, p.shelfPosition.y - hit.point.y);
			const fliers = placed.filter((p) => p.item.id.startsWith('flier-') && p !== held);
			return fliers.sort((a, b) => from(a) - from(b))[0];
		}
		// Something that stays on the shelf is not a hit, but it does hide what is behind it.
		return placed.find((p) => p.item.id === hit.object.userData.item && !p.item.fixed);
	}

	/** The working part that a press on this would work. Nothing works while something is held. */
	function controlAt(hit: Intersection | undefined): Control | undefined {
		return held ? undefined : hit?.object.userData.control;
	}

	// A press that starts on a part that turns, and how far down the window it had got at the
	// last click. From there it takes another CLICK_PX either way for the next one, so a finger
	// resting where one click came does not rock between two.
	const CLICK_PX = 12;
	let turning: { control: Control; id: number; y: number; turned: boolean } | undefined;

	function letGo() {
		if (turning && canvas.hasPointerCapture(turning.id)) canvas.releasePointerCapture(turning.id);
		turning = undefined;
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0 || !event.isPrimary) return;
		down = { x: event.clientX, y: event.clientY };
		const control = controlAt(under(event));
		if (!control?.turn) return;
		turning = { control, id: event.pointerId, y: event.clientY, turned: false };
		// The press stays the knob's however far from it the drag goes.
		canvas.setPointerCapture(event.pointerId);
	}

	/** A finger that came down on a part that turns is turning it, not scrolling the page. */
	function onTouchStart(event: TouchEvent) {
		if (turning && event.cancelable) event.preventDefault();
	}

	function onPointerUp(event: PointerEvent) {
		const start = down;
		const turned = turning?.turned;
		down = undefined;
		letGo();
		if (!start || turned) return;
		// A press that moved was not a tap.
		const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
		if (moved > 10) return;
		const hit = under(event);
		const control = controlAt(hit);
		const item = itemAt(hit);
		// With something held, a tap anywhere (the object included) puts it back.
		if (held) host?.onTap(null);
		else if (control) {
			// A tap on a working part works it, where it is.
			if (event.pointerType !== 'mouse' && control.touch) control.touch();
			else control.tap();
			request();
		} else if (item) host?.onTap(item.item.id);
	}

	function onPointerMove(event: PointerEvent) {
		if (turning?.id === event.pointerId) {
			while (Math.abs(event.clientY - turning.y) >= CLICK_PX) {
				const by = event.clientY > turning.y ? 1 : -1;
				turning.y += by * CLICK_PX;
				turning.turned = true;
				turning.control.turn?.(by);
			}
			if (turning.turned) request();
			return;
		}
		if (event.pointerType !== 'mouse') return;
		const hit = under(event);
		const item = itemAt(hit);
		// Whatever a tap would pick up, or do something else with, leans out under the pointer.
		const over = held ? (item === held ? item : undefined) : item;
		canvas.style.cursor = held || item || controlAt(hit) ? 'pointer' : '';
		if (over !== hovered) {
			hovered = over;
			request();
		}
	}

	// The wheel, over a part that turns, turns it instead of scrolling the page: a click for every
	// WHEEL_PX it would have scrolled, which is two to a notch of most wheels.
	const WHEEL_PX = 50;
	let wheeled: { control: Control; by: number } | undefined;

	function onWheel(event: WheelEvent) {
		const control = controlAt(under(event));
		if (!control?.turn || event.ctrlKey) {
			wheeled = undefined;
			return;
		}
		event.preventDefault();
		if (wheeled?.control !== control) wheeled = { control, by: 0 };
		// Some browsers count in lines or pages instead of pixels.
		const unit = event.deltaMode === 1 ? 100 / 3 : event.deltaMode === 2 ? height : 1;
		wheeled.by += event.deltaY * unit;
		while (Math.abs(wheeled.by) >= WHEEL_PX) {
			const by = wheeled.by > 0 ? 1 : -1;
			wheeled.by -= by * WHEEL_PX;
			control.turn(by);
		}
		request();
	}

	function onPointerLeave() {
		down = undefined;
		letGo();
		if (hovered) {
			hovered = undefined;
			request();
		}
	}

	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('touchstart', onTouchStart, { passive: false });
	canvas.addEventListener('wheel', onWheel, { passive: false });
	canvas.addEventListener('pointerup', onPointerUp);
	canvas.addEventListener('pointercancel', onPointerLeave);
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerleave', onPointerLeave);

	buildUnit();

	return {
		/** Bring an object forward (by id), or put whatever is held back (null). */
		pick(id: string | null) {
			held = placed.find((p) => p.item.id === id && p.group.visible && !p.item.fixed && !p.item.link);
			if (held) hold(held);
			request();
		},
		setShelves(count: number) {
			shelves = count;
			buildUnit();
			layout();
		},
		/**
		 * A copy of the canvas as it looks now, laid out exactly over it. A WebGL canvas reads back
		 * blank except straight after it is drawn, so the page transitions (#lib/capture.ts), which
		 * take a picture of the page, need this put in front of it first.
		 */
		canvas,
		snapshot(): HTMLCanvasElement {
			const copy = document.createElement('canvas');
			copy.width = canvas.width;
			copy.height = canvas.height;
			copy.style.cssText = `position:fixed;top:0;left:0;width:${width}px;height:${height}px;`;
			renderer.render(scene, camera);
			copy.getContext('2d')?.drawImage(canvas, 0, 0);
			return copy;
		},
		/** Compile the scene's shaders without blocking the page, then draw it once. */
		async warm() {
			layout();
			await renderer.compileAsync(scene, camera);
			// A full draw, which is what stands the objects on their shelves.
			draw(performance.now());
			reflect();
			draw(performance.now());
		},
		/** Put the scene on a page, inside `element`, drawn before this returns. */
		attach(element: HTMLElement, page: Host) {
			host = page;
			element.append(canvas);
			window.addEventListener('resize', layout);
			for (const works of working) works.start(redraw);
			layout();
			cancelAnimationFrame(frame);
			frame = 0;
			draw(performance.now());
		},
		/** Take the scene off its page, with everything back on the shelf, and keep it for later. */
		detach() {
			host = undefined;
			cancelAnimationFrame(frame);
			frame = 0;
			last = 0;
			window.removeEventListener('resize', layout);
			for (const works of working) works.stop();
			canvas.remove();
			held = hovered = undefined;
			for (const p of placed) p.t = p.nudge = 0;
		}
	};
}
