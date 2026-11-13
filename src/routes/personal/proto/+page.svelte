<script lang="ts">
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { items } from '#lib/shelf/items.ts';
	import type { Layout } from '#lib/shelf/scene.ts';
	import { href } from '#lib/sides.ts';
	import { site } from '#lib/site.ts';

	// Grey-box prototype of the personal side: a shelving unit of block-out objects. The scene
	// (and three.js with it) is loaded here in the browser, not with the rest of the site.

	let canvas: HTMLCanvasElement;
	let labels: HTMLElement;
	let probe: HTMLElement;
	let shelf: ReturnType<typeof import('#lib/shelf/scene.ts').createShelf> | undefined = $state();
	let layout: Layout = $state({ mode: 'tall', unitRight: 0, contentPx: 0 });
	let extra = $state(false);
	let showLabels = $state(true);

	// Which object is picked up lives in the history entry, so Back puts it down.
	const picked = $derived(items.find((item) => item.id === page.state.picked));

	function tap(id: string | null) {
		if (id) pushState('', { picked: id });
		else if (page.state.picked) history.back();
	}

	$effect(() => {
		let destroyed = false;
		import('#lib/shelf/scene.ts').then(({ createShelf }) => {
			if (destroyed) return;
			shelf = createShelf({
				canvas,
				labels,
				fitHeight: () => probe.clientHeight,
				onLayout: (next) => (layout = next),
				onTap: tap
			});
		});
		return () => {
			destroyed = true;
			shelf?.destroy();
			shelf = undefined;
		};
	});

	$effect(() => shelf?.pick(picked?.id ?? null));
	$effect(() => shelf?.setShelves(extra ? 5 : 4));

	// The page does not scroll while something is held.
	$effect(() => {
		document.documentElement.classList.toggle('shelf-held', !!picked);
		return () => document.documentElement.classList.remove('shelf-held');
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') tap(null);
	}
</script>

<svelte:head>
	<title>Shelf prototype | {site.name}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="probe" bind:this={probe}></div>
<canvas bind:this={canvas}></canvas>
<div class="labels" class:off={!showLabels} bind:this={labels}></div>

<!-- Gives the document its height, so the unit scrolls like ordinary page content. -->
<div class="spacer" style:height="{layout.contentPx}px"></div>

{#if picked}
	<aside class="panel {layout.mode}" style:--unit-right="{layout.unitRight}px">
		<button class="close" onclick={() => tap(null)} aria-label="Put it back">×</button>
		<h2>{picked.label}</h2>
		<p>{picked.blurb}</p>
		{#if picked.id === 'work'}
			<p><a href={href('work', '/')}>Go to the work site →</a></p>
		{/if}
	</aside>
{/if}

<form class="controls">
	<label><input type="checkbox" bind:checked={extra} /> 5th shelf</label>
	<label><input type="checkbox" bind:checked={showLabels} /> labels</label>
</form>

<style>
	:global(:root.shelf-held) {
		overflow: hidden;
	}

	/* Measures the viewport as it is with the browser's bars showing, which does not change as
	   they slide away; the canvas covers the viewport with them hidden. */
	.probe {
		position: fixed;
		top: 0;
		left: 0;
		width: 0;
		height: 100svh;
		visibility: hidden;
	}

	canvas,
	.labels {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100lvh;
	}

	canvas {
		display: block;
	}

	.labels {
		overflow: hidden;
		pointer-events: none;
		transition: opacity 0.3s;

		&.off,
		&:global(.held) {
			opacity: 0;
		}

		:global(span) {
			position: absolute;
			top: 0;
			left: 0;
			color: #8f8a82;
			font: 10px/1 'Martian Mono Variable', ui-monospace, monospace;
			letter-spacing: 0.04em;
			white-space: nowrap;
		}
	}

	.spacer {
		pointer-events: none;
	}

	.panel {
		position: fixed;
		z-index: 1;
		padding: 1.25rem 1.5rem 1.5rem;
		color: #e9e5dd;
		background: rgb(18 17 16 / 0.92);
		border: 1px solid #3a352f;
		font: 1rem/1.5 system-ui, sans-serif;

		h2 {
			margin: 0 2rem 0.5rem 0;
			font-size: 1.25rem;
		}

		p {
			margin: 0 0 0.75rem;
		}

		a {
			color: #f0c040;
		}

		/* Under the object, as a sheet rising from the bottom. */
		&.tall {
			inset: auto 0 0;
			min-height: 46svh;
			border-width: 1px 0 0;
		}

		/* On the wall to the right of the unit, the object being in front of the unit. */
		&.side {
			top: 50svh;
			left: calc(var(--unit-right) + 2rem);
			width: min(24rem, 100% - var(--unit-right) - 3rem);
			transform: translateY(-50%);
		}
	}

	.close {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 2.75rem;
		height: 2.75rem;
		color: inherit;
		background: none;
		border: 0;
		font-size: 1.5rem;
		cursor: pointer;
	}

	.controls {
		position: fixed;
		z-index: 2;
		top: 0.5rem;
		left: 0.5rem;
		display: flex;
		gap: 0.75rem;
		color: #8f8a82;
		font: 11px/1 ui-monospace, monospace;

		label {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}
	}
</style>
