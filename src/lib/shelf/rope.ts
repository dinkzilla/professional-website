// The climbing rope that hangs from the coat rack (see coatrack.ts, and room.ts, which hangs it):
// a single dynamic rope in a butterfly coil, which is how a climber carries and stores one. The
// rope is laid back and forth in laps, the laps are folded in half over their middle, and the last
// few feet are wound round all of them just below the fold; the peg goes through the eye that is
// left above the winding. So, from the top: a heap of strands lying over the peg and slid down it
// against the tube, the two halves coming down either side of the peg and closing together, the
// turns of the winding, and under them the long loops, hanging to different lengths, with the
// rope's two ends among them.
//
// It is one rope from end to end. Its middle line is laid out by rule, then let settle: wherever
// two lengths of it would pass through one another, or through the rack, they are pushed apart.
// The rope is drawn a little thicker than life so that its sheath can be seen from across the
// room, and has fewer laps than sixty metres would make, so that the coil is still a real coil's
// size. It is all made here, as one mesh, with its two bound ends as a second.

import {
	BufferGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CylinderGeometry,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshStandardMaterial,
	Quaternion,
	RepeatWrapping,
	SRGBColorSpace,
	Vector3
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COAT_RACK, type Peg } from './coatrack.ts';
import { air, blown } from './tie.ts';

const R = 0.012; // the rope's radius
const GAP = 2 * R * 1.03; // between the middles of two strands lying together
const LAPS = 12; // how many times the rope goes over the peg
const HEAD = 0.112; // from the peg down to the winding
const DROP = 0.75; // from the peg down to the lowest loop
const STEP = 0.0075; // between the points the rope is made through
const SIDES = 8; // round the rope
const TILE = 0.085; // the length of rope one tile of the sheath's pattern covers
const TURN = Math.PI * 2;
const UP = new Vector3(0, 1, 0);

// The sheath: purple, with a yellow tracer wound one way round it and a thin dark one the other.
const PURPLE = [118, 52, 176];
const YELLOW = [240, 204, 52];
const INK = [36, 14, 60];

/** The same numbers every time, so that the coil is the same coil. */
function dice(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * The sheath's weave, as one tile that goes once round the rope: yarns running both ways round
 * it, each showing as a short slanted tick where it lies over the one it crosses. Either its
 * colours, or its relief: light where a yarn stands proud, dark in the gaps between them.
 */
function sheath(relief: boolean) {
	const CELLS = 16;
	const PX = 8;
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = CELLS * PX;
	const c = canvas.getContext('2d')!;
	const random = dice(5);
	// Each yarn is a little off its fellows in shade, as dyed yarn is.
	const shade = Array.from({ length: 2 * CELLS }, () => 0.88 + random() * 0.2);
	c.fillStyle = relief ? '#000' : 'rgb(54,22,84)';
	c.fillRect(0, 0, canvas.width, canvas.height);
	for (let i = -1; i <= CELLS; i++) {
		for (let j = -1; j <= CELLS; j++) {
			const rising = (((i + j) % 2) + 2) % 2 === 0;
			const yarn = ((((rising ? i - j : i + j) % CELLS) + CELLS) % CELLS) >> 1;
			const [red, green, blue] = rising ? (yarn < 2 ? YELLOW : PURPLE) : yarn === 4 ? INK : PURPLE;
			const k = shade[yarn + (rising ? 0 : CELLS)];
			const [x, y] = [(i + 0.5) * PX, (j + 0.5) * PX];
			if (relief) {
				const glow = c.createRadialGradient(x, y, 0, x, y, PX * 0.75);
				glow.addColorStop(0, '#fff');
				glow.addColorStop(1, '#555');
				c.fillStyle = glow;
			} else {
				c.fillStyle = `rgb(${Math.min(255, red * k)},${Math.min(255, green * k)},${Math.min(255, blue * k)})`;
			}
			c.beginPath();
			c.ellipse(x, y, PX * 0.74, PX * 0.4, rising ? 0.95 : -0.95, 0, TURN);
			c.fill();
		}
	}
	const map = new CanvasTexture(canvas);
	if (!relief) map.colorSpace = SRGBColorSpace;
	map.wrapS = map.wrapT = RepeatWrapping;
	map.anisotropy = 8;
	return map;
}

/**
 * The line a cord takes when it is wound tight round a bundle of strands: round the outside of
 * them all, this far off their middles. The strands' middles are given as seen from above. Gives
 * back a way to ask where the cord is any part of the way round, and all the points of its line.
 */
function girdle(strands: [number, number][], off: number) {
	// The strands on the outside of the bundle, in order round it.
	const sorted = [...strands].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	const turns = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
	const half = (points: [number, number][]) => {
		const kept: [number, number][] = [];
		for (const p of points) {
			while (kept.length >= 2 && turns(kept[kept.length - 2], kept[kept.length - 1], p) <= 0) kept.pop();
			kept.push(p);
		}
		kept.pop();
		return kept;
	};
	const outer = [...half(sorted), ...half(sorted.reverse())];
	// Straight from one to the next, and round each of them on the way.
	const line: [number, number][] = [];
	outer.forEach((p, k) => {
		const before = outer[(k + outer.length - 1) % outer.length];
		const after = outer[(k + 1) % outer.length];
		const from = Math.atan2(p[1] - before[1], p[0] - before[0]) - Math.PI / 2;
		let to = Math.atan2(after[1] - p[1], after[0] - p[0]) - Math.PI / 2;
		while (to < from) to += TURN;
		const steps = Math.max(1, Math.ceil((to - from) / 0.3));
		for (let n = 0; n <= steps; n++) {
			const a = from + ((to - from) * n) / steps;
			line.push([p[0] + off * Math.cos(a), p[1] + off * Math.sin(a)]);
		}
	});
	const lengths = [0];
	line.forEach((p, k) => {
		const q = line[(k + 1) % line.length];
		lengths.push(lengths[k] + Math.hypot(q[0] - p[0], q[1] - p[1]));
	});
	const round = lengths[line.length];
	/** Where it is this much of the way round: 1 is once round, and it goes on round after that. */
	const at = (part: number): [number, number] => {
		const far = (part - Math.floor(part)) * round;
		let k = 0;
		while (k < line.length - 1 && lengths[k + 1] < far) k++;
		const p = line[k];
		const q = line[(k + 1) % line.length];
		const f = (far - lengths[k]) / Math.max(1e-9, lengths[k + 1] - lengths[k]);
		return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
	};
	/** How far round it is where it is nearest to, or furthest toward, something: whichever scores highest. */
	const where = (score: (p: [number, number]) => number) => {
		let best = 0;
		for (let k = 1; k < line.length; k++) if (score(line[k]) > score(line[best])) best = k;
		return lengths[best] / round;
	};
	return { at, where, line, round };
}

/**
 * Build the rope hung on this peg of the rack, in the rack's own frame: the origin on the floor
 * under the tube's middle, y up.
 */
export function buildRope(peg: Peg) {
	const random = dice(23);
	const between = (from: number, to: number) => from + (to - from) * random();

	// --- The peg, and the ways things are measured from it. `out` is level, away from the tube;
	// `side` is level and square to that; `along` is the way the peg itself runs, tilted up, and
	// `off` is square to the peg, up and back toward the tube.
	const pole = COAT_RACK.pole;
	const [cos, sin] = [Math.cos(peg.rise), Math.sin(peg.rise)];
	const out = peg.out;
	const side = new Vector3().crossVectors(UP, out);
	const along = out.clone().multiplyScalar(cos).addScaledVector(UP, sin);
	const off = out.clone().multiplyScalar(-sin).addScaledVector(UP, cos);
	// Where the peg's middle line leaves the tube's.
	const root = peg.rest
		.clone()
		.addScaledVector(UP, -peg.r / cos)
		.addScaledVector(along, -(peg.fromPole + pole) / cos);
	const tip = root.clone().addScaledVector(along, COAT_RACK.long);

	// --- The heap on the peg. Each lap of the rope lies over the peg, and they slide down it and
	// pile up against the tube: the first on the peg and against the tube, each one after it in the
	// lowest place left, on the peg or in the hollow between two already there. Seen from the side,
	// so each is a round: how far along the peg, and how far off its middle line.
	const heap: { u: number; v: number }[] = [];
	for (let lap = 0; lap < LAPS; lap++) {
		let best: { u: number; v: number; y: number } | undefined;
		for (let u = 0.02; u < COAT_RACK.long - 0.025; u += 0.0004) {
			let v = peg.r + R + 0.0004;
			for (const p of heap) {
				const du = u - p.u;
				if (Math.abs(du) < GAP) v = Math.max(v, p.v + Math.sqrt(GAP * GAP - du * du));
			}
			if (u * cos - v * sin < pole + R + 0.001) continue; // in the tube
			const y = u * sin + v * cos;
			if (!best || y < best.y - 1e-7) best = { u, v, y };
		}
		heap.push(best!);
	}

	// --- The bundle under the peg. Each lap comes down both sides of the peg, so the bundle is the
	// heap twice over, once each side, the two closed together under the peg; and the strands keep
	// the places in it that they have in the heap. As seen from above: across the peg, and along it.
	const us = heap.map((p) => p.u);
	const middle = (Math.min(...us) + Math.max(...us)) / 2;
	const place = (lap: number, way: number): [number, number] => [way * (heap[lap].v - peg.r + 0.0005), heap[lap].u - middle];
	const all: [number, number][] = [];
	for (let lap = 0; lap < LAPS; lap++) all.push(place(lap, 1), place(lap, -1));
	// The rope's last few inches are drawn up under the winding to lock it off, so there they lie
	// against the bundle like one strand more, on the `side` side, and the winding goes round them too.
	const bare = girdle(all, GAP);
	const tuck = bare.at(bare.where(([x, y]) => x + 0.35 * y));
	const wound = girdle([...all, tuck], GAP);
	// The winding lies against the tube, which holds the whole coil a little out from where it
	// would hang: so far out is the bundle's middle, and the loops', which reach further.
	const REACH = 0.096; // as far as a loop reaches either way from the coil's middle
	const bundleOut = pole + R + 0.0015 - Math.min(...wound.line.map((p) => p[1]));
	const loopsOut = Math.max(bundleOut, pole + R + 0.002 + REACH);
	/** A point given across the peg, along it from the coil's middle, and up; the middle this far out. */
	const point = (across: number, far: number, y: number, middleOut = bundleOut) =>
		out
			.clone()
			.multiplyScalar(middleOut + far)
			.addScaledVector(side, across)
			.setY(y);

	const PITCH = GAP * 1.03; // from one turn of the winding to the next, at the least
	const TILT = 0.07; // the winding is not quite level
	const tilt = (x: number, z: number) => TILT * (x * Math.cos(0.9) + z * Math.sin(0.9));
	const tilts = Math.max(...wound.line.map(([x, z]) => Math.abs(tilt(x, z))));
	const windingTop = peg.rest.y - HEAD;
	// The last lap comes down the side that `side` points to, and from there is wound round the
	// bundle, ending just short of where its end is drawn up under the turns.
	const tucked = wound.where(([x, y]) => -Math.hypot(x - tuck[0], y - tuck[1]));
	let starts = wound.where(([x, y]) => -Math.hypot(x - place(LAPS - 1, 1)[0], y - place(LAPS - 1, 1)[1]));
	const apart = ((((starts - tucked) % 1) + 1.5) % 1) - 0.5;
	if (Math.abs(apart) < 0.12) starts += (apart < 0 ? -0.12 : 0.12) - apart; // not down on top of that
	let TURNS = 3 + ((((tucked - 0.12 - starts) % 1) + 1) % 1);
	if (TURNS < 3.45) TURNS += 1;
	/** How far down the winding has got after so many turns: they are not evenly spaced. */
	const sunk = (t: number) => PITCH * (1.08 * t + 0.06 * Math.sin(2.3 * t + 1));
	const windingFoot = windingTop - sunk(TURNS) - tilts;
	const bundleFoot = windingFoot - R - 0.012; // where the strands come out from under it
	const lowest = peg.rest.y - DROP;

	// --- The rope's line, as points for it to pass through, from one end to the other. Those that
	// are `held` are where the rope is pulled tight on something, and stay where they are put.
	const line: Vector3[] = [];
	const held: boolean[] = [];
	const through = (p: Vector3, fast = false) => {
		line.push(p);
		held.push(fast);
	};

	/** A lap's way over the peg: half round it, from one side to the other. */
	const over = (lap: number, from: number) => {
		const { u, v } = heap[lap];
		const centre = root.clone().addScaledVector(along, u);
		for (let n = 0; n <= 6; n++) {
			const a = (n * Math.PI) / 6;
			through(centre.clone().addScaledVector(side, from * v * Math.cos(a)).addScaledVector(off, v * Math.sin(a)), true);
		}
	};
	/** A lap's strand on one side, from just under the peg down through the winding. Given from the top down. */
	const strand = (lap: number, way: number): [Vector3, boolean][] => {
		const { u, v } = heap[lap];
		const [across, far] = place(lap, way);
		return [
			[root.clone().addScaledVector(along, u).addScaledVector(side, way * v).addScaledVector(off, -0.03), false],
			[point(across, far, windingTop + 0.016), true],
			[point(across, far, (windingTop + bundleFoot) / 2), true],
			[point(across, far, bundleFoot), true]
		];
	};
	const down = (lap: number, way: number) => strand(lap, way).forEach(([p, fast]) => through(p, fast));
	const up = (lap: number, way: number) =>
		strand(lap, way)
			.reverse()
			.forEach(([p, fast]) => through(p, fast));

	// The loops. A lap that comes down one side turns at the bottom and goes back up the same side
	// as the next lap, so the laps make loops by twos, turn about on either side. Each side's loops
	// hang in sheets one outside another, as the laps lay on the hand, two loops to a sheet: a
	// wide one, and a narrower and shorter one inside it. No two are the same length.
	type Loop = { sheet: number; middle: number; wide: number; foot: number; lean: number };
	const loops = new Map<number, Loop>(); // by the lap that comes down into it
	for (const way of [1, -1]) {
		const first = way === 1 ? 1 : 0; // the first lap goes up the `side` side and comes down the other
		const laps: number[] = [];
		for (let lap = first; lap + 1 < LAPS; lap += 2) laps.push(lap);
		const depth = (lap: number) => Math.abs(place(lap, way)[0]) + Math.abs(place(lap + 1, way)[0]);
		laps.sort((a, b) => depth(a) - depth(b));
		const yaw = between(-0.1, 0.1);
		// How far short of the lowest each sheet's wide loop hangs, and how far off the coil's middle,
		// toward the tube or away: the two that hang lowest are off to opposite sides of one another.
		const short = way === 1 ? [0, 0.075, 0.12] : [0.012, 0.05, 0.1];
		const aside = way === 1 ? [0.02, -0.022, 0.004] : [-0.02, 0.023, -0.006];
		for (let k = 0; k < laps.length; k += 2) {
			const sheet = way * (0.0135 + (k / 2) * 0.0265);
			const middle = aside[k / 2] + between(-0.003, 0.003);
			const wide = between(0.058, 0.07);
			const foot = lowest + short[k / 2] + between(0, 0.012);
			loops.set(laps[k], { sheet, middle, wide, foot, lean: yaw });
			if (k + 1 < laps.length) {
				const narrow = wide - between(0.029, 0.036);
				loops.set(laps[k + 1], { sheet, middle: middle + between(-0.003, 0.003), wide: narrow, foot: foot + wide - narrow + between(0.025, 0.07), lean: yaw });
			}
		}
	}
	/** The loop a lap comes down into on this side, from under the winding, round its foot and back up to it. */
	const loop = (lap: number, way: number) => {
		const { sheet, middle: mid, wide, foot, lean } = loops.get(lap)!;
		const from = place(lap, way);
		const to = place(lap + 1, way);
		const q = from[1] <= to[1] ? -1 : 1; // which end of the loop the strand coming down takes
		const turn = foot + wide; // the height the loop's round foot is struck from
		const leg = (start: [number, number], end: number, t: number) => {
			const e = Math.pow(t, 1.15);
			const y = bundleFoot + (turn - bundleFoot) * t;
			const across = start[0] + (sheet + lean * end * wide - start[0]) * e;
			return point(across, start[1] + (mid + end * wide - start[1]) * e, y, bundleOut + (loopsOut - bundleOut) * t);
		};
		const parts = [0.16, 0.4, 0.7, 1];
		for (const t of parts) through(leg(from, q, t));
		for (let n = 1; n < 6; n++) {
			const a = (n * Math.PI) / 6;
			through(point(sheet + lean * q * wide * Math.cos(a), mid + q * wide * Math.cos(a), turn - wide * Math.sin(a), loopsOut));
		}
		for (const t of [...parts].reverse()) through(leg(to, -q, t));
	};

	// One end hangs among the loops, a little short of their feet, under where the first lap goes up.
	{
		const [across, far] = place(0, 1);
		const end = lowest + between(0.1, 0.14);
		for (const t of [1, 0.75, 0.5, 0.25]) {
			through(point(across + 0.004 * t, far * (1 - 0.15 * t), bundleFoot + (end - bundleFoot) * t, bundleOut + (loopsOut - bundleOut) * t * 0.6));
		}
	}
	// Then the laps: up one side, over the peg, down the other, round a loop, and so on.
	for (let lap = 0; lap < LAPS; lap++) {
		const way = lap % 2 === 0 ? 1 : -1; // the side it goes up
		up(lap, way);
		over(lap, way);
		if (lap < LAPS - 1) {
			down(lap, -way);
			loop(lap, -way);
		}
	}
	// The last lap comes down outside the rest to the top of the winding and goes round and round
	// the bundle, each turn under the one before.
	{
		const { u, v } = heap[LAPS - 1];
		const girt = (part: number, y: number, more = 0) => {
			const [x, z] = wound.at(part);
			const k = 1 + more / Math.hypot(x, z);
			return point(x * k, z * k, y);
		};
		const turnAt = (t: number) => {
			const [x, z] = wound.at(starts + t);
			return windingTop - sunk(t) + tilt(x, z);
		};
		through(root.clone().addScaledVector(along, u).addScaledVector(side, v + 0.005).addScaledVector(off, -0.03));
		through(girt(starts - 0.05, turnAt(0) + 0.05));
		through(girt(starts - 0.013, turnAt(0) + 0.017));
		for (let t = 0; t <= TURNS; t += 1 / 36) through(girt(starts + t, turnAt(t)), t > 0.08 && t < TURNS - 0.03);
		// Then the end is locked off. It dips below the last turn, comes up under all the turns
		// against the bundle, out at the top, and is bent over to hang down outside them.
		const last = turnAt(TURNS);
		const top = windingTop + tilt(...wound.at(tucked));
		const reach = Math.hypot(tuck[0], tuck[1]);
		const drawn = (y: number, more = 0) => point(tuck[0] * (1 + more / reach), tuck[1] * (1 + more / reach), y);
		through(girt(tucked - 0.09, last - 0.01, -0.003));
		through(girt(tucked - 0.045, last - 0.036, -GAP * 0.55));
		through(girt(tucked - 0.012, last - 0.03, -GAP * 0.9));
		through(drawn(last + 0.004, 0.001));
		through(drawn(last + PITCH + 0.004), true);
		through(drawn((last + PITCH + top) / 2), true);
		through(drawn(top + 0.004), true);
		through(drawn(top + R + 0.024, 0.003));
		through(drawn(top + R + 0.045, GAP));
		through(drawn(top + R + 0.026, 2 * GAP - 0.003));
		through(drawn(top - 0.004, 2 * GAP + 0.002));
		through(drawn(windingFoot, 2 * GAP + 0.002));
		const sway = between(-0.012, 0.012);
		for (const fall of [0.05, 0.11, 0.17]) {
			through(
				drawn(windingFoot - fall, 2 * GAP + 0.004 + fall * 0.08)
					.addScaledVector(out, (loopsOut - bundleOut) * fall * 2)
					.addScaledVector(side, sway * fall * 4)
			);
		}
	}

	// --- From those, the rope itself: a smooth line through them, as points close together.
	const smooth = new CatmullRomCurve3(line);
	const fine: Vector3[] = [];
	const fineHeld: boolean[] = [];
	for (let k = 0; k + 1 < line.length; k++) {
		const steps = Math.max(2, Math.ceil((line[k].distanceTo(line[k + 1]) / STEP) * 4));
		for (let n = 0; n < steps; n++) {
			fine.push(smooth.getPoint((k + n / steps) / (line.length - 1)));
			fineHeld.push(held[k] && held[k + 1]);
		}
	}
	fine.push(line[line.length - 1].clone());
	fineHeld.push(false);
	// Evenly spaced along it.
	const at: Vector3[] = [fine[0]];
	const fast: boolean[] = [false];
	let since = 0;
	for (let k = 1; k < fine.length; k++) {
		since += fine[k].distanceTo(fine[k - 1]);
		if (since >= STEP) {
			at.push(fine[k]);
			fast.push(fineHeld[k]);
			since = 0;
		}
	}
	if (since > STEP / 2) {
		at.push(fine[fine.length - 1]);
		fast.push(false);
	}

	// --- Let it settle. Rope cannot pass through rope, or through the rack: wherever two lengths
	// of it are closer than they can be, or one is in the tube or the peg, they are moved apart, a
	// little at a time, while the rope's own stiffness keeps it from kinking and its weight keeps it
	// near where it was hung. The parts pulled tight (over the peg and in the winding) do not move.
	const laid = at.map((p) => p.clone());
	const APART = 2 * R * 1.01;
	const NEAR = 6; // points this close along the rope are neighbours, not another strand
	const CELL = APART;
	const key = (x: number, y: number, z: number) => (x + 512) * 1048576 + (y + 512) * 1024 + (z + 512);
	const between2 = new Vector3();
	for (let pass = 0; pass < 36; pass++) {
		for (let k = 1; k + 1 < at.length; k++) {
			if (fast[k]) continue;
			const p = at[k];
			between2.addVectors(at[k - 1], at[k + 1]).multiplyScalar(0.5).sub(p);
			p.addScaledVector(between2, 0.22);
			p.addScaledVector(between2.subVectors(laid[k], p), 0.03);
		}
		// It does not stretch: each point keeps its distance from the next.
		for (let k = 0; k + 1 < at.length; k++) {
			if (fast[k] && fast[k + 1]) continue;
			const d = between2.subVectors(at[k + 1], at[k]).length();
			if (d < STEP * 1.15 || d < 1e-6) continue;
			between2.multiplyScalar((0.6 * (d - STEP * 1.15)) / d);
			const share = fast[k] ? 0 : fast[k + 1] ? 1 : 0.5;
			at[k].addScaledVector(between2, share);
			at[k + 1].addScaledVector(between2, share - 1);
		}
		for (let again = 0; again < 2; again++) {
			const cells = new Map<number, number[]>();
			at.forEach((p, k) => {
				const id = key(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL));
				if (!cells.has(id)) cells.set(id, []);
				cells.get(id)!.push(k);
			});
			for (let k = 0; k < at.length; k++) {
				const p = at[k];
				const [cx, cy, cz] = [Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL)];
				for (let dx = -1; dx <= 1; dx++) {
					for (let dy = -1; dy <= 1; dy++) {
						for (let dz = -1; dz <= 1; dz++) {
							for (const j of cells.get(key(cx + dx, cy + dy, cz + dz)) ?? []) {
								if (j <= k + NEAR || (fast[k] && fast[j])) continue;
								const q = at[j];
								const d = p.distanceTo(q);
								if (d >= APART || d < 1e-6) continue;
								const share = fast[k] ? 0 : fast[j] ? 1 : 0.5;
								between2.subVectors(p, q).multiplyScalar(((APART - d) / d) * 0.9);
								p.addScaledVector(between2, share);
								q.addScaledVector(between2, share - 1);
							}
						}
					}
				}
			}
		}
		for (let k = 0; k < at.length; k++) {
			if (fast[k]) continue;
			const p = at[k];
			// The tube.
			const d = Math.hypot(p.x, p.z);
			const clear = pole + R + 0.001;
			if (d < clear && d > 1e-6) {
				p.x *= clear / d;
				p.z *= clear / d;
			}
			// The peg.
			const t = Math.min(1, Math.max(0, between2.subVectors(p, root).dot(along) / COAT_RACK.long));
			between2.lerpVectors(root, tip, t).sub(p);
			const gap = between2.length();
			if (gap < peg.r + R && gap > 1e-6) p.addScaledVector(between2, 1 - (peg.r + R) / gap);
		}
	}

	// --- How much of the room's light each part of it gets. Where one strand lies against another
	// the room cannot be seen from between them, so the sides of a strand that face its neighbours
	// are dark and only its crown is fully lit, and so is whatever faces into the middle of the
	// coil. For each point along the rope: which way its near neighbours lie, and how near.
	const SHADE = 3.6 * R; // further off than this a strand shades nothing
	const boxes = new Map<number, number[]>();
	at.forEach((p, k) => {
		const id = key(Math.floor(p.x / SHADE), Math.floor(p.y / SHADE), Math.floor(p.z / SHADE));
		if (!boxes.has(id)) boxes.set(id, []);
		boxes.get(id)!.push(k);
	});
	const shaders = at.map((p, k) => {
		const found: number[] = []; // the way to each, and how much it shades: four numbers apiece
		const [cx, cy, cz] = [Math.floor(p.x / SHADE), Math.floor(p.y / SHADE), Math.floor(p.z / SHADE)];
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				for (let dz = -1; dz <= 1; dz++) {
					for (const j of boxes.get(key(cx + dx, cy + dy, cz + dz)) ?? []) {
						if (Math.abs(j - k) <= NEAR) continue;
						const d = p.distanceTo(at[j]);
						if (d >= SHADE || d < 1e-6) continue;
						const q = at[j];
						found.push((q.x - p.x) / d, (q.y - p.y) / d, (q.z - p.z) / d, Math.min(1, (SHADE - d) / (1.6 * R)));
					}
				}
			}
		}
		return found;
	});
	const coreOut = (bundleOut + loopsOut) / 2;
	const lit = (p: Vector3, k: number, nx: number, ny: number, nz: number) => {
		const found = shaders[k];
		let shade = 0;
		for (let n = 0; n < found.length; n += 4) {
			const facing = nx * found[n] + ny * found[n + 1] + nz * found[n + 2];
			if (facing > 0.2) shade += ((facing - 0.2) / 0.8) * found[n + 3];
		}
		shade = Math.min(1, shade / 3);
		if (p.y < windingTop) {
			const [x, z] = [out.x * coreOut - p.x, out.z * coreOut - p.z];
			const far = Math.hypot(x, z);
			if (far > R) shade = Math.max(shade, (0.9 * (nx * x + nz * z)) / far);
		}
		return 1 - 0.52 * shade;
	};

	// --- Its skin: a round tube along that line, the sheath's pattern going once round it and
	// repeating along it.
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const shades: number[] = [];
	const index: number[] = [];
	const heading = new Vector3();
	const a = new Vector3(1, 0, 0);
	const b = new Vector3();
	let run = 0;
	const runs: number[] = []; // how far along the rope each ring is
	const headings: Vector3[] = [];
	at.forEach((p, k) => {
		heading.subVectors(at[Math.min(k + 1, at.length - 1)], at[Math.max(k - 1, 0)]).normalize();
		headings.push(heading.clone());
		// The ring's own two directions are carried along from the ring before, so that the skin does not twist.
		a.addScaledVector(heading, -a.dot(heading));
		if (a.lengthSq() < 1e-8) a.set(0, 0, 1).addScaledVector(heading, -heading.z);
		a.normalize();
		b.crossVectors(heading, a);
		if (k > 0) run += p.distanceTo(at[k - 1]);
		runs.push(run);
		// A rope that has been coiled by hand is turned about its own length as it goes, a little this
		// way and a little that and on the whole one way, so the tracer does not come round to the
		// same side on every lap: without this the yellow lines up from strand to strand across the coil.
		const roll = 0.37 * run + 0.5 * Math.sin(1.7 * run + 1) + 0.3 * Math.sin(4.3 * run + 2.2);
		for (let n = 0; n <= SIDES; n++) {
			const turn = (n / SIDES) * TURN;
			const [ca, cb] = [Math.cos(turn), Math.sin(turn)];
			const [nx, ny, nz] = [a.x * ca + b.x * cb, a.y * ca + b.y * cb, a.z * ca + b.z * cb];
			positions.push(p.x + nx * R, p.y + ny * R, p.z + nz * R);
			normals.push(nx, ny, nz);
			uvs.push(n / SIDES + roll, run / TILE);
			const light = lit(p, k, nx, ny, nz);
			shades.push(light, light, light);
		}
		if (k > 0) {
			for (let n = 0; n < SIDES; n++) {
				const here = k * (SIDES + 1) + n;
				const back = here - (SIDES + 1);
				index.push(back, back + 1, here, back + 1, here + 1, here);
			}
		}
	});
	const skin = new BufferGeometry();
	skin.setAttribute('position', new Float32BufferAttribute(positions, 3));
	skin.setAttribute('normal', new Float32BufferAttribute(normals, 3));
	skin.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
	skin.setAttribute('color', new Float32BufferAttribute(shades, 3));
	skin.setIndex(index);
	const nylon = new MeshStandardMaterial({ map: sheath(false), bumpMap: sheath(true), bumpScale: 1.5, roughness: 0.85, vertexColors: true });

	// --- Its two ends: each cut and melted, which leaves a dark fused face, and bound a little way
	// back from the cut in a band of yellow heat-shrink. The band is shrunk onto the rope, so it is
	// made from the rope's own skin there, a little proud of it, and bends wherever the rope does.
	const ends = new MeshStandardMaterial({ roughness: 0.55, vertexColors: true });
	const BAND = { long: 0.045, back: 0.005, proud: 0.07 * R };
	const tinted = (geometry: BufferGeometry, [red, green, blue]: number[]) => {
		const tints: number[] = [];
		for (let n = 0; n < geometry.attributes.position.count; n++) tints.push(red, green, blue);
		return geometry.setAttribute('color', new Float32BufferAttribute(tints, 3));
	};
	const RING = SIDES + 1;
	// For each end, its band and its face, and for every point of them how far back from the cut it is.
	const sleeves = [0, at.length - 1].flatMap((k) => {
		const fromCut = (ring: number) => (k === 0 ? runs[ring] : run - runs[ring]);
		const rings = at.map((_, ring) => ring).filter((ring) => fromCut(ring) >= BAND.back && fromCut(ring) <= BAND.back + BAND.long);
		const [points, facing, backs, faces]: number[][] = [[], [], [], []];
		rings.forEach((ring, row) => {
			for (let n = 0; n < RING; n++) {
				const i = (ring * RING + n) * 3;
				const [nx, ny, nz] = [normals[i], normals[i + 1], normals[i + 2]];
				points.push(positions[i] + nx * BAND.proud, positions[i + 1] + ny * BAND.proud, positions[i + 2] + nz * BAND.proud);
				facing.push(nx, ny, nz);
				backs.push(fromCut(ring));
				if (row > 0 && n < SIDES) {
					const here = row * RING + n;
					const before = here - RING;
					faces.push(before, before + 1, here, before + 1, here + 1, here);
				}
			}
		});
		const band = new BufferGeometry();
		band.setAttribute('position', new Float32BufferAttribute(points, 3));
		band.setAttribute('normal', new Float32BufferAttribute(facing, 3));
		band.setAttribute('uv', new Float32BufferAttribute(new Array((points.length / 3) * 2).fill(0), 2));
		band.setIndex(faces);
		const inward = headings[k].clone().multiplyScalar(k === 0 ? 1 : -1);
		const face = new CylinderGeometry(R * 0.985, R * 0.985, 0.002, 12).applyQuaternion(new Quaternion().setFromUnitVectors(UP, inward)).translate(at[k].x, at[k].y, at[k].z);
		return [
			{ geometry: tinted(band, [0.87, 0.6, 0.04]), backs },
			{ geometry: tinted(face, [0.05, 0.012, 0.09]), backs: new Array<number>(face.attributes.position.count).fill(0) }
		];
	});

	const rope = new Group();
	const bound = mergeGeometries(sleeves.map((sleeve) => sleeve.geometry));
	const skinned = new Mesh(skin, nylon);
	rope.add(skinned, new Mesh(bound, ends));

	// --- The air from the door stirs the end that hangs loose below the winding, as it does the tie
	// and the fliers (see tie.ts), and in the same way: pushed away from the door and a little out
	// from the coil, further the further down, with a ripple running down it. A rope's end is far
	// heavier than a tie, so it goes a little over half as far, and the air reaches this corner later.
	// That end and the loops move: their rings in the skin, and the band and the cut face on the end.
	const LOOSE = 0.17; // how much of the rope's end hangs free
	const hinge = runs.findIndex((far) => run - far <= LOOSE);
	// The far end's band and face come after the near end's in the one mesh. Each point of them goes
	// exactly as the rope does where it is, by how far back from the cut it lies, so that the band
	// stays on the rope and is not carried through it.
	const bandFrom = sleeves[0].backs.length + sleeves[1].backs.length;
	const banded = bound.attributes.position;
	const bandShare = sleeves.flatMap((sleeve) => sleeve.backs).map((far, i) => (i < bandFrom ? 0 : 1 - far / LOOSE));
	// The loops are stirred too, all of them together and the same way, but less, being a bundle and
	// not one strand: nothing where they come out from under the winding, more the further down,
	// and most at the foot of the deepest. Everything at one height goes together, so that no strand
	// comes through another.
	const deepest = at.reduce((least, p) => Math.min(least, p.y), Infinity);
	const hangs = bundleFoot - deepest;
	const ringOf = (i: number) => Math.floor(i / RING);
	const stirred = [
		{ points: skin.attributes.position, from: hinge * RING, to: skin.attributes.position.count, give: 1, lag: 0.6, share: (i: number) => (runs[ringOf(i)] - runs[hinge]) / LOOSE },
		{ points: banded, from: bandFrom, to: banded.count, give: 1, lag: 0.6, share: (i: number) => bandShare[i] },
		{ points: skin.attributes.position, from: 0, to: hinge * RING, give: 0.7, lag: 0.75, share: (i: number) => (bundleFoot - at[ringOf(i)].y) / hangs }
	].map(({ points, from, to, give, lag, share }) => {
		// Only the points that move at all are kept, each with how far it goes: stiff near where it
		// is held, freer the further down.
		const moved: number[] = [];
		const weights: number[] = [];
		const downs: number[] = [];
		for (let i = from; i < to; i++) {
			const down = Math.min(1, Math.max(0, share(i)));
			if (down <= 0) continue;
			moved.push(i);
			downs.push(down);
			weights.push(down ** 1.6);
		}
		return { points, give, lag, moved, weights, downs, still: Float32Array.from(points.array) };
	});
	const swing = (t: number) => 0.027 * (0.65 + 0.25 * Math.sin(3.4 * t) + 0.12 * Math.sin(5.3 * t + 1));
	const pose = (t: number, strength: number) => {
		for (const { points, give, lag, moved, weights, downs, still } of stirred) {
			const blowing = air(t - lag) * strength * give;
			const aside = blowing * swing(t - lag);
			for (let n = 0; n < moved.length; n++) {
				const i = moved[n];
				const w = weights[n];
				const ripple = blowing * 0.003 * Math.sin(8 * (t - lag) - 5 * downs[n]);
				points.setXYZ(i, still[i * 3] + w * (aside + ripple), still[i * 3 + 1], still[i * 3 + 2] + w * blowing * 0.012);
			}
			points.needsUpdate = true;
		}
	};
	rope.userData.works = blown(skinned, pose);
	return rope;
}
