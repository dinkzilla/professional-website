// The paint roller: the visible page is rasterised to an image and laid over the viewport, then
// it is painted away in long, slightly tilted, overlapping strokes, as if by a roller (which is
// not itself drawn), revealing whatever has been rendered underneath in the meantime. Every stroke
// runs up the screen, and they go on in order from the left edge to the right.
//
// Usage: `const roll = await prepare()` captures the page and covers it with the (so far
// unpainted, so invisible) image; change the page underneath, then call `roll()`.

import { canAnimate, capture, link, overlay, upload, viewport, warm } from '#lib/capture.ts';

export { canAnimate as canRoll, warm };

const MAX_STROKES = 7; // must match N in the shader
const SPACING = 280; // px: roughly how far apart neighbouring strokes sit
const OVERLAP = 28; // px: the least any stroke overlaps its neighbour, at their widest gap
const RAGGED = 5; // px: how far a stroke's ragged edge can fall short of its nominal width
const MAX_TILT = (9 * Math.PI) / 180; // strokes lean up to this far off vertical
const TILT_SHARE = 0.35; // ...but never drift sideways by more than this share of the spacing
const TOTAL_S = 1.4; // s: the whole job, before the per-stroke limits below
const MIN_STROKE_S = 0.22;
const MAX_STROKE_S = 0.34;

const VERTEX = `
attribute vec2 position;
void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}`;

// Everything is worked out per pixel, in CSS pixels with y down. A stroke is a band around a
// line: `lines` holds where the line starts and its direction, `marks` how wide the band is
// and how far along it the paint has got.
const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define N ${MAX_STROKES}
uniform sampler2D page;
uniform vec2 size;
uniform float ratio;
uniform vec4 lines[N]; // start.xy, direction.xy
uniform vec3 marks[N]; // half width, length painted so far, seed

float hash(float n) {
	return fract(sin(n) * 43758.5453);
}

float noise(float x) {
	float i = floor(x);
	float f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(hash(i), hash(i + 1.0), f);
}

void main() {
	vec2 p = vec2(gl_FragCoord.x / ratio, size.y - gl_FragCoord.y / ratio);

	// How much of this pixel has been painted over, by any stroke.
	float painted = 0.0;
	for (int i = 0; i < N; i++) {
		vec2 dir = lines[i].zw;
		vec2 d = p - lines[i].xy;
		float along = dot(d, dir);
		float across = dot(d, vec2(-dir.y, dir.x));
		// Each side of the band wanders in and out a little, the way a roller's edge does.
		float side = marks[i].z + sign(across) * 31.7;
		float edge = marks[i].x
			- ${RAGGED.toFixed(1)} * (0.6 * noise(along * 0.035 + side) + 0.4 * noise(along * 0.3 + side));
		float covered = clamp(edge - abs(across) + 0.5, 0.0, 1.0)
			* clamp(marks[i].y - along + 0.5, 0.0, 1.0);
		painted = max(painted, covered);
	}

	// Premultiplied: painted pixels are clear, so the page underneath shows through.
	gl_FragColor = vec4(texture2D(page, p / size).rgb, 1.0) * (1.0 - painted);
}`;

type Stroke = {
	x: number; // where the stroke starts, beyond the bottom of the screen
	y: number;
	dx: number; // unit direction of travel
	dy: number;
	length: number; // how far the stroke runs, from off one end of the screen to off the other
	seed: number;
};

/**
 * Lay out the strokes for a viewport. The widths are worked out from the spacing and the
 * steepest tilt so that neighbours overlap along their whole length, whichever way each leans,
 * and the outermost strokes overhang the sides of the screen.
 */
function plan(width: number, height: number) {
	const perSide = Math.max(1, Math.min(3, Math.round((width / SPACING - 1) / 2)));
	const count = 2 * perSide + 1;
	const spacing = (width - OVERLAP) / count;
	const maxTan = Math.min(Math.tan(MAX_TILT), (TILT_SHARE * spacing) / (height / 2));
	const drift = (height / 2) * maxTan; // how far a stroke's ends sit to the side of its middle
	const halfWidth = spacing / 2 + drift + OVERLAP / 2 + RAGGED;
	// Far enough past the screen's edge that the slanted end of the band is out of sight when a
	// stroke starts and ends.
	const margin = halfWidth * maxTan + 8;

	// Left to right across the screen.
	const lean = Math.random() < 0.5 ? 1 : -1;
	const strokes: Stroke[] = [];
	for (let k = 0; k < count; k++) {
		const step = k - perSide;
		const tan = (k % 2 === 0 ? lean : -lean) * maxTan * (0.5 + 0.5 * Math.random());
		const norm = Math.hypot(tan, 1);
		// Every stroke runs upwards, from below the screen to above it.
		const dx = -tan / norm;
		const dy = -1 / norm;
		const length = (height + 2 * margin) * norm;
		strokes.push({
			x: width / 2 + step * spacing - (dx * length) / 2,
			y: height / 2 - (dy * length) / 2,
			dx,
			dy,
			length,
			seed: Math.random() * 100,
		});
	}
	return { strokes, halfWidth };
}

/**
 * Capture the visible page and lay it over the viewport.
 * Resolves to a function that paints it away, from left to right.
 */
export async function prepare(): Promise<() => void> {
	const { width, height, ratio } = viewport();
	const image = await capture(width, height, ratio);
	const canvas = overlay(width, height, ratio);

	const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
	if (!gl) throw new Error('WebGL unavailable');

	const program = link(gl, VERTEX, FRAGMENT);
	const uniform = (name: string) => gl.getUniformLocation(program, name);
	gl.uniform2f(uniform('size'), width, height);
	gl.uniform1f(uniform('ratio'), canvas.height / height);

	// One quad over the whole canvas; the fragment shader does the rest.
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
	const position = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

	upload(gl, image);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clearColor(0, 0, 0, 0);

	const { strokes, halfWidth } = plan(width, height);
	const strokeS = Math.max(MIN_STROKE_S, Math.min(MAX_STROKE_S, TOTAL_S / strokes.length));

	const lines = new Float32Array(MAX_STROKES * 4);
	const marks = new Float32Array(MAX_STROKES * 3);
	strokes.forEach((stroke, i) => {
		lines.set([stroke.x, stroke.y, stroke.dx, stroke.dy], i * 4);
		marks.set([halfWidth, -1e4, stroke.seed], i * 3);
	});
	// Unused slots need a direction too, and a band that covers nothing.
	for (let i = strokes.length; i < MAX_STROKES; i++) {
		lines.set([0, 0, 0, 1], i * 4);
		marks.set([0, -1e4, 0], i * 3);
	}
	gl.uniform4fv(uniform('lines'), lines);

	const marksAt = uniform('marks');

	/** Draw the wall as it is `t` seconds into the job. */
	function draw(t: number) {
		const current = Math.floor(t / strokeS);
		strokes.forEach((stroke, i) => {
			let head = -1e4;
			if (i < current) head = stroke.length;
			else if (i === current) {
				// Mostly steady, easing a little into and out of each stroke.
				const f = t / strokeS - current;
				head = stroke.length * (0.4 * f + 0.6 * f * f * (3 - 2 * f));
			}
			marks[i * 3 + 1] = head;
		});
		gl!.uniform3fv(marksAt, marks);
		gl!.clear(gl!.COLOR_BUFFER_BIT);
		gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
	}

	function remove() {
		canvas.remove();
		gl!.getExtension('WEBGL_lose_context')?.loseContext();
	}

	draw(-1);
	document.body.append(canvas);

	return () => {
		let last: number | undefined;
		let elapsed = 0;
		const frame = (now: number) => {
			// Cap the frame time so a stall (e.g. the page change underneath) doesn't make the
			// stroke jump ahead.
			elapsed += Math.min((now - (last ?? now)) / 1000, 1 / 30);
			last = now;
			if (elapsed >= strokes.length * strokeS) return remove();
			draw(elapsed);
			requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);
	};
}
