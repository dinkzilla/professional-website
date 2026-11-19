// The mains wiring, and the ribbon cable up the back of the rack.
//
// A power strip lies on the floor between the rack and the door, plugged into the lower half of
// the outlet on the wall. Three things are plugged into it and its fourth socket, the one nearest
// the viewer, is empty: the amp, by way of a power brick on the floor in front of it; the tv; and
// the rack itself. The strip, the amp's lead and the rack's are all on the floor, so they are part
// of the room (see room.ts). The tv's lead goes from the floor to the top of the rack, and the
// ribbon from one bay of it to another, so those two are built with the rack, whose heights are
// only known there (see scene.ts).
//
// Everything is placed by eye, in the room's coordinates: x along the back wall from the rack's
// middle, y up from the floor, z out from the wall.

import {
	BoxGeometry,
	BufferGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CylinderGeometry,
	DoubleSide,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshStandardMaterial,
	Quaternion,
	SRGBColorSpace,
	TubeGeometry,
	Vector3,
	type Material
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { bent, settle, solid } from './cable.ts';
import { BOARD, LEGS, RACK_DEPTH, RACK_WIDTH, STANDOFF } from './items.ts';

type Point = [number, number, number];

const ivory = new MeshStandardMaterial({ color: 0xe6e2d6, roughness: 0.6 }); // the strip, its cord and its plug
const recess = new MeshStandardMaterial({ color: 0xc9c5b8, roughness: 0.7 }); // the face of each of its sockets
const rubber = new MeshStandardMaterial({ color: 0x141416, roughness: 0.7 }); // everything plugged into it
const moulded = new MeshStandardMaterial({ color: 0x3b3b42, roughness: 0.4 }); // their plugs, a shade off the leads
const slot = new MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 });
// The strip's switch is lit, which is how it shows that it is on. So is the light on the brick.
const rocker = new MeshStandardMaterial({ color: 0xd9281c, roughness: 0.4, emissive: 0xff2a14, emissiveIntensity: 0.7 });
const lamp = new MeshStandardMaterial({ color: 0x3fe06a, roughness: 0.5, emissive: 0x3fe06a, emissiveIntensity: 1 });

const LEAD = 0.011; // the radius of a mains lead
const PLUG = { w: 0.07, h: 0.075, d: 0.052, relief: 0.04 }; // a plug's body, and the sleeve the lead leaves it by
const PLUG_OUT = PLUG.h + PLUG.relief - 0.004; // how far from a socket's face the lead starts

// The amp, as it stands in the room (see items.ts): its middle, and its size.
const AMP_BOX = { x: -1.22, z: 0.31, w: 1.2, h: 1, d: 0.5 };
const STRIP = { x: 0.9, z: 0.86, yaw: -0.35, w: 0.13, h: 0.065, l: 0.62 };
// Where along the strip its sockets are, from the end its cord is at.
const SOCKETS = [-0.13, -0.025, 0.08, 0.185];

/** A round cable through these points. */
function lead(points: (Point | Vector3)[], material: Material, r = LEAD) {
	const path = new CatmullRomCurve3(points.map((p) => (p instanceof Vector3 ? p : new Vector3(...p))));
	return new Mesh(new TubeGeometry(path, Math.ceil(path.getLength() / 0.012), r, 10), material);
}

function block(w: number, h: number, d: number, material: Material, x: number, y: number, z: number) {
	const m = new Mesh(new BoxGeometry(w, h, d), material);
	m.position.set(x, y, z);
	return m;
}

/**
 * A mains plug standing in a socket whose face is the plane y = 0: a moulded body, and on top of
 * it the sleeve its lead leaves by, which the lead comes out of at PLUG_OUT.
 */
function plug(material: Material) {
	const g = new Group();
	const body = new Mesh(new RoundedBoxGeometry(PLUG.w, PLUG.h, PLUG.d, 3, 0.012), material);
	body.position.y = PLUG.h / 2 - 0.004;
	const sleeve = new Mesh(new CylinderGeometry(LEAD + 0.003, 0.02, PLUG.relief, 16), material);
	sleeve.position.y = PLUG.h - 0.004 + PLUG.relief / 2;
	g.add(body, sleeve);
	return g;
}

/** Where a point given in a group's own coordinates is in those of whatever the group is in. */
const from = (g: Group, x: number, y: number, z: number) => new Vector3(x, y, z).applyQuaternion(g.quaternion).add(g.position);

/**
 * The strip and all that lies on the floor with it, for a room whose outlet has the middle of its
 * lower receptacle's face at `outlet`. `tv` is where the tv's lead leaves its plug: the lead
 * itself is built with the rack (see rackWiring).
 */
export function powerStrip(outlet: Vector3) {
	const group = new Group();

	// The strip, built lying along z with its cord at the far end, then turned askew.
	const strip = new Group();
	strip.position.set(STRIP.x, 0, STRIP.z);
	strip.rotation.y = STRIP.yaw;
	strip.updateMatrix();
	group.add(strip);
	const body = new Mesh(new RoundedBoxGeometry(STRIP.w, STRIP.h, STRIP.l, 3, 0.014), ivory);
	body.position.y = STRIP.h / 2;
	strip.add(body);
	// Its sockets are set across it, not along: the earth pin toward the door, so that what is
	// plugged in hangs off the side the rack is on.
	for (const z of SOCKETS) {
		const socket = new Group();
		socket.position.set(0, STRIP.h, z);
		socket.rotation.y = Math.PI / 2;
		socket.add(block(0.09, 0.003, 0.082, recess, 0, 0, 0));
		for (const x of [-0.016, 0.016]) socket.add(block(0.007, 0.002, 0.026, slot, x, 0.002, 0.008));
		const earth = new Mesh(new CylinderGeometry(0.0065, 0.0065, 0.002, 12), slot);
		earth.position.set(0, 0.002, -0.022);
		socket.add(earth);
		strip.add(socket);
	}
	// The switch, at the cord's end: a rocker in a dark surround, pressed down at its far side.
	const SWITCH = -0.24;
	strip.add(block(0.064, 0.004, 0.084, slot, 0, STRIP.h, SWITCH));
	const key = block(0.048, 0.018, 0.068, rocker, 0, STRIP.h + 0.004, SWITCH);
	key.rotation.x = 0.14;
	strip.add(key);
	// The sleeve its cord leaves by.
	const END = { y: 0.032, sleeve: 0.05 };
	const sleeve = new Mesh(new CylinderGeometry(0.021, 0.015, END.sleeve, 16), ivory);
	sleeve.rotation.x = Math.PI / 2;
	sleeve.position.set(0, END.y, -STRIP.l / 2 - END.sleeve / 2 + 0.004);
	strip.add(sleeve);

	// Three things plugged in, in all but the socket nearest the viewer: the rack's plug, the tv's,
	// and the amp's, which is not a plug with a lead out of its top but a wall wart: a flat block
	// that overhangs the strip on the rack's side, with its lead leaving the low end of that side
	// straight out through a stiff sleeve.
	const [rack, tv] = SOCKETS.slice(0, 2).map((z) => {
		const p = plug(moulded);
		p.position.set(0, STRIP.h, z);
		p.rotation.y = Math.PI / 2; // turned as the sockets are
		strip.add(p);
		return from(strip, 0, STRIP.h + PLUG_OUT, z);
	});
	const WART = { w: 0.135, h: 0.075, d: 0.088, off: -0.022, sleeve: 0.05 };
	const wart = new Mesh(new RoundedBoxGeometry(WART.w, WART.h, WART.d, 3, 0.012), moulded);
	wart.position.set(WART.off, STRIP.h + WART.h / 2 - 0.002, SOCKETS[2]);
	strip.add(wart);
	// The way its lead leaves it, and where: from the middle of its side, the sleeve first.
	const slanting = new Vector3(-1, 0, 0); // straight out of that side
	const exit = new Vector3(WART.off - WART.w / 2 + 0.004, STRIP.h + 0.032, SOCKETS[2]);
	const relief = new Mesh(new CylinderGeometry(0.019, LEAD + 0.003, WART.sleeve, 16), moulded);
	relief.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), slanting);
	relief.position.copy(exit).addScaledVector(slanting, WART.sleeve / 2);
	strip.add(relief);
	const ampOut = slanting.clone().applyQuaternion(strip.quaternion);
	const amp = from(strip, exit.x, exit.y, exit.z).addScaledVector(ampOut, WART.sleeve - 0.004);
	const lying = LEAD + 0.001; // the height of a lead's middle where it lies on the floor

	// The strip's own cord, to its plug in the wall. The plug stands out of the receptacle, and
	// the cord droops from it to the floor and comes along that to the strip.
	const mains = plug(ivory);
	mains.position.copy(outlet).setY(outlet.y - 0.002);
	mains.rotation.x = Math.PI / 2;
	group.add(mains);
	const wallPlug = new Vector3(outlet.x, outlet.y - 0.002, outlet.z + PLUG_OUT);
	const along = (x: number, y: number, z: number) => new Vector3(x, y, z).applyQuaternion(strip.quaternion);
	const body3 = solid(STRIP.x, STRIP.h / 2, STRIP.z, STRIP.w, STRIP.h, STRIP.l, STRIP.yaw);
	const leg = solid(RACK_WIDTH / 2 + BOARD - 0.025, LEGS / 2, STANDOFF + RACK_DEPTH - 0.025, 0.06, LEGS, 0.06); // the rack's front right one
	group.add(
		lead(
			settle({
				from: wallPlug,
				out: new Vector3(0, 0, 1),
				to: from(strip, 0, END.y, -STRIP.l / 2 - END.sleeve + 0.006),
				into: along(0, 0, 1),
				// Down to the floor first, so that it is lying on it when it gets to the strip.
				via: [
					new Vector3(outlet.x, outlet.y - 0.1, wallPlug.z + 0.105),
					new Vector3(outlet.x, 0.1, wallPlug.z + 0.12),
					from(strip, 0, lying + 0.004, -STRIP.l / 2 - END.sleeve - 0.07)
				],
				slack: 0.01,
				weight: 2,
				r: LEAD + 0.001,
				wall: 0
			}),
			ivory,
			LEAD + 0.001
		)
	);

	// The rack's lead: off the strip on the rack's side, across the floor between the rack's two
	// right-hand legs, and up through the underside of its bottom board.
	const under = LEGS; // the underside of the rack's bottom board
	const gland = new Vector3(0.46, under, 0.45);
	group.add(
		lead(
			settle({
				from: rack,
				out: new Vector3(0, 1, 0),
				to: gland,
				into: new Vector3(0, 1, 0),
				via: [
					rack.clone().add(new Vector3(-0.04, 0.045, -0.09)),
					new Vector3(0.84, lying, 0.5),
					new Vector3(0.7, lying, 0.44),
					new Vector3(0.56, lying, 0.47)
				],
				slack: 0.03,
				hold: 0.035,
				bend: 0.06,
				weight: 1.6,
				r: LEAD,
				wall: 0,
				solids: [body3, leg]
			}),
			rubber
		)
	);
	const grommet = new Mesh(new CylinderGeometry(0.024, 0.024, 0.014, 16), rubber);
	grommet.position.copy(gland).setY(under - 0.007);
	group.add(grommet);

	// The amp's lead: off the strip to the left, clear of the empty socket, down onto the floor in
	// front of the rack's leg, and along the
	// floor in front of the rack, on the viewer's side of the cable that runs from the cassette
	// player to the amp (see items.ts), to a power brick on the floor in front of the amp.
	const brick = new Group();
	brick.position.set(-1.3, 0, 0.98);
	brick.rotation.y = -0.3;
	group.add(brick);
	const BRICK = { w: 0.26, h: 0.075, d: 0.12, sleeve: 0.04 };
	const casing = new Mesh(new RoundedBoxGeometry(BRICK.w, BRICK.h, BRICK.d, 3, 0.014), rubber);
	casing.position.y = BRICK.h / 2;
	brick.add(casing);
	for (const side of [-1, 1]) {
		const end = new Mesh(new CylinderGeometry(0.019, 0.013, BRICK.sleeve, 16), rubber);
		end.rotation.z = (side * Math.PI) / 2;
		end.position.set(side * (BRICK.w / 2 + BRICK.sleeve / 2 - 0.004), BRICK.h / 2, 0);
		brick.add(end);
	}
	brick.add(block(0.014, 0.003, 0.014, lamp, BRICK.w / 2 - 0.035, BRICK.h, 0.03));
	const brickEnd = BRICK.w / 2 + BRICK.sleeve - 0.01;
	const amplifier = solid(AMP_BOX.x, AMP_BOX.h / 2, AMP_BOX.z, AMP_BOX.w, AMP_BOX.h, AMP_BOX.d);
	const side = (x: number) => new Vector3(x, 0, 0).applyQuaternion(brick.quaternion);
	// This one is not left to settle but laid out (see bent in cable.ts), so that it bends at the
	// one radius all the way: straight out of the wart's sleeve, down and round to the floor in
	// front of the rack's leg, and along.
	const clear = amp.clone().addScaledVector(ampOut, 0.065); // straight out of the sleeve this far before it turns
	const landing = clear.clone().add(new Vector3(-0.9, 0, 0.44).normalize().multiplyScalar(0.12)).setY(lying);
	group.add(
		lead(
			bent(
				[
					amp,
					clear,
					landing,
					[new Vector3(0.36, lying, 1.29), 0.4],
					[new Vector3(-0.78, lying, 1.38), 0.4],
					[from(brick, brickEnd + 0.16, lying, 0), 0.12],
					from(brick, brickEnd, BRICK.h / 2, 0)
				],
				0.075
			),
			rubber
		)
	);
	// And on from the brick, a thinner lead: along the floor, round the amp's far side and in
	// behind it.
	group.add(
		lead(
			settle({
				from: from(brick, -brickEnd, BRICK.h / 2, 0),
				out: side(-1),
				to: new Vector3(-1.68, 0.2, 0.032),
				into: new Vector3(0, 1, 0),
				via: [new Vector3(-1.8, 0.009, 0.8), new Vector3(-1.9, 0.009, 0.4), new Vector3(-1.87, 0.009, 0.06)],
				slack: 0.02,
				r: 0.008,
				bend: 0.035,
				stiff: 0.3,
				wall: 0,
				solids: [amplifier]
			}),
			rubber,
			0.008
		)
	);

	return { group, tv };
}

// A ribbon cable's ten wires, in the order they always come in: the resistor colour code.
const RAINBOW = ['#7a4a21', '#d42a2a', '#f07d1a', '#f2d21b', '#2fa84f', '#2a6fd6', '#8a3fc2', '#8f8f93', '#ecebe6', '#1b1b1d'];
let rainbow: MeshStandardMaterial | undefined;

function ribbonMaterial() {
	if (rainbow) return rainbow;
	const PX = 16; // to a wire
	const canvas = document.createElement('canvas');
	canvas.width = RAINBOW.length * PX;
	canvas.height = 4;
	const c = canvas.getContext('2d')!;
	RAINBOW.forEach((colour, i) => {
		c.fillStyle = colour;
		c.fillRect(i * PX, 0, PX, 4);
		// The groove between one wire and the next.
		c.fillStyle = 'rgba(0, 0, 0, 0.35)';
		c.fillRect(i * PX, 0, 2, 4);
	});
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	map.anisotropy = 8;
	return (rainbow = new MeshStandardMaterial({ map, roughness: 0.6, side: DoubleSide }));
}

/** A flat cable this wide along these points, its width lying along x all the way. */
function ribbon(points: Point[], width: number) {
	const path = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
	const n = Math.ceil(path.getLength() / 0.01);
	const at: number[] = [];
	const uv: number[] = [];
	const faces: number[] = [];
	path.getSpacedPoints(n).forEach((p, i) => {
		at.push(p.x - width / 2, p.y, p.z, p.x + width / 2, p.y, p.z);
		// Brown is at the right, which is the edge that shows past the amp.
		uv.push(1, i / n, 0, i / n);
		if (i < n) faces.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
	});
	const strip = new BufferGeometry();
	strip.setAttribute('position', new Float32BufferAttribute(at, 3));
	strip.setAttribute('uv', new Float32BufferAttribute(uv, 2));
	strip.setIndex(faces);
	strip.computeVertexNormals();
	return new Mesh(strip, ribbonMaterial());
}

// As the mounted gear and the tv are built (see items.ts): how far behind the front of its panel
// the back of each case is, and where under the hump on the tv's back its power goes in, from the
// middle of its foot.
const CASE = { video: 0.312, cassette: 0.512 };
const TV_INLET = new Vector3(0.2, 0.269, -0.095);

/**
 * The wiring that is built with the rack, in the scene's coordinates (the wall is z = 0, as in the
 * room's, but heights are from the scene's origin): the tv's lead and the ribbon. `floor`, `top`, `video` and
 * `cassette` are heights: of the floor, of the rack's top, and of the bottom edges of the two
 * mounted panels. `tv` is where the tv stands and how it is turned, and `plug` is where its lead
 * leaves the power strip, from the floor.
 */
export function rackWiring(at: {
	floor: number;
	top: number;
	video: number;
	cassette?: number;
	tv: { position: Vector3; rotation: Quaternion };
	plug: Vector3;
}) {
	const group = new Group();
	const side = RACK_WIDTH / 2 + BOARD; // the rack's right-hand side

	// The tv's lead hangs free. Its plug hangs under the hump on the tv's back, behind the panel;
	// the lead drops from that onto the rack's top, goes over the right-hand edge, and hangs in
	// the air from there down to its plug in the strip.
	const onTv = (x: number, y: number, z: number) => new Vector3(x, y, z).applyQuaternion(at.tv.rotation).add(at.tv.position);
	const inlet = plug(moulded);
	inlet.position.copy(onTv(TV_INLET.x, TV_INLET.y, TV_INLET.z));
	inlet.quaternion.copy(at.tv.rotation).multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI));
	group.add(inlet);
	const socket = at.plug.clone().setY(at.floor + at.plug.y);
	const tall = at.top - at.floor - LEGS;
	group.add(
		lead(
			settle({
				from: onTv(TV_INLET.x, TV_INLET.y - PLUG_OUT, TV_INLET.z),
				out: new Vector3(0, -1, 0),
				to: socket,
				into: new Vector3(0, -1, 0),
				via: [new Vector3(side - 0.04, at.top + 0.03, 0.285), new Vector3(side + 0.05, at.top - 0.1, 0.275)],
				slack: 0.008,
				hold: 0.04,
				stiff: 0.9,
				r: LEAD,
				floor: at.floor,
				wall: 0,
				// The rack, all of it but its legs, as one box.
				solids: [solid(0, at.top - tall / 2, STANDOFF + RACK_DEPTH / 2, 2 * side + 0.012, tall, RACK_DEPTH)]
			}),
			rubber
		)
	);

	// The ribbon: out of the back of the cassette player, up the front face of the rack's back
	// left post, and off the post in a slow curve up and forward into the back of the video
	// module. Each end has a connector as wide as the ribbon, and two ties hold it to the post.
	if (at.cassette !== undefined) {
		const RIBBON = 0.07;
		const post = { x: -(side - 0.025), z: STANDOFF + 0.055 + 0.003 }; // the post's middle, and just off its front face
		const front = STANDOFF + RACK_DEPTH + 0.008; // the fronts of the panels
		const high = { x: -0.485, y: at.video + 0.2, z: front - CASE.video };
		const low = { x: -0.485, y: at.cassette + 0.1, z: front - CASE.cassette };
		group.add(
			ribbon(
				[
					[low.x, low.y, low.z],
					[low.x - 0.01, low.y + 0.004, low.z - 0.03],
					[low.x - 0.04, low.y + 0.04, low.z - 0.085],
					[post.x + 0.01, low.y + 0.12, post.z + 0.02],
					[post.x, low.y + 0.2, post.z],
					[post.x, (low.y + high.y) / 2 - 0.1, post.z],
					[post.x, high.y - 0.3, post.z],
					[post.x + 0.002, high.y - 0.25, post.z + 0.005],
					[post.x + 0.012, high.y - 0.195, post.z + 0.04],
					[post.x + 0.035, high.y - 0.125, post.z + 0.125],
					[post.x + 0.06, high.y - 0.06, post.z + 0.22],
					[post.x + 0.08, high.y - 0.018, post.z + 0.295],
					[high.x, high.y - 0.004, high.z - 0.03],
					[high.x, high.y, high.z]
				],
				RIBBON
			)
		);
		for (const end of [low, high]) group.add(block(RIBBON + 0.024, 0.034, 0.04, rubber, end.x, end.y, end.z - 0.02));
		for (const y of [high.y - 0.33, (low.y + high.y) / 2 - 0.12]) {
			group.add(block(RIBBON + 0.006, 0.014, 0.006, rubber, post.x, y, post.z + 0.001));
		}
	}

	group.traverse((o) => {
		if (!(o instanceof Mesh)) return;
		o.castShadow = true;
		// Not the ribbon, most of which is in the shadow of the rack, where its colours would be lost.
		o.receiveShadow = o.material !== rainbow;
	});
	return group;
}
