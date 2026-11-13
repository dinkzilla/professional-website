<script lang="ts">
	import '#lib/styles/personal.css';
	import { page } from '$app/state';
	import { site } from '#lib/site.ts';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Page not found' : 'Error'} | {site.name}</title>
</svelte:head>

<!-- A placeholder until the personal side has a design. -->
<main class="side-personal">
	<h1>{page.status}</h1>
</main>

<style>
	main {
		display: grid;
		place-items: center;
		min-height: 100dvh;
	}

	h1 {
		margin: 0;
		color: #fff;
		font: 700 4rem system-ui, sans-serif;
	}
</style>
