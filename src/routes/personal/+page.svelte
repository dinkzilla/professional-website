<script lang="ts">
	import { goto } from '$app/navigation';
	import { canonical, href } from '#lib/sides.ts';
	import { site } from '#lib/site.ts';

	// The "work stuff" link paints the work site over this page with a roller (see
	// #lib/roller.ts). The module is loaded when the link is first hovered or focused, not with
	// the page.
	let rolling = false;

	function warmRoller() {
		import('#lib/roller.ts').then((roller) => roller.warm());
	}

	async function rollPaint(event: MouseEvent) {
		// Leave new-tab clicks alone.
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		if (rolling) return;
		rolling = true;
		const href = (event.currentTarget as HTMLAnchorElement).pathname;
		let roll: (() => void) | undefined;
		try {
			const roller = await import('#lib/roller.ts');
			if (roller.canRoll()) roll = await roller.prepare();
		} catch {
			// No roller (capture or WebGL failed): just go.
		}
		await goto(href);
		roll?.();
		rolling = false;
	}
</script>

<svelte:head>
	<title>Personal | {site.name}</title>
	<link rel="canonical" href={canonical('personal', '/')} />
</svelte:head>

<p>
	<a
		href={href('work', '/')}
		onpointerenter={warmRoller}
		onfocus={warmRoller}
		onclick={rollPaint}>work stuff</a
	>
</p>

<style>
	/* Placeholder: just enough to see the link on the black page. */
	p {
		margin: 0;
		padding: 2rem;
	}

	a {
		color: #fff;
	}
</style>
