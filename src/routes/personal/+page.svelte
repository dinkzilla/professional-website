<script lang="ts">
	import { site } from '#lib/site.ts';

	// Blacks out the document itself (see html.void in app.css) so overscroll is black too,
	// and undoes it when navigating away.
	$effect(() => {
		document.documentElement.classList.add('void');
		return () => document.documentElement.classList.remove('void');
	});
</script>

<svelte:head>
	<title>Personal | {site.name}</title>
</svelte:head>

<!-- Covers the purple page and the grain in the prerendered HTML, before the effect runs. -->
<div class="void"></div>

<style>
	.void {
		position: fixed;
		inset: 0;
		z-index: 10000;
		background: #000;
	}
</style>
