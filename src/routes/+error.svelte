<script lang="ts">
	import { page } from '$app/state';
	import { site } from '#lib/site.ts';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Page not found' : 'Error'} | {site.name}</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<h1 class="page-title">{page.status}</h1>
		<p class="tagline">
			{page.status === 404 ? "That page doesn't exist." : 'Something went wrong.'}
		</p>
		<p class="actions">
			<a class="button" href="/">Main</a>
			<a class="button" href="/blog/">Blog</a>
		</p>
	</header>
</div>

<style>
	.actions {
		display: flex;
		gap: 1rem;
		margin: 2rem 0 0;
	}
</style>
