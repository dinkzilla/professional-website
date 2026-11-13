// The paint roller: the visible page is rasterised to an image and laid over the viewport, then
// a roller paints it away in long, slightly tilted, overlapping strokes, revealing whatever has
// been rendered underneath in the meantime. The first stroke runs down the middle of the screen
// and the rest widen the painted patch outwards, a stroke on one side then one on the other,
// until it runs off both edges.
//
// Usage: `const roll = await prepare(clickX)` captures the page and covers it with the (so far
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
const FALLBACK_PAINT = [0.29, 0.16, 0.62];

const VERTEX = `
attribute vec2 position;
void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}`;

// Everything is worked out per pixel, in CSS pixels with y down. A stroke is a band around a
// line: `lines` holds where the line starts and its direction, `marks` how wide the band is
// and how far along it the roller has got.
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
uniform vec4 roller; // centre.xy, direction of travel.xy
uniform vec3 rollerSize; // half length, radius (0 while it is off the wall), distance rolled
uniform vec3 paint;

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
	vec4 color = vec4(texture2D(page, p / size).rgb, 1.0) * (1.0 - painted);

	if (rollerSize.y > 0.0) {
		vec2 dir = roller.zw;
		vec2 perp = vec2(-dir.y, dir.x);
		float halfLength = rollerSize.x;
		float radius = rollerSize.y;

		// A soft shadow, cast down and to the right, over both the old page and the new.
		vec2 s = p - roller.xy - vec2(5.0, 8.0);
		float shadow = 0.4
			* (1.0 - smoothstep(halfLength - 4.0, halfLength + 10.0, abs(dot(s, perp))))
			* (1.0 - smoothstep(radius - 4.0, radius + 12.0, abs(dot(s, dir))));
		color = vec4(color.rgb * (1.0 - shadow), shadow + color.a * (1.0 - shadow));

		// The roller itself: a cylinder lying across the stroke, lit from the top left.
		vec2 d = p - roller.xy;
		float u = dot(d, perp);
		float v = dot(d, dir);
		float mask = clamp(halfLength - abs(u) + 0.5, 0.0, 1.0) * clamp(radius - abs(v) + 0.5, 0.0, 1.0);
		float t = clamp(v / radius, -1.0, 1.0);
		vec3 normal = vec3(dir * t, sqrt(1.0 - t * t));
		float light = max(dot(normal, normalize(vec3(-0.4, -0.6, 0.7))), 0.0);
		// The nap: a speckle fixed to the roller's surface, so it visibly turns as it rolls.
		vec2 cell = floor(vec2(u, asin(t) * radius + rollerSize.z) * 0.5);
		float nap = 0.94 + 0.12 * hash(dot(cell, vec2(12.9898, 78.233)));
		vec3 surface = paint * (0.4 + 0.8 * light) * nap + 0.18 * pow(light, 24.0);
		color = mix(color, vec4(surface, 1.0), mask);
	}

	gl_FragColor = color;
}`;

type Stroke = {
	x: number; // where the stroke starts, beyond the top or bottom of the screen
	y: number;
	dx: number; // unit direction of travel
	dy: number;
	length: number; // how far the roller travels, from off one end of the screen to off the other
	seed: number;
};

/**
 * Lay out the strokes for a viewport. The widths are worked out from the spacing and the
 * steepest tilt so that neighbours overlap along their whole length, whichever way each leans,
 * and the outermost strokes overhang the sides of the screen.
 */
function plan(width: number, height: number, originX: number) {
	const perSide = Math.max(1, Math.min(3, Math.round((width / SPACING - 1) / 2)));
	const count = 2 * perSide + 1;
	const spacing = (width - OVERLAP) / count;
	const maxTan = Math.min(Math.tan(MAX_TILT), (TILT_SHARE * spacing) / (height / 2));
	const drift = (height / 2) * maxTan; // how far a stroke's ends sit to the side of its middle
	const halfWidth = spacing / 2 + drift + OVERLAP / 2 + RAGGED;
	const radius = Math.max(14, Math.min(30, halfWidth * 0.14));
	// Far enough past the screen's edge that the roller, its shadow and the slanted end of the
	// band are all out of sight when a stroke starts and ends.
	const margin = radius + halfWidth * maxTan + 24;

	// Middle first, then alternating sides, starting on the side that was clicked.
	const first = originX > width / 2 ? 1 : -1;
	const lean = Math.random() < 0.5 ? 1 : -1;
	const strokes: Stroke[] = [];
	for (let k = 0; k < count; k++) {
		const step = Math.ceil(k / 2) * (k % 2 === 1 ? first : -first);
		const tan = (k % 2 === 0 ? lean : -lean) * maxTan * (0.5 + 0.5 * Math.random());
		const norm = Math.hypot(tan, 1);
		const down = k % 2 === 0 ? 1 : -1; // down, up, down, ...
		const dx = (down * tan) / norm;
		const dy = down / norm;
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
	return { strokes, halfWidth, radius };
}

/** The colour of the page that is now underneath, which is what the roller is loaded with. */
function paintColor(): number[] {
	const channels = getComputedStyle(document.documentElement).backgroundColor.match(/[\d.]+/g);
	if (!channels || channels.length < 3 || channels[3] === '0') return FALLBACK_PAINT;
	return channels.slice(0, 3).map((channel) => parseFloat(channel) / 255);
}

/**
 * Capture the visible page and lay it over the viewport.
 * Resolves to a function that paints it away, working outwards from the middle and taking the
 * side nearest `originX` first.
 */
export async function prepare(originX = 0): Promise<() => void> {
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

	const { strokes, halfWidth, radius } = plan(width, height, originX);
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
	const rollerAt = uniform('roller');
	const rollerSizeAt = uniform('rollerSize');

	/** Draw the wall as it is `t` seconds into the job. */
	function draw(t: number) {
		const current = Math.floor(t / strokeS);
		let onWall = false;
		strokes.forEach((stroke, i) => {
			let head = -1e4;
			if (i < current) head = stroke.length;
			else if (i === current) {
				// Mostly steady, easing a little into and out of each stroke.
				const f = t / strokeS - current;
				head = stroke.length * (0.4 * f + 0.6 * f * f * (3 - 2 * f));
				gl!.uniform4f(
					rollerAt,
					stroke.x + stroke.dx * head,
					stroke.y + stroke.dy * head,
					stroke.dx,
					stroke.dy,
				);
				gl!.uniform3f(rollerSizeAt, halfWidth, radius, head);
				onWall = t >= 0;
			}
			marks[i * 3 + 1] = head;
		});
		if (!onWall) gl!.uniform3f(rollerSizeAt, 0, 0, 0);
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
		gl.uniform3fv(uniform('paint'), paintColor());
		let last: number | undefined;
		let elapsed = 0;
		const frame = (now: number) => {
			// Cap the frame time so a stall (e.g. the page change underneath) doesn't make the
			// roller jump ahead.
			elapsed += Math.min((now - (last ?? now)) / 1000, 1 / 30);
			last = now;
			if (elapsed >= strokes.length * strokeS) return remove();
			draw(elapsed);
			requestAnimationFrame(frame);
		};
		requestAnimationFrame(frame);
	};
}
