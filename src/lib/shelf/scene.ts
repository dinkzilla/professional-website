// The shelving unit (grey-box prototype): a narrow unit of shelves on a dark wall, a light over
// each shelf, and block-out objects (see items.ts) that come forward off the shelf when picked.
//
// The page scrolls natively; the canvas is fixed and the camera follows the scroll position, so
// the unit behaves like a column of ordinary page content. The camera looks at the wall square-on
// from a little above, with the frustum shifted down rather than the camera tilted (a "shift
// lens"), so the unit's verticals stay vertical and one world unit is the same number of pixels
// (`ppu`) all the way down the shelves' front edge.
//
// Nothing is drawn unless something changed: scroll, resize, hover, or an object in flight.

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
	PlaneGeometry,
	Quaternion,
	Raycaster,
	Scene,
	SpotLight,
	Vector2,
	Vector3,
	WebGLRenderer
} from 'three';
import { items, type Item } from './items.ts';

// The unit, in world units (one is about half a metre). The wall is the plane z = 0 and the
// unit's top edge is y = 0, with the shelves going down from there.
const WIDTH = 2.4; // inside, between the side panels
const DEPTH = 0.7;
const PITCH = 1.3; // from one shelf's surface to the next
const BOARD = 0.05; // thickness of shelves and side panels
const FULL_WIDTH = WIDTH + 2 * BOARD;

const FOV = (24 * Math.PI) / 180; // vertical field of view across the window
const ELEVATION = (13 * Math.PI) / 180; // how far above the window's centre the camera looks from
const MARGIN = 28; // px kept clear above and below the unit
const GUTTER = 16; // px kept clear either side
const FIT_SHELVES = 3; // the unit is sized so this many shelves fit the window's height...
const MIN_PPU = 150; // ...unless that would make it narrower than this many px per unit
const FLANK_MIN = 300; // px of wall needed beside the unit to hold a picked object there
const FLANK_MAX = 480;
const PICK_S = 0.55; // seconds for an object to come forward or go back
const DIM = 0.65; // how much of the shelf lighting is lost while an object is held

export type LayoutMode = 'tall' | 'flank' | 'split';

export interface Layout {
	/** Where a picked object and its panel go: stacked, either side of the unit, or half each. */
	mode: LayoutMode;
	/** The unit's width on screen. */
	unitPx: number;
	/** How tall the document has to be for the whole unit to scroll into view. */
	contentPx: number;
}

export interface Options {
	canvas: HTMLCanvasElement;
	/** An overlay the scene fills with one caption per object. */
	labels: HTMLElement;
	/** The height to lay out for: the viewport with the browser's bars showing. */
	fitHeight: () => number;
	onLayout: (layout: Layout) => void;
	/** An object was tapped (its id), or the space around a held object was (null). */
	onTap: (id: string | null) => void;
}

interface Placed {
	item: Item;
	group: Group;
	label: HTMLElement;
	centre: Vector3; // of its bounding box, in its own coordinates
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

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createShelf(options: Options) {
	const { canvas, labels } = options;

	const renderer = new WebGLRenderer({ canvas, antialias: true });
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = PCFSoftShadowMap;
	renderer.toneMapping = ACESFilmicToneMapping;

	const scene = new Scene();
	scene.background = new Color(0x000000);
	const camera = new PerspectiveCamera();

	const wood = new MeshStandardMaterial({ color: 0x4a443d, roughness: 0.9 });
	const wallMaterial = new MeshStandardMaterial({ color: 0x2b2a2d, roughness: 1 });

	const wall = new Mesh(new PlaneGeometry(60, 60), wallMaterial);
	wall.receiveShadow = true;
	scene.add(wall);
	scene.add(new HemisphereLight(0xcfd8ff, 0x1a1410, 0.22));

	// Lights the wall around the unit, brightest at the top and falling off to the sides.
	const wash = new SpotLight(0xffe7c8, 60, 0, 0.75, 1, 1.6);
	scene.add(wash, wash.target);

	// Lights whichever object is being held, from above it.
	const heldLight = new SpotLight(0xfff1dc, 0, 0, 0.6, 0.9, 1.2);
	scene.add(heldLight, heldLight.target);

	// The unit and its lights are rebuilt whenever the number of shelves changes.
	let unit = new Group();
	let shelfLights: SpotLight[] = [];
	let shelves = FIT_SHELVES;

	const placed: Placed[] = items.map((item) => {
		const group = item.build();
		group.traverse((o) => (o.userData.item = item.id));
		const bounds = new Box3().setFromObject(group);
		const label = document.createElement('span');
		label.textContent = item.label;
		labels.append(label);
		scene.add(group);
		return {
			item,
			group,
			label,
			centre: bounds.getCenter(new Vector3()),
			size: bounds.getSize(new Vector3()).length() * 0.8,
			shelfPosition: new Vector3(),
			shelfRotation: new Quaternion().setFromAxisAngle(Y_AXIS, item.yaw ?? 0),
			heldPosition: new Vector3(),
			heldRotation: new Quaternion(),
			t: 0,
			nudge: 0
		};
	});

	const unitHeight = () => shelves * PITCH + BOARD;
	const shelfY = (index: number) => -(index + 1) * PITCH;

	function buildUnit() {
		scene.remove(unit);
		for (const light of shelfLights) light.dispose();
		unit.traverse((o) => o instanceof Mesh && o.geometry.dispose());
		unit = new Group();
		shelfLights = [];

		const height = unitHeight();
		const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
			const m = new Mesh(new BoxGeometry(w, h, d), wood);
			m.position.set(x, y, z);
			m.castShadow = true;
			m.receiveShadow = true;
			unit.add(m);
		};
		for (const side of [-1, 1]) {
			add(BOARD, height, DEPTH, (side * (WIDTH + BOARD)) / 2, -height / 2, DEPTH / 2);
		}
		add(FULL_WIDTH, 0.02, 0.02, 0, 0, 0); // keeps the top edge crisp against the wall
		add(FULL_WIDTH, BOARD, DEPTH, 0, -BOARD / 2, DEPTH / 2);
		add(WIDTH, height, 0.02, 0, -height / 2, 0.01); // the back panel
		for (let i = 0; i < shelves; i++) {
			add(WIDTH, BOARD, DEPTH, 0, shelfY(i) - BOARD / 2, DEPTH / 2);

			// One light per shelf, tucked under the board above at the front, pointing down and back.
			const light = new SpotLight(0xffdfb8, 5, 5, 1.2, 0.85, 1.4);
			light.position.set(0, shelfY(i) + PITCH - BOARD - 0.03, DEPTH * 0.98);
			light.target.position.set(0, shelfY(i), DEPTH * 0.3);
			light.castShadow = true;
			light.shadow.mapSize.set(1024, 1024);
			light.shadow.camera.near = 0.05;
			light.shadow.camera.far = 4;
			light.shadow.bias = -0.0015;
			light.shadow.radius = 4;
			unit.add(light, light.target);
			shelfLights.push(light);
		}
		scene.add(unit);

		wash.position.set(0, 2.2, 4.5);
		wash.target.position.set(0, -height * 0.35, 0);

		for (const p of placed) {
			const present = p.item.shelf < shelves;
			p.group.visible = present;
			p.label.hidden = !present;
			p.shelfPosition.set(p.item.x, shelfY(p.item.shelf), DEPTH * (1 - (p.item.back ?? 0.5)));
		}
	}

	// --- Layout: window size and scroll position to camera -----------------------------------

	let width = 0; // of the canvas, in CSS px
	let height = 0;
	let fit = 0; // the height the unit is fitted to (see Options.fitHeight)
	let ppu = 1; // px per world unit at the shelves' front edge
	let focal = 1; // px: the camera's distance from that plane, in screen pixels
	let shift = 0; // px: how far below the camera's axis the window's centre is
	let top = 0; // px from the top of the document to the top of the unit
	let mode: LayoutMode = 'tall';
	let held: Placed | undefined;

	function layout() {
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		fit = Math.min(options.fitHeight(), height);
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(width, height, false);

		const widthFit = (width - 2 * GUTTER) / FULL_WIDTH;
		const heightFit = (fit - 2 * MARGIN) / (FIT_SHELVES * PITCH + BOARD);
		ppu = Math.min(widthFit, Math.max(heightFit, MIN_PPU));

		const unitPx = FULL_WIDTH * ppu;
		const contentPx = unitHeight() * ppu + 2 * MARGIN;
		top = contentPx <= fit ? (fit - unitHeight() * ppu) / 2 : MARGIN;

		const beside = (width - unitPx) / 2;
		mode = width < fit ? 'tall' : beside >= FLANK_MIN ? 'flank' : 'split';

		focal = height / 2 / Math.tan(FOV / 2);
		shift = focal * Math.tan(ELEVATION);
		camera.fov = (2 * Math.atan((height / 2 + shift) / focal) * 180) / Math.PI;
		camera.near = 0.1;
		camera.far = 200;
		// The window is the lower part of a taller frustum, which puts the camera's axis above
		// the window's centre without tilting it. This also sets the aspect ratio.
		camera.setViewOffset(width, height + 2 * shift, 0, 2 * shift, width, height);

		options.onLayout({ mode, unitPx, contentPx: Math.max(contentPx, fit) });
		follow();
	}

	/** Put the camera where the scroll position says, and anything held in front of it. */
	function follow() {
		const distance = focal / ppu;
		const centre = (top - window.scrollY - height / 2) / ppu; // world y at the window's centre
		camera.position.set(0, centre + distance * Math.tan(ELEVATION), DEPTH + distance);
		camera.updateMatrixWorld();
		for (const p of placed) hold(p);
		request();
	}

	/** Where on screen (CSS px) a picked object is shown. */
	function stage() {
		if (mode === 'tall') return { x: width / 2, y: fit * 0.27, w: width, h: fit * 0.5 };
		if (mode === 'split') return { x: width / 4, y: fit / 2, w: width / 2, h: fit };
		const beside = (width - FULL_WIDTH * ppu) / 2;
		const w = Math.min(beside, FLANK_MAX);
		return { x: beside - w / 2, y: fit / 2, w, h: fit };
	}

	/** Work out an object's held position and attitude: centred on the stage, facing the camera. */
	function hold(p: Placed) {
		const s = stage();
		const distance = focal / ppu;
		const room = Math.min(s.w, s.h) * 0.72;
		const dz = Math.min(Math.max((p.size * focal) / room, 1.2), distance * 0.8);
		const down = s.y - height / 2 + shift; // px below the camera's axis
		const target = new Vector3(
			((s.x - width / 2) / focal) * dz,
			camera.position.y - (down / focal) * dz,
			camera.position.z - dz
		);
		// Tip it back to face the camera, which is above it, then apply its own attitude.
		const pitch = -Math.atan(down / focal) + (p.item.held?.pitch ?? 0);
		p.heldRotation
			.setFromAxisAngle(X_AXIS, pitch)
			.multiply(new Quaternion().setFromAxisAngle(Y_AXIS, p.item.held?.yaw ?? 0));
		// The group's origin is its base, so offset it to put its middle on the target.
		p.heldPosition.copy(target).sub(p.centre.clone().applyQuaternion(p.heldRotation));
		if (p === held) {
			heldLight.position.set(target.x, target.y + 2.4, target.z + 1.4);
			heldLight.target.position.copy(target);
		}
	}

	// --- Drawing ------------------------------------------------------------------------------

	let frame = 0;
	let last = 0;
	let hovered: Placed | undefined;
	const projected = new Vector3();

	function request() {
		if (!frame) frame = requestAnimationFrame(draw);
	}

	function draw(now: number) {
		frame = 0;
		const dt = Math.min((now - (last || now)) / 1000, 0.05);
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
			p.group.position.z += 0.06 * p.nudge * (1 - e);
			p.group.quaternion.slerpQuaternions(p.shelfRotation, p.heldRotation, e);
			lift = Math.max(lift, e);
		}

		for (const light of shelfLights) light.intensity = 5 * (1 - DIM * lift);
		wash.intensity = 60 * (1 - DIM * lift);
		heldLight.intensity = 9 * lift;

		renderer.render(scene, camera);

		// Captions sit just under each object's spot on the front edge of its shelf.
		for (const p of placed) {
			if (p.label.hidden) continue;
			projected.set(p.shelfPosition.x, p.shelfPosition.y - BOARD, DEPTH).project(camera);
			const x = ((projected.x + 1) / 2) * width;
			const y = ((1 - projected.y) / 2) * height;
			p.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, 3px)`;
		}

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
		const targets: Object3D[] = placed.filter((p) => p.group.visible).map((p) => p.group);
		const hit = raycaster.intersectObjects(targets, true)[0];
		return hit && placed.find((p) => p.item.id === hit.object.userData.item);
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
		if (held) {
			if (hit !== held) options.onTap(null);
		} else if (hit) {
			options.onTap(hit.item.id);
		}
	}

	function onPointerMove(event: PointerEvent) {
		if (event.pointerType !== 'mouse') return;
		const hit = itemAt(event);
		const over = held ? (hit === held ? hit : undefined) : hit;
		canvas.style.cursor = (held ? hit !== held : hit) ? 'pointer' : '';
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
	window.addEventListener('scroll', follow, { passive: true });
	window.addEventListener('resize', layout);

	buildUnit();
	layout();

	return {
		/** Bring an object forward (by id), or put whatever is held back (null). */
		pick(id: string | null) {
			held = placed.find((p) => p.item.id === id && p.group.visible);
			labels.classList.toggle('held', !!held);
			if (held) hold(held);
			request();
		},
		setShelves(count: number) {
			shelves = count;
			buildUnit();
			layout();
		},
		destroy() {
			cancelAnimationFrame(frame);
			canvas.removeEventListener('pointerdown', onPointerDown);
			canvas.removeEventListener('pointerup', onPointerUp);
			canvas.removeEventListener('pointercancel', onPointerLeave);
			canvas.removeEventListener('pointermove', onPointerMove);
			canvas.removeEventListener('pointerleave', onPointerLeave);
			window.removeEventListener('scroll', follow);
			window.removeEventListener('resize', layout);
			for (const p of placed) p.label.remove();
			renderer.dispose();
		}
	};
}
