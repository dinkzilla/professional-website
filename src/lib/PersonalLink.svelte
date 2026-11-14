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

	let dropping = false;

	async function drop(event: MouseEvent) {
		// Leave new-tab clicks alone.
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		if (dropping) return;
		dropping = true;
		const target = (event.currentTarget as HTMLAnchorElement).pathname;
		let fall: (() => void) | undefined;
		try {
			const curtain = await import('#lib/curtain.ts');
			if (curtain.canDrop()) fall = await curtain.prepare(event.clientX);
		} catch {
			// No curtain (capture or WebGL failed): just go.
		}
		// With the shelf ready, the personal page shows it as it mounts.
		await prepareShelf().catch(() => {});
		await goto(target);
		fall?.();
		dropping = false;
	}
</script>

<a
	class={className}
	href={href('personal', '/')}
	onpointerenter={warm}
	onpointerdown={warm}
	onfocus={warm}
	onclick={drop}>{@render children()}</a
>
