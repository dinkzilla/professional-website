// The cassette player in the rack, and the cable from it to the amp.

import { CatmullRomCurve3, ExtrudeGeometry, Shape, TubeGeometry, Vector2, Vector3 } from 'three';
import {
	light,
	dark,
	plugGreen,
	rubberGreen,
	screen,
	mesh,
	box,
	round,
	plugged,
	PANEL,
	PANEL_HEIGHT,
	panel
} from '../parts.ts';
import { RACK_DEPTH, BOARD, STANDOFF, LEGS, AMP_JACK } from '../rack.ts';
import type { Placement } from '../types.ts';

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

export const cassettePlacement: Placement = { id: 'cassette', shelf: 3, x: 0, flush: PANEL_HEIGHT, fixed: true, build: cassettePlayer };
