// The fliers pinned to the board on the wall.

import {
	BoxGeometry,
	Group,
	LatheGeometry,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	SRGBColorSpace,
	Texture,
	Vector2
} from 'three';
import { page, mesh } from '../parts.ts';
import { WALL, HOOK, RACK_WIDTH, BOARD, RACK_BACK } from '../rack.ts';
import { air, blown } from '../tie.ts';
import type { Placement } from '../types.ts';

// The fliers on the board: the pictures saved in the assets' fliers folder, in the order of their
// names, which `npm run fliers` puts there (see scripts/set-fliers.js). A flier is its picture
// and nothing else, so there are only as many fliers as pictures.
const flierArt = Object.entries(
	import.meta.glob<string>('../../assets/fliers/*.{jpg,jpeg,png,webp}', {
		eager: true,
		query: '?url',
		import: 'default'
	})
)
	.sort(([a], [b]) => a.localeCompare(b))
	.map(([, url]) => url);
/** Where one flier is pinned, as scripts/set-fliers.js worked it out for this set of pictures. */
interface Pinned {
	/** Where along the wall its middle is, and how far above the floor. */
	x: number;
	up: number;
	/** How crooked it hangs. */
	lean: number;
	w: number;
	h: number;
	/** How much further off the wall than the board it is: it is over others. */
	proud: number;
	/**
	 * Where its pins are, from its middle as it hangs: one at its top, or one at its top and one
	 * at its foot. And what colour the head of each is: whatever was in the box.
	 */
	pins: { x: number; y: number; color: string }[];
	/**
	 * It has the one pin, and the air gets under it. Those that do are over all the others and
	 * clear of one another, so that nothing is ever in the way of them; the rest are pinned top
	 * and foot and do not move, as a board that is used fills up.
	 */
	waves: boolean;
}
// The arrangement of them: made afresh for each set of pictures, since their shapes differ, to
// look thrown up anyhow and yet hide as little of any as can be.
const flierLayout: Pinned[] =
	Object.values(
		import.meta.glob<{ fliers: Pinned[] }>('../../assets/fliers/layout.json', { eager: true, import: 'default' })
	)[0]?.fliers ?? [];
/** Those pictures, once fetched: each where its flier looks for it. */
const flierPrints: (HTMLImageElement | undefined)[] = [];

/** Fetch the fliers' pictures. Whatever cannot be had is done without. */
export async function loadFliers() {
	const prints = flierArt.map((url) => Object.assign(new Image(), { src: url }));
	await Promise.allSettled(prints.map((print, i) => print.decode().then(() => (flierPrints[i] = print))));
}

// A push pin's head, standing out from the paper (which is at y = 0 here, the pin pointing up),
// in the proportions of a real one: about half an inch long and three eighths across, so taller
// than it is wide. A flange against the paper, which is the widest of it; a long waist drawn in
// to half that, to take it by; and a cap a little narrower than the flange. Made more than half
// as big again as life, as the small things in the room are, so that it shows. Turned from its
// outline.
const PIN_R = 0.0152;
const PIN_H = 0.0405;
const PIN_HEAD = new LatheGeometry(
	[
		[0, 0],
		[0.95, 0],
		[1, 0.03],
		[1, 0.1],
		// The waist: in from the flange to its narrowest, less than half way up, and out to the cap.
		...Array.from({ length: 13 }, (_, n) => {
			const u = n / 12;
			const full = u < 0.45 ? 0.5 + 0.5 * Math.cos((Math.PI * u) / 0.45) : 0.72 * (0.5 - 0.5 * Math.cos((Math.PI * (u - 0.45)) / 0.55));
			return [0.5 + 0.43 * full, 0.13 + 0.7 * u];
		}),
		[0.82, 0.86],
		[0.82, 0.95],
		[0.74, 0.99],
		[0, 1]
	].map(([r, y]) => new Vector2(r * PIN_R, y * PIN_H)),
	24
);
// Bright plastic, glossy, and lit by the room as everything else in it is: lit by itself as
// well, it stood out of the dim like a lamp.
// One material for each colour, however many pins have it.
const pinHeads = new Map<string, MeshStandardMaterial>();
function pinHead(color: string) {
	let head = pinHeads.get(color);
	if (!head) {
		head = new MeshStandardMaterial({ color, roughness: 0.3 });
		pinHeads.set(color, head);
	}
	return head;
}

/**
 * A show flier, flat against the wall and facing out: one of the pictures in the assets (see
 * flierArt), on a sheet of that picture's proportions. Most are pinned at top and foot and stay
 * as they are. One with a single pin through its top is taken by the air from the door, later
 * the further off it is, and what part of it is behind the rack cannot lift far.
 */
function flier(index: number, at: Pinned) {
	const { x, lean, w, h } = at;
	const far = HOOK.x - x;
	const art = flierPrints[index];
	let map: Texture | undefined;
	if (art) {
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
	const strips: [number, number] = at.waves ? [4, 12] : [1, 1];
	const stock = new BoxGeometry(w, h, 0.004, ...strips, 1);
	const facing = stock.groups[4]; // a box's faces come right, left, top, bottom, front, back
	const faces = Array.from(stock.index!.array);
	faces.splice(facing.start, facing.count);
	stock.setIndex(faces);
	stock.clearGroups();
	const sheet = mesh(stock, page);
	// A picture that could not be had leaves the paper blank.
	const front = new Mesh(new PlaneGeometry(w, h, ...strips), map ? new MeshStandardMaterial({ map, roughness: 0.95 }) : page);
	front.position.z = 0.0025;
	g.add(sheet, front);
	for (const pin of at.pins) {
		const head = mesh(PIN_HEAD, pinHead(pin.color), pin.x, pin.y, 0.0046);
		// Pushed in by hand: out from the paper, and never quite square to it.
		head.rotation.set(Math.PI / 2 + 0.22 * Math.sin(91 * pin.x + 13 * pin.y + index), 0, 0.22 * Math.sin(57 * pin.y - 29 * pin.x + 2 * index));
		g.add(head);
	}
	if (!at.waves) return g;

	// Its one pin, which under the pointer it turns on (see Placement.swing).
	const PIN = at.pins[0].y;
	g.userData.pin = PIN;

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
		// How far the paper's face is from the back of the rack, where it is now.
		const gap = Math.max(0, RACK_BACK - 0.004 - g.position.z - 0.0045);
		for (const { geometry, still } of sheets) {
			const points = geometry.attributes.position;
			for (let i = 0; i < points.count; i++) {
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
				points.setXYZ(i, px, py, still[i * 3 + 2] + lifted);
			}
			points.needsUpdate = true;
			geometry.computeVertexNormals();
			// What a pointer is over is found by these.
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
		}
	};
	g.userData.works = blown(front, pose);
	return g;
}

export const flierPlacements: Placement[] = flierLayout.slice(0, flierArt.length).map((at, i) => ({
	id: `flier-${i + 1}`,
	shelf: WALL,
	x: at.x,
	up: at.up,
	lean: at.lean,
	pinned: true,
	proud: at.proud,
	// One that waves is over the rest, and straightens a little under the pointer, whichever way
	// it hangs. One pinned top and foot stays as it is: it may have others over it, which coming
	// forward would take it through.
	...(at.waves ? { swing: at.lean > 0 ? -0.1 : 0.1 } : { out: 0 }),
	build: () => flier(i, at)
}));
