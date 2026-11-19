// Khemmis, the ginger and white cat, asleep in his bed on top of the rack.

import { CylinderGeometry, Group, SphereGeometry, TorusGeometry, type Material } from 'three';
import { mid, ginger, white, mesh, horn } from '../parts.ts';
import type { Placement } from '../types.ts';

function catBed() {
	// A round bed with a padded rim, and a ginger and white cat curled up asleep in it, nose to
	// tail.
	const g = new Group();
	const R = 0.19; // to the middle of the rim
	const tube = 0.04;
	g.add(mesh(new CylinderGeometry(R, R, 0.03, 40), mid, 0, 0.015, 0));
	const rim = mesh(new TorusGeometry(R, tube, 16, 48), mid, 0, tube, 0);
	rim.rotation.x = Math.PI / 2;
	g.add(rim);

	const blob = (r: number, material: Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
		const m = mesh(new SphereGeometry(r, 24, 16), material, x, y, z);
		m.scale.set(sx, sy, sz);
		return m;
	};
	// Big enough to spill over the rim a little.
	const cat = new Group();
	cat.scale.setScalar(1.25);
	cat.position.y = 0.012;
	// The body, lying round the back of the bed, with a white patch over its flank and haunch.
	cat.add(blob(0.13, ginger, 0, 0.085, -0.03, 1.2, 0.62, 0.95));
	cat.add(blob(0.085, white, -0.05, 0.1, 0.0, 1.15, 0.72, 1.1));
	cat.add(blob(0.075, ginger, -0.1, 0.085, 0.03, 1, 0.75, 1)); // haunch
	// The head, tucked down at the front on its white chest and paws.
	cat.add(blob(0.06, white, 0.07, 0.065, 0.06, 1.2, 0.7, 1));
	cat.add(blob(0.062, ginger, 0.09, 0.105, 0.075, 1, 0.85, 1));
	cat.add(blob(0.03, white, 0.1, 0.09, 0.125, 1, 0.8, 0.8)); // muzzle
	for (const side of [-1, 1]) {
		const ear = horn(0.045, 0.022, ginger);
		ear.position.set(0.09 + side * 0.035, 0.14, 0.065);
		ear.rotation.z = -side * 0.25;
		cat.add(ear);
		cat.add(blob(0.02, white, 0.03 + side * 0.03, 0.05, 0.12, 1.3, 0.7, 1)); // paws
	}
	// The tail, wrapped round the front to the nose, with a white tip.
	const tail = mesh(new TorusGeometry(0.115, 0.02, 10, 32, 2.2), ginger, -0.02, 0.06, 0.02);
	tail.rotation.set(Math.PI / 2, 0, -2.75);
	cat.add(tail);
	cat.add(blob(0.022, white, -0.02 + 0.115 * Math.cos(-0.55), 0.06, 0.02 + 0.115 * Math.sin(0.55)));
	g.add(cat);
	return g;
}

export const khemmisPlacement: Placement = { id: 'cat', shelf: 0, x: -0.36, back: 0.26, yaw: 0.2, fixed: true, build: catBed };
