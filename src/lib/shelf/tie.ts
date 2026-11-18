// The tie on the hook by the door (placed in items.ts).

import {
	BufferGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	DoubleSide,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshPhysicalMaterial,
	MeshStandardMaterial,
	RepeatWrapping,
	SphereGeometry,
	SRGBColorSpace,
	Vector3,
	type Material
} from 'three';
import type { Works } from './items.ts';

function mesh(geometry: BufferGeometry, material: Material | Material[]) {
	const m = new Mesh(geometry, material);
	m.castShadow = true;
	m.receiveShadow = true;
	return m;
}

const ease = (k: number) => k * k * (3 - 2 * k);
const clamp = (k: number) => Math.min(1, Math.max(0, k));
/** From 0 to 1, and the same every time for the same `n`: for creases that stay where they are. */
const chance = (n: number) => {
	const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
	return s - Math.floor(s);
};

// How big one repeat of the tie's weave is, in world units, and in the picture of it.
const WEAVE = 0.03;
const WEAVE_PX = 32;
const PINK = { ground: '#ff2e93', rib: '#e3207f' };
// The same weave as a relief: its ribs are furrows.
const RELIEF = { ground: '#808080', rib: '#6c6c6c' };

function sheet(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width));
	canvas.height = Math.max(1, Math.round(height));
	return { canvas, c: canvas.getContext('2d')! };
}

/** One repeat of the tie's cloth: a twill, its ribs running up to the right, or to the left. */
function twill({ ground, rib }: { ground: string; rib: string }, left = false) {
	const PX = WEAVE_PX;
	const { canvas, c } = sheet(PX, PX);
	c.fillStyle = ground;
	c.fillRect(0, 0, PX, PX);
	c.strokeStyle = rib;
	c.lineWidth = 2;
	// Four ribs to the repeat, so that it meets itself at every edge.
	for (let k = -PX; k <= PX; k += PX / 4) {
		c.beginPath();
		c.moveTo(k, left ? 0 : PX);
		c.lineTo(k + PX, left ? PX : 0);
		c.stroke();
	}
	return canvas;
}

/** Cloth with this picture on it and this relief, lit a little by itself, to show in the dim of the room. */
function cloth(picture: HTMLCanvasElement, relief: HTMLCanvasElement, tiled: boolean) {
	const map = new CanvasTexture(picture);
	map.colorSpace = SRGBColorSpace;
	const bumpMap = new CanvasTexture(relief);
	for (const texture of [map, bumpMap]) {
		if (tiled) texture.wrapS = texture.wrapT = RepeatWrapping;
		texture.anisotropy = 4;
	}
	return new MeshPhysicalMaterial({
		map,
		bumpMap,
		bumpScale: 2.5,
		roughness: 0.62,
		// The nap of it, catching the light where it turns away; none on the lining.
		sheen: 1,
		sheenColorMap: map,
		sheenRoughness: 0.45,
		emissive: 0xffffff,
		emissiveMap: map,
		emissiveIntensity: 0.17,
		side: DoubleSide
	});
}

/** A blade of the tie: half its width where it leaves the knot and at its widest, and its length. */
interface Blade {
	halfTop: number;
	halfEnd: number;
	length: number;
}

/**
 * The back of a blade, as a picture of the whole of it at the weave's own scale, and its relief:
 * the two edges of the cloth folded in to meet at a seam that wanders down the middle (`seam` is
 * how far it is off the middle, this far down), the weave turned the other way on each; creases
 * from being knotted and thrown about; at the bottom, where the folds part, the black lining in a
 * diamond with the cloth turned in round it; and, on the wide blade, the maker's label.
 */
function bladeBack({ halfEnd, length }: Blade, seam: (y: number) => number, seed: number, label?: number) {
	const S = WEAVE_PX / WEAVE;
	const picture = sheet(2 * halfEnd * S, length * S);
	const relief = sheet(2 * halfEnd * S, length * S);
	const W = picture.canvas.width;
	const H = picture.canvas.height;
	const c = picture.c;
	const b = relief.c;
	const mid = W / 2;
	const end = halfEnd * S;
	const shoulder = H - end; // where the point begins
	const apex = shoulder - end * 0.9; // where the folded edges part
	const hem = 5;
	const seamAt = (py: number) => mid + seam(py / S) * S;

	// The right-hand fold, and over it the left-hand one, as far as the seam.
	c.fillStyle = c.createPattern(twill(PINK, true), 'repeat')!;
	c.fillRect(0, 0, W, H);
	b.fillStyle = b.createPattern(twill(RELIEF, true), 'repeat')!;
	b.fillRect(0, 0, W, H);
	const run = (to: CanvasRenderingContext2D, shift: number, from = 0, until = apex) => {
		to.beginPath();
		for (let py = from; py < until; py += 6) to.lineTo(seamAt(py) + shift, py);
		to.lineTo(seamAt(until) + shift, until);
	};
	for (const [to, weave] of [
		[c, PINK],
		[b, RELIEF]
	] as const) {
		to.save();
		run(to, 0);
		to.lineTo(mid, H);
		to.lineTo(0, H);
		to.lineTo(0, 0);
		to.closePath();
		to.clip();
		to.fillStyle = to.createPattern(twill(weave), 'repeat')!;
		to.fillRect(0, 0, W, H);
		to.restore();
	}

	// Creases, most of them near the knot, each a furrow with the light on its lower lip.
	const creases = Math.round(length * 15);
	for (let i = 0; i < creases; i++) {
		const y = apex * chance(seed + i) ** 1.7;
		const x = W * chance(seed + i + 0.31);
		const reach = 12 + 34 * chance(seed + i + 0.57);
		const slope = (chance(seed + i + 0.83) - 0.5) * 1.3;
		const line = (to: CanvasRenderingContext2D, drop: number) => {
			to.beginPath();
			to.moveTo(x - reach, y - reach * slope + drop);
			to.quadraticCurveTo(x, y + drop + 3 * (chance(seed + i + 0.11) - 0.5), x + reach, y + reach * slope + drop);
			to.stroke();
		};
		// Soft: each is laid on in a few passes, wide and faint to narrow.
		for (const [width, share] of [
			[9, 0.35],
			[5, 0.6],
			[2.5, 1]
		]) {
			c.lineWidth = width;
			c.strokeStyle = `rgba(90, 0, 45, ${0.034 * share})`;
			line(c, 0);
			c.strokeStyle = `rgba(255, 190, 220, ${0.028 * share})`;
			line(c, width);
			b.lineWidth = width * 1.3;
			b.strokeStyle = `rgba(0, 0, 0, ${0.055 * share})`;
			line(b, 0);
		}
	}

	// The left-hand fold lies over the right-hand one, shades it along the seam, and stands a
	// little proud of it; part way down the stitching has let go and it gapes.
	c.lineCap = b.lineCap = 'round';
	c.strokeStyle = 'rgba(70, 0, 35, 0.1)';
	c.lineWidth = 9;
	run(c, 4);
	c.stroke();
	c.strokeStyle = 'rgba(70, 0, 35, 0.15)';
	c.lineWidth = 4;
	run(c, 2);
	c.stroke();
	c.strokeStyle = 'rgba(255, 170, 210, 0.25)';
	c.lineWidth = 1.5;
	run(c, -1.5);
	c.stroke();
	c.strokeStyle = 'rgba(70, 0, 35, 0.3)';
	c.lineWidth = 1;
	run(c, 0);
	c.stroke();
	c.strokeStyle = 'rgba(60, 0, 30, 0.35)';
	c.lineWidth = 2.5;
	run(c, 0.5, apex * 0.3, apex * 0.47);
	c.stroke();
	b.strokeStyle = 'rgba(255, 255, 255, 0.2)';
	b.lineWidth = 12;
	run(b, -6);
	b.stroke();
	b.strokeStyle = 'rgba(0, 0, 0, 0.28)';
	b.lineWidth = 3;
	run(b, 1.5);
	b.stroke();

	// The lining, the cloth turned in round it, and the stitch that holds the folds where they part.
	const top = seamAt(apex);
	const diamond = (to: CanvasRenderingContext2D) => {
		to.beginPath();
		to.moveTo(top, apex);
		to.lineTo(mid + end - hem, shoulder + 1);
		to.lineTo(mid, H - hem * 1.4);
		to.lineTo(mid - end + hem, shoulder - 1);
		to.closePath();
	};
	diamond(c);
	c.fillStyle = '#131315';
	c.fill();
	c.save();
	diamond(c);
	c.clip();
	c.strokeStyle = 'rgba(255, 255, 255, 0.08)';
	c.lineWidth = 1;
	for (let k = -H; k < W; k += 5) {
		c.beginPath();
		c.moveTo(k, H);
		c.lineTo(k + H, 0);
		c.stroke();
	}
	// The folds stand over the lining, and shade the top of it.
	const shade = c.createLinearGradient(0, apex, 0, apex + end * 0.8);
	shade.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
	shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
	c.fillStyle = shade;
	c.fillRect(0, apex, W, end);
	c.restore();
	diamond(c);
	c.strokeStyle = 'rgba(255, 150, 200, 0.45)';
	c.lineWidth = 1.2;
	c.stroke();
	diamond(b);
	b.fillStyle = '#4a4a4a';
	b.fill();
	b.strokeStyle = 'rgba(255, 255, 255, 0.5)';
	b.lineWidth = 3;
	b.stroke();
	c.strokeStyle = '#131315';
	c.lineWidth = 3;
	c.beginPath();
	c.moveTo(top - end * 0.17, apex - 5);
	c.lineTo(top + end * 0.15, apex - 3);
	c.stroke();

	if (label !== undefined) {
		const w = 0.046 * S;
		const h = 0.02 * S;
		for (const to of [c, b]) {
			to.save();
			to.translate(seamAt(label * S) + 1, label * S);
			to.rotate(-0.05);
			to.fillStyle = to === c ? '#18181b' : '#a0a0a0';
			to.fillRect(-w / 2, -h / 2, w, h);
			if (to === c) {
				to.strokeStyle = 'rgba(225, 225, 235, 0.55)';
				to.lineWidth = 1;
				to.strokeRect(-w / 2 + 2.5, -h / 2 + 2.5, w - 5, h - 5);
				to.fillStyle = 'rgba(225, 225, 235, 0.7)';
				to.fillRect(-w * 0.28, -2.5, w * 0.56, 2);
				to.fillRect(-w * 0.18, 2, w * 0.36, 1.2);
			}
			to.restore();
		}
	}
	return cloth(picture.canvas, relief.canvas, false);
}

/**
 * The face of the cloth where it is bunched up in the knot, one repeat of it and the whole of its
 * width, with so many furrows (`gathers`) along it. Or, given `worn`, a length of the band that
 * goes round the neck, several repeats long: creased here and there, differently for each
 * `seed`, and with the seam down the back of it if that side of it is the one that shows.
 */
function bandCloth(width: number, gathers = 0, worn?: { seam: boolean; seed: number }) {
	const S = WEAVE_PX / WEAVE;
	const LONG = worn ? 8 : 1; // how many repeats of the weave the picture is long
	const picture = sheet(width * S, WEAVE_PX * LONG);
	const relief = sheet(width * S, WEAVE_PX * LONG);
	const W = picture.canvas.width;
	const H = WEAVE_PX * LONG;
	const c = picture.c;
	const b = relief.c;
	c.fillStyle = c.createPattern(twill(PINK), 'repeat')!;
	c.fillRect(0, 0, W, H);
	b.fillStyle = b.createPattern(twill(RELIEF), 'repeat')!;
	b.fillRect(0, 0, W, H);
	const stripe = (to: CanvasRenderingContext2D, x: number, w: number, colour: string) => {
		const fade = to.createLinearGradient(x - w, 0, x + w, 0);
		fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
		fade.addColorStop(0.5, colour);
		fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
		to.fillStyle = fade;
		to.fillRect(x - w, 0, 2 * w, H);
	};
	if (gathers) {
		// Its edges are folds, and turn away.
		stripe(c, 0, 4, 'rgba(80, 0, 40, 0.22)');
		stripe(c, W, 4, 'rgba(80, 0, 40, 0.22)');
		for (let i = 0; i < gathers; i++) {
			const x = W * ((i + 0.3 + 0.5 * chance(i + gathers)) / gathers);
			stripe(c, x, 7, 'rgba(80, 0, 40, 0.17)');
			stripe(c, x + 6, 6, 'rgba(255, 200, 225, 0.1)');
			stripe(b, x, 8, 'rgba(0, 0, 0, 0.35)');
		}
	}
	if (worn) {
		if (worn.seam) {
			// The two edges of the cloth meet a little off the middle, one lying over the other.
			const x = W * 0.46;
			c.fillStyle = c.createPattern(twill(PINK, true), 'repeat')!;
			c.fillRect(x, 0, W - x, H);
			b.fillStyle = b.createPattern(twill(RELIEF, true), 'repeat')!;
			b.fillRect(x, 0, W - x, H);
			stripe(c, x + 2.5, 4, 'rgba(70, 0, 35, 0.16)');
			c.fillStyle = 'rgba(70, 0, 35, 0.3)';
			c.fillRect(x - 0.6, 0, 1.2, H);
			stripe(b, x - 4, 6, 'rgba(255, 255, 255, 0.25)');
			stripe(b, x + 1.5, 2, 'rgba(0, 0, 0, 0.3)');
		}
		// Creases across it, each drawn again a picture's length up and down, so that the picture
		// meets itself end to end.
		for (let i = 0; i < 5; i++) {
			const y = H * chance(worn.seed + i);
			const x = W * (0.2 + 0.6 * chance(worn.seed + i + 0.31));
			const reach = 10 + 16 * chance(worn.seed + i + 0.57);
			const slope = (chance(worn.seed + i + 0.83) - 0.5) * 1.2;
			for (const at of [y - H, y, y + H]) {
				const line = (to: CanvasRenderingContext2D, drop: number) => {
					to.beginPath();
					to.moveTo(x - reach, at - reach * slope + drop);
					to.quadraticCurveTo(x, at + drop + 2, x + reach, at + reach * slope + drop);
					to.stroke();
				};
				for (const [width, share] of [
					[8, 0.4],
					[4, 0.7],
					[2, 1]
				]) {
					c.lineWidth = width;
					c.strokeStyle = `rgba(90, 0, 45, ${0.05 * share})`;
					line(c, 0);
					c.strokeStyle = `rgba(255, 190, 220, ${0.04 * share})`;
					line(c, width);
					b.lineWidth = width * 1.3;
					b.strokeStyle = `rgba(0, 0, 0, ${0.08 * share})`;
					line(b, 0);
				}
			}
		}
	}
	const made = cloth(picture.canvas, relief.canvas, true);
	// The strip it goes on counts along itself in repeats of the weave.
	for (const texture of [made.map, made.bumpMap]) texture?.repeat.set(1, 1 / LONG);
	return made;
}

/**
 * One step along a strip of cloth: its middle there; half its width; how far it is turned about
 * its own length from lying flat to the wall with its face to the room; and how far its face
 * stands out from flat, `u` of the way across it from the middle (-1 to 1).
 */
interface Row {
	at: Vector3;
	half: number;
	turn?: number;
	relief?: (u: number) => number;
}

/** How the cloth's picture is laid on a strip: cut from the middle of a sheet this size; or the
 * weave by its real size; or a band's own picture, as wide as the strip is. */
type Lay = { width: number; length: number } | 'weave' | 'band';

const OUT = new Vector3(0, 0, 1);

/** A strip of cloth through these rows, with a line of points across it at each of `us`. */
function strip(rows: Row[], us: number[], lay: Lay) {
	const position: number[] = [];
	const uv: number[] = [];
	const index: number[] = [];
	const COLS = us.length;
	let along = 0;
	const flat = new Vector3(1, 0, 0);
	rows.forEach((row, j) => {
		if (j) along += row.at.distanceTo(rows[j - 1].at);
		const run = (rows[j + 1] ?? row).at.clone().sub((rows[j - 1] ?? row).at).normalize();
		const level = OUT.clone().cross(run);
		if (level.lengthSq() > 0.01) flat.copy(level.normalize());
		const turn = row.turn ?? 0;
		const across = flat.clone().multiplyScalar(Math.cos(turn)).add(run.clone().cross(flat).multiplyScalar(Math.sin(turn)));
		const face = run.clone().cross(across).normalize();
		for (const u of us) {
			const reach = row.half * u;
			const lift = row.relief?.(u) ?? 0;
			position.push(
				row.at.x + across.x * reach + face.x * lift,
				row.at.y + across.y * reach + face.y * lift,
				row.at.z + across.z * reach + face.z * lift
			);
			if (lay === 'weave') uv.push(reach / WEAVE, along / WEAVE);
			else if (lay === 'band') uv.push(0.5 + u / 2, along / WEAVE);
			else uv.push(0.5 + reach / lay.width, 1 - along / lay.length);
		}
		if (!j) return;
		for (let i = 0; i < COLS - 1; i++) {
			const a = (j - 1) * COLS + i;
			const c = a + COLS;
			index.push(a, c, a + 1, a + 1, c, c + 1);
		}
	});
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
	geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
	geometry.setIndex(index);
	geometry.computeVertexNormals();
	return geometry;
}

/**
 * A slim tie taken off over the head and hung up still knotted, its back to the room, and not
 * with any care: the loop that went round the neck, sagging over the peg; the back of the knot,
 * a four-in-hand, where the wide end is wrapped behind the narrow one and brought up over the
 * loop; the narrow blade hanging in front, not through the keeper, and turned part way round; and
 * behind it the back of the wide blade, with its seam, its label and its black lining. Its origin
 * is where the hook is, and it hangs against the wall. Now and then a breath of air from the door
 * stirs it.
 */
export function tie() {
	const g = new Group();
	const lining = new MeshStandardMaterial({ color: 0x151517, roughness: 0.5, side: DoubleSide });

	// The wall is this far behind the origin, and the cloth is about this thick where it is folded.
	const THICK = 0.005;
	// The top of the peg, where the loop lies on it.
	const TOP = -0.017;
	const LOOP = 0.25;
	// Hung up in a hurry: the knot is off to one side of the hook and tipped over.
	const OFF = 0.045;
	const TILT = -0.411;
	const KNOT = 0.1;
	const knotY = TOP - LOOP - KNOT / 2;
	const fromKnot = (x: number, y: number, z = 0) =>
		new Vector3(x, y, z).applyAxisAngle(OUT, TILT).add(new Vector3(OFF, knotY, 0));
	/** Put a part of the knot, made about the knot's middle, where the knot is. */
	const knotted = (part: BufferGeometry) => part.scale(1.02, 1.02, 1).rotateZ(TILT).translate(OFF, knotY, 0);

	// The loop: a band over the peg, lying on it there and turning to face out on the way down
	// each side. Its two sides are not alike: the left is pulled taut and hangs nearly straight;
	// the right is slack, bows out, has a kink in it, and stays half turned, its seam showing.
	const BAND = 0.022;
	// Its two ends go well down into the knot, close together and gathered narrow, so that neither
	// shows past the knot from any side.
	const entry = { [-1]: fromKnot(-0.037, 0.0, -0.002), [1]: fromKnot(-0.02, 0.007, -0.007) };
	const band: Row[] = [];
	const STEPS = 60;
	for (let j = 0; j <= STEPS; j++) {
		const k = (j / STEPS) * 2 - 1;
		const side = k < 0 ? -1 : 1;
		const d = Math.abs(k) ** 1.6;
		const to = entry[side];
		const full = side > 0 ? 0.105 * (1 - d) ** 1.05 : 0.05 * (1 - d) ** 2.6;
		const turn =
			(1 - ease(clamp(d / 0.24))) * (Math.PI / 2) +
			(side > 0 ? 0.34 * Math.sin(Math.PI * d ** 0.8) ** 2 + 0.1 * Math.sin(11 * d) * clamp(d / 0.3) : -0.25 * Math.exp(-(((d - 0.5) / 0.2) ** 2)));
		const half = BAND - 0.004 * Math.exp(-d / 0.05) - 0.014 * ease(clamp((d - 0.8) / 0.2));
		band.push({
			at: new Vector3(
				side * full * Math.sqrt(d) + to.x * ease(d) + 0.004 * Math.sin(9 * d + side) + (side > 0 ? 0.007 * Math.exp(-(((d - 0.55) / 0.09) ** 2)) : 0),
				TOP + 0.001 + (to.y - TOP) * d,
				0.008 * (1 - ease(clamp(d / 0.3))) - 0.004 * Math.sin(Math.PI * d) + to.z * d + half * Math.abs(Math.sin(turn)) * clamp(d / 0.3)
			),
			half,
			turn,
			relief: (u) => 0.05 * half * (1 - u * u) + 0.0015 * Math.sin(3 * u + 12 * d) - 0.0015 * Math.abs(u) ** 4
		});
	}
	const loop = strip(band, [-1, -0.8, -0.3, 0.3, 0.8, 1], 'band');
	// Its two sides are of different cloth (below): the left, then the right.
	const side = loop.index!.count / 2;
	loop.addGroup(0, side, 0);
	loop.addGroup(side, side, 1);

	// The knot, a four-in-hand from behind. Inside it, the narrow end, and what is wrapped round
	// it: a soft lump, wider at the top than the bottom and not quite even.
	const core = new SphereGeometry(1, 14, 10);
	{
		const at = core.attributes.position;
		const uv: number[] = [];
		for (let i = 0; i < at.count; i++) {
			const [x, y, z] = [at.getX(i), at.getY(i), at.getZ(i)];
			const wide = (0.033 + 0.009 * y) * (1 + 0.07 * Math.sin(5 * y + 1));
			at.setXYZ(i, x * wide + 0.003 * y, y * 0.044, z * 0.012 - 0.004);
			uv.push(at.getX(i) / WEAVE, at.getY(i) / WEAVE);
		}
		core.setAttribute('uv', new Float32BufferAttribute(uv, 2));
		core.computeVertexNormals();
	}
	const pleats = (half: number, deep: number, phase: number) => (u: number) =>
		0.05 * half * (1 - u * u) + deep * Math.cos(2.5 * Math.PI * u + phase) * (1 - u * u) - 0.2 * half * Math.abs(u) ** 6;
	const ACROSS = [-1, -0.85, -0.6, -0.35, -0.1, 0.15, 0.4, 0.65, 0.85, 1];
	// Across it, the wide end where it goes behind the narrow one: a plump band, off level,
	// gathered tighter at one side than the other, going out of sight round both.
	const wrapRows: Row[] = [];
	for (let j = 0; j <= 16; j++) {
		const k = (j / 16) * 2 - 1;
		const x = 0.037 * k;
		const half = 0.023 - 0.003 * k + 0.001 * Math.sin(k * 7);
		wrapRows.push({
			at: new Vector3(x, -0.014 + 0.22 * x + 0.002 * Math.sin(k * 4), 0.012 - 0.028 * Math.abs(k) ** 4),
			half,
			relief: pleats(half, 0.0022, 1 + k)
		});
	}
	const wrap = strip(wrapRows, ACROSS, 'band');
	// Over that, the wide end again, on its last pass: it comes round the lower corner of the knot,
	// goes up across the back of it, bunched, and over the loop into the front.
	const sling = new CatmullRomCurve3([
		new Vector3(-0.039, -0.016, -0.014),
		new Vector3(-0.031, -0.005, 0.006),
		new Vector3(-0.018, 0.009, 0.014),
		new Vector3(-0.006, 0.023, 0.015),
		new Vector3(0.001, 0.036, 0.01),
		new Vector3(0.002, 0.044, -0.008)
	]);
	const tuckRows: Row[] = [];
	for (let j = 0; j <= 16; j++) {
		const k = j / 16;
		const half = 0.019 - 0.005 * ease(k);
		tuckRows.push({ at: sling.getPoint(k), half, relief: pleats(half, 0.0018 * Math.sin(Math.PI * k), 0.4 + 2 * k) });
	}
	const tuck = strip(tuckRows, ACROSS, 'band');
	for (const part of [core, wrap, tuck]) knotted(part);

	/** How a blade hangs, this far down it: how far aside and out from the wall, and how far turned. */
	type Hang = (y: number) => { x: number; z: number; turn: number };
	/** What is particular to a blade's cloth: how deep it is gathered at the knot, how hollow it
	 * is across, and how far the fold along its seam has lifted, this far down. */
	interface Drape {
		gather: number;
		cup: number;
		phase: number;
		open: (y: number) => number;
		/** And whatever else has happened to it: how far it stands out, there. */
		bent: (u: number, y: number) => number;
	}
	const EDGES = [-1, -0.9, -0.72, -0.4, -0.1, 0.04, 0.09, 0.4, 0.72, 0.9, 1];
	// A blade, its back out: nearly straight sided, ending in a point, its edges rolled under. It
	// starts at `from`, hidden in the knot, where it is gathered narrow.
	const blade = (shape: Blade, from: Vector3, hang: Hang, drape: Drape) => {
		const rows: Row[] = [];
		const row = (y: number, half: number, flatten = 0) => {
			const { x, z, turn } = hang(y);
			rows.push({
				at: new Vector3(from.x + x, from.y - y, z),
				half,
				turn,
				relief: (u) => {
					const roll = -THICK * ease(clamp((Math.abs(u) - 0.7) / 0.3));
					const cup = drape.cup * half * (1 - u * u);
					const gather = drape.gather * Math.exp(-y / 0.07) * Math.cos(2.4 * Math.PI * u + drape.phase);
					const fold = 0.0007 * Math.sin(2.3 * u + 6 * y + drape.phase) * clamp(y / 0.08);
					const flap = u < 0.06 ? drape.open(y) * Math.exp(-(((u - 0.04) / 0.45) ** 2)) : 0;
					return roll + (cup + gather + fold + flap) * (1 - flatten) + drape.bent(u, y);
				}
			});
		};
		const STRAIGHT = 34;
		const shoulder = shape.length - shape.halfEnd;
		for (let j = 0; j <= STRAIGHT; j++) {
			const k = j / STRAIGHT;
			const y = shoulder * (0.4 * k + 0.6 * k * k);
			const half = shape.halfTop + (shape.halfEnd - shape.halfTop) * (y / shoulder) ** 1.25;
			row(y, half * (1 - 0.28 * Math.exp(-y / 0.045)), clamp((y / shoulder - 0.85) / 0.15));
		}
		for (let j = 1; j <= 4; j++) row(shoulder + (shape.halfEnd * j) / 4, shape.halfEnd * (1 - j / 4), 1);
		return strip(rows, EDGES, { width: 2 * shape.halfEnd, length: shape.length });
	};
	// Both leave the knot the way it is tipped, and are soon hanging by their own weight, apart:
	// the narrow one has not been put through the keeper. Neither hangs dead straight.
	const leaving = (y: number, far: number) => far * (1 - Math.exp(-y / 0.1));
	const bump = (y: number, at: number, wide: number) => Math.exp(-(((y - at) / wide) ** 2));
	// The wide blade, against the wall, from the bottom of the knot: a buckle where it was folded
	// over a hanger once, a slow twist, and its point curling off the wall, one corner first.
	const WIDE: Blade = { halfTop: 0.031, halfEnd: 0.06, length: 0.82 };
	const wideSeam = (y: number) => 0.003 * Math.sin(9 * y + 1) + 0.0015 * Math.sin(23 * y) - 0.002;
	const wideHang: Hang = (y) => {
		const turn = 0.08 * Math.sin(4.2 * y + 0.4) * clamp(y / 0.1) - 0.07 * bump(y, 0.33, 0.09) - 0.14 * ease(clamp((y - 0.55) / 0.27));
		const half = WIDE.halfTop + (WIDE.halfEnd - WIDE.halfTop) * clamp(y / WIDE.length);
		return {
			x: leaving(y, 0.022) + 0.045 * y + 0.004 * Math.sin(7 * y + 1) + 0.003 * bump(y, 0.36, 0.09),
			z:
				-0.022 +
				0.008 * Math.exp(-y / 0.03) +
				0.002 * Math.sin(10 * y) * clamp(y / 0.1) +
				0.003 * bump(y, 0.33, 0.08) +
				0.008 * ease(clamp((y - 0.6) / 0.22)) ** 2 +
				half * Math.abs(Math.sin(turn)),
			turn
		};
	};
	const wideFrom = fromKnot(-0.002, -KNOT / 2 + 0.02);
	const wide = blade(WIDE, wideFrom, wideHang, {
		gather: 0.003,
		cup: 0.05,
		phase: 0.5,
		open: () => 0.001,
		// A soft fold along it, off the middle, and one edge lifting toward the point.
		bent: (u, y) =>
			-0.001 * bump(y, 0.5, 0.14) * Math.exp(-(((u - 0.45) / 0.22) ** 2)) +
			0.005 * ease(clamp((-u - 0.3) / 0.7)) * bump(y, 0.7, 0.09)
	});
	// The narrow one in front of it, from under the wrap. It kicks out to the left, and lower
	// down it has turned part way round, one edge out from the wall, and not quite come back.
	const NARROW: Blade = { halfTop: 0.021, halfEnd: 0.034, length: 0.66 };
	const narrowSeam = (y: number) => 0.002 * Math.sin(11 * y + 2) + 0.001 * Math.sin(29 * y);
	const narrowHang: Hang = (y) => {
		const turn = 0.4 * bump(y, 0.27, 0.11) + 0.15 * ease(clamp((y - 0.36) / 0.2)) + 0.03 * Math.sin(14 * y);
		const half = NARROW.halfTop + (NARROW.halfEnd - NARROW.halfTop) * clamp(y / NARROW.length);
		return {
			x: leaving(y, 0.006) - 0.03 * (1 - Math.exp(-y / 0.16)) - 0.012 * y + 0.006 * Math.sin(9 * y),
			z: 0.004 + 0.007 * clamp(y / 0.06) + half * Math.abs(Math.sin(turn)) + 0.003 * bump(y, 0.5, 0.1),
			turn
		};
	};
	const narrow = blade(NARROW, fromKnot(0.003, -0.018), narrowHang, {
		gather: 0.003,
		cup: 0.09,
		phase: 2,
		open: () => 0.001,
		// Its point curls up off the wall.
		bent: (u, y) => 0.006 * ease(clamp((y - 0.52) / 0.14)) * (0.5 + 0.5 * u)
	});

	// The keeper: a black band sewn across the back of the wide blade, for the narrow one to be
	// put through. It is empty, and sags.
	const KEEPER = { down: 0.43, reach: 0.031, half: 0.011 };
	const keeperRows: Row[] = [];
	for (let j = 0; j <= 8; j++) {
		const k = (j / 8) * 2 - 1;
		const y = KEEPER.down + 0.004 * (1 - k * k);
		const hung = wideHang(y);
		const x = wideSeam(y) + KEEPER.reach * k;
		keeperRows.push({
			at: new Vector3(
				wideFrom.x + hung.x + x * Math.cos(hung.turn),
				wideFrom.y - y,
				hung.z + x * Math.sin(hung.turn) + 0.011 - 0.012 * k ** 4
			),
			half: KEEPER.half
		});
	}
	const keeper = strip(keeperRows, [-1, 0, 1], 'weave');

	// Each part, with how long after the air moves it follows, and how far it goes along with it.
	const parts = [
		{ geometry: loop, lag: 0, give: 1 },
		{ geometry: core, lag: 0, give: 1 },
		{ geometry: wrap, lag: 0, give: 1 },
		{ geometry: tuck, lag: 0, give: 1 },
		{ geometry: wide, lag: 0, give: 1 },
		{ geometry: narrow, lag: 0.25, give: 1.3 },
		{ geometry: keeper, lag: 0, give: 1 }
	].map((part) => ({ ...part, still: Float32Array.from(part.geometry.attributes.position.array) }));
	// Most of the tie, and what shows most of the air in it.
	const wideBlade = mesh(wide, bladeBack(WIDE, wideSeam, 3, KEEPER.down + 0.045));
	const gathered = bandCloth(0.06, 3);
	g.add(
		mesh(loop, [bandCloth(2 * BAND, 0, { seam: false, seed: 7 }), bandCloth(2 * BAND, 0, { seam: true, seed: 23 })]),
		mesh(core, gathered),
		mesh(wrap, gathered),
		mesh(tuck, gathered),
		wideBlade,
		mesh(narrow, bladeBack(NARROW, narrowSeam, 41)),
		mesh(keeper, lining)
	);

	// The air from the door (which is to the right) is never quite still: it comes and goes
	// slowly, on no beat, and the tie swings in it a little, away from the door, and lifts off the
	// wall. The loop and the knot hardly move: the blades hang from the knot, stiff where they
	// leave it and freer the further down, with a ripple running down them. The narrow blade,
	// which is in front and lighter, has more of its own way lower down, a little behind the rest
	// and a little further, so that none comes through another.
	const HANG = LOOP + 0.92; // about how far the tip is below the hook
	const FROM = knotY - KNOT / 2; // where the blades come out of the knot
	const LIFT = 0.025;
	const air = (t: number) =>
		Math.max(0.12, 0.5 + 0.28 * Math.sin(0.41 * t) + 0.17 * Math.sin(0.97 * t + 1.1) + 0.1 * Math.sin(2.3 * t + 2.7));
	const swing = (t: number) => 0.045 * (0.65 + 0.25 * Math.sin(3.4 * t) + 0.12 * Math.sin(5.3 * t + 1));
	const pose = (t: number, strength: number) => {
		const all = air(t) * strength;
		for (const { geometry, still, lag, give } of parts) {
			const at = geometry.attributes.position;
			const own = air(t - lag) * strength * give;
			const aside = [all * swing(t), own * swing(t - lag)];
			const out = [all * LIFT, Math.max(all, own) * LIFT * give];
			for (let i = 0; i < at.count; i++) {
				const y = still[i * 3 + 1];
				const d = clamp(-y / HANG);
				const k = clamp((FROM - y) / (HANG + FROM));
				const w = 0.04 * d + 0.96 * k ** 2.2;
				const free = ease(clamp(k / 0.3)); // how far it has its own way, there
				const ripple = all * 0.006 * Math.sin(8 * (t - lag * free) - 9 * d);
				at.setXYZ(
					i,
					still[i * 3] - w * (aside[0] + (aside[1] - aside[0]) * free + ripple),
					y,
					still[i * 3 + 2] + w * (out[0] + (out[1] - out[0]) * free)
				);
			}
			at.needsUpdate = true;
			geometry.computeVertexNormals();
			// What a pointer is over is found by these.
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
		}
	};

	// It keeps its own time, and asks to be drawn every frame that it is in view: the scene only
	// draws when something has changed, and this never stops changing.
	let t = 40 * Math.random();
	let then = 0;
	let frame = 0;
	g.userData.works = {
		start(redraw) {
			// TEMPORARY, for looking at it: ?gust=2.5 holds it as it is at that moment.
			const frozen = new URLSearchParams(location.search).get('gust');
			if (frozen) {
				t = Number(frozen);
				pose(t, 1);
				redraw();
				return;
			}
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			then = 0;
			const blow = () => {
				frame = requestAnimationFrame(blow);
				redraw(wideBlade);
			};
			frame = requestAnimationFrame(blow);
		},
		stop() {
			cancelAnimationFrame(frame);
			frame = 0;
			pose(t, 0);
		},
		dim() {},
		tick() {
			if (!frame) return false;
			const now = performance.now();
			const dt = Math.min((now - (then || now)) / 1000, 0.25);
			then = now;
			t += dt;
			pose(t, 1);
			return false;
		}
	} satisfies Works;
	return g;
}
