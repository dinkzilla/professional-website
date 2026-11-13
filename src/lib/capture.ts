// Shared by the page transitions (curtain.ts, roller.ts): both rasterise the visible page to an
// image and hand it to WebGL as a texture.

import { getFontEmbedCSS, toCanvas } from 'html-to-image';

let fontCSS: Promise<string> | undefined;

/** Whether a transition should run at all; if not, navigate normally. */
export function canAnimate(): boolean {
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
	return !!document.createElement('canvas').getContext('webgl');
}

/** Start the slow part of capturing (inlining the web fonts) ahead of the click. */
export function warm(): void {
	fontCSS ??= getFontEmbedCSS(document.body).catch(() => '');
}

/** The size to capture and draw at: the viewport in CSS pixels, and the device pixel ratio. */
export function viewport() {
	return {
		width: document.documentElement.clientWidth,
		height: window.innerHeight,
		ratio: Math.min(window.devicePixelRatio || 1, 2),
	};
}

/** Rasterise the part of the page that is currently on screen. */
export async function capture(width: number, height: number, ratio: number) {
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

// The grain overlay (body::after in work.css) doesn't survive the capture, and without it the
// page visibly loses its texture the moment the capture replaces it. Print the same tile onto
// the image, at the same opacity and anchored to the viewport as the real one is.
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

/** A canvas the size of the viewport, fixed over the page and transparent to the pointer. */
export function overlay(width: number, height: number, ratio: number): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(width * ratio);
	canvas.height = Math.round(height * ratio);
	canvas.setAttribute('aria-hidden', 'true');
	// Above the grain overlay (9999).
	canvas.style.cssText = `position:fixed;top:0;left:0;width:${width}px;height:${height}px;z-index:10001;pointer-events:none;`;
	return canvas;
}

export function compile(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed to compile');
	}
	return shader;
}

export function link(gl: WebGLRenderingContext, vertex: string, fragment: string) {
	const program = gl.createProgram()!;
	gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertex));
	gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) ?? 'program failed to link');
	}
	gl.useProgram(program);
	return program;
}

/** Upload the captured page as the bound 2D texture. */
export function upload(gl: WebGLRenderingContext, image: HTMLCanvasElement) {
	gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
