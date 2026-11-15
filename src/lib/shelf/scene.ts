// The rack (grey-box prototype): a tall, narrow equipment rack on legs against a dark wall, with a
// light over its one open shelf, and block-out objects (see items.ts). Some are mounted in it, their
// panels flush with its front; the others stand on its shelves, and some of those come forward
// when picked.
//
// The page scrolls natively; the canvas is fixed and the camera follows the scroll position, so
// the unit behaves like a column of ordinary page content. The camera looks at the wall square-on
// from its left at about eye level. One world unit is `ppu` pixels where the middle of the unit's
// front edge is drawn.
//
// Nothing is drawn unless something changed: scroll, resize, hover, or an object in flight.
//
// The scene outlives the page that shows it. It owns its canvas, so it can be built and drawn
// once before the personal page is ever visited (see ready.ts), then put on that page the moment
// it mounts, and taken off again, intact, when the visitor leaves.

import {
	ACESFilmicToneMapping,
	Box3,
	BoxGeometry,
	Color,
	Group,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	Object3D,
	PCFSoftShadowMap,
	PerspectiveCamera,
	Quaternion,
	Raycaster,
	Scene,
	SpotLight,
	Vector2,
	Vector3,
	WebGLRenderer
} from 'three';
import { buildRoom } from './room.ts';
import { BOARD, items, LEGS, RACK_DEPTH, RACK_WIDTH, WALL, type Item } from './items.ts';

// The unit, in world units (one is about half a metre). The wall is the plane z = 0, and y = 0 is
// a little above the tallest thing on the top shelf, with the shelves going down from there.
const WIDTH = RACK_WIDTH; // inside, between the posts
const DEPTH = RACK_DEPTH;
const HEADROOM = 0.2; // clear space left above the tallest object on a shelf
const POST = 0.06; // the posts are square, and stand a touch proud of the shelves
const FULL_WIDTH = WIDTH + 2 * BOARD;

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
const GUTTER = 16; // px kept clear either side
const FIT_SHELVES = 4; // the unit is sized so this many shelves fit the window's height...
const MIN_PPU = 150; // ...unless that would make it narrower than this many px per unit
const OFF_CENTRE = 0.12; // in wide windows the unit sits this share of the width left of centre
const PANEL_MIN = 280; // px of wall needed right of the unit for the panel to go there
const PICK_S = 0.55; // seconds for an object to come forward or go back
const SHELF_LIGHT = 3.2;
const DIM = 0.65; // how much of the shelf lighting is lost while an object is held

export type LayoutMode = 'tall' | 'side';

export interface Layout {
	/**
	 * Tall: the unit is centred, and a picked object shows above its panel. Side: the unit sits
	 * left of centre, a picked object comes up in front of it, and the panel is on its right.
	 */
	mode: LayoutMode;
	/** Where the unit's right edge is on screen. */
	unitRight: number;
	/** How tall the document has to be for the whole unit to scroll into view. */
	contentPx: number;
}

/** What the scene needs from the page it is shown on. */
export interface Host {
	/** The height to lay out for: the viewport with the browser's bars showing. */
	fitHeight: () => number;
	onLayout: (layout: Layout) => void;
	/** An object was tapped (its id), or the space around a held object was (null). */
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
}

const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Build the scene and draw it once, off the page, so that it can be shown without delay. */
export async function prepare(): Promise<Shelf> {
	const shelf = createShelf();
	await shelf.warm();
	return shelf;
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

	const steel = new MeshStandardMaterial({ color: 0x3b3b40, roughness: 0.7 });
	scene.add(new HemisphereLight(0xcfd8ff, 0x1a1410, 0.22));

	// Lights the wall around the unit, brightest at the top and falling off to the sides.
	const wash = new SpotLight(0xffe7c8, 60, 0, 0.75, 1, 1.6);
	scene.add(wash, wash.target);

	// Lights whichever object is being held, from above it.
	const heldLight = new SpotLight(0xfff1dc, 0, 0, 0.6, 0.9, 1.2);
	scene.add(heldLight, heldLight.target);

	// The unit and its lights are rebuilt whenever the number of shelves changes.
	let unit = new Group();
	let shelfLights = new Map<number, SpotLight>(); // by shelf
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
			nudge: 0
		};
	});

	// Each shelf is only as tall as its tallest object needs. `pitch` is the distance from the
	// surface above (the underside of the unit's top, for the first) to the shelf's own surface.
	const pitch: number[] = [];
	for (const p of placed) {
		if (p.item.shelf === WALL) continue;
		// Something mounted in the rack fills its bay.
		const needed = (p.item.flush ?? p.height + HEADROOM) + BOARD;
		pitch[p.item.shelf] = Math.max(pitch[p.item.shelf] ?? 0, needed);
	}
	const lit = new Set(items.filter((item) => !item.fixed && item.shelf !== WALL).map((item) => item.shelf));
	const drop = (count: number) => pitch.slice(0, count).reduce((sum, h) => sum + h, 0);
	// From y = 0 down to the floor.
	const unitHeight = (count = shelves) => drop(count) + BOARD + LEGS;
	const shelfY = (index: number) => -drop(index + 1);

	// The walls, the floor the legs stand on, and what is outside (see room.ts).
	const room = buildRoom(unitHeight(FIT_SHELVES));
	scene.add(room.group);

	function buildUnit() {
		scene.remove(unit);
		for (const light of shelfLights.values()) light.dispose();
		unit.traverse((o) => o instanceof Mesh && o.geometry.dispose());
		unit = new Group();
		shelfLights = new Map();

		const height = unitHeight();
		const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
			const m = new Mesh(new BoxGeometry(w, h, d), steel);
			m.position.set(x, y, z);
			m.castShadow = true;
			m.receiveShadow = true;
			unit.add(m);
		};
		// Open shelving: no back or sides, just a post at each corner. The posts stop at the top
		// shelf, which has nothing over it, and carry on below the bottom one as legs. The wall
		// shows through behind.
		const posts = height + shelfY(0);
		for (const side of [-1, 1]) {
			for (const z of [POST / 2 - 0.005, DEPTH - POST / 2 + 0.005]) {
				add(POST, posts, POST, side * (FULL_WIDTH / 2 - POST / 2 + 0.005), shelfY(0) - posts / 2, z);
			}
		}
		for (let i = 0; i < shelves; i++) {
			add(FULL_WIDTH, BOARD, DEPTH, 0, shelfY(i) - BOARD / 2, DEPTH / 2);

			// A shelf with something on it to pick up has a light at the front, pointing down and
			// back: tucked under the shelf above, or for the top shelf hanging in the air over it.
			// The rest of the rack has only the light that falls on the wall.
			if (!lit.has(i)) continue;
			const light = new SpotLight(0xffdfb8, SHELF_LIGHT, 5, 1.2, 0.85, 1.4);
			const over = i === 0 ? pitch[0] + 0.25 : pitch[i] - BOARD - 0.03;
			light.position.set(0, shelfY(i) + over, DEPTH * 0.98);
			light.target.position.set(0, shelfY(i), DEPTH * 0.3);
			light.castShadow = true;
			light.shadow.mapSize.set(1024, 1024);
			light.shadow.camera.near = 0.05;
			light.shadow.camera.far = 4;
			light.shadow.bias = -0.0015;
			light.shadow.radius = 4;
			// Its shadows are only redrawn when something on its shelf moves (see draw).
			light.shadow.autoUpdate = false;
			light.shadow.needsUpdate = true;
			unit.add(light, light.target);
			shelfLights.set(i, light);
		}
		scene.add(unit);

		room.group.position.y = -height;

		wash.position.set(0, 2.2, 4.5);
		wash.target.position.set(0, -height * 0.35, 0);

		for (const p of placed) {
			p.group.visible = p.item.shelf < shelves;
			if (p.item.shelf === WALL) {
				// Just off the wall: against the board, or hanging from a hook.
				p.shelfPosition.set(p.item.x, (p.item.up ?? 0) - height, 0.034);
				continue;
			}
			p.shelfPosition.set(
				p.item.x,
				shelfY(p.item.shelf) + p.sunk,
				// A mounted panel lies against the fronts of the posts.
				p.item.flush ? DEPTH + 0.008 : DEPTH * (1 - (p.item.back ?? 0.5))
			);
		}
	}

	// --- Layout: window size and scroll position to camera -----------------------------------

	let width = 0; // of the canvas, in CSS px
	let height = 0;
	let fit = 0; // the height the unit is fitted to (see Host.fitHeight)
	let ppu = 1; // px per world unit at the shelves' front edge
	let focal = 1; // px: the camera's distance from that plane, in screen pixels
	let shift = 0; // px: how far below the camera's axis the window's centre is
	let aside = 0; // px: how far to the right of the camera's axis it is
	let offset = 0; // px: how far right of the window's centre the unit is (negative: left)
	let top = 0; // px from the top of the document to the top of the unit
	let mode: LayoutMode = 'tall';
	let held: Placed | undefined;

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
			unitRight: spare + unitPx + offset,
			contentPx: Math.max(contentPx, fit)
		});
		follow();
	}

	/** Put the camera where the scroll position says, and anything held in front of it. */
	function follow() {
		const distance = focal / ppu;
		const scroll = host ? window.scrollY : 0;
		const centre = (top - scroll - height / 2) / ppu; // world y at the window's centre
		// The window is centred on the unit's front and its visible side together.
		const middle = (DEPTH * Math.sin(TURN)) / 2;
		// The camera is placed so that this point lands in the middle of the window.
		camera.rotation.set(0, TURN, 0);
		camera.position
			.set((aside + offset) / ppu, -shift / ppu, -distance)
			.applyQuaternion(camera.quaternion)
			.negate()
			.add(new Vector3(middle, centre, DEPTH));
		camera.updateMatrixWorld();
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

	function draw(now: number) {
		frame = 0;
		// Real elapsed time, so that a slow device drops frames instead of slowing the motion down.
		const dt = Math.min((now - (last || now)) / 1000, 0.25);
		last = now;
		let moving = false;
		let lift = 0;

		for (const p of placed) {
			const was = p.t;
			const leant = p.nudge;
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
			if (p.t !== was || p.nudge !== leant) {
				const light = shelfLights.get(p.item.shelf);
				if (light) light.shadow.needsUpdate = true;
			}
			const e = ease(p.t);
			p.group.position.lerpVectors(p.shelfPosition, p.heldPosition, e);
			p.group.position.z += 0.06 * p.nudge * (1 - e);
			p.group.quaternion.slerpQuaternions(p.shelfRotation, p.heldRotation, e);
			lift = Math.max(lift, e);
		}

		for (const light of shelfLights.values()) light.intensity = SHELF_LIGHT * (1 - DIM * lift);
		wash.intensity = 60 * (1 - DIM * lift);
		heldLight.intensity = 9 * lift;
		room.dim(DIM * lift);

		renderer.render(scene, camera);

		if (moving) request();
		else last = 0;
	}

	// --- Input --------------------------------------------------------------------------------

	const raycaster = new Raycaster();
	const pointer = new Vector2();
	let down: { x: number; y: number; scroll: number } | undefined;

	function itemAt(event: PointerEvent): Placed | undefined {
		const rect = canvas.getBoundingClientRect();
		pointer.set(
			((event.clientX - rect.left) / rect.width) * 2 - 1,
			-((event.clientY - rect.top) / rect.height) * 2 + 1
		);
		raycaster.setFromCamera(pointer, camera);
		// The rack and the board are not objects, but they hide what is behind them.
		const targets: Object3D[] = placed.filter((p) => p.group.visible).map((p) => p.group);
		const hit = raycaster.intersectObjects([...targets, unit, room.board], true)[0];
		// A press on the board itself is for the flier nearest to it.
		if (hit?.object === room.board) {
			const from = (p: Placed) => Math.hypot(p.shelfPosition.x - hit.point.x, p.shelfPosition.y - hit.point.y);
			const fliers = placed.filter((p) => p.item.id.startsWith('flier-') && p !== held);
			return fliers.sort((a, b) => from(a) - from(b))[0];
		}
		// Something that stays on the shelf is not a hit, but it does hide what is behind it.
		return hit && placed.find((p) => p.item.id === hit.object.userData.item && !p.item.fixed);
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		down = { x: event.clientX, y: event.clientY, scroll: window.scrollY };
	}

	function onPointerUp(event: PointerEvent) {
		const start = down;
		down = undefined;
		if (!start) return;
		// A press that moved, or that scrolled the page, was not a tap.
		const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
		if (moved > 10 || Math.abs(window.scrollY - start.scroll) > 4) return;
		const hit = itemAt(event);
		// With something held, a tap anywhere (the object included) puts it back.
		if (held) host?.onTap(null);
		else if (hit) host?.onTap(hit.item.id);
	}

	function onPointerMove(event: PointerEvent) {
		if (event.pointerType !== 'mouse') return;
		const hit = itemAt(event);
		const over = held ? (hit === held ? hit : undefined) : hit;
		canvas.style.cursor = held || hit ? 'pointer' : '';
		if (over !== hovered) {
			hovered = over;
			request();
		}
	}

	function onPointerLeave() {
		down = undefined;
		if (hovered) {
			hovered = undefined;
			request();
		}
	}

	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointerup', onPointerUp);
	canvas.addEventListener('pointercancel', onPointerLeave);
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerleave', onPointerLeave);

	buildUnit();

	return {
		/** Bring an object forward (by id), or put whatever is held back (null). */
		pick(id: string | null) {
			held = placed.find((p) => p.item.id === id && p.group.visible && !p.item.fixed);
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
			// A full draw, which is what stands the objects on their shelves; the shadows drawn here
			// are kept until something moves.
			draw(performance.now());
		},
		/** Put the scene on a page, inside `element`, drawn before this returns. */
		attach(element: HTMLElement, page: Host) {
			host = page;
			element.append(canvas);
			window.addEventListener('scroll', follow, { passive: true });
			window.addEventListener('resize', layout);
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
			window.removeEventListener('scroll', follow);
			window.removeEventListener('resize', layout);
			canvas.remove();
			held = hovered = undefined;
			for (const p of placed) p.t = p.nudge = 0;
			for (const light of shelfLights.values()) light.shadow.needsUpdate = true;
		}
	};
}
