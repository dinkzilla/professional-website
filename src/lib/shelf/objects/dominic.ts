// Dominic, the grey and white cat, asleep (room.ts places him; he is put away for now).

import { CapsuleGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type Material } from 'three';

/**
 * Grey and white and a little fat, flat out on his side with his belly toward the room and his
 * legs anywhere. Built oversize, lying along x with his head at +x and his belly toward +z.
 */
export function dominic() {
	const fur = new MeshStandardMaterial({ color: 0x8b8e94, roughness: 0.95 });
	const snow = new MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.95 });
	const cat = new Group();
	const blob = (r: number, material: Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
		const m = new Mesh(new SphereGeometry(r, 24, 16), material);
		m.position.set(x, y, z);
		m.scale.set(sx, sy, sz);
		cat.add(m);
	};
	/** A leg or tail from this point, this long, pointing this way. */
	const limb = (r: number, length: number, material: Material, from: Vector3, toward: Vector3) => {
		const m = new Mesh(new CapsuleGeometry(r, length, 4, 10), material);
		const way = toward.clone().normalize();
		m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), way);
		m.position.copy(from).addScaledVector(way, length / 2);
		cat.add(m);
	};
	blob(0.2, fur, 0, 0.2, -0.03, 1.9, 1, 1.15); // his back and sides
	blob(0.19, snow, -0.02, 0.19, 0.06, 1.65, 0.92, 1.1); // the belly, which is most of him
	blob(0.13, fur, 0.43, 0.14, 0.03); // head, on the floor
	blob(0.075, snow, 0.47, 0.12, 0.11, 1, 0.8, 1); // muzzle and chin
	for (const [x, y] of [
		[0.5, 0.25],
		[0.4, 0.27]
	]) {
		const ear = new Mesh(new ConeGeometry(0.045, 0.09, 4), fur);
		ear.position.set(x, y, 0);
		cat.add(ear);
	}
	limb(0.035, 0.2, snow, new Vector3(0.24, 0.24, 0.16), new Vector3(0.5, 0.7, 0.6)); // front legs
	limb(0.035, 0.22, snow, new Vector3(0.26, 0.07, 0.16), new Vector3(0.6, 0, 0.8));
	limb(0.04, 0.22, snow, new Vector3(-0.24, 0.26, 0.16), new Vector3(-0.4, 0.75, 0.55)); // hind legs
	limb(0.04, 0.24, fur, new Vector3(-0.28, 0.07, 0.14), new Vector3(-0.7, 0, 0.7));
	limb(0.03, 0.34, fur, new Vector3(-0.36, 0.05, -0.06), new Vector3(-0.9, 0, 0.35)); // tail
	return cat;
}
