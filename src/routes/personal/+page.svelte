<script lang="ts">
	import { goto, pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { catalogue } from '#lib/shelf/catalogue.ts';
	import { prepareShelf } from '#lib/shelf/ready.ts';
	import type { Layout, Shelf } from '#lib/shelf/scene.ts';
	import { canonical, href } from '#lib/sides.ts';
	import { site } from '#lib/site.ts';

	// The personal side is a shelving unit of objects, one per project, each of which comes forward
	// when picked (see #lib/shelf/scene.ts). For now the objects are grey-box stand-ins. The scene
	// is not part of this page: it is built separately, often before the page is visited (see
	// #lib/shelf/ready.ts), and put here when the page mounts.

	let stage: HTMLElement;
	let probe: HTMLElement;
	let shelf: Shelf | undefined = $state();
	let layout: Layout = $state({ mode: 'tall', unitRight: 0 });

	// Which object is picked up lives in the history entry, so Back puts it down.
	const picked = $derived(catalogue.find((entry) => entry.id === page.state.picked));

	function tap(id: string | null) {
		// The tie is the way back to the work side: it is not picked up.
		if (id === 'tie') rollToWork();
		else if (id) pushState('', { picked: id });
		else if (page.state.picked) history.back();
	}

	$effect(() => {
		let gone = false;
		prepareShelf()
			.then((prepared) => {
				if (gone) return;
				prepared.attach(stage, {
					fitHeight: () => probe.clientHeight,
					onLayout: (next) => (layout = next),
					onTap: tap
				});
				shelf = prepared;
				// The roller is loaded now, ahead of a tap on the tie.
				import('#lib/roller.ts').then((roller) => roller.warm());
			})
			.catch(() => {
				// No scene (it failed to load, or there is no WebGL): the page stays empty for now.
			});
		return () => {
			gone = true;
			shelf?.detach();
			shelf = undefined;
		};
	});

	$effect(() => shelf?.pick(picked?.id ?? null));

	// A tap on the tie paints the work site over this page with a roller (see #lib/roller.ts).
	let rolling = false;
	const work = href('work', '/');

	async function rollToWork() {
		if (rolling) return;
		rolling = true;
		let roll: (() => void) | undefined;
		// The roller takes a picture of the page, in which the scene's own canvas would be blank,
		// so a copy of it stands in while the picture is taken.
		const copy = shelf?.snapshot();
		if (copy) shelf?.canvas.after(copy);
		try {
			const roller = await import('#lib/roller.ts');
			if (roller.canRoll()) roll = await roller.prepare();
		} catch {
			// No roller (capture or WebGL failed): just go.
		}
		copy?.remove();
		await goto(work);
		roll?.();
		rolling = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') tap(null);
	}
</script>

<svelte:head>
	<title>Personal | {site.name}</title>
	<link rel="canonical" href={canonical('personal', '/')} />
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<!-- The tie is only in the picture: this is the same way out for a keyboard or a screen reader,
     out of sight until it has the focus. -->
<a
	class="way-out"
	href={work}
	onclick={(event) => {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		rollToWork();
	}}>Go to the work site →</a
>

<div class="probe" bind:this={probe}></div>
<!-- The scene puts its canvas in here. -->
<div class="stage" bind:this={stage}></div>

{#if picked}
	<aside class="panel {layout.mode}" style:--unit-right="{layout.unitRight}px">
		<button class="close" onclick={() => tap(null)} aria-label="Put it back">×</button>
		<h2>{picked.label}</h2>
		<p>{picked.blurb}</p>
	</aside>
{/if}

<style>
	/* Nothing here scrolls, and no touch is a scroll, pinch or pull-to-refresh: with nothing to
	   scroll against, a phone browser leaves its bars where they are. */
	:global(:root:has(.stage)) {
		height: 100%;
		overflow: hidden;
		touch-action: none;
	}

	/* Measures the viewport as it is with the browser's bars showing; the canvas covers the
	   viewport with them hidden, so a bar that does move overlaps the scene, not resizes it. */
	.probe {
		position: fixed;
		top: 0;
		left: 0;
		width: 0;
		height: 100svh;
		visibility: hidden;
	}

	/* The canvas is the scene's own element, so this rule reaches it as a global inside the
	   stage. */
	.stage :global(canvas) {
		display: block;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100lvh;
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

	.way-out {
		position: fixed;
		z-index: 2;
		top: 0.75rem;
		left: 0.75rem;
		padding: 0.5rem 0.75rem;
		color: #f0c040;
		background: rgb(18 17 16 / 0.92);
		border: 1px solid #3a352f;
		font: 1rem/1.5 system-ui, sans-serif;

		&:not(:focus-visible) {
			width: 1px;
			height: 1px;
			padding: 0;
			overflow: hidden;
			clip-path: inset(50%);
			border: 0;
			white-space: nowrap;
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
</style>
