// The curtain drop: the visible page is rasterised to an image, mapped onto a simulated sheet
// of cloth drawn over the viewport, and the sheet is torn from its top edge and falls away to
// reveal whatever has been rendered underneath in the meantime.
//
// Usage: `const drop = await prepare(clickX)` captures the page and puts the (still flat, so
// invisible) cloth over it; change the page underneath, then call `drop()`.

import { getFontEmbedCSS, toCanvas } from 'html-to-image';

const COLS = 40; // cloth cells across; rows follow from the viewport's aspect ratio
const STEP = 1 / 120; // s: fixed simulation timestep
const RELAX = 4; // constraint passes per step: more is stiffer cloth
const DAMPING = 0.996;
const RIP_S = 0.32; // s: how long the tear takes to travel across the top edge
const MAX_S = 4; // s: hard stop, in case the cloth somehow never leaves the screen
const Z_INDEX = 10001; // above the grain overlay (9999) and the black page (10000)

const VERTEX = `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform vec2 size;
uniform float eye;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
	// Positions are in CSS pixels, y down, z towards the viewer. The camera sits \`eye\` pixels in
	// front of the viewport's centre, so a flat sheet at z = 0 lands exactly on the page.
	float w = (eye - position.z) / eye;
	vec2 p = (position.xy - size * 0.5) / (size * 0.5);
	gl_Position = vec4(p.x, -p.y, -position.z / (2.0 * eye) * w, w);
	vUv = uv;
	vNormal = normal;
}`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D page;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
	vec3 n = normalize(vNormal);
	// Exactly 1.0 for a flat sheet facing the viewer, so the first frame matches the page.
	float shade = 1.0 - 0.75 * (1.0 - abs(n.z)) - 0.5 * (n.x * 0.4 + n.y * 0.6) * sign(n.z);
	shade = clamp(shade, 0.25, 1.2);
	// The back of the cloth shows the print faintly, like light through fabric.
	if (n.z < 0.0) shade *= 0.3;
	gl_FragColor = vec4(texture2D(page, vUv).rgb * shade, 1.0);
}`;

let fontCSS: Promise<string> | undefined;

/** Whether the animation should run at all; if not, navigate normally. */
export function canDrop(): boolean {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
	return !!document.createElement('canvas').getContext('webgl');
}

/** Start the slow part of capturing (inlining the web fonts) ahead of the click. */
export function warm(): void {
	fontCSS ??= getFontEmbedCSS(document.body).catch(() => '');
}

async function capture(width: number, height: number, ratio: number) {
	warm();
	const root = document.documentElement;
	const image = await toCanvas(document.body, {
		width,
		height,
		pixelRatio: ratio,
		fontEmbedCSS: await fontCSS,
		backgroundColor: getComputedStyle(root).backgroundColor,
		filter: (node) => node.tagName !== 'SCRIPT',
		// The clone is the whole body, shifted up so the scrolled-to part fills the image. The
		// height override keeps the body's own background (the dot grid) behind all of it.
		style: {
			margin: '0',
			width: `${width}px`,
			height: `${root.scrollHeight}px`,
			transform: `translateY(${-window.scrollY}px)`,
		},
	});
	await printGrain(image, ratio);
	return image;
}

// The grain overlay (body::after in app.css) doesn't survive the capture, and without it the
// page visibly loses its texture the moment the cloth appears. Print the same tile onto the
// image, at the same opacity and anchored to the viewport as the real one is.
async function printGrain(image: HTMLCanvasElement, ratio: number) {
	const grain = getComputedStyle(document.body, '::after');
	// Greedy on purpose: the tile is an SVG data URI with a `url(#…)` of its own inside it.
	const url = /^url\("(.*)"\)$/.exec(grain.backgroundImage)?.[1];
	const context = image.getContext('2d');
	if (!url || !context || grain.display === 'none') return;
	const tile = new Image();
	tile.src = url.replace(/\\"/g, '"');
	try {
		await tile.decode();
	} catch {
		return;
	}
	const pattern = context.createPattern(tile, 'repeat');
	if (!pattern) return;
	const scale = (parseFloat(grain.backgroundSize) || tile.width) / tile.width;
	context.save();
	context.globalAlpha = parseFloat(grain.opacity) || 0;
	context.scale(ratio * scale, ratio * scale);
	context.fillStyle = pattern;
	context.fillRect(0, 0, image.width, image.height);
	context.restore();
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed to compile');
	}
	return shader;
}

/**
 * Capture the visible page and lay it over the viewport as a flat sheet of cloth.
 * Resolves to a function that rips the sheet down, starting from the side nearest `originX`.
 */
export async function prepare(originX = 0): Promise<() => void> {
	const width = document.documentElement.clientWidth;
	const height = window.innerHeight;
	const ratio = Math.min(window.devicePixelRatio || 1, 2);
	const image = await capture(width, height, ratio);

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(width * ratio);
	canvas.height = Math.round(height * ratio);
	canvas.setAttribute('aria-hidden', 'true');
	canvas.style.cssText = `position:fixed;top:0;left:0;width:${width}px;height:${height}px;z-index:${Z_INDEX};pointer-events:none;`;

	const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
	if (!gl) throw new Error('WebGL unavailable');

	// --- The cloth: a grid of points joined by fixed-length links. ---
	const rows = Math.max(12, Math.min(64, Math.round((COLS * height) / width)));
	const nx = COLS + 1;
	const ny = rows + 1;
	const count = nx * ny;
	const pos = new Float32Array(count * 3);
	const prev = new Float32Array(count * 3);
	const normals = new Float32Array(count * 3);
	const uvs = new Float32Array(count * 2);
	for (let r = 0; r < ny; r++) {
		for (let c = 0; c < nx; c++) {
			const i = r * nx + c;
			pos[i * 3] = (c / COLS) * width;
			pos[i * 3 + 1] = (r / rows) * height;
			normals[i * 3 + 2] = 1;
			uvs[i * 2] = c / COLS;
			uvs[i * 2 + 1] = r / rows;
		}
	}
	prev.set(pos);

	// Links along the weave plus both diagonals of every cell, which resist shearing.
	const links: number[] = [];
	const rest: number[] = [];
	const link = (a: number, b: number) => {
		links.push(a, b);
		rest.push(
			Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1]),
		);
	};
	const indices: number[] = [];
	for (let r = 0; r < ny; r++) {
		for (let c = 0; c < nx; c++) {
			const i = r * nx + c;
			if (c < COLS) link(i, i + 1);
			if (r < rows) link(i, i + nx);
			if (c < COLS && r < rows) {
				link(i, i + nx + 1);
				link(i + 1, i + nx);
				indices.push(i, i + nx, i + 1, i + 1, i + nx, i + nx + 1);
			}
		}
	}

	// The top edge is pinned. The tear starts at the side nearest the click and runs across.
	const fromRight = originX > width / 2;
	const releaseAt = new Float32Array(nx);
	for (let c = 0; c < nx; c++) {
		releaseAt[c] = ((fromRight ? COLS - c : c) / COLS) * RIP_S;
	}

	// --- WebGL setup. ---
	const program = gl.createProgram()!;
	gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
	gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) ?? 'program failed to link');
	}
	gl.useProgram(program);

	const eye = Math.max(width, height) * 1.6;
	gl.uniform2f(gl.getUniformLocation(program, 'size'), width, height);
	gl.uniform1f(gl.getUniformLocation(program, 'eye'), eye);

	const attribute = (name: string, data: Float32Array, size: number, usage: number) => {
		const buffer = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, usage);
		const location = gl.getAttribLocation(program, name);
		gl.enableVertexAttribArray(location);
		gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
		return buffer;
	};
	attribute('uv', uvs, 2, gl.STATIC_DRAW);
	const normalBuffer = attribute('normal', normals, 3, gl.DYNAMIC_DRAW);
	const positionBuffer = attribute('position', pos, 3, gl.DYNAMIC_DRAW);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

	gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.enable(gl.DEPTH_TEST);
	gl.clearColor(0, 0, 0, 0);

	function updateNormals() {
		for (let r = 0; r < ny; r++) {
			for (let c = 0; c < nx; c++) {
				const l = (r * nx + Math.max(c - 1, 0)) * 3;
				const rt = (r * nx + Math.min(c + 1, COLS)) * 3;
				const u = (Math.max(r - 1, 0) * nx + c) * 3;
				const d = (Math.min(r + 1, rows) * nx + c) * 3;
				const ax = pos[rt] - pos[l];
				const ay = pos[rt + 1] - pos[l + 1];
				const az = pos[rt + 2] - pos[l + 2];
				const bx = pos[d] - pos[u];
				const by = pos[d + 1] - pos[u + 1];
				const bz = pos[d + 2] - pos[u + 2];
				const i = (r * nx + c) * 3;
				normals[i] = ay * bz - az * by;
				normals[i + 1] = az * bx - ax * bz;
				normals[i + 2] = ax * by - ay * bx;
			}
		}
	}

	function draw() {
		updateNormals();
		gl!.bindBuffer(gl!.ARRAY_BUFFER, normalBuffer);
		gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, normals);
		gl!.bindBuffer(gl!.ARRAY_BUFFER, positionBuffer);
		gl!.bufferSubData(gl!.ARRAY_BUFFER, 0, pos);
		gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
		gl!.drawElements(gl!.TRIANGLES, indices.length, gl!.UNSIGNED_SHORT, 0);
	}

	// --- Simulation: Verlet integration, then pull every link back to its rest length. ---
	const gravity = height * 3.2; // px/s²: scaled so the fall takes the same time on any screen
	const billow = gravity * 0.9;
	const zLimit = eye * 0.45;

	function step(t: number) {
		const dt2 = STEP * STEP;
		for (let i = 0; i < count; i++) {
			const c = i % nx;
			if (i < nx && t < releaseAt[c]) continue; // still pinned
			const x = i * 3;
			const y = x + 1;
			const z = x + 2;
			// Uneven push in and out of the screen, so the falling sheet buckles into folds
			// instead of sliding down as a rigid board.
			const push =
				billow * Math.sin(pos[x] * 0.011 + t * 5.3) * Math.cos(pos[y] * 0.008 - t * 3.7);
			const vx = (pos[x] - prev[x]) * DAMPING;
			const vy = (pos[y] - prev[y]) * DAMPING;
			const vz = (pos[z] - prev[z]) * DAMPING;
			prev[x] = pos[x];
			prev[y] = pos[y];
			prev[z] = pos[z];
			pos[x] += vx;
			pos[y] += vy + gravity * dt2;
			pos[z] = Math.max(-zLimit, Math.min(zLimit, pos[z] + vz + push * dt2));
		}
		for (let pass = 0; pass < RELAX; pass++) {
			for (let k = 0; k < rest.length; k++) {
				const a = links[k * 2];
				const b = links[k * 2 + 1];
				const a3 = a * 3;
				const b3 = b * 3;
				const dx = pos[b3] - pos[a3];
				const dy = pos[b3 + 1] - pos[a3 + 1];
				const dz = pos[b3 + 2] - pos[a3 + 2];
				const length = Math.hypot(dx, dy, dz) || 1;
				const aPinned = a < nx && t < releaseAt[a % nx];
				const bPinned = b < nx && t < releaseAt[b % nx];
				if (aPinned && bPinned) continue;
				// A pinned end doesn't move, so the free end takes the whole correction.
				const share = aPinned || bPinned ? 1 : 0.5;
				const f = ((length - rest[k]) / length) * share;
				if (!aPinned) {
					pos[a3] += dx * f;
					pos[a3 + 1] += dy * f;
					pos[a3 + 2] += dz * f;
				}
				if (!bPinned) {
					pos[b3] -= dx * f;
					pos[b3 + 1] -= dy * f;
					pos[b3 + 2] -= dz * f;
				}
			}
		}
	}

	function gone() {
		// Perspective enlarges anything nearer than the page, so leave a generous margin.
		for (let i = 0; i < count; i++) {
			if (pos[i * 3 + 1] < height * 1.35) return false;
		}
		return true;
	}

	function remove() {
		canvas.remove();
		gl!.getExtension('WEBGL_lose_context')?.loseContext();
	}

	draw();
	document.body.append(canvas);

	return () => {
		let simulated = 0;
		let last: number | undefined;
		let elapsed = 0;
		const frame = (now: number) => {
			// Cap the frame time so a stall (e.g. the page change underneath) doesn't make the
			// cloth jump ahead.
			elapsed += Math.min((now - (last ?? now)) / 1000, 1 / 30);
			last = now;
			while (simulated + STEP <= elapsed) {
				step(simulated);
				simulated += STEP;
			}
			draw();
			if (elapsed > MAX_S || gone()) remove();
			else requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);
	};
}
