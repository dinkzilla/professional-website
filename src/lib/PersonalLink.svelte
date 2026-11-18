<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { prepareShelf } from '#lib/shelf/ready.ts';
	import { href } from '#lib/sides.ts';

	// A link from the work side to the personal side. Following it drops the whole page like a
	// curtain (see #lib/curtain.ts) to reveal the shelf behind.
	//
	// The shelf is a 3D scene that takes a while to download and build, so the link starts on it
	// in the background as soon as the browser is idle; by the time anyone clicks, it is normally
	// ready. If it is not, the click waits for it, however long that takes, and only goes ahead
	// without it if it fails.
	//
	// So that a click is answered at once, however long the rest takes, the link itself breaks
	// loose first: its words drop off the bottom of the screen and its arrow flies off the right.
	// The curtain falls once that has finished and the shelf is ready, whichever is later.

	let { class: className, children }: { class?: string; children: Snippet } = $props();

	$effect(() => {
		const start = () => prepareShelf().catch(() => {});
		if ('requestIdleCallback' in window) {
			const id = requestIdleCallback(start, { timeout: 3000 });
			return () => cancelIdleCallback(id);
		}
		const id = setTimeout(start, 1000);
		return () => clearTimeout(id);
	});

	// The curtain's module is loaded when the link is first hovered, pressed or focused.
	function warm() {
		import('#lib/curtain.ts').then((curtain) => curtain.warm());
	}

	let words: HTMLElement;
	let arrow: HTMLElement;

	const KNOCK_MS = 320; // how long the pieces are knocked about before they come away
	const FREE_FALL = 'cubic-bezier(0.33, 0, 0.67, 0.33)'; // constant acceleration from rest
	// What the copies take from the link, being outside it.
	const INHERITED = [
		'color',
		'fontFamily',
		'fontSize',
		'fontStretch',
		'fontStyle',
		'fontVariationSettings',
		'fontWeight',
		'letterSpacing',
		'lineHeight'
	] as const;

	/**
	 * Knock a piece twice, then send it `distance` px away at `acceleration` px/s². `pose` gives
	 * its transform for how far it has been shaken (1 is the first knock) and has travelled.
	 */
	function launch(
		piece: HTMLElement,
		distance: number,
		acceleration: number,
		pose: (shake: number, travel: number) => string
	) {
		const total = KNOCK_MS + Math.sqrt((2 * distance) / acceleration) * 1000;
		const at = (ms: number) => ms / total;
		return piece.animate(
			[
				{ offset: 0, transform: pose(0, 0), easing: 'ease-out' },
				{ offset: at(50), transform: pose(1, 0), easing: 'ease-in-out' },
				{ offset: at(110), transform: pose(0.55, 0), easing: 'ease-in-out' },
				{ offset: at(170), transform: pose(0.8, 0) },
				{ offset: at(KNOCK_MS - 40), transform: pose(0.8, 0), easing: 'ease-out' },
				{ offset: at(KNOCK_MS), transform: pose(1.4, 0), easing: FREE_FALL },
				{ offset: 1, transform: pose(4, distance) }
			],
			{ duration: total, fill: 'forwards' }
		);
	}

	/**
	 * The link breaks loose and leaves the screen; resolves when it has gone. What moves is a copy
	 * of each piece, in a layer over the whole page: the pieces themselves are only hidden, so the
	 * page keeps its shape, and the picture the curtain takes of it has a gap where the link was.
	 */
	async function breakLoose(link: HTMLElement) {
		const layer = document.createElement('div');
		layer.setAttribute('aria-hidden', 'true');
		// Left out of the curtain's picture of the page (see #lib/capture.ts).
		layer.setAttribute('data-capture-skip', '');
		// Above the curtain (10001), which is laid over the page while these are still in the air.
		layer.style.cssText =
			'position:fixed;inset:0;z-index:10002;overflow:hidden;pointer-events:none;';
		const from = getComputedStyle(link);
		for (const property of INHERITED) layer.style[property] = from[property];

		const copy = (piece: HTMLElement) => {
			const box = piece.getBoundingClientRect();
			const twin = piece.cloneNode(true) as HTMLElement;
			twin.style.cssText = `position:absolute;left:${box.left}px;top:${box.top}px;white-space:pre;will-change:transform;`;
			layer.append(twin);
			return { box, twin };
		};
		const falling = copy(words);
		const flying = copy(arrow);
		document.body.append(layer);
		words.style.visibility = arrow.style.visibility = 'hidden';

		// The words hang by their left end as the right comes away, then drop.
		falling.twin.style.transformOrigin = 'left center';
		const flights = [
			launch(
				falling.twin,
				window.innerHeight - falling.box.top + falling.box.height,
				6000,
				(shake, travel) => `translateY(${travel}px) rotate(${shake * 6}deg)`
			),
			// The arrow is knocked back, further each time, then shoots off.
			launch(
				flying.twin,
				document.documentElement.clientWidth - flying.box.left + 16,
				9000,
				(shake, travel) => `translateX(${travel - shake * 4}px)`
			)
		];
		try {
			await Promise.all(flights.map((flight) => flight.finished));
		} finally {
			layer.remove();
		}
	}

	let dropping = false;

	async function drop(event: MouseEvent) {
		// Leave new-tab clicks alone.
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		if (dropping) return;
		dropping = true;
		const link = event.currentTarget as HTMLAnchorElement;
		const target = link.pathname;
		// Kept here because the bindings are cleared when the page goes.
		const pieces = [words, arrow];
		// Started before the curtain takes its picture of the page, which must not have the link
		// in it.
		const loose = window.matchMedia('(prefers-reduced-motion: reduce)').matches
			? undefined
			: breakLoose(link).catch(() => {});
		let fall: (() => void) | undefined;
		try {
			const curtain = await import('#lib/curtain.ts');
			if (curtain.canDrop()) fall = await curtain.prepare(event.clientX);
		} catch {
			// No curtain (capture or WebGL failed): just go.
		}
		// With the shelf ready, the personal page shows it as it mounts.
		await prepareShelf().catch(() => {});
		await loose;
		await goto(target);
		fall?.();
		// For a navigation that did not happen: normally this page has gone by now.
		for (const piece of pieces) piece.style.visibility = '';
		dropping = false;
	}
</script>

<a
	class={className}
	href={href('personal', '/')}
	onpointerenter={warm}
	onpointerdown={warm}
	onfocus={warm}
	onclick={drop}
	><span class="piece" bind:this={words}>{@render children()}</span>
	<span class="piece" bind:this={arrow}>→</span></a
>

<style>
	/* Boxes a full line high, as their copies are, so that a copy sits exactly over its piece. */
	.piece {
		display: inline-block;
	}
</style>
